"""Fly the unmodified compiled Vite release from its O’Leary dispatch: genuine artwork, unavailable artwork and explicit stock.
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
site='oleary-railway-low';prefix='/PEI-Flight-simulation/';name='oleary-railway-exterior-v1.olx'
X,Z=-78729.85614635695,-23078.19701513572
wire=(a.dist/'art'/name).read_bytes();expected_hash='685b4b3f23345c66dd588d74c307e9a4e82cc2b5c3d12cfd2ad159bb3b1ad681'
assert len(wire)==111961 and hashlib.sha256(wire).hexdigest()==expected_hash
assert all('__olearyCapture' not in f.read_text() and 'olQaSurface' not in f.read_text() for f in (a.dist/'assets').glob('index-*.js'))
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(prefix):] if path.startswith(prefix) else '/no-app/')
def state(page):
 return page.evaluate("""()=>{const g=window.islandAirDiagnostics;const c=document.querySelector('#world').getContext('webgl2');
  return g&&{phase:g.mode,site:g.site,cam:g.camera,x:g.x,z:g.z,alt:g.altitude,art:g.olearyExterior,heading:g.heading,
   lake:g.dalvayWaterOptics,waterAdmission:g.dalvayWaterAdmission,buildings:g.buildingTiles,
   detail:g.detail,roads:g.roads,layerWarnings:g.layerWarnings,draws:g.drawCalls,triangles:g.triangles,
   GLerror:c.getError(),contextLost:c.isContextLost(),injectedQA:typeof window.__olearyCapture!=='undefined'};}""")
def flight(page,start,threshold):
 page.wait_for_function("""q=>{const g=window.islandAirDiagnostics;
  return g?.mode==='flight'&&Math.hypot(g.x-q.x,g.z-q.z)>q.d&&g.roads&&g.detail.ready>0&&!g.detail.missing&&g.buildingTiles?.wanted>0}""",
  arg={'x':start['x'],'z':start['z'],'d':threshold},polling=200,timeout=225000)
modes=a.modes.split(',');assert all(q in ('active','missing','stock')for q in modes)
results={}
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(a.dist))) as server, sync_playwright() as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--disable-setuid-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist','--disable-background-networking'])
 try:
  for mode in modes:
   page=browser.new_page(viewport={'width':600,'height':400});page.set_default_timeout(180000);errors=[];expected=[];artRequests=[];bodyResponses=[];module=[];water=[]
   def is_art(url):return urlsplit(url).path.endswith('/'+name)
   def request(q):
    path=urlsplit(q.url).path
    if is_art(q.url):artRequests.append(path)
    if '/assets/packet-' in path:module.append(path)
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
   url=f'http://127.0.0.1:{server.server_port}'+prefix+'?diagnostics&departure='+site+'&olearyExteriorStudy'
   if mode=='stock':url+='&stockOlearyExterior'
   assert page.goto(url,wait_until='domcontentloaded').status==200
   try:
    page.wait_for_function("id=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.site===id",arg=site,polling=200)
    before=state(page);
    assert abs(math.hypot(before['x']-X,before['z']-Z)-1210)<1e-4 and abs(math.degrees(before['heading'])-221)<1e-8
    assert 'Virtual sightseeing only' in page.locator('#site-note').inner_text()
    print(mode,'dispatch',before['alt'],before['art'],flush=True)
    page.get_by_role('button',name='Begin flight').click()
    flight(page,before,140)
    if mode=='active':page.wait_for_function("window.islandAirDiagnostics?.olearyExterior==='authored'",polling=200,timeout=180000)
    elif mode=='missing':
     page.wait_for_function("file=>performance.getEntriesByType('resource').some(e=>new URL(e.name).pathname.endsWith('/'+file))",arg=name,polling=200,timeout=150000)
    # Only one world witness needs the whole near approach. The other cases
    # play the same route through the close resource window and change cameras normally.
    approach=state(page);moved=math.hypot(approach['x']-before['x'],approach['z']-before['z'])
    stationView=None
    if mode=='active':
     page.wait_for_function("p=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-p[0],d.z-p[1])<p[2]&&d.olearyExterior==='authored';}",
      arg=[X,Z,265],polling=150,timeout=190000)
     stationView=state(page)
     assert 155<math.hypot(stationView['x']-X,stationView['z']-Z)<270
     page.locator('#world').screenshot(path=a.out/'ordinary-approach.png',timeout=90000,animations='allow')
     stationView['pngSHA256']=hashlib.sha256((a.out/'ordinary-approach.png').read_bytes()).hexdigest()
    print(mode,'approach',round(moved,1),approach['art'],len(bodyResponses),flush=True)
    assert approach['art']==('authored' if mode=='active' else 'stock') and moved>140
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Wide chase'")
    page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    last=state(page);assert last['site']==site and last['phase']=='paused' and last['cam']=='Wide chase'
    assert last['art']==('authored' if mode=='active' else 'stock')
    assert all(k['lake'] is None and k['waterAdmission']=='idle' and k['GLerror']==0 and not k['contextLost'] and not k['injectedQA'] for k in [before,approach,last]+([stationView] if stationView else []))
    assert not water and not errors and not last['layerWarnings'],(water,errors,last)
    codes=[q.status for q in bodyResponses];assert codes=={'active':[200],'missing':[404],'stock':[]}[mode],codes
    assert len(artRequests)==len(module)==(0 if mode=='stock' else 1),(artRequests,module)
    got=None
    if mode=='active':
     b=bodyResponses[0].body();got=hashlib.sha256(b).hexdigest();assert len(b)==len(wire) and got==expected_hash
    results[mode]={'site':site,'initial':before,'approach':approach,'stationView':stationView,'paused':last,'distanceAtApproachM':round(moved,2),'deltaFromDispatchAtPauseM':round(math.hypot(last['x']-before['x'],last['z']-before['z']),2),'assetCodes':codes,'assetCount':len(artRequests),'wireSHA256':got,'moduleCount':len(module),'waterRequests':water,'expectedFaultConsole':expected,'errors':errors,'controls':['Begin flight','Cockpit','Wide chase','Escape → Pause']}
    (a.out/'compiled-player.json').write_text(json.dumps(results,indent=2)+'\n');print(mode,'passed',codes,got,flush=True)
   except Exception:
    print('failed',mode,state(page),[q.status for q in bodyResponses],errors,flush=True);raise
   finally:page.close()
 finally:browser.close();server.shutdown()
