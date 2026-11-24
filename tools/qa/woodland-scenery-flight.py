#!/usr/bin/env python3
"""Real Standard Dispatch flight and optional scenery-camera tests."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--counties',default='prince');a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True)
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
out=[]
try:
 with sync_playwright() as m:
  browser=m.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for county in a.counties.split(','):
   for mode in ('stock','bundle'):
    c=browser.new_context(viewport={'width':460,'height':338});errors=[];assets=[]
    try:
     pg=c.new_page();pg.set_default_timeout(130000)
     pg.on('pageerror',lambda e:errors.append(str(e)))
     pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
     pg.on('request',lambda r:assets.append(r.url.partition(srv.server_port.__str__())[-1]) if any(k in r.url for k in ('/art/bark/','/art/forest-floor/','/woodland/crown-v1/')) else None)
     site=county+'-woodland-view'
     pg.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+('&woodlandView' if mode=='bundle' else ''),wait_until='domcontentloaded')
     pg.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
     pg.get_by_role('button',name='Begin flight').click()
     pg.wait_for_function('id=>window.islandAirDiagnostics?.mode==="flight"&&window.islandAirDiagnostics.site===id',arg=site)
     start=pg.evaluate('window.islandAirDiagnostics')
     for camera in ('Cockpit','Wide chase','Scenery' if mode=='bundle' else 'Chase'):
      pg.keyboard.press('v');pg.wait_for_function('c=>window.islandAirDiagnostics?.camera===c',arg=camera)
     pg.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>=240',arg={'x':start['x'],'z':start['z']})
     pg.keyboard.press('Escape');pg.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
     if mode=='bundle':
      pg.wait_for_function('window.islandAirDiagnostics?.woodlandBark==="ready"')
     q=pg.evaluate('window.islandAirDiagnostics')
     pg.screenshot(path=str(a.out/f'{site}-{mode}.png'))
     pg.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
     pg.screenshot(path=str(a.out/f'{site}-{mode}-world.png'))
     assert not errors and not q['layerWarnings'],(errors,q['layerWarnings'])
     if mode=='stock':assert not assets,(assets,q)
     row=dict(county=county,mode=mode,view=q['camera'],ground=q['groundY'],altitude=q['altitude'],
      movementM=round(((q['x']-start['x'])**2+(q['z']-start['z'])**2)**.5,3),bark=q['woodlandBark'],
      crown=q['woodlandCrown'],groundArt=q['forestFloor'],uses=assets,pause=True)
     out.append(row);(a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
    finally:c.close()
  browser.close()
finally:srv.shutdown()
