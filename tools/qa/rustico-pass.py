"""Record a normal compiled-player North Rustico pass, with No JS camera/flight hooks."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--preview',action='store_true');p.add_argument('--corrupt',action='store_true')
p.add_argument('--metrics-only',action='store_true',help='Record real flight diagnostics without compositor captures.')
p.add_argument('--apron',action='store_true',help='Require local dry soil; no low foliage may draw on this flight.')
p.add_argument('--envelope',action='store_true',help='Require the verified nearby building envelope in this pass.')
p.add_argument('--dispatch',action='store_true',help='Enable the study through the normal Dispatch control rather than a bookmark.')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(prefix):]if path.startswith(prefix) else '/wrong-app/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(a.dist.resolve())))as s,sync_playwright()as pw:
 threading.Thread(target=s.serve_forever,daemon=True).start()
 errors=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  url=f'http://127.0.0.1:{s.server_port}'+prefix+'?diagnostics&departure=north-rustico-harbour-low'
  page=b.new_page(viewport={'width':640 if a.metrics_only else 1000,'height':480 if a.metrics_only else 680});page.set_default_timeout(150000)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  if a.corrupt:
   page.route('**/rustico/v1/lighthouse-ground.g11.gz',lambda r:r.fulfill(status=200,body=b'Intentionally invalid terrain.'))
  assert not a.dispatch or a.preview
  if a.dispatch:
   page.goto(url+'&unrelated=keep',wait_until='domcontentloaded')
   page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
   assert not page.evaluate("performance.getEntriesByType('resource').some(r=>r.name.includes('lighthouse-ground.g11.gz'))")
   page.locator('.scenery-reviews summary').click()
   page.get_by_label('North Rustico lighthouse').check()
   with page.expect_navigation(wait_until='domcontentloaded'):
    page.get_by_role('button',name='Apply studies').click()
   assert 'departure=north-rustico-harbour-low' in page.url and 'unrelated=keep' in page.url
  else:
   page.goto(url+('&northRusticoLighthouseStudy' if a.preview or a.corrupt else ''),wait_until='domcontentloaded')
  page.wait_for_function("""()=>{const d=window.islandAirDiagnostics;return d?.site==='north-rustico-harbour-low'&&d.mode==='dispatch'&&d.roads&&d.buildings;}""")
  if a.preview:
   page.wait_for_function('window.islandAirDiagnostics?.northRusticoLighthouse?.seat==="verified"')
  if a.envelope:
   assert a.preview
   page.wait_for_function('window.islandAirDiagnostics?.rusticoMassingReview===true')
  start=page.evaluate('window.islandAirDiagnostics')
  if not a.preview:assert start['northRusticoLighthouse'] is None and start['localGroundGrade'] is None
  if a.corrupt:assert not a.preview
  assert 71.9 < start['altitude']-start['groundY'] < 72.1
  course=start['heading']; page.get_by_role('button',name='Begin flight').click()
  captures=[]
  for travel in ((38,72,104) if a.metrics_only else (300,433,535)):
   page.wait_for_function("""([x,z,dmin])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>dmin}""",arg=[start['x'],start['z'],travel],polling=100)
   d=page.evaluate('window.islandAirDiagnostics');distance=math.hypot(d['x']-start['x'],d['z']-start['z'])
   assert 70<d['altitude']-d['groundY']<100 and abs(d['heading']-course)<.5
   if a.preview:assert d['northRusticoLighthouse']['seat']=='verified'
   if a.envelope:assert d['rusticoMassingReview']
   if a.apron:assert d['rusticoDrySoil'] and d['rusticoDryTussocks']==0
   if not a.metrics_only:page.screenshot(path=str(a.out/f'pass-{travel}.png'),timeout=30000)
   captures.append({**{k:d.get(k)for k in ('x','z','altitude','groundY','heading','mode','triangles','drawCalls','northRusticoLighthouse')},'travelMetres':distance})
  assert not errors,errors
  report={'route':'north-rustico-harbour-low','samePublicDispatchAndFlightLoop':True,'preview':a.preview,'apronRequired':a.apron,'enabledThroughDispatch':a.dispatch,'corruptGroundFallsBackToStock':a.corrupt,'captures':captures,'errors':errors}
  (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  print(json.dumps(report),flush=True)
