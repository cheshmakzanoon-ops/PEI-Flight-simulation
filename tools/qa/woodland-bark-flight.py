#!/usr/bin/env python3
"""Exercise ordinary controls and optional bark in a compiled West Point pass."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True)
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
out=[]
try:
 with sync_playwright() as m:
  browser=m.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode in ('standard','scanned','corrupt'):
   c=browser.new_context(viewport={'width':460,'height':338});errors=[];req=[];damage=[]
   try:
    pg=c.new_page();pg.set_default_timeout(140000)
    pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
    pg.on('request',lambda r:req.append(r.url.rsplit('/',1)[-1]) if '/art/bark/' in r.url else None)
    if mode=='corrupt':
     def bad(route):
      r=route.fetch();body=bytearray(r.body())
      if body:body[len(body)//2+31]^=0x40
      damage.append(len(body));h=dict(r.headers)
      h.pop('content-encoding',None);h.pop('content-length',None)
      route.fulfill(status=200,headers=h,body=bytes(body))
     pg.route('**/art/bark/wood-v1.rgba.gz',bad)
    flags='&woodlandBark&woodlandCrownBase' if mode!='standard' else ''
    pg.goto(f'http://127.0.0.1:{srv.server_port}/?departure=west-light&diagnostics'+flags,wait_until='domcontentloaded')
    pg.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function('window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics.site==="west-light"')
    start=pg.evaluate('window.islandAirDiagnostics')
    pg.wait_for_function('s=>Math.hypot(window.islandAirDiagnostics.x-s.x,window.islandAirDiagnostics.z-s.z)>425',arg={'x':start['x'],'z':start['z']})
    pg.keyboard.down('ArrowUp')
    pg.wait_for_function('window.islandAirDiagnostics.altitude-window.islandAirDiagnostics.groundY<44')
    pg.keyboard.up('ArrowUp')
    pg.keyboard.press('Escape')
    pg.wait_for_function('window.islandAirDiagnostics.mode==="paused"')
    if mode=='scanned':pg.wait_for_function('window.islandAirDiagnostics.woodlandBark==="ready"')
    if mode=='corrupt':pg.wait_for_function('window.islandAirDiagnostics.woodlandBark==="optional"')
    q=pg.evaluate('window.islandAirDiagnostics')
    assert not errors and not q['layerWarnings'],(errors,q['layerWarnings'])
    if mode=='standard':assert not req and q['woodlandBark'] is None
    else:assert len(req)==1 and q['woodlandVolume']>0
    if mode=='corrupt':assert damage
    row=dict(mode=mode,site=q['site'],movementM=round(((q['x']-start['x'])**2+(q['z']-start['z'])**2)**.5,3),
     altitude=q['altitude'],ground=q['groundY'],bark=q['woodlandBark'],volumeCount=q['woodlandVolume'],download=req,damagedBytes=damage,pause=True)
    out.append(row);(a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
   finally:c.close()
  browser.close()
finally:srv.shutdown()
