#!/usr/bin/env python3
"""Capture fixed viewpoints using the application's own scene from a temporary QA checkout.
Usage: python fixed_scenery.py --checkout <full checkout> --out <outside checkout>
Requires the checkout's npm dependencies (or --deps), Python playwright, chromium, Pillow.
No network imagery, production hooks, absolute output assumptions, or repository modifications.
All dimensions are metres; vertical FOV 53 degrees. Only the HUD & plane are hidden, physics held;
geometry, shaders, detail streaming, dynamic scenery updates and browser are the real application.
"""
import argparse,json,math,os,pathlib,shutil,subprocess,tempfile,time,sys,socket,urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent
VIEWS=[
 dict(site='east',lon=-61.9718333333,lat=46.452527778,h=19.5,east=.91,south=-.415),
 dict(site='west',lon=-64.38675,lat=46.620305556,h=20.62,east=-.88,south=.475),
]
def setup(repo,path,deps,void_probe):
 files=['index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts']
 for f in files:
  if (repo/f).is_file():shutil.copy2(repo/f,path/f)
 shutil.copytree(repo/'src',path/'src');(path/'public').symlink_to(repo/'public',target_is_directory=True);(path/'node_modules').symlink_to(deps,target_is_directory=True)
 target=path/'src'/'main.ts';src=target.read_text()
 def rep(search,replace):
  nonlocal src
  assert src.count(search)==1,'QA integration anchor requires review: '+search
  src=src.replace(search,replace)
 # Preserve the runtime boot and layer pipeline. For QA only, hold physics and substitute
 # a single surveyed spectator camera at animation time. Keep simulation-facing x/z at eye.
 rep('const diagnostic=',"const qa = JSON.parse(decodeURIComponent(new URLSearchParams(location.search).get('qa')!)); const center=project(qa.lon,qa.lat); const baseH=terrain.elevation(center.x,center.z); let qaFrame=0; const diagnostic=")
 rep('clamp, RAD, geographic','clamp, RAD, geographic, project')
 rep('groundY.copy(aircraft.root.position);', '''const norm=Math.hypot(qa.east,qa.south); const ex=center.x+qa.dist*qa.east/norm, ez=center.z+qa.dist*qa.south/norm; f.x=ex;f.z=ez;f.y=terrain.elevation(ex,ez)+qa.agl;
  camera.position.set(ex,f.y,ez); camera.up.set(0,1,0);camera.lookAt(center.x,baseH+qa.h*.5,center.z);camera.updateMatrixWorld(); aircraft.root.visible=false;
  const screenY=(h:number)=>{const v=new THREE.Vector3(center.x,baseH+h,center.z).project(camera);return (1-v.y)*innerHeight*.5;};
  (window as any).reviewCamera={frame:++qaFrame,baseH,eyeY:f.y,bottomY:screenY(0),topY:screenY(qa.h),x:ex,z:ez,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries};
  groundY.copy(aircraft.root.position);''')
 # Force same sea/sky phase; still advance update clock to resolve LOD & streaming.
 if 'this.t.value=clock;' in (path/'src/render/world.ts').read_text():
  w=path/'src/render/world.ts';w.write_text(w.read_text().replace('this.t.value=clock;','this.t.value=12;'))
 if void_probe:
  text=w.read_text(); needle='this.sky.renderOrder=-10;'; assert text.count(needle)==1; w.write_text(text.replace(needle,"this.sky.material=new THREE.MeshBasicMaterial({color:0xff00ff,side:THREE.BackSide,toneMapped:false});"+needle))
 target.write_text(src)
def main():
 p=argparse.ArgumentParser();p.add_argument('--checkout',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--deps',type=pathlib.Path);p.add_argument('--chromium');p.add_argument('--void-probe',action='store_true');p.add_argument('--views',default='east-close,west-close,east-approach,west-approach');p.add_argument('--size',default='1024x640');args=p.parse_args()
 repo=args.checkout.resolve();out=args.out.resolve();deps=(args.deps or repo/'node_modules').resolve()
 assert repo!=out and repo not in out.parents,'Use output directory outside checkout'
 out.mkdir(parents=True,exist_ok=True); ww,hh=map(int,args.size.split('x'))
 with tempfile.TemporaryDirectory(prefix='pei-inspect-') as td:
  root=pathlib.Path(td);setup(repo,root,deps,args.void_probe)
  # Vite needs writeable optimizer cache. Give it a per-execution root, not the real checkout.
  (root/'vite.config.ts').write_text("import {defineConfig} from 'vite'; export default defineConfig({base:'./',cacheDir: "+json.dumps(str(root/'cache'))+"});")
  with socket.socket()as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  log=open(out/'server.log','w');proc=subprocess.Popen(['node',str(deps/'vite/bin/vite.js'),'--host','127.0.0.1','--port',str(port),'--strictPort'],cwd=root,stdout=log,stderr=log)
  url='http://127.0.0.1:'+str(port)
  try:
   for i in range(100):
    try:urllib.request.urlopen(url,timeout=1).read();break
    except Exception:
     if proc.poll()!=None:raise RuntimeError('Vite failed; see server.log')
     time.sleep(.2)
   with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=args.chromium or os.environ.get('CHROMIUM') or 'chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    results=[]
    for sel in args.views.split(','):
     site,capture=sel.split('-');qa=next(v.copy() for v in VIEWS if v['site']==site)
     assert capture in ('close','approach');qa.update(dist=125 if capture=='close' else 650,agl=45 if capture=='close' else 120)
     c=b.new_context(viewport={'width':ww,'height':hh},device_scale_factor=1);page=c.new_page();page.set_default_timeout(60000);errors=[]
     page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
     page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 and r.url.startswith(url) else None)
     from urllib.parse import quote
     page.goto(url+'/?diagnostics&qa='+quote(json.dumps(qa)),wait_until='domcontentloaded')
     page.wait_for_function('window.reviewCamera?.frame>5 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.buildings')
     page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
     prev=None;consecutive=0;t0=time.monotonic()
     while time.monotonic()-t0<75:
      diag=page.evaluate('() => ({...window.islandAirDiagnostics,...window.reviewCamera})')
      d=diag['detail']; key=(diag['triangles'],diag['geometries'],d['ready'],d['loading'],diag['drawCalls'])
      if key==prev and d['loading']==0 and d['ready']>0 and diag['frame']>22:consecutive+=1
      else:consecutive=0
      if consecutive>=3:break
      prev=key
      page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
     else:raise AssertionError('scene streaming did not settle: '+str(diag))
     assert not errors and not diag['layerWarnings'] and d['missing']==0,(errors,diag)
     page.screenshot(path=str(out/(sel+'.png')));diag['renderedHeightPx']=diag['bottomY']-diag['topY']
     print(sel,round(diag['renderedHeightPx'],1),'projected reference height px',diag['drawCalls'],'draws',d,flush=True)
     results.append({'name':sel,'pose':qa,'width':ww,'height':hh,'renderer':'Chromium / SwiftShader; not a device performance result','diag':diag,'errors':errors})
     (out/'results.json').write_text(json.dumps(results,indent=2));c.close()
    b.close()
  finally:
   proc.terminate()
   try:proc.wait(timeout=5)
   except subprocess.TimeoutExpired:proc.kill()
   log.close()
if __name__=='__main__':main()
