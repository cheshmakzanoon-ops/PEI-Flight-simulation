"""Only normal stock simulation and genuine trusted Begin, observing exact original foliage upload."""
import argparse,base64,hashlib,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--browser',required=True);p.add_argument('--port',required=True,type=int)
p.add_argument('--out',required=True,type=Path)
p.add_argument('--county',choices=['prince','queens','kings'],required=True)
p.add_argument('--manifest',required=True)
a=p.parse_args();d=Path(__file__).resolve().parent.parent
sha=lambda q:hashlib.sha256(q).hexdigest()
assert sha((d/'BUILD.sha256').read_bytes())==a.manifest
for line in (d/'BUILD.sha256').read_text().splitlines():
 h,n=line.split(maxsplit=1);assert sha((d/n).read_bytes())==h,n
a.out.mkdir()
du='http://127.0.0.1:'+str(a.port)
route='private-'+a.county+'-field-edge'
r={'state':'HOLD incomplete stock observation','sealedBuild':a.manifest,'site':route,'windows':[],'ranges':[],
   'outside':[],'errors':[], 'begin':None}
def save():
 (a.out/'receipt.json').write_text(json.dumps(r,indent=2)+'\n')
save()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=a.browser,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
 q=b.new_page(viewport={'width':1200,'height':760},device_scale_factor=1,service_workers='block')
 q.set_default_timeout(275000)
 q.add_init_script("""(()=>{
 Object.defineProperty(window,'__hedgeStockKey',{value:'ordinary-hedge-stock-q476'});
 addEventListener('click',e=>{if(e.target.closest('button#start')&&e.isTrusted){
  const p=window.islandAirDiagnostics;window.__stockTrusted={site:p?.site,x:p?.x,z:p?.z,mode:p?.mode,mainland:p?.mainland,roads:p?.roads,buildings:p?.buildings};
 }},true);})();""")
 def block(route_req):
  r['outside'].append(route_req.request.url);route_req.abort()
 def response(resp):
  k='/world/woodland/hedgerows-v1/'
  if k not in resp.url:return
  r['ranges'].append({'leaf':resp.url.split(k)[-1],'status':resp.status,'range':resp.request.headers.get('range'),
     'contentRange':resp.headers.get('content-range'),'length':resp.headers.get('content-length')})
 q.route(re.compile(r'^(?!'+re.escape(du)+r'/)https?://'),block)
 q.on('response',response)
 q.on('pageerror',lambda e:r['errors'].append(str(e)))
 try:
  q.goto(du+'/?departure='+route+'&diagnostics',wait_until='domcontentloaded')
  q.wait_for_function("""t=>{const p=window.islandAirDiagnostics;
     return p?.site===t&&p?.mode==='dispatch'&&p?.mainland&&p?.roads&&p?.buildings&&p?.hedgerows?.visible>0;}""",arg=route,polling='raf')
  q.get_by_role('button',name='Begin flight',exact=True).click()
  r['begin']=q.evaluate('()=>window.__stockTrusted');assert r['begin'] and r['begin']['site']==route and r['begin']['mode']=='dispatch'
  save()
  for n in range(2):
   q.wait_for_function("()=>{const p=window.__hedgeStockProof.status();return p.error||p.queued;}",polling='raf')
   v=q.evaluate('()=>window.__hedgeStockProof.take()')
   assert v and v['covered']==n and v['site']==route,q.evaluate('()=>window.__hedgeStockProof.status()')
   pick=q.evaluate('()=>{const x=window.islandAirDiagnostics;return {mode:x?.mode,camera:x?.camera,site:x?.site,hedges:x?.hedgerows,roads:x?.roads,buildings:x?.buildings};}')
   assert pick['mode']=='flight' and pick['camera']=='Chase' and pick['roads'] and pick['buildings'],pick
   assert v['viewport']==[0,0,1200,760] and v['samples']==4 and v['hedgeCount']>0
   v['captureState']=pick
   for k,m in [('fullStem',12),('fullShape',16)]:
    raw=base64.b64decode(v.pop(k),validate=True);assert len(raw)==m*v['hedgeCount']
    name=f'{n}-{k}.f32le';(a.out/name).write_bytes(raw);v[k]={'name':name,'sha256':sha(raw)}
   sv=v['shadow'];assert sv['instances']==v['instances'] and sv['count']==6
   raw=base64.b64decode(sv.pop('ground'),validate=True);assert len(raw)==16*v['hedgeCount']
   fn=f'{n}-old-shadow-floor.f32le';(a.out/fn).write_bytes(raw);sv['ground']={'name':fn,'sha256':sha(raw)}
   v['shaderSHA256']=[]

   for j,text in enumerate(v.pop('glsl')):
    data=text.encode();(a.out/f'{n}-shader-{j}.glsl').write_bytes(data);v['shaderSHA256'].append(sha(data))
   r['windows'].append(v)
   save()
   print('stock physical station',n,v['d'],v['hedgeCount'],flush=True)
  assert not r['errors'] and not r['outside']
  assert any(x['status']==206 for x in r['ranges']),r['ranges']
  r['state']='PASS exact linked standard hedge custody at two physical steps; no depth-pixel visibility or artist claim'
 except BaseException as e:
  r['state']='HOLD '+repr(e)
  raise
 finally:
  try: r['final']=q.evaluate('()=>window.__hedgeStockProof?.status()')
  except Exception: pass
  save();b.close()
