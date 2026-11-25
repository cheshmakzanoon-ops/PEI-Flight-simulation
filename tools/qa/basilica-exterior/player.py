"""Actual built local gameplay comparator for an optional Basilica exterior; no QA camera or spawn."""
import argparse, functools, http.server, json, math, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--diagnostic',default='basilicaExterior')
p.add_argument('--cases',nargs='+',choices=['new','standard','explicit-stock','stock-only','incompatible','missing-art','low'])
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
web=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist.resolve())))
threading.Thread(target=web.serve_forever,daemon=True).start()
modes={
 'new':('basilicaExteriorStudy','authored'),
 'standard':('','stock'),
 'explicit-stock':('basilicaExteriorStudy&stockBasilicaExterior','stock'),
 'stock-only':('stockBasilicaExterior','stock'),
 'incompatible':('basilicaExteriorStudy&inlandRelief','stock'),
 'missing-art':('basilicaExteriorStudy','stock'),
 'low':('basilicaExteriorStudy','authored'),
}
def own(page):
 return page.evaluate('k=>window.islandAirDiagnostics[k]',a.diagnostic)
rows=[]
try:
 with sync_playwright() as w:
  b=w.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for case in (a.cases or modes):
   flags,expected=modes[case];site='harbour-low' if case=='low' else 'charlottetown'
   with b.new_context(viewport={'width':490,'height':346}) as ctx:
    pg=ctx.new_page();pg.set_default_timeout(110000)
    errors=[];art=[];forced=[]
    def is_art(url):return '/assets/basilica-exterior-' in url and url.split('?',1)[0].endswith('.js')
    def log_console(msg):
     if msg.type=='error':
      if case=='missing-art' and is_art(msg.location.get('url','')) and '404' in msg.text:forced.append('console 404')
      else:errors.append(msg.text)
    def log_response(res):
     if res.status>=400:
      if case=='missing-art' and is_art(res.url) and res.status==404:forced.append('response 404')
      else:errors.append(f'{res.status} {res.url}')
    pg.on('pageerror',lambda err:errors.append(str(err)))
    pg.on('console',log_console)
    pg.on('response',log_response)
    pg.on('request',lambda req:art.append(req.url) if is_art(req.url) else None)
    if case=='missing-art':
     pg.route('**/assets/basilica-exterior-*.js',lambda route:route.fulfill(status=404,content_type='text/javascript',body=''))

    pg.goto(f'http://127.0.0.1:{web.server_port}/?departure={site}&diagnostics'+('&'+flags if flags else ''),wait_until='domcontentloaded')
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    assert own(pg)==expected,(case,expected,own(pg))
    assert not errors,(case,errors)
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("site=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site===site",arg=site)
    start=pg.evaluate('window.islandAirDiagnostics')
    for mode in ('Cockpit','Wide chase'):
     pg.keyboard.press('v');pg.wait_for_function('v=>window.islandAirDiagnostics.camera===v',arg=mode)
    pg.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>=120',
      arg={k:start[k]for k in ('x','z')})
    pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    end=pg.evaluate('window.islandAirDiagnostics')
    assert own(pg)==expected and not errors and not end['layerWarnings'],(case,own(pg),errors)
    assert len(art)==(1 if case in ('new','missing-art','low') else 0),(case,art)
    if case=='missing-art':assert 'response 404' in forced
    else:assert not forced
    rows.append({'mode':case,'landmarkOwns':expected,'availableDeparture':end['site'],'actualFlightMovementM':math.hypot(end['x']-start['x'],end['z']-start['z']),
     'controls':['Begin flight','Cockpit','Wide chase','Pause'],'artChunkRequests':len(art),'intendedFaultObservations':forced,
     'errors':errors,'warnings':end['layerWarnings']})
    (a.out/'compiled-basilica-controls.json').write_text(json.dumps(rows,indent=2)+'\n')
  b.close()
finally:web.shutdown()
