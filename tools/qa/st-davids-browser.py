#!/usr/bin/env python3
"""Reproduce exterior, fallback, and flight evidence in isolated copies.
Examples: python -B qa/st-davids-browser.py --checkout . --out /tmp/… --chromium /supported/browser
          python -B qa/st-davids-browser.py --checkout . --out /tmp/… --prepare-only --edition flight
Locked cameras and a dated virtual departure are inserted only in isolated temp source copies.
"""
from pathlib import Path
import argparse, base64, json, math, os, shutil, socket, subprocess, tempfile, time
from urllib.request import urlopen

FLAGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']
OPT='buildingShadows&diagnostics&stDavidsChurchReview'
STOCK='buildingShadows&diagnostics'
TARGET='st-davids-B3-v1.bin.gz'
def once(source,before,after):
 if source.count(before)!=1:raise ValueError('Unexpected reviewed source anchor: '+before)
 return source.replace(before,after,1)
def readpath(p):return json.loads(p.read_text())
def make_stage(repo, target, edition):
 stage=target.resolve();stage.mkdir(parents=True,exist_ok=True)
 for one in ('index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'):shutil.copyfile(repo/one,stage/one)
 shutil.copytree(repo/'src',stage/'src')
 (stage/'public').symlink_to((repo/'public').resolve(),target_is_directory=True)
 (stage/'node_modules').symlink_to((repo/'node_modules').resolve(),target_is_directory=True)
 if edition=='flight':
  f={'id': 'georgetown-fixture', 'name': 'Georgetown QA · temporary replay', 'region': 'Kings County', 'heading': 309, 'height': 61, 'lon': -62.52719008293827, 'lat': 46.17861545831718, 'note': ''};f['name']='Georgetown · virtual verification only'
  place=stage/'src/sim/places.ts';s=place.read_text();s=once(s,'];\nfunction cyyg10SimulatorEnds()',',\n '+json.dumps(f,ensure_ascii=False)+'\n];\nfunction cyyg10SimulatorEnds()');place.write_text(s)
 else:
  main=stage/'src/main.ts';s=main.read_text()
  s=once(s,'const diagnostic=', '''const sdavPose=(window as any).sdavQaInit;let sdavFrames=0;
 const diagnostic=''')
  s=once(s,'groundY.copy(aircraft.root.position);', '''
   if(sdavPose){const v=(window as any).sdavPose??sdavPose;
    f.x=v.eye[0];f.y=v.eye[1];f.z=v.eye[2];aircraft.root.visible=false;
    camera.position.set(...(v.eye as [number,number,number]));camera.up.set(0,1,0);
    camera.lookAt(...(v.aim as [number,number,number]));camera.updateMatrixWorld(true);
   }
   groundY.copy(aircraft.root.position);''')
  s=once(s,'  renderer.render(scene,camera);','''
   if(sdavPose){
    const key='24-17',t=(world as any).byId.get(key), b=(buildings as any)?.meshes.get('q11220'), staging=(buildings as any)?.stDavids;
    (window as any).stDavidsQA={frame:++sdavFrames,position:camera.position.toArray(),target:(window as any).sdavPose?.aim??sdavPose.aim,
      terrainOwner:key,lod:t.lod,groundClearance:world.surface(51111.69140072926,35337.302605766265),
      installed:!!b,indexed:!!b?.geometry.index,vertices:b?.geometry.getAttribute('position').count??0,indices:b?.geometry.index?.count??0,
      mounted:!!staging?.art.group.parent,assetVisible:staging?.art.group.visible??false,
      sortedTileImages:[...(world as any).byId.values()].filter((q:any)=>q.status==='ready').map((q:any)=>q.id).sort()};
   }
  renderer.render(scene,camera);
   if(sdavPose)(window as any).sdavCapture=async()=>{
    const b=(buildings as any)?.meshes.get('q11220'),g=b?.geometry;
    const result={q:{d:(window as any).islandAirDiagnostics,s:(window as any).stDavidsQA}};
    if(!g)return {...result,owner:null};
    const entries=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b));
    if(g.index)entries.push(['index',g.index]);
    const hashes=await Promise.all(entries.map(async ([name,attr]:[string,any])=>{
      const a=attr.array;
      const sha=await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
      return [name,attr.count,attr.itemSize,Array.from(new Uint8Array(sha),q=>q.toString(16).padStart(2,'0')).join('')];
    }));
    return {...result,owner:{vertices:g.getAttribute('position').count,drawAttributes:hashes}};
   };
   if(sdavPose)(window as any).sdavPair=()=>{
    const church=(buildings as any).stDavids,shadows=world.buildingShadows!;
    const snap=()=>{
     if(shadows){shadows.leaseOwnerChanged();
     shadows.render(camera.position,world.groundHeight(camera.position.x,camera.position.z),liveCasters);}
     renderer.render(scene,camera);
     return {image:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,
      triangles:renderer.info.render.triangles,shadows:shadows?.state??null,indexed:!!church.owner.geometry.index,visible:church.art.group.visible};
    };
    if(!church.variant.visible)throw Error('Church preview not active at capture');
    const candidate=snap();
    church.variant.sync(false);const stock=snap();
    church.variant.sync(true);if(church.neighborsCaster)church.neighborsCaster.geometry=church.owner.geometry;
    const restored=snap();
    return {candidate,stock,restored:restored.image===candidate.image,q:(window as any).stDavidsQA};
   };''');main.write_text(s)
  world=stage/'src/render/world.ts';s=once(world.read_text(),'this.t.value=clock;','this.t.value=12;');world.write_text(s)
 return stage

def poses(repo):
 return {'street': {'eye': [51126.12235040195, 11.65, 35307.31472497186], 'aim': [51111.50512722345, 13.35, 35336.62782778891], 'lod': 112, 'retained': True}, 'air': {'eye': [51151.469099657756, 61.25, 35260.78025272575], 'aim': [51112.35666325, 12.3, 35339.71252711398], 'lod': 112, 'retained': True}, 'medium': {'eye': [44190.7620842242, 1120, 35874.7133932999], 'aim': [51111.50512722345, 13.35, 35336.62782778891], 'lod': 56, 'retained': True}, 'coarse': {'eye': [38190.7620842242, 1600, 35874.7133932999], 'aim': [51111.50512722345, 13.35, 35336.62782778891], 'lod': 8, 'retained': False}}

def stable(page, expected, optical=True, timeout=110):
 page.wait_for_function('window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.mode === "dispatch"')
 if optical:page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
 prior=None;started=time.monotonic();steady=0
 while time.monotonic()-started<timeout:
  docket=page.evaluate('()=>({d:window.islandAirDiagnostics,s:window.stDavidsQA})');d=docket['d'];s=docket.get('s')
  k=(d['buildingTiles']['ready'],d['buildingTiles']['failed'],d['triangles'],d['drawCalls'],tuple(s['sortedTileImages'] if s else []),(d['buildingShadows'] or {}).get('updates'))
  done=not d['detail']['loading'] and not d['detail'].get('retrying',0) and d['buildingTiles']['loading']==0 and not d['buildingTiles']['pending'] and d['stDavids'] is expected
  if done and k==prior:steady+=1
  else:steady=0
  prior=k
  if steady>=3 and time.monotonic()-started>1.75:return docket
  page.wait_for_timeout(90)
 raise TimeoutError(f'did not settle (expected stDavids={expected}) {docket}')

def auth(d,active,view=None):
 q=d['d'];assert q['stDavids'] is active and not q['layerWarnings'],q['layerWarnings']
 if view is None:return
 z=d['s'];assert z['lod']==view['lod'] and z['installed'] is view['retained'],z
 assert z['indexed'] is active and z['assetVisible'] is active and (not active or z['indices']==31113),z
 if view['retained']:assert z['vertices']==31179,z
 assert z['groundClearance']['land'] and not z['groundClearance']['runway'],z

def setup_routes(page,mode,requests,status):
 page.on('request',lambda q:requests.append(q.url.rsplit('/',1)[-1]) if q.url.split('?')[0].endswith(TARGET) else None)
 def route_job(route):
  if mode=='missing':status.append('404');route.fulfill(status=404,body='');return
  if mode=='held':status.append('aborted delayed good body');time.sleep(3.5)
  try:r=route.fetch();src=bytearray(r.body())
  except Exception:
   if mode=='held':return
   raise
  heads={k:v for k,v in r.headers.items() if k.lower() not in ['content-encoding','content-length']}
  if mode=='corrupt':assert len(src) in (374243,1792460);src[len(src)//2]^=16;status.append(f'mutated actual body {len(src)}')
  try:route.fulfill(status=200,body=bytes(src),headers=heads)
  except Exception:
   if mode!='held':raise
 if mode in ('corrupt','missing','held'):page.route('**/art/'+TARGET+'*',route_job)

def capture(repo,browser,url,args):
 views=poses(repo);jobs=[]
 for k in args.views.split(','):
  if k not in views:raise ValueError(k)
  jobs.extend([(k,'stock')]);
  if k!='street':jobs.append((k,'candidate'))
  elif not args.skip_faults:jobs.extend([(k,'corrupt'),(k,'missing'),(k,'held')])
 allframes={};modes=[]
 for k,mode in jobs:
  view=views[k];expect=mode=='candidate' and view['lod']==112;ctx=browser.new_context(viewport={'width':args.width,'height':args.height},device_scale_factor=1)
  try:
   p=ctx.new_page();p.set_default_timeout(150000)
   p.add_init_script('window.sdavQaInit='+json.dumps(view));err=[];req=[];route=[]
   p.on('pageerror',lambda x:err.append(str(x)))
   p.on('console',lambda q:err.append(q.text) if q.type=='error' and 'status of 404' not in q.text else None)
   setup_routes(p,mode,req,route);p.goto(url+'/?'+(STOCK if mode=='stock' else OPT),wait_until='domcontentloaded')
   stable(p,expect)
   frame=p.evaluate('window.sdavCapture()')
   after=frame['q'];auth(after,expect,view)
   assert not err,err
   assert len(req)==(0 if mode=='stock' or view['lod']<112 else 1),(view,mode,req)
   allframes[k,mode]=frame['owner'];modes.append({'view':k,'mode':mode,'q':after,'owner':frame['owner'],'transport':route})
   (args.out/'replay.json').write_text(json.dumps(modes,indent=2)+'\n');print(k,mode,expect,after['s']['lod'],req,flush=True)
  finally:ctx.close()
 comparisons=[]
 for (view,mode),owner in allframes.items():
  if mode=='stock':continue
  baseline=allframes[view,'stock']
  assert owner==baseline,(view,mode,owner,baseline)
  assert owner is not None or view=='coarse',(view,mode)
  comparisons.append({'pose':view,'mode':mode,'stockOwnerPresent':owner is not None,
                      'actualDrawBufferSha256Exact':owner==baseline if owner is not None else None})
 (args.out/'comparisons.json').write_text(json.dumps(comparisons,indent=2)+'\n')

def paired_views(repo,browser,url,args):
 from PIL import Image,ImageChops
 rows=[]
 for k in args.views.split(','):
  view=poses(repo)[k];c=browser.new_context(viewport={'width':args.width,'height':args.height})
  try:
   p=c.new_page();p.set_default_timeout(150000)
   p.add_init_script('window.sdavQaInit='+json.dumps(view));errors=[]
   p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   p.goto(url+'/?'+('diagnostics' if args.standard else OPT),wait_until='domcontentloaded')
   stable(p,True);x=p.evaluate('window.sdavPair()')
   assert x['restored'] and not errors and x['candidate']['indexed'] and x['candidate']['visible'] and not x['stock']['indexed'] and not x['stock']['visible'],(x.get('restored'),errors)
   for v in ('stock','candidate'):
    image=x[v].pop('image')
    (args.out/f'{k}-{v}.png').write_bytes(base64.b64decode(image.split(',',1)[1]))
   y=ImageChops.difference(Image.open(args.out/f'{k}-stock.png').convert('RGB'),Image.open(args.out/f'{k}-candidate.png').convert('RGB'))
   if args.standard:
    mask={'street':(160,78,421,319),'air':(263,158,376,268)}[k]
    # The protected windows are calibrated to the published comparison.
    if (args.width,args.height)==(650,435):
     x0,y0,x1,y1=mask; bb=y.getbbox()
     assert bb and x0<=bb[0]<bb[2]<=x1 and y0<=bb[1]<bb[3]<=y1,(k,bb)
     x['protectedPixels']=args.width*args.height-(x1-x0)*(y1-y0)
    assert x['candidate']['triangles']-x['stock']['triangles']==5342 and x['candidate']['draws']-x['stock']['draws']==13,x
    assert x['candidate']['shadows'] is None and x['stock']['shadows'] is None,x
   x['view']=k;x['changedRgbBoundingBox']=y.getbbox();rows.append(x)
   (args.out/'paired.json').write_text(json.dumps(rows,indent=2)+'\n')
   print(k,x['changedRgbBoundingBox'],x['stock']['triangles'],x['candidate']['triangles'],x['restored'],flush=True)
  finally:c.close()

def fly(repo,browser,url,args):
 out=[]
 cases=['stock','candidate']+([] if args.skip_faults else ['corrupt','held']);
 for mode in cases:
  expected=mode=='candidate';c=browser.new_context(viewport={'width':args.width,'height':args.height},device_scale_factor=1)
  try:
   p=c.new_page();p.set_default_timeout(150000);req=[];route=[];err=[];p.on('pageerror',lambda e:err.append(str(e)))
   setup_routes(p,mode,req,route);p.goto(url+'/?departure=georgetown-fixture&sceneryObserver&'+(STOCK if mode=='stock' else OPT),wait_until='domcontentloaded')
   start=stable(p,expected,optical=False)['d'];auth({'d':start},expected);assert start['site']=='georgetown-fixture';assert len(req)==(0 if mode=='stock' else 1),req
   p.get_by_role('button',name='Begin flight').click();p.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
   p.wait_for_function('ref=>Math.hypot(window.islandAirDiagnostics.x-ref.x,window.islandAirDiagnostics.z-ref.z)>500',arg={'x':start['x'],'z':start['z']})
   d=p.evaluate('window.islandAirDiagnostics');auth({'d':d},expected);p.screenshot(path=str(args.out/f'normal-{mode}.png'),timeout=100000)
   for k in ('Cockpit','Wide chase','Scenery'):
    p.keyboard.press('v');p.wait_for_function('k=>window.islandAirDiagnostics?.camera===k',arg=k)
   observer=p.evaluate('window.islandAirDiagnostics');auth({'d':observer},expected)
   p.keyboard.press('Escape');p.wait_for_function('window.islandAirDiagnostics?.mode==="paused"');assert not err
   out.append({'mode':mode,'nativeDispatchThenFlight':True,'virtualStart':start,'afterNativePhysics':d,'routeTransport':route,'retainedOptional':expected,'preserved133ObserverCamera':observer['camera']})
   (args.out/'normal-route.json').write_text(json.dumps(out,indent=2)+'\n');print('normal-route',mode,d['stDavids'],d['x'],d['z'],d['altitude'],flush=True)
  finally:c.close()

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
 p.add_argument('--chromium',default=os.environ.get('CHROMIUM'));p.add_argument('--edition',choices=['views','paired','flight'],default='views')
 p.add_argument('--width',type=int,default=650);p.add_argument('--height',type=int,default=435);p.add_argument('--views',help='Comma-separated camera names; depends on edition')
 p.add_argument('--standard',action='store_true',help='Render the ordinary shadowless pair (paired edition only).');p.add_argument('--skip-faults',action='store_true');p.add_argument('--prepare-only',action='store_true');a=p.parse_args();a.checkout=a.checkout.resolve();a.out=a.out.resolve()
 if a.standard and a.edition!='paired':p.error('--standard needs --edition paired')
 available=('street','air') if a.edition=='paired' else ('street','medium','coarse')
 a.views=a.views or ','.join(available)
 if not set(a.views.split(',')).issubset(available):p.error('Available views: '+', '.join(available))
 if a.out==a.checkout or a.checkout in a.out.parents:raise ValueError('Must set --out outside checkout')
 a.out.mkdir(parents=True,exist_ok=True)
 if a.prepare_only:
  if (a.out/'stage').exists():raise FileExistsError(a.out/'stage')
  stage=make_stage(a.checkout,a.out/'stage',a.edition);print(stage);return
 if not a.chromium:raise ValueError('Provide a local Chromium executable or set CHROMIUM.')
 from playwright.sync_api import sync_playwright
 with tempfile.TemporaryDirectory(prefix='peistdavids-') as t:
  root=make_stage(a.checkout,Path(t),a.edition)
  with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
  log=(a.out/'vite.log').open('w');url=f'http://127.0.0.1:{port}'
  deps=(root/'node_modules').resolve();server=subprocess.Popen(['node',str(deps/'vite/bin/vite.js'),'--host','127.0.0.1','--port',str(port),'--strictPort'],cwd=root,stdout=log,stderr=log)
  try:
   for k in range(200):
    try:
     with urlopen(url,timeout=1):break
    except OSError:
     if server.poll() is not None:raise RuntimeError('Vite fixture terminated; see log')
     time.sleep(.1)
   else:raise TimeoutError('Waiting for Vite fixture')
   with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=a.chromium,args=FLAGS)
    (fly if a.edition=='flight' else paired_views if a.edition=='paired' else capture)(a.checkout,browser,url,a)
    browser.close()
  finally:
   server.terminate()
   try:server.wait(timeout=5)
   except subprocess.TimeoutExpired:server.kill();server.wait()
   log.close()
if __name__=='__main__':main()
