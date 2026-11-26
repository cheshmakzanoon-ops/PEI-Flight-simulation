"""Compiled controllable QA flights at private positions, no real navigation use."""
from pathlib import Path
import argparse, functools, http.server, json, math
from threading import Thread
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--corridors',type=Path,required=True)
parser.add_argument('--dist',type=Path,required=True)
parser.add_argument('--chromium',required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--normal-only',action='store_true',help='Replay each signed corridor without the south-shore fallback fixtures')
args=parser.parse_args()
cfgs={v['name']:v for v in json.loads(args.corridors.read_text())}
if not args.normal_only and 'south-central-fields' not in cfgs:
 parser.error('The signed corridor list must include the south-central fallback fixture')
args.out.parent.mkdir(parents=True,exist_ok=True)
dist=args.dist
atlas=json.loads((dist/'world/detail/index.json').read_text())
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(dist)))
Thread(target=srv.serve_forever,daemon=True).start()
result=[]
try:
 with sync_playwright() as w:
  browser=w.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
  fallback=[] if args.normal_only else [('stock','south-central-fields'),('corrupt','south-central-fields')]
  for mode,name in [('normal',n) for n in cfgs]+fallback:
   q=cfgs[name];a=math.radians(q['heading']);d=[math.sin(a),-math.cos(a)];pair=' / '.join(q['owners'])
   ctx=browser.new_context(viewport={'width':620,'height':400});p=ctx.new_page();p.set_default_timeout(120_000)
   errs=[];imagery=set();corrupted=[]
   p.on('pageerror',lambda e:errs.append(str(e)))
   p.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
   p.on('request',lambda e:imagery.add(e.url.split('/detail/')[-1]) if '/world/detail/' in e.url else None)
   if mode=='corrupt':
    target=atlas['tiles'][q['owners'][0]]
    pack=atlas['packs'][target['pack']]['file']
    def taint(route):
     res=route.fetch();raw=bytearray(res.body())
     assert res.status==200 and target['offset']+target['bytes']<=len(raw)
     raw[target['offset']+target['bytes']//2]^=1;corrupted.append(len(raw))
     route.fulfill(response=res,body=bytes(raw))
    p.route('**/world/detail/'+pack,taint)
   try:
    nav=p.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure=qa-{name}'+('&stockInlandOrtho' if mode=='stock' else ''),wait_until='domcontentloaded')
    assert nav.status==200
    p.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    p.get_by_role('button',name='Begin flight').click()
    p.wait_for_function("(id)=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===id",arg='qa-'+name)
    s=p.evaluate("({x:islandAirDiagnostics.x,z:islandAirDiagnostics.z})")
    print(mode,name,'started',s,flush=True)
    p.wait_for_function("({x,z})=>Math.hypot(islandAirDiagnostics.x-x,islandAirDiagnostics.z-z)>150",arg=s)
    if mode=='normal':
     p.wait_for_function("edge=>islandAirDiagnostics?.orthophotoSeams?.find(o=>o.edge===edge)?.gain===1",arg=pair)
    if mode=='corrupt':
     p.wait_for_function("edge=>islandAirDiagnostics.detail?.missing>0&&islandAirDiagnostics?.orthophotoSeams?.find(o=>o.edge===edge)?.uploads===0",arg=pair)
    v=p.evaluate('islandAirDiagnostics');e=next((o for o in v.get('orthophotoSeams',[]) if o['edge']==pair),None)
    dx,dz=v['x']-s['x'],v['z']-s['z'];along=dx*d[0]+dz*d[1];cross=abs(dx*d[1]-dz*d[0])
    assert along>145 and cross<15 and v['altitude']-v['groundY']>30,(mode,name,dx,dz,v)
    if mode=='normal': assert e['gain']==1 and e['resident'] and e['bytes']==10240 and e['errors']==0
    if mode=='stock': assert e is None and len(v['orthophotoSeams'])==4
    if mode=='corrupt': assert corrupted and e and not e['resident'] and e['bytes']==0
    assert not errs and not v['layerWarnings'],(mode,name,errs,v['layerWarnings'])
    p.keyboard.press('v');p.wait_for_function("islandAirDiagnostics.camera==='Cockpit'")
    p.keyboard.press('Escape');p.wait_for_function("islandAirDiagnostics.mode==='paused'")
    row=dict(name=name,mode=mode,flightMeters=round(math.hypot(dx,dz),3),alongMeters=round(along,3),
       crossMeters=round(cross,3),groundClearance=round(v['altitude']-v['groundY'],3),edge=e,cockpitAndPause=True,
       requestedImagery=sorted(imagery),corrupted=corrupted,errors=errs)
    result.append(row)
    args.out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(row),flush=True)
   finally:ctx.close()
  browser.close()
finally:srv.shutdown()
