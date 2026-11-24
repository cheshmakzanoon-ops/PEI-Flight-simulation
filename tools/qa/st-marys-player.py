"""Exercise the authenticated Indian River scene through ordinary Dispatch and flight."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--departure',default='indian-river-country-pass')
p.add_argument('--distance',type=float,default=150)
p.add_argument('--corrupt',choices=['grade','sun'])
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Local(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
 def translate_path(self,url):
  name=urlsplit(url).path
  return super().translate_path(name[len(prefix):]if name.startswith(prefix)else '/unrelated/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Local,directory=str(a.dist.resolve())))as server,sync_playwright()as p:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 with p.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  page=b.new_page(viewport={'width':680,'height':500});page.set_default_timeout(170000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  url=f'http://127.0.0.1:{server.server_port}'+prefix+'?diagnostics&departure='+a.departure+'&unrelated=keep'
  if a.corrupt:
   failed,n=('ground.g11.gz',4021)if a.corrupt=='grade'else ('sun-cast.r8.gz',1667)
   page.route('**/indian-river/v1/'+failed,lambda r:r.fulfill(status=200,body=bytes(n)))
  reads=[]
  page.on('response',lambda r:reads.append({'asset':urlsplit(r.url).path.rsplit('/',1)[-1],'status':r.status}) if '/indian-river/v1/' in r.url else None)
  page.goto(url,wait_until='domcontentloaded');page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  assert page.evaluate("window.islandAirDiagnostics.indianRiver===false")
  assert not reads
  page.locator('.scenery-reviews summary').click();page.get_by_label('St. Mary’s exterior').check()
  with page.expect_navigation(wait_until='domcontentloaded'):page.get_by_role('button',name='Apply studies').click()
  assert 'indianRiverReview' in page.url and 'unrelated=keep' in page.url and a.departure in page.url
  page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.buildings")
  if not a.corrupt:
   page.wait_for_function("window.islandAirDiagnostics.localGroundGrade==='st-marys-2020-grade-study'&&window.islandAirDiagnostics.indianRiver&&window.islandAirDiagnostics.indianRiverSun&&window.islandAirDiagnostics.indianRiverShadowTriangles>0")
   print('active at dispatch',page.evaluate("JSON.stringify({triangles:window.islandAirDiagnostics.indianRiverShadowTriangles,ground:window.islandAirDiagnostics.localGroundGrade})"),flush=True)
  else:assert page.evaluate("window.islandAirDiagnostics.localGroundGrade===null")
  initial=page.evaluate('window.islandAirDiagnostics')
  page.get_by_role('button',name='Begin flight').click()
  page.wait_for_function("""([x,z,target])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>target}""",arg=[initial['x'],initial['z'],a.distance],polling=200)
  d=page.evaluate('window.islandAirDiagnostics')
  if a.corrupt:
   assert d['indianRiver'] is False and d['indianRiverSun'] is False and d['indianRiverShadowTriangles']==0 and d['localGroundGrade'] is None
  else:
   assert d['indianRiver'] is True and d['indianRiverSun'] is True and d['indianRiverShadowTriangles']>0 and d['localGroundGrade']=='st-marys-2020-grade-study'
  assert d['site']==a.departure and d['altitude']-d['groundY']>50 and not errors
  out={'atomicArt':d['indianRiver'],'churchSun':d['indianRiverSun'],'nearShadowTriangles':d['indianRiverShadowTriangles'],'ownerPrepared':d['indianRiverPrepared'],'startingStandardFetchedNoGrade':True,'departure':a.departure,'corruptAsset':a.corrupt,
      'travelM':math.hypot(d['x']-initial['x'],d['z']-initial['z']),'localGroundGrade':d['localGroundGrade'],'responses':reads,'errors':errors}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
