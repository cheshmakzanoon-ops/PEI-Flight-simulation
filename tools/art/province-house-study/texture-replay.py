"""Compare real WebGL textures, screenshots and browser timings to frozen E.
Usage: python texture-replay.py /path/to/instrumented/E/dist ./dist --trials 5
Both builds have the same QA-only boot timestamps, and only F requests the local worker.
The source device is the cloud browser (SwiftShader). Timings are not GPU/FPS claims.
"""
from argparse import ArgumentParser
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
from statistics import median
from PIL import Image
from playwright.sync_api import sync_playwright
import io, json, os
import numpy as np

TAP = r'''(() => {
 const P=WebGL2RenderingContext.prototype;
 const contexts=new Map(); const details=new Map();
 const stats={ mip:0,shapes:[],uploadBytes:0};
 const sizeOfFormat=new Map([[0x8058,4],[0x8c43,4],[0x822b,2],[0x8229,1]]);
 const refs=(gl)=>{if(!contexts.has(gl))contexts.set(gl,{unit:gl.TEXTURE0,t:new Map()});return contexts.get(gl);};
 for(const [name,hook] of Object.entries({
   activeTexture(gl,[unit]){refs(gl).unit=unit},
   bindTexture(gl,[target,texture]){const a=refs(gl);a.t.set(a.unit+':'+target,texture)},
   deleteTexture(gl,[tex]){details.delete(tex)},
   texStorage2D(gl,[target,levels,internal,w,h]) {
     if(target!==gl.TEXTURE_2D||!sizeOfFormat.has(internal)||![512,1024,1536].includes(w)||h!==w/2)return;
     levels=Math.trunc(levels); // WebGL receives a GLint, not Three's unrounded log2 value.
     const a=refs(gl),tex=a.t.get(a.unit+':'+target);let bytes=0;
     for(let i=0;i<levels;i++)bytes+=Math.max(1,w>>i)*Math.max(1,h>>i)*sizeOfFormat.get(internal);
     details.set(tex,{width:w,height:h,format:internal,levels,bytes,base:w*h*sizeOfFormat.get(internal),subUploads:0});
   },
   texSubImage2D(gl,args){const a=refs(gl),d=details.get(a.t.get(a.unit+':'+args[0]));if(d)d.subUploads++},
 })){
   const old=P[name];P[name]=function(...a){const b=old.apply(this,a);hook(this,a);return b;};
 }
 window.stoneGlMemory=()=>{const records=Array.from(details.values()).sort((a,b)=>a.width-b.width||a.format-b.format);return {maps:records.length,bytes:records.reduce((v,m)=>v+m.bytes,0),base:records.reduce((v,m)=>v+m.base,0),records};};
})();'''

class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_): pass

def local(dir):
 s=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(dir.resolve())))
 Thread(target=s.serve_forever,daemon=True).start()
 return s

def init(page,url):
 page.add_init_script(TAP)
 errors=[]; loaded=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
 page.on('response',lambda r: loaded.append([r.status,r.url.partition(url)[2]]))
 page.goto(url,wait_until='load',timeout=40000)
 page.wait_for_function('()=>!!window.porticoBoot',timeout=15000)
 page.evaluate('()=>porticoBoot.ready')
 return errors,loaded

def boot(page):
 return page.evaluate('''()=>{ const b=porticoBoot;return {
   firstMs:b.firstRenderEnd-b.phaseStart, prepareMs:b.prepareEnd-b.phaseStart,
   firstDrawMs:b.firstRenderEnd-b.firstRenderStart, finishedMs:b.texturedEnd-b.phaseStart,
   firstFromNavigationMs:b.firstRenderEnd,texturedFromNavigationMs:b.texturedEnd,
   decodeMs:b.texturePrepare?Object.values(b.texturePrepare).reduce((a,x)=>a+x,0):(b.result?.bakeMs??null),
   detail:b.result??null, gl:stoneGlMemory()
 };}''')

def frame(page,pose,lod,enable=True):
 counters=page.evaluate('([on,p,c,l])=>portico.render(on,p,c,l)',[enable,pose,pose not in ('capital','fly'),lod]);
 pic=page.locator('canvas').screenshot(animations='disabled',type='png',timeout=35000)
 return Image.open(io.BytesIO(pic)).convert('RGB'),counters

def compare(a,b,has_sky):
 g=np.asarray(a).astype(np.float64);h=np.asarray(b).astype(np.float64);d=np.abs(g-h);v=d.max(axis=2)
 count=v.size;qd=np.percentile(v,[50,90,95,99,99.9,100]);mse=(d*d).mean();protected=v[:85,:64] if has_sky else np.zeros((0,0),dtype=v.dtype)
 return {'total':count,'exact':int((v==0).sum()),'above2':int((v>2).sum()),'above5':int((v>5).sum()),'above12':int((v>12).sum()),'above24':int((v>24).sum()),'p50_90_95_99_999_max':qd.tolist(),'rmseRGB':float(np.sqrt(mse)),'psnrDB':float(20*np.log10(255/np.sqrt(mse))) if mse else None, 'protectedUpperLeftCount':int(protected.size),'protectedUpperLeftDiff':int(np.count_nonzero(protected))}

if __name__=='__main__':
 p=ArgumentParser();p.add_argument('base',type=Path);p.add_argument('candidate',type=Path);p.add_argument('--trials',type=int,default=5);p.add_argument('--out',type=Path,default=Path('proof/packed'))
 p.add_argument('--chromium',default=os.environ.get('CHROMIUM_EXECUTABLE')); a=p.parse_args(); a.out.mkdir(parents=True,exist_ok=True)
 scenes=[('street','hero'),('bay','hero'),('capital','hero'),('street','approach'),('fly','approach')]
 e=local(a.base);f=local(a.candidate);urls={'E':f'http://127.0.0.1:{e.server_port}','F':f'http://127.0.0.1:{f.server_port}'}
 receipts={'timing':{'E':[], 'F':[]},'cameras':{f'{pose}-{level}':{} for pose,level in scenes},'failover':{}}
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path=a.chromium,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
   witnessed={}; fingerprints={}
   for trial in range(a.trials):
    for label in (('E','F') if trial%2==0 else ('F','E')):
     context=browser.new_context(viewport={'width':1096,'height':680},device_scale_factor=1); page=context.new_page(); errs,requests=init(page,urls[label]); timings=boot(page)
     assert not errs,(label,errs)
     assert timings['gl']['maps']==(15 if label=='E' else 5), timings
     if label=='F':
      assert timings['detail']['status']=='ready' and timings['gl']['bytes']==timings['detail']['mipBytes'] and timings['gl']['bytes']<=18*(2**20),timings
     receipts['timing'][label].append({**timings,'requests':requests})
     if trial==0:
      for pose,lod in scenes:
       pic,counters=frame(page,pose,lod)
       name=f'{pose}-{lod}'; pic.save(a.out/f'{name}-{label}.png'); receipts['cameras'][name][label]=counters
      witnessed[label]=page.evaluate('()=>portico.inspect()'); fingerprints[label]=page.evaluate('()=>portico.geometryFingerprint()')
     print(label,trial,round(timings['firstMs']),round(timings['finishedMs']),timings['gl']['bytes'],flush=True)
     context.close()
   assert witnessed['E']==witnessed['F'] and fingerprints['E']==fingerprints['F'] and fingerprints['E']['bytes']>4000000
   receipts['sameWitnessGeometry']=True; receipts['actualBufferFingerprint']=fingerprints['E']
   for outcome in receipts['cameras'].values(): assert outcome['E']==outcome['F']
   for name,q in receipts['cameras'].items():
    q['delta']=compare(Image.open(a.out/f'{name}-E.png'),Image.open(a.out/f'{name}-F.png'),not name.startswith('capital-'))
    assert q['delta']['above5']==0 and q['delta']['protectedUpperLeftDiff']==0 and q['delta']['above2']<500,(name,q)
   # A real blocked worker must leave one stable view, no raw/large texture allocation or geometry change.
   context=browser.new_context(viewport={'width':1096,'height':680});page=context.new_page();hits=[]
   def block(route): hits.append(route.request.url);route.abort('failed')
   page.route('**/assets/masonry.worker-*.js',block)
   errs,requests=init(page,urls['F']);fallback=boot(page)
   assert len(hits)==1 and fallback['gl']['maps']==0 and fallback['detail']['status']=='fallback', (hits,errs,fallback)
   assert page.evaluate('()=>portico.inspect()')==witnessed['E'] and page.evaluate('()=>portico.geometryFingerprint()')==fingerprints['E']
   pic,counts=frame(page,'street','approach');pic.save(a.out/'worker-blocked-fallback.png')
   again,counts2=frame(page,'street','approach');assert counts==counts2 and np.array_equal(np.asarray(pic),np.asarray(again))
   receipts['failover']={'workerRequests':len(hits),'timings':fallback,'render':counts,'repeatedFrameExact':True,'expectedNetworkErrors':errs}
   context.close();browser.close()
 finally:
  e.shutdown();f.shutdown()
 keys=['firstMs','prepareMs','firstDrawMs','finishedMs','firstFromNavigationMs','texturedFromNavigationMs','decodeMs']
 receipts['median']={s:{k:median(r[k] for r in rows) for k in keys} for s,rows in receipts['timing'].items()}
 receipts['glMemoryMips']={s:r[0]['gl'] for s,r in receipts['timing'].items()}
 (a.out/'comparison.json').write_text(json.dumps(receipts,indent=2)+'\n')
 q=receipts['median'];print(json.dumps({'median':q,'cameras':receipts['cameras']},indent=2),flush=True)
