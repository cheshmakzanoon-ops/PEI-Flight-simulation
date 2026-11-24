"""Verify the packaged dry dune option with usual Dispatch and flight controls."""
import argparse,functools,http.server,json,math,threading,time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--county',choices=['prince','queens','kings'],default='queens')
p.add_argument('--fault',action='store_true')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
PREFIX='/PEI-Flight-simulation/'
class Static(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(PREFIX):]if path.startswith(PREFIX)else '/unrelated/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Static,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  pg=b.new_page(viewport={'width':460,'height':338});pg.set_default_timeout(115000)
  erro=[];reads=[]
  pg.on('pageerror',lambda e:erro.append(str(e)))
  pg.on('console',lambda e:erro.append(e.text)if e.type=='error'else None)
  def registered(r):
   u=urlsplit(r.url)
   if '/dune-grass/v1/' in u.path:reads.append((u.path.rsplit('/',1)[-1],r.status))
  pg.on('response',registered)
  if a.fault:
   pg.route('**/dune-grass/v1/sparse-grass-photometric.png',lambda route:route.fulfill(status=200,body=bytes(480772)))
  route=a.county+'-coastal-grass'
  url=f'http://127.0.0.1:{server.server_port}'+PREFIX+'?diagnostics&departure='+route+'&stable=1'
  pg.goto(url,wait_until='domcontentloaded')
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  # The same route may already prefetch the qualified Standard material.
  # Isolate traffic from the explicit study after its Dispatch reload.
  pg.locator('.scenery-reviews summary').click();pg.get_by_label('Coastal grass surface').check()
  reads.clear()
  with pg.expect_navigation(wait_until='domcontentloaded'):pg.get_by_role('button',name='Apply studies').click()
  assert all(s in pg.url for s in ('duneGrassSurface',route,'stable=1')),pg.url
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.grassCoast?.authorized")
  before=pg.evaluate('window.islandAirDiagnostics');pg.get_by_role('button',name='Begin flight').click()
  pg.wait_for_function("([x,z])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>175}",
      arg=[before['x'],before['z']],polling=200)
  pg.keyboard.press('KeyV');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
  pg.wait_for_function("([x,z])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>380}",
      arg=[before['x'],before['z']],polling=200)
  if not a.fault:pg.wait_for_function("window.islandAirDiagnostics?.grassCoast?.active.length>0")
  else:pg.wait_for_function("window.islandAirDiagnostics?.grassCoast?.failed>0")
  pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  after=pg.evaluate('window.islandAirDiagnostics')
  state=after['grassCoast']
  assert bool(state['active'])==(not a.fault) and not erro and not after['layerWarnings'],(state,erro,after['layerWarnings'])
  assert after['site']==route and after['altitude']-after['groundY']>45,(after['site'],after['altitude'],after['groundY'])
  assert sum(n=='sparse-grass-photometric.png' and s==200 for n,s in reads)==1
  assert sum(n=='authority.pack' and s==200 for n,s in reads)==1
  out={'trafficAfterNamedStudyReload':True,'materialActive':not a.fault,'diagnostics':state,
       'ordinaryTravelM':math.hypot(after['x']-before['x'],after['z']-before['z']),
       'heightAGLM':after['altitude']-after['groundY'],'fault':a.fault,'requests':reads,'errors':erro,'route':route}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
