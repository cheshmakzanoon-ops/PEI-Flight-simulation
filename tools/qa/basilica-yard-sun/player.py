"""Actual ordinary compiled flight controls for optional local sunlight.
The official starting scene is intentionally far from the landmark, where
its shadow target must not allocate. Near optics are separately verified."""
import argparse, functools, http.server, json, math, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
cases={
 'yard-request-far':('basilicaExteriorStudy&basilicaYardSun',True,True,False),
 'explicit-stock-sun':('basilicaExteriorStudy&basilicaYardSun&stockBasilicaSun',True,False,False),
 'yard-key-alone':('basilicaYardSun',False,False,False),
 'standard':('',False,False,False),
 'missing-shadow-module':('basilicaExteriorStudy&basilicaYardSun',True,True,True),
}
js='''()=>{const d=window.islandAirDiagnostics;return {...d,own:d.basilicaExterior,state:d.basilicaSun}}'''
def read(page):
 return page.evaluate(js)
def check(state,art,chunk,fault):
 assert state['own']==('authored' if art else 'stock')
 value=state['state']
 if chunk and not fault:
  assert value and value['phase']=='cold' and not value['yard'] and not value['target'] and value['leases']==0
  assert value['isolatedDepthDraws']==0 and value['sourceChecks']==0
 else:assert value is None
rows=[]
try:
 with sync_playwright() as w:
  b=w.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for name,(flags,art,chunk,fault) in cases.items():
   with b.new_context(viewport={'width':490,'height':346}) as ctx:
    pg=ctx.new_page();pg.set_default_timeout(120000)
    errors=[];forced=[];light=[]
    def match(url):return '/assets/basilica-local-sun-' in url and url.split('?',1)[0].endswith('.js')
    def console(m):
     if m.type=='error':
      if fault and match(m.location.get('url','')) and '404' in m.text:forced.append('console 404')
      else:errors.append(m.text)
    def response(res):
     if res.status<400:return
     if fault and match(res.url) and res.status==404:forced.append('response 404')
     else:errors.append(f'{res.status} {res.url}')
    pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',console);pg.on('response',response)
    pg.on('request',lambda q:light.append(q.url) if match(q.url) else None)
    if fault:pg.route('**/assets/basilica-local-sun-*.js',lambda q:q.fulfill(status=404,content_type='text/javascript',body=''))
    pg.goto(f'http://127.0.0.1:{server.server_port}/?departure=harbour-low&diagnostics'+('&'+flags if flags else ''),wait_until='domcontentloaded')
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    before=read(pg);check(before,art,chunk,fault)
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='harbour-low'")
    start=read(pg)
    for c in ('Cockpit','Wide chase'):
     pg.keyboard.press('v')
     pg.wait_for_function('v=>window.islandAirDiagnostics?.camera===v',arg=c)
    pg.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>=120',arg={k:start[k]for k in ('x','z')})
    pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    end=read(pg);check(end,art,chunk,fault)
    assert not errors and not end['layerWarnings'] and len(light)==int(chunk),(name,errors,light,forced)
    if fault:assert 'response 404' in forced
    else:assert not forced
    rows.append({'case':name,'site':end['site'],'existingBasilicaMode':end['own'],'sourceChunkRequests':len(light),
     'noDepthAllocationAtStartingSite':True,'metersTravelled':math.hypot(end['x']-start['x'],end['z']-start['z']),
     'controls':['Begin flight','Cockpit','Wide chase','Pause'],'intentionalFailure':forced,'errors':errors})
    (a.out/'compiled-yard-player.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(rows[-1],flush=True)
  b.close()
finally:server.shutdown()
