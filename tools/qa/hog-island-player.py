"""Exercise the authenticated Hog Island photo surface through ordinary Dispatch and flight."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--departure',default='hog-island-west-pass')
p.add_argument('--distance',type=float,default=150)
p.add_argument('--corrupt',choices=['west','east'])
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
  page=b.new_page(viewport={'width':460,'height':338});page.set_default_timeout(170000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  url=f'http://127.0.0.1:{server.server_port}'+prefix+'?diagnostics&departure='+a.departure+'&unrelated=keep'
  if a.corrupt:
   filename,n=('hog-west-optics.png',250758)if a.corrupt=='west'else ('hog-east-optics.png',93810)
   page.route('**/hog-island/v1/'+filename,lambda r:r.fulfill(status=200,body=bytes(n)))
  reads=[]
  page.on('response',lambda r:reads.append({'asset':urlsplit(r.url).path.rsplit('/',1)[-1],'status':r.status}) if '/hog-island/v1/' in r.url else None)
  page.goto(url,wait_until='domcontentloaded');page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  assert page.evaluate("window.islandAirDiagnostics.hogPhoto===false")
  assert not reads
  page.locator('.scenery-reviews summary').click();page.get_by_label('Hog Island aerial detail').check()
  with page.expect_navigation(wait_until='domcontentloaded'):page.get_by_role('button',name='Apply studies').click()
  assert 'hogIslandPhotoStudy' in page.url and 'unrelated=keep' in page.url and a.departure in page.url
  page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.buildings&&window.islandAirDiagnostics?.roads")
  if a.corrupt:assert page.evaluate("window.islandAirDiagnostics.hogPhoto===false")
  else:page.wait_for_function("window.islandAirDiagnostics.hogPhoto===true")
  initial=page.evaluate('window.islandAirDiagnostics')
  page.get_by_role('button',name='Begin flight').click()
  page.wait_for_function("""([x,z,target])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>target}""",arg=[initial['x'],initial['z'],a.distance],polling=200)
  d=page.evaluate('window.islandAirDiagnostics')
  assert d['hogPhoto'] is (a.corrupt is None) and d['site']==a.departure and d['altitude']-d['groundY']>55 and not errors
  assert sorted(q['asset'] for q in reads)==['hog-east-optics.png','hog-west-optics.png'] and all(q['status']==200 for q in reads)
  out={'photoActive':d['hogPhoto'],'standardZeroPhotoRequests':True,'departure':a.departure,'fault':a.corrupt,
   'travelM':math.hypot(d['x']-initial['x'],d['z']-initial['z']),'heightAGLEnd':d['altitude']-d['groundY'],'assetResponses':reads,'errors':errors}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
