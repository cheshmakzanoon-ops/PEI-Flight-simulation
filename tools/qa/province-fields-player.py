"""Verify the compiled player, origin scope, missing field packs, and terrain exclusions."""
import argparse,functools,http.server,json,math,threading,re
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--cases',default='stock,live,missing,adaptive,cape')
a=p.parse_args();a.out.mkdir(exist_ok=True,parents=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def translate_path(self,path):
  path=path.split('?',1)[0]
  return super().translate_path(path.removeprefix('/PEI-Flight-simulation/')if path.startswith('/PEI-Flight-simulation/')else '/no-app/')
def accepted(case):
 return {'stock':'','live':'&provinceFieldsReview','missing':'&provinceFieldsReview','adaptive':'&provinceFieldsReview&surveyRelief','cape':'&provinceFieldsReview&northCapeWind'}[case]
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  for case in a.cases.split(','):
   requests=[];responses=[];errors=[]
   r=b.new_page(viewport={'width':460,'height':300});r.set_default_timeout(145000)
   r.on('pageerror',lambda e:errors.append(str(e)))
   def touch(event):
    if '/fields-province/'in event.url:requests.append(event.url.rsplit('/',1)[-1])
   r.on('request',touch)
   r.on('response',lambda s:responses.append([s.url.rsplit('/',1)[-1],s.status]) if '/fields-province/'in s.url else None)
   def console(m):
    if m.type=='error'and not(case=='missing'and '/fields-province/'in m.location.get('url','')):errors.append(m.text)
   r.on('console',console)
   if case=='missing':r.route(re.compile(r'/fields-province/v2/crop-\d+\.pack$'),lambda route:route.fulfill(status=404,body='Expected optional pack failure'))
   r.goto(f'http://127.0.0.1:{server.server_port}/PEI-Flight-simulation/?diagnostics'+accepted(case),wait_until='domcontentloaded')
   r.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
   r.select_option('#site',label='Prince County · fields low pass')
   r.get_by_role('button',name='Begin flight').click()
   r.wait_for_function("window.islandAirDiagnostics?.site==='prince-fields'&&window.islandAirDiagnostics.mode==='flight'")
   start=r.evaluate('window.islandAirDiagnostics')
   if case=='live':r.wait_for_function("window.islandAirDiagnostics?.provinceFields?.ready>0")
   r.wait_for_function("""s=>{const a=window.islandAirDiagnostics;return a.mode==='flight'&&a.site===s.site&&
     Math.hypot(a.x-s.x,a.z-s.z)>75&&a.roads&&a.buildingTiles?.ready>0&&!a.buildingTiles.failed&&
     a.detail.ready>0&&!a.detail.missing}""",arg=start,polling=250)
   d=r.evaluate('window.islandAirDiagnostics')
   report={'case':case,'metres':math.hypot(d['x']-start['x'],d['z']-start['z']),'fieldStream':d['provinceFields'],'requests':requests,'responses':responses,'warnings':d['layerWarnings'],'errors':errors}
   assert not errors and not d['layerWarnings'],report
   if case in ('stock','adaptive','cape'):assert not requests and d['provinceFields']is None,report
   else:
    assert 'index.fcr.gz'in requests and any(n.endswith('.pack')for n in requests),report
    if case=='live':assert d['provinceFields']['ready']>0 and any(s in (200,206)for _,s in responses),report
    else:assert d['provinceFields']['ready']==0 and any(s==404 for _,s in responses),report
   (a.out/(case+'.json')).write_text(json.dumps(report,indent=2)+'\n')
   r.screenshot(path=str(a.out/(case+'.png')),timeout=95000)
   print(report,flush=True);r.close()
 finally:
  b.close();server.shutdown()
