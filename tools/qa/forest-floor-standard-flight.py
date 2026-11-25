#!/usr/bin/env python3
"""Compiled Standard flight: woodland material loads, fails and stays optional."""
import argparse, functools, http.server, json, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
args=p.parse_args()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/?diagnostics'
data=[]
try:
 with sync_playwright() as api:
  browser=api.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for case in ('standard','stock','corrupt'):
   ctx=browser.new_context(viewport={'width':570,'height':350},device_scale_factor=1)
   pg=ctx.new_page()
   errors=[];images=[]
   pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   pg.set_default_timeout(200000)
   pg.on('request',lambda r:images.append(r.url.rsplit('/',1)[-1]) if '/art/forest-floor/' in r.url else None)
   if case=='corrupt':pg.route('**/art/forest-floor/duff-2.webp',lambda r:r.fulfill(status=200,body='unusable woodland texture'))
   pg.goto(url+('&stockForestFloor' if case=='stock' else ''),wait_until='domcontentloaded')
   pg.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch" && document.querySelector("#site")')
   pg.select_option('#site',label='Queens County · woodland view pass')
   pg.get_by_role('button',name='Begin flight').click()
   pg.wait_for_function('()=>window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics.site==="queens-woodland-view"')
   before=pg.evaluate('window.islandAirDiagnostics')
   pg.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>55',arg={'x':before['x'],'z':before['z']})
   after=pg.evaluate('window.islandAirDiagnostics')
   assert not errors and not after['layerWarnings'],(errors,after['layerWarnings'])
   assert after['mode']=='flight' and after['canopyLight'] is True
   if case!='stock':
    pg.wait_for_function('expected=>window.islandAirDiagnostics?.forestFloor===expected',arg='failed' if case=='corrupt' else 'ready')
    after=pg.evaluate('window.islandAirDiagnostics')
    assert not errors and not after['layerWarnings'],(errors,after['layerWarnings'])
   pg.keyboard.press('Escape')
   pg.wait_for_function('()=>window.islandAirDiagnostics?.mode==="paused"')
   assert len(images)==(0 if case=='stock' else 2),images
   if case=='stock':assert after['forestFloor'] is None
   row=dict(option=case,site='queens-woodland-view',movementM=((before['x']-after['x'])**2+(before['z']-after['z'])**2)**.5,
            floor=after['forestFloor'],resources=images,startY=before['altitude'],afterY=after['altitude'],pauseSucceeded=True,errors=errors)
   data.append(row);args.out.write_text(json.dumps(data,indent=2)+'\n');print(row,flush=True)
   ctx.close()
  browser.close()
finally:
 server.shutdown()
