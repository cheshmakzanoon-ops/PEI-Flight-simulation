#!/usr/bin/env python3
"""Exercise the default and opt-in crown shaders in normal compiled flight."""
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
  for active in [False,True]:
   ctx=browser.new_context(viewport={'width':640,'height':400},device_scale_factor=1)
   pg=ctx.new_page()
   errors=[]
   pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   pg.set_default_timeout(120000)
   pg.goto(url+('&canopyLight' if active else ''),wait_until='domcontentloaded')
   pg.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch" && document.querySelector("#site")')
   pg.select_option('#site',label='Cavendish shore · low pass')
   pg.get_by_role('button',name='Begin flight').click()
   pg.wait_for_function('()=>window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics.site==="cavendish-low"')
   before=pg.evaluate('window.islandAirDiagnostics')
   pg.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>45',arg={'x':before['x'],'z':before['z']})
   after=pg.evaluate('window.islandAirDiagnostics')
   assert not errors and not after['layerWarnings'],(errors,after['layerWarnings'])
   assert after['mode']=='flight' and after['canopyLight'] is active
   pg.keyboard.press('Escape')
   pg.wait_for_function('()=>window.islandAirDiagnostics?.mode==="paused"')
   row=dict(option=active,site='cavendish-low',movementM=((before['x']-after['x'])**2+(before['z']-after['z'])**2)**.5,
            startY=before['altitude'],afterY=after['altitude'],pauseSucceeded=True,errors=errors)
   data.append(row);args.out.write_text(json.dumps(data,indent=2)+'\n');print(row,flush=True)
   ctx.close()
  browser.close()
finally:
 server.shutdown()
