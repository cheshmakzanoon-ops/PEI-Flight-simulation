"""Fly the real Vite release from the Dalvay dispatch: genuine artwork, unavailable artwork and explicit stock.
No fixed QA camera, generated art, shader edits, simulated clock, position change or custom scene hooks.
"""
import argparse,functools,http.server,hashlib,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',required=True,type=Path);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--modes',default='active,missing,stock')
a=p.parse_args();a.dist=a.dist.resolve();a.out.mkdir(parents=True,exist_ok=True)
site='dalvay-lake-coastal-pass';prefix='/PEI-Flight-simulation/';name='dalvay-manor-exterior-v2.dvx'
wire=(a.dist/'art'/name).read_bytes();expected_hash='35b99bcb553c16a25960f98ea540a6313c315d622e5cc75f9aa27b2512ff6382'
assert len(wire)==504132 and hashlib.sha256(wire).hexdigest()==expected_hash
assert all('__manorScope' not in f.read_text() and '__qaSeatReport' not in f.read_text() for f in (a.dist/'assets').glob('index-*.js'))
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(prefix):] if path.startswith(prefix) else '/no-app/')
def state(page):
 return page.evaluate("""()=>{const g=window.islandAirDiagnostics;const c=document.querySelector('#world').getContext('webgl2');
  return g&&{phase:g.mode,site:g.site,cam:g.camera,x:g.x,z:g.z,alt:g.altitude,art:g.dalvayExterior,
   lake:g.dalvayWaterOptics,waterAdmission:g.dalvayWaterAdmission,buildings:g.buildingTiles,
   detail:g.detail,roads:g.roads,layerWarnings:g.layerWarnings,draws:g.drawCalls,triangles:g.triangles,
   GLerror:c.getError(),contextLost:c.isContextLost(),injectedQA:typeof window.__manorScope!=='undefined'};}""")
def flight(page,start,threshold):
 page.wait_for_function("""q=>{const g=window.islandAirDiagnostics;
  return g?.mode==='flight'&&Math.hypot(g.x-q.x,g.z-q.z)>q.d&&g.roads&&g.detail.ready>0&&!g.detail.missing&&g.buildingTiles?.wanted>0}""",
  arg={'x':start['x'],'z':start['z'],'d':threshold},polling=200,timeout=225000)
modes=a.modes.split(',');assert all(q in ('active','missing','stock')for q in modes)
results={};confirmed=0
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(a.dist))) as server, sync_playwright() as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  for mode in modes:
   page=browser.new_page(viewport={'width':480,'height':320});page.set_default_timeout(180000);errors=[];expected=[];artRequests=[];bodyResponses=[];module=[];water=[]
   def is_art(url):return urlsplit(url).path.endswith('/'+name)
   def request(q):
    path=urlsplit(q.url).path
    if is_art(q.url):artRequests.append(path)
    if '/assets/dalvay-art-packet-' in path:module.append(path)
    if '/dalvay-optics/' in path or '/assets/dalvay-lake-optics-' in path:water.append(path)
   def response(q):
    if is_art(q.url):bodyResponses.append(q)
    if q.status>=400 and not (is_art(q.url) and mode=='missing' and q.status==404):errors.append([q.status,q.url])
   def console(m):
    if m.type=='error':
     if mode=='missing' and is_art(m.location.get('url','')) and '404' in m.text:expected.append('asset 404')
     else:errors.append(m.text)
   page.on('request',request);page.on('response',response);page.on('console',console);page.on('pageerror',lambda err:errors.append(str(err)))
   if mode=='missing':page.route('**/'+name,lambda route:route.fulfill(status=404,content_type='application/octet-stream',body=''))
   url=f'http://127.0.0.1:{server.server_port}'+prefix+'?diagnostics&departure='+site+'&dalvayExteriorStudy&stockDalvayWaterOptics'
   if mode=='stock':url+='&stockDalvayExterior'
   assert page.goto(url,wait_until='domcontentloaded').status==200
   try:
    page.wait_for_function("id=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.site===id",arg=site,polling=200)
    before=state(page);print(mode,'dispatch',before['alt'],before['art'],flush=True)
    page.get_by_role('button',name='Begin flight').click()
    flight(page,before,max(140,confirmed-10) if confirmed else (140 if mode=='active' else 950))
    if mode=='active':page.wait_for_function("window.islandAirDiagnostics?.dalvayExterior==='authored'",polling=150,timeout=210000)
    elif mode=='missing':
     page.wait_for_function("file=>performance.getEntriesByType('resource').some(e=>new URL(e.name).pathname.endsWith('/'+file))",arg=name,polling=150,timeout=210000)
    # Same terrain cohort and equivalent position, not a stock-only test at an unrelated departure.
    approach=state(page);moved=math.hypot(approach['x']-before['x'],approach['z']-before['z'])
    if mode=='active':confirmed=moved
    print(mode,'approach',round(moved,1),approach['art'],len(bodyResponses),flush=True)
    assert approach['art']==('authored' if mode=='active' else 'stock')
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Wide chase'")
    page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    last=state(page);assert last['site']==site and last['phase']=='paused' and last['cam']=='Wide chase'
    assert last['art']==('authored' if mode=='active' else 'stock')
    assert all(k['lake'] is None and k['waterAdmission']=='idle' and k['GLerror']==0 and not k['contextLost'] and not k['injectedQA'] for k in [before,approach,last])
    assert not water and not errors and not last['layerWarnings'],(water,errors,last)
    codes=[q.status for q in bodyResponses];assert codes=={'active':[200],'missing':[404],'stock':[]}[mode],codes
    assert len(artRequests)==len(module)==(0 if mode=='stock' else 1),(artRequests,module)
    got=None
    if mode=='active':
     b=bodyResponses[0].body();got=hashlib.sha256(b).hexdigest();assert len(b)==len(wire) and got==expected_hash
    results[mode]={'site':site,'initial':before,'approach':approach,'paused':last,'distanceAtApproachM':round(moved,2),'deltaFromDispatchAtPauseM':round(math.hypot(last['x']-before['x'],last['z']-before['z']),2),'assetCodes':codes,'assetCount':len(artRequests),'wireSHA256':got,'moduleCount':len(module),'waterRequests':water,'expectedFaultConsole':expected,'errors':errors,'controls':['Begin flight','Cockpit','Wide chase','Escape → Pause']}
    (a.out/'compiled-player.json').write_text(json.dumps(results,indent=2)+'\n');print(mode,'passed',codes,got,flush=True)
   except Exception:
    print('failed',mode,state(page),[q.status for q in bodyResponses],errors,flush=True);raise
   finally:page.close()
 finally:browser.close();server.shutdown()
