#!/usr/bin/env python3
"""Compiled close-crown preview smoke with normal dispatch, flight, and pause."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
out=[]
try:
 with sync_playwright() as api:
  b=api.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode,options in [('standard',''),('preview','&woodlandCrownBase'),('blocked','&woodlandCrownBase&duneSandDetail'),('corrupt','&woodlandCrownBase')]:
   c=b.new_context(viewport={'width':460,'height':338})
   try:
    page=c.new_page(); errors=[]; requests=[]; damaged=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
    page.on('request',lambda r:requests.append(r.url.split('/crown-v1/')[-1]) if '/crown-v1/' in r.url else None)
    if mode=='corrupt':
     def corrupt(route):
      response=route.fetch();body=bytearray(response.body())
      if not body:raise RuntimeError('missing test body')
      for i in range(12,len(body),127):body[i]^=0x20
      damaged.append(len(body));route.fulfill(response=response,body=bytes(body))
     page.route('**/crown-v1/*.pack',corrupt)
    page.set_default_timeout(130000)
    page.goto(f'http://127.0.0.1:{server.server_port}/?departure=west-light&diagnostics'+options,wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch" && document.querySelector("#site")')
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics.site==="west-light"')
    before=page.evaluate('window.islandAirDiagnostics')
    page.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>260',arg={'x':before['x'],'z':before['z']})
    if mode=='preview':page.wait_for_function('window.islandAirDiagnostics?.woodlandCrown?.activeReady')
    if mode=='corrupt':page.wait_for_function('window.islandAirDiagnostics?.woodlandCrown?.failed>0')
    after=page.evaluate('window.islandAirDiagnostics')
    page.keyboard.press('Escape')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    assert not errors and not after['layerWarnings'],(errors,after['layerWarnings'])
    if mode in ('standard','blocked'):assert not requests and not after['woodlandCrown'],after['woodlandCrown']
    if mode=='corrupt':assert damaged and not after['woodlandCrown']['activeReady'] and after['woodlandCrown']['rosterEligible']==0,after['woodlandCrown']
    row=dict(mode=mode,site=after['site'],travelM=round(((after['x']-before['x'])**2+(after['z']-before['z'])**2)**.5,3),
      terrainAtAircraft=after['groundY'],finalAltitude=after['altitude'],crown=after['woodlandCrown'],
      files=requests,damagedPackBytes=damaged,pause=True)
    out.append(row);print(row,flush=True)
   finally:c.close()
  b.close()
finally:server.shutdown()
a.out.write_text(json.dumps(out,indent=2)+'\n')
