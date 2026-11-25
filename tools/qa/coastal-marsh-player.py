#!/usr/bin/env python3
"""Explicit Marsh optics and actual blades from a normal private player start."""
from pathlib import Path
import argparse, functools, http.server,json,threading
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--modes',default='active,stock,corrupt')
p.add_argument('--chromium',required=True)
a=p.parse_args()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{srv.server_port}/?departure=tracadie-marsh&diagnostics'
receipt=[]
try:
 with sync_playwright() as s:
  browser=s.chromium.launch(executable_path=a.chromium,
   args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode in a.modes.split(','):
   ctx=browser.new_context(viewport={'width':610,'height':395})
   pg=ctx.new_page();pg.set_default_timeout(130000);errors=[];assets=[]
   pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
   pg.on('request',lambda r:assets.append(r.url.rsplit('/',1)[-1]) if '/coastal-marsh/' in r.url else None)
   try:
    if mode=='corrupt':
     def corrupt(route):
      res=route.fetch();b=bytearray(res.body());b[len(b)//2]^=1
      route.fulfill(status=200,body=bytes(b),content_type='application/gzip')
     pg.route('**/world/coastal-marsh/tracadie.red.gz',corrupt)
    pg.goto(url+('&stockCoastalMarsh' if mode=='stock' else ''),wait_until='domcontentloaded')
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
    d0=pg.evaluate('window.islandAirDiagnostics')
    if mode=='active':
     pg.wait_for_function("""()=>{const d=window.islandAirDiagnostics;
      return d?.mode==='flight'&&d?.marsh?.find(r=>r.id==='tracadie')?.state==='ready'&&d?.marshFoliage?.mid>0;}""")
     pg.screenshot(path=str(a.out.parent/'live-player-tracadie.png'))
    if mode=='corrupt':pg.wait_for_function("window.islandAirDiagnostics?.marsh?.find(r=>r.id==='tracadie')?.state==='failed'")
    pg.wait_for_function("p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>140",arg={'x':d0['x'],'z':d0['z']})
    last=pg.evaluate('window.islandAirDiagnostics');assert last['site']=='tracadie-marsh'
    assert not errors and not last['layerWarnings'],(errors,last['layerWarnings'])
    assert assets==([] if mode=='stock' else ['tracadie.red.gz']),assets
    pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    row=dict(mode=mode,distance=((last['x']-d0['x'])**2+(last['z']-d0['z'])**2)**.5,textureRequests=assets,
             marsh=last.get('marsh'),plants=last.get('marshFoliage'),pause=True,errors=errors)
    receipt.append(row);a.out.write_text(json.dumps(receipt,indent=2)+'\n');print(row,flush=True)
   finally:ctx.close()
  browser.close()
finally:srv.shutdown()
