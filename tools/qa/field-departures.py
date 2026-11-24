"""Fly all three field comparison starts with ordinary game controls."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(exist_ok=True,parents=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
sites=[('prince-fields','Prince County · fields low pass'),('queens-fields','Queens County · fields low pass'),('kings-fields','Kings County · fields low pass')]
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist.resolve()))) as server,sync_playwright() as driver:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 browser=driver.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  page=browser.new_page(viewport={'width':510,'height':335});page.set_default_timeout(155000)
  errors=[];results=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics&cropRowsReview',wait_until='domcontentloaded')
  page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.cropRowsReview")
  for i,(id,label) in enumerate(sites):
   if i==0:
    page.select_option('#site',label=label);page.get_by_role('button',name='Begin flight').click()
   else:
    page.locator('#nav-map').click();page.select_option('#map-site',label=label);page.locator('#fly-here').click()
   page.wait_for_function("v=>window.islandAirDiagnostics?.site===v&&window.islandAirDiagnostics?.mode==='flight'",arg=id)
   start=page.evaluate('window.islandAirDiagnostics')
   page.wait_for_function("""s=>{const a=window.islandAirDiagnostics,t=a.buildingTiles;return a.site===s.site&&a.mode==='flight'&&a.cropRowsReview&&Math.hypot(a.x-s.x,a.z-s.z)>105&&a.altitude-a.groundY>34&&a.roads&&a.detail.ready>0&&!a.detail.missing&&t?.ready>0&&!t.failed}""",arg=start,polling=250)
   end=page.evaluate('window.islandAirDiagnostics')
   assert not end['layerWarnings'] and not errors,(end['layerWarnings'],errors)
   result={'site':id,'travelled':math.hypot(end['x']-start['x'],end['z']-start['z']),'aboveGroundM':end['altitude']-end['groundY'],'tileCount':end['detail']['ready'],'cropLoaded':end['cropRowsReview'],'warnings':end['layerWarnings']}
   results.append(result);print(result,flush=True)
   page.screenshot(path=str(a.out/(id+'.png')),timeout=100000)
   (a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
  page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
 finally:
  browser.close();server.shutdown()
