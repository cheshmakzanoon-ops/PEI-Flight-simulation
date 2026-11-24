"""Normal packaged measured dune relief and invalid-download fallback."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--county',choices=['prince','queens','kings'],default='prince')
g=p.add_mutually_exclusive_group();g.add_argument('--fault',action='store_true');g.add_argument('--stock',action='store_true');g.add_argument('--distant',action='store_true')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
PREFIX='/PEI-Flight-simulation/'
FILES=('prince-native-ground.g11.gz','kings-native-ground.g11.gz')
KEY=a.county+'-measured-dune-relief'
class Static(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
 def translate_path(self,url):
  p=urlsplit(url).path
  return super().translate_path(p[len(PREFIX):]if p.startswith(PREFIX)else '/unrelated/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Static,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  pg=b.new_page(viewport={'width':460,'height':338});pg.set_default_timeout(100000)
  err=[];reads=[]
  pg.on('pageerror',lambda e:err.append(str(e)))
  pg.on('console',lambda e:err.append(e.text)if e.type=='error'else None)
  def track(r):
   u=urlsplit(r.url)
   if '/dune-relief/v1/' in u.path:reads.append((u.path.rsplit('/',1)[-1],r.status))
  pg.on('response',track)
  if a.fault:
   filename=a.county+'-native-ground.g11.gz'
   n=(a.dist/'world/dune-relief/v1'/filename).stat().st_size
   pg.route('**/dune-relief/v1/'+filename,lambda route:route.fulfill(status=200,body=bytes(n)))
  site='montague' if a.distant else a.county+'-sand-dunes'
  url=f'http://127.0.0.1:{server.server_port}'+PREFIX+'?diagnostics&departure='+site+'&kept=1'+('&stockDuneRelief' if a.stock else '')
  pg.goto(url,wait_until='domcontentloaded');pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  expect=not(a.fault or a.stock or a.distant or a.county=='queens')
  before=pg.evaluate('window.islandAirDiagnostics');pg.get_by_role('button',name='Begin flight').click()
  pg.wait_for_function("([x,z])=>{const a=window.islandAirDiagnostics;return a?.mode==='flight'&&Math.hypot(a.x-x,a.z-z)>370}",
    arg=[before['x'],before['z']],polling=200)
  if not a.distant:pg.wait_for_function("window.islandAirDiagnostics?.duneSand?.active.length>0")
  if expect:pg.wait_for_function(f"window.islandAirDiagnostics?.localGroundGrades?.includes('{KEY}')")
  pg.keyboard.press('KeyV');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
  pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  after=pg.evaluate("window.islandAirDiagnostics");
  assert (KEY in after['localGroundGrades'])==expect and not err and not after['layerWarnings']
  assert after['site']==site and after['altitude']-after['groundY']>45
  assert reads==([(a.county+'-native-ground.g11.gz',200)] if expect or a.fault else []),reads
  out={'route':site,'exactLocalGrade':after['localGroundGrades'],'duneSandStillActive':after['duneSand']['active'],
   'fault':a.fault,'stock':a.stock,'distant':a.distant,'groundTransfer':reads,'heightAGLM':after['altitude']-after['groundY'],
   'flightDistanceM':math.hypot(after['x']-before['x'],after['z']-before['z']),'errors':err}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
