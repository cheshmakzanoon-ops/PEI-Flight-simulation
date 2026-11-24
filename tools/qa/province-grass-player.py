"""Exercise packaged Ground vegetation through ordinary Dispatch and flight."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--departure',default='prince-grassland')
p.add_argument('--distance',type=float,default=150)
p.add_argument('--corrupt',action='store_true')
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
  if a.corrupt:page.route('**/grass-study/index.fcr.gz',lambda r:r.fulfill(status=200,body=bytes(249810)))
  page.goto(url,wait_until='domcontentloaded');page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  assert page.evaluate("window.islandAirDiagnostics.provinceGrass===null")
  assert not page.evaluate("performance.getEntriesByType('resource').some(r=>r.name.includes('grass-study/'))")
  page.locator('.scenery-reviews summary').click();page.get_by_label('Ground vegetation').check()
  with page.expect_navigation(wait_until='domcontentloaded'):page.get_by_role('button',name='Apply studies').click()
  assert 'sourceGrassStudy' in page.url and 'unrelated=keep' in page.url and a.departure in page.url
  page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  if not a.corrupt:
   page.wait_for_function('window.islandAirDiagnostics?.provinceGrass?.active&&window.islandAirDiagnostics.provinceGrass.ready>0')
  else:assert page.evaluate("window.islandAirDiagnostics.provinceGrass===null")
  initial=page.evaluate('window.islandAirDiagnostics')
  page.get_by_role('button',name='Begin flight').click()
  page.wait_for_function("""([x,z,target])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>target}""",arg=[initial['x'],initial['z'],a.distance],polling=200)
  d=page.evaluate('window.islandAirDiagnostics')
  if not a.corrupt:assert d['provinceGrass']['ready']>0 and d['provinceGrass']['slots']==4 and d['provinceGrass']['pending']<=2
  else:assert d['provinceGrass']is None and not page.evaluate("performance.getEntriesByType('resource').some(r=>r.name.includes('grass-study/')&&r.name.endsWith('.pack'))")
  assert d['site']==a.departure and d['altitude']-d['groundY']>50 and not errors
  out={'normalDispatch':True,'startingStandardFetchedNoGrass':True,'departure':a.departure,'corruptDirectoryFallsBack':a.corrupt,
      'travelM':math.hypot(d['x']-initial['x'],d['z']-initial['z']),'activeLayerState':d['provinceGrass'],'errors':errors}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
