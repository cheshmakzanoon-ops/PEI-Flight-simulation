"""Exercise the real packaged western dune option and its all-or-stock fallback."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--fault',choices=['photo','grade'])
p.add_argument('--distance',type=float,default=640)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
PREFIX='/PEI-Flight-simulation/'
ASSETS={'west-dune-native-optics.png':136660,'west-dune-ground.g11.gz':2384}
KEY='hog-island-west-native-ground'
class Static(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(PREFIX):]if path.startswith(PREFIX)else '/unrelated/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Static,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  pg=b.new_page(viewport={'width':460,'height':338});pg.set_default_timeout(105000)
  erro=[];reads=[]
  pg.on('pageerror',lambda e:erro.append(str(e)))
  pg.on('console',lambda e:erro.append(e.text)if e.type=='error'else None)
  def registered(r):
   name=urlsplit(r.url).path.rsplit('/',1)[-1]
   if name in ASSETS:reads.append((name,r.status))
  pg.on('response',registered)
  if a.fault:
   f='west-dune-native-optics.png' if a.fault=='photo' else 'west-dune-ground.g11.gz'
   pg.route('**/hog-island/v1/'+f,lambda route:route.fulfill(status=200,body=bytes(ASSETS[f])))
  url=f'http://127.0.0.1:{server.server_port}'+PREFIX+'?diagnostics&departure=hog-island-west-pass&stable=1'
  pg.goto(url,wait_until='domcontentloaded')
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  assert not reads and not pg.evaluate('window.islandAirDiagnostics.hogWestAerial')
  pg.locator('.scenery-reviews summary').click();pg.get_by_label('Hog Island dune ground').check()
  with pg.expect_navigation(wait_until='domcontentloaded'):pg.get_by_role('button',name='Apply studies').click()
  assert all(s in pg.url for s in ('hogIslandWestGround','hog-island-west-pass','stable=1')),pg.url
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.roads&&window.islandAirDiagnostics?.buildings")
  if not a.fault:
   pg.wait_for_function(f"window.islandAirDiagnostics?.localGroundGrades?.includes('{KEY}')&&window.islandAirDiagnostics?.hogWestAerial")
  before=pg.evaluate('window.islandAirDiagnostics')
  assert (KEY in before['localGroundGrades'])==(not a.fault)
  assert before['hogWestAerial']==(not a.fault)
  pg.get_by_role('button',name='Begin flight').click()
  pg.wait_for_function("([x,z,m])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>m}",
      arg=[before['x'],before['z'],a.distance],polling=200)
  pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  after=pg.evaluate('window.islandAirDiagnostics')
  assert (KEY in after['localGroundGrades'])==(not a.fault)
  assert after['hogWestAerial']==(not a.fault)
  assert after['site']=='hog-island-west-pass' and after['altitude']-after['groundY']>55 and not erro and not after['layerWarnings']
  assert sorted(reads)==sorted((f,200)for f in ASSETS),reads
  out={'standardZeroOptionalRequests':True,'pairedActivation':after['hogWestAerial'],
       'groundInstalled':KEY in after['localGroundGrades'],'ordinaryTravelM':math.hypot(after['x']-before['x'],after['z']-before['z']),
       'heightAGLM':after['altitude']-after['groundY'],'fault':a.fault,'requests':reads,'errors':erro}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
