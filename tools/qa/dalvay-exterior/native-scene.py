"""Compile the unchanged player in an isolated QA copy; compare the same native frame with only the original manor socket swapped.
Requires Python Playwright, Pillow, NumPy and a WebGL-capable Chromium (e.g. Chrome headless shell).
Stock negative masks come from export-stock.mjs and authored geometry from export-submitted.mjs.
No prior private model, held-source image, browser account or network imagery is needed.
"""
import argparse,base64,functools,hashlib,http.server,importlib.util,json,subprocess,tempfile,threading
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
here=Path(__file__).resolve().parent
p.add_argument('--checkout',type=Path,default=here.parents[2]);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--views',nargs='+',default=['dalvay-principal-nw','dalvay-lake-front-lawn','dalvay-approach-over-named-lake']);a=p.parse_args()
repo=a.checkout.resolve();out=a.out.resolve();assert repo not in out.parents and out!=repo
out.mkdir(parents=True,exist_ok=True);locked=json.loads((here/'native-cameras.json').read_text());assert set(a.views)<=set(locked['views'])
spec=importlib.util.spec_from_file_location('fixed',repo/'tools/qa/fixed-scenery.py');fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
fixed.VIEWS=locked['views'];fixed_quote=fixed.quote;fixed.quote=lambda v:fixed_quote(v)+'&dalvayExteriorStudy&stockDalvayWaterOptics'
a.views=','.join(v+'-close'for v in a.views);a.pose_baseline=None;a.void_probe=False;a.size=locked['size'];a.deps=None
JS="""
  (window as any).__dalvayScope=()=>{
   const slot=(buildings as any)?.dalvay,source=slot?.owner,view=slot?.helper,g=slot?.art?.group,gl=renderer.getContext();
   if(!slot?.active||!g?.visible||!view)throw Error('No original admitted manifold');
   const frame=()=>{renderer.render(scene,camera);return {pixels:renderer.domElement.toDataURL('image/png').split(',')[1],
    draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,err:gl.getError()};};
   const prior=gl.getError(),a=frame();view.sync(false);const b=frame();view.sync(true);g.visible=false;const empty=frame();slot.sync();const restored=frame();
   return {prior,on:a,stock:b,empty,restored,scope:source.userData.beaconTriangles,view:camera.matrixWorldInverse.toArray(),
    projection:camera.projectionMatrix.toArray(),baseH,eye:camera.position.y,parts:g.children.map((m:any)=>m.geometry.index.count/3),
    glLinks:renderer.info.programs?.map((p:any)=>gl.getProgramParameter(p.program,gl.LINK_STATUS))};
  };
"""
def load_geometry(p,mat):
 coords=np.fromfile(p,dtype='<f4').astype(float).reshape(-1,3)
 return (np.c_[coords,np.ones(len(coords))]@np.asarray(mat).reshape(4,4)).reshape(-1,3,4)
def projected(g,pv,w,h):
 clip=g@pv;assert clip[:,:,3].min()>0
 xy=(clip[:,:,:2]/clip[:,:,3,None]*[.5,-.5]+[.5,.5])*[w,h]*4
 im=Image.new('L',(w*4,h*4));draw=ImageDraw.Draw(im)
 for tri in xy:draw.polygon([tuple(p)for p in tri],fill=255)
 return np.asarray(im.resize((w,h),Image.Resampling.BOX))>0
def sha(b):return hashlib.sha256(b).hexdigest()
with tempfile.TemporaryDirectory(prefix='pei-dalvay-native-')as temp:
 tmp=Path(temp);stage=tmp/'game';stage.mkdir();compiled=tmp/'dist';draws=tmp/'draws'
 subprocess.run(['node','--experimental-strip-types',str(here/'export-stock.mjs'),str(draws),str(repo)],cwd=repo,check=True)
 subprocess.run(['node','--experimental-strip-types',str(repo/'tools/qa/dalvay-exterior/export-submitted.mjs'),str(draws)],cwd=repo,check=True)
 st=json.loads((draws/'stock.json').read_text());meta=json.loads((draws/'submitted.json').read_text())
 stock=load_geometry(draws/'stock-position.f32',st['stockMatrix']);authored=np.concatenate([load_geometry(draws/(str(i)+'-position.f32'),m['matrixWorld'])for i,m in enumerate(meta['parts'])]);assert len(stock)==37 and len(authored)==24853
 fixed.stage(repo,stage,(repo/'node_modules').resolve(),False);main=stage/'src/main.ts';s=main.read_text();anchor='  renderer.render(scene,camera);'
 assert s.count(anchor)==1;main.write_text(s.replace(anchor,anchor+JS))
 subprocess.run(['node',str(repo/'node_modules/vite/bin/vite.js'),'build','--outDir',str(compiled)],cwd=stage,check=True)
 class Served(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*x):pass
 with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Served,directory=str(compiled)))as server,sync_playwright()as pw:
  threading.Thread(target=server.serve_forever,daemon=True).start();browser=pw.chromium.launch(executable_path=a.chromium,args=fixed.FLAGS)
  settle=fixed.settle;records=[];ai=meta['pack']['file'];net={};new_context=browser.new_context
  def fresh(*args,**kw):
   ctx=new_context(*args,**kw);network=net[id(ctx)]={'bodies':[],'water':[]}
   def response(r):
    path=r.url.split('?')[0]
    if path.endswith('/'+ai):network['bodies'].append(r.status)
    if '/dalvay-optics/'in path:network['water'].append(r.status)
   ctx.on('response',response);return ctx
  browser.new_context=fresh
  def scope(page,errors):
   base=settle(page,errors);page.wait_for_function("""()=>{const q=window.islandAirDiagnostics,b=q?.buildingTiles;
    return q?.dalvayExterior==='authored'&&q.dalvayWaterOptics===null&&q.dalvayWaterAdmission==='idle'&&
    b?.wanted>0&&b.ready===b.wanted&&!b.pending&&!b.loading&&!b.failed&&window.__dalvayScope;}""",timeout=120000)
   pose=page.evaluate("()=>JSON.parse(new URLSearchParams(location.search).get('qa'))");name=pose['site'];q=page.evaluate('()=>window.__dalvayScope()')
   assert not errors and q['glLinks'] and all(q['glLinks']) and not q['prior'];assert q['scope']==[4533,4644]
   assert q['eye']==pose['fixedEyeY'] and q['baseH']==pose['fixedBaseH'] and sum(q['parts'])==24853
   assert net[id(page.context)]=={'bodies':[200],'water':[]}
   canvases={};pHashes={}
   for k in ['on','stock','empty','restored']:
    t=q[k];assert not t['err'];png=base64.b64decode(t.pop('pixels'));file=out/(name+'-'+k+'.png');file.write_bytes(png);pHashes[k]=sha(png)
    canvases[k]=np.asarray(Image.open(file).convert('RGB'),np.int16)
   assert pHashes['on']==pHashes['restored'] and q['on']==q['restored']
   assert q['on']['triangles']-q['stock']['triangles']==24853-37 and q['on']['draws']-q['stock']['draws']==5 and q['stock']['triangles']-q['empty']['triangles']==37
   h,w=canvases['on'].shape[:2];pv=np.asarray(q['view']).reshape(4,4)@np.asarray(q['projection']).reshape(4,4)
   masks={'on':projected(authored,pv,w,h),'stock':projected(stock,pv,w,h),'empty':np.zeros((h,w),bool)};pairs={}
   for l,r in [('on','stock'),('on','empty'),('stock','empty')]:
    support=masks[l]|masks[r];ring=np.asarray(Image.fromarray(np.uint8(support)).filter(ImageFilter.MaxFilter(5)))>0;res=np.max(abs(canvases[l]-canvases[r]),2)
    pairs[l+'__'+r]={'gt2':int((res>2).sum()),'maxBeyond2px':int(res[~ring].max(initial=0))};assert pairs[l+'__'+r]['maxBeyond2px']==0
   record={'site':name,'pose':pose,'matricesAndDraws':q,'network':net[id(page.context)],'SHA256':pHashes,'pixelPairs':pairs};records.append(record)
   (out/'native-scope.json').write_text(json.dumps(records,indent=2)+'\n');print(name,pairs,flush=True);return base
  fixed.settle=scope
  try:fixed.capture(a,browser,'http://127.0.0.1:'+str(server.server_port))
  finally:browser.close();server.shutdown()
