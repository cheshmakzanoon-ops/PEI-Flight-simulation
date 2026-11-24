#!/usr/bin/env python3
"""Compiled Georgetown menu flight, Standard exterior and corrupt-asset fallback."""
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
  for mode in ('stock','candidate','corrupt','distance'):
   c=b.new_context(viewport={'width':520,'height':385});e=[];hits=[];failed=[]
   try:
    p=c.new_page();p.set_default_timeout(180000)
    p.on('pageerror',lambda x:e.append(str(x)));p.on('console',lambda x:e.append(x.text) if x.type=='error' else None)
    p.on('request',lambda x:hits.append(x.url.rsplit('/',1)[-1]) if 'st-davids-B3' in x.url else None)
    if mode=='corrupt':
     def bad(route):
      r=route.fetch();raw=bytearray(r.body());failed.append(len(raw))
      if raw:raw[len(raw)//2]^=128
      route.fulfill(response=r,body=bytes(raw))
     p.route('**/art/st-davids-B3*',bad)
    site='montague' if mode=='distance' else 'georgetown-low'
    p.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics'+('&stockStDavidsExterior' if mode=='stock' else ''),wait_until='domcontentloaded')
    p.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    p.select_option('#site',label='Montague River' if mode=='distance' else 'Georgetown harbour · low pass')
    p.get_by_role('button',name='Begin flight').click()
    p.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
    start=p.evaluate('window.islandAirDiagnostics')
    if mode=='candidate':
     p.wait_for_function('window.islandAirDiagnostics?.stDavids===true')
     p.screenshot(path=str(a.out/'departure-active.png'),timeout=100000)
    p.wait_for_function('s=>Math.hypot(window.islandAirDiagnostics.x-s.x,window.islandAirDiagnostics.z-s.z)>520',arg={'x':start['x'],'z':start['z']})
    q=p.evaluate('window.islandAirDiagnostics')
    p.keyboard.press('Escape');p.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    assert not e and not q['layerWarnings'],(e,q['layerWarnings'])
    assert q['site']==site,(q['site'],site)
    if mode in ('stock','distance'):assert not hits and not q['stDavids']
    if mode=='candidate':assert len(hits)==1 and q['stDavids']
    if mode=='corrupt':assert failed and not q['stDavids']
    if mode!='distance':assert 50<start['altitude']<75 and 45<q['altitude']<90,(start['altitude'],q['altitude'])
    if mode=='candidate':assert q['buildingShadows'] is None
    row=dict(mode=mode,site=q['site'],movementM=round(((q['x']-start['x'])**2+(q['z']-start['z'])**2)**.5,3),
     altitude=q['altitude'],stockGround=q['groundY'],exteriorAtEnd=q['stDavids'],pauseSucceeded=True,downloads=hits,corruptLengths=failed)
    out.append(row);(a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
   finally:c.close()
  b.close()
finally:srv.shutdown()
