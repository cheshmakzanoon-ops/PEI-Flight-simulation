"""Exercise the Vite bundle, stock aircraft and unmodified camera. No QA dispatch or camera modifications."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--modes',default='active,missing,stock')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
name='2021-visual-core.dlb'
site='dalvay-lake-coastal-pass'
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*x):pass
 def translate_path(self,url):
  q=urlsplit(url).path
  return super().translate_path(q[len(prefix):] if q.startswith(prefix) else '/no-app/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(a.dist.resolve()))) as s, sync_playwright() as pw:
 threading.Thread(target=s.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  results={}
  for mode in a.modes.split(','):
   assert mode in ('active','missing','stock')
   page=b.new_page(viewport={'width':560,'height':370});page.set_default_timeout(225000)
   errors=[];expected=[];paths=[];statuses=[];modules=[]
   def asset(u):return urlsplit(u).path.endswith('/'+name)
   def request(r):
    u=urlsplit(r.url).path
    if asset(r.url):paths.append(u)
    if '/assets/dalvay-lake-optics-' in u:modules.append(u)
   def response(r):
    if asset(r.url):
     statuses.append([r.status,r.headers.get('content-encoding')])
     if r.status==404 and mode=='missing':return
    if r.status>=400:errors.append(f'{r.status} {r.url}')
   def console(m):
    if m.type!='error':return
    if mode=='missing' and asset(m.location.get('url','')) and '404' in m.text:expected.append('optional body 404')
    else:errors.append(m.text)
   page.on('request',request);page.on('response',response);page.on('console',console)
   page.on('pageerror',lambda e:errors.append(str(e)))
   if mode=='missing':page.route('**/'+name,lambda r:r.fulfill(status=404,content_type='application/octet-stream',body=''))
   url=f'http://127.0.0.1:{s.server_port}'+prefix+'?diagnostics&dalvayWaterOptics&departure='+site
   if mode=='stock':url+='&stockDalvayWaterOptics'
   response_main=page.goto(url,wait_until='domcontentloaded')
   print(mode,'navigated',response_main.status,page.title(),flush=True)
   try:
    page.wait_for_function("site=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.site===site",arg=site,timeout=85000,polling=250)
   except Exception:
    print('dispatch gate failed',mode,page.evaluate("""()=>({title:document.title,diag:window.islandAirDiagnostics?.mode,site:window.islandAirDiagnostics?.site,body:document.body.innerText.slice(0,400)})"""),statuses,errors,flush=True)
    raise
   before=page.evaluate('window.islandAirDiagnostics')
   print(mode,'dispatch ready',before['site'],flush=True)
   page.get_by_role('button',name='Begin flight').click()
   min_distance=1750 if mode=='active' else 725
   try:
    page.wait_for_function("""p=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&
     Math.hypot(d.x-p.x,d.z-p.z)>p.min&&d.roads&&d.detail.ready>0&&!d.detail.missing}""",arg={'x':before['x'],'z':before['z'],'min':min_distance},polling=250)
   except Exception:
    print('distance gate failed',mode,page.evaluate("""()=>{const d=window.islandAirDiagnostics;return {mode:d?.mode,x:d?.x,z:d?.z,site:d?.site,ready:d?.detail,roads:d?.roads,admission:d?.dalvayWaterAdmission}}"""),statuses,errors,flush=True)
    raise
   print(mode,'flight distance ready',min_distance,flush=True)

   exp={'active':'ready','missing':'unavailable','stock':'idle'}[mode]
   page.wait_for_function("wanted=>window.islandAirDiagnostics?.dalvayWaterAdmission===wanted",arg=exp)
   if mode=='active':page.wait_for_function("window.islandAirDiagnostics?.dalvayWaterOptics?.active===true")
   page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
   page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Wide chase'")
   page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
   last=page.evaluate('window.islandAirDiagnostics')
   assert last['altitude']>95 and last['site']==site and not last['layerWarnings'] and not errors,(last,errors)
   assert bool(last['dalvayWaterOptics'] and last['dalvayWaterOptics']['active'])==(mode=='active')
   assert statuses=={'active':[[200,None]],'missing':[[404,None]],'stock':[]}[mode],statuses
   assert len(paths)==len(modules)==(0 if mode=='stock' else 1),(paths,modules)
   if mode=='active':assert last['dalvayWaterOptics']['receivers']==['17-12','17-13']
   result=results[mode]={'phase':last['mode'],'optic':last['dalvayWaterOptics'],'admission':last['dalvayWaterAdmission'],
    'distanceM':round(math.hypot(last['x']-before['x'],last['z']-before['z']),2),'assetResponses':statuses,
    'assetCount':len(paths),'moduleCount':len(modules),'checked': ['Begin flight','Cockpit','Wide chase','Pause'],
    'expectedConsole':expected,'errors':errors,'warnings':last['layerWarnings']}
   (a.out/'compiled-receipts.json').write_text(json.dumps(results,indent=2)+'\n')
   print(mode,result,flush=True)
   page.close()
 finally:
  b.close();s.shutdown()
