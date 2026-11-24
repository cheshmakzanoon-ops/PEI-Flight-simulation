from pathlib import Path
import argparse,functools,http.server,json,threading
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_): pass
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True)
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)));threading.Thread(target=srv.serve_forever,daemon=True).start()
rows=[]
try:
 with sync_playwright() as m:
  browser=m.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode,query,expect,expectedSky in [('stock','&stockAerialPerspective',False,1),('candidate','',True,1),('detail','&scenery=detail',False,1),('invalid','',False,2),('held','',False,1)]:
   ctx=browser.new_context(viewport={'width':505,'height':350})
   try:
    page=ctx.new_page();page.set_default_timeout(130000);errors=[];sky=[];call=[];delayed=[]
    def intercept(route):
     call.append(route.request.url)
     if mode!='invalid' or len(call)>1:return route.continue_()
     a=route.fetch();raw=bytearray(a.body());assert len(raw)==214798
     raw[len(raw)//2]^=8
     route.fulfill(response=a,body=bytes(raw))
    page.route('**/maritime-sky.webp',intercept)
    if mode=='held':page.route('**/aerial-perspective-lab-*.js',lambda r:delayed.append(r))
    page.on('request',lambda x:sky.append(x) if 'aerial-perspective-lab-' in x.url else None)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda c:errors.append(c.text) if c.type=='error' else None)
    page.goto(f'http://127.0.0.1:{srv.server_port}/?departure=eastpoint&diagnostics'+query,wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
    start=page.evaluate('window.islandAirDiagnostics')
    page.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>100',arg={'x':start['x'],'z':start['z']})
    page.wait_for_function('(exp)=>!!window.islandAirDiagnostics?.aerialPerspective===exp && window.islandAirDiagnostics?.mainland',arg=expect)
    page.keyboard.press('v');page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
    d=page.evaluate('window.islandAirDiagnostics')
    page.keyboard.press('Escape');page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    assert len(call)==expectedSky and not d['layerWarnings'] and not errors and d['site']=='eastpoint',(len(call),d['layerWarnings'],errors,d['site'])
    assert (len(sky)>0)==(mode in ('candidate','invalid','held')),len(sky)
    if mode=='held':
     assert len(delayed)==1
     delayed[0].continue_()
     page.wait_for_timeout(500)
     assert not page.evaluate('!!window.islandAirDiagnostics?.aerialPerspective')
    row=dict(mode=mode,contrastAerialOptics=bool(d.get('aerialPerspective')),skyRequests=len(call),opticsModuleRequests=len(sky),
             visibleAfterRealFlightM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),draws=d['drawCalls'],triangles=d['triangles'])
    rows.append(row);print(row,flush=True);(a.out/'report.json').write_text(json.dumps(rows,indent=2)+'\n')
   finally:ctx.close()
finally:srv.shutdown()
