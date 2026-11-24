#!/usr/bin/env python3
"""Compiled stock and measured Summerside transitions through the regular flight UI."""
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
  b=m.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode in ('stock','candidate','corrupt'):
   c=b.new_context(viewport={'width':520,'height':385});e=[];hits=[];failed=[]
   try:
    p=c.new_page();p.set_default_timeout(180000)
    p.on('pageerror',lambda x:e.append(str(x)));p.on('console',lambda x:e.append(x.text) if x.type=='error' else None)
    p.on('request',lambda x:hits.append(x.url.rsplit('/',1)[-1]) if 'summerside-station-C' in x.url else None)
    if mode=='corrupt':
     def bad(route):
      r=route.fetch();raw=bytearray(r.body());failed.append(len(raw))
      if raw:raw[len(raw)//2]^=128
      route.fulfill(response=r,body=bytes(raw))
     p.route('**/art/summerside-station-C*',bad)
    p.goto(f'http://127.0.0.1:{srv.server_port}/?departure=spinnakers-low&buildingShadows&diagnostics'+('' if mode=='stock' else '&summersideStationReview'),wait_until='domcontentloaded')
    p.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    p.get_by_role('button',name='Begin flight').click()
    p.wait_for_function('window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics.site==="spinnakers-low"')
    start=p.evaluate('window.islandAirDiagnostics')
    if mode=='candidate':
     p.wait_for_function('window.islandAirDiagnostics?.summersideStation===true')
     p.screenshot(path=str(a.out/'departure-active.png'),timeout=100000)
    p.wait_for_function('s=>Math.hypot(window.islandAirDiagnostics.x-s.x,window.islandAirDiagnostics.z-s.z)>260',arg={'x':start['x'],'z':start['z']})
    q=p.evaluate('window.islandAirDiagnostics')
    p.keyboard.press('Escape');p.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    assert not e and not q['layerWarnings'],(e,q['layerWarnings'])
    if mode=='stock':assert not hits and not q['summersideStation']
    if mode=='corrupt':assert failed and not q['summersideStation']
    row=dict(mode=mode,site=q['site'],movementM=round(((q['x']-start['x'])**2+(q['z']-start['z'])**2)**.5,3),
     altitude=q['altitude'],stockGround=q['groundY'],stationAtEnd=q['summersideStation'],pauseSucceeded=True,downloads=hits,corruptLengths=failed)
    out.append(row);(a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
   finally:c.close()
  b.close()
finally:srv.shutdown()
