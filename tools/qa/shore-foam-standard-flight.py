#!/usr/bin/env python3
"""Verify Standard shore-breaker selection from compiled, ordinary flight."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--case',action='append');a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True)
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist))) as server,sync_playwright() as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 cases=[('prince','spinnakers-low','',True),('queens','cavendish-low','',True),('kings','basin-head-low','',True),
        ('stock','spinnakers-low','&stockShoreFoam',False),('legacy','cavendish-low','&legacyShoreArcs',False),
        ('detail','cavendish-low','&scenery=detail',True),('authored-basin','basin-head-low','&basinChannel',False)]
 out=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']) as browser:
  for case,site,additional,expected in cases:
   if a.case and case not in a.case:continue
   page=browser.new_page(viewport={'width':480,'height':330});err=[]
   try:
    page.on('pageerror',lambda e:err.append(str(e)));page.on('console',lambda e:err.append(e.text) if e.type=='error' else None)
    page.set_default_timeout(115000)
    page.goto(f'http://127.0.0.1:{server.server_port}/?departure={site}&diagnostics'+additional,wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics?.roads')
    start=page.evaluate('window.islandAirDiagnostics')
    page.wait_for_function('(o)=>Math.hypot(o.x-window.islandAirDiagnostics.x,o.z-window.islandAirDiagnostics.z)>105',arg={k:start[k] for k in ('x','z')})
    page.keyboard.press('v');page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
    end=page.evaluate('window.islandAirDiagnostics')
    page.keyboard.press('Escape');page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    assert end['site']==site and not err and not end['layerWarnings'] and end['shoreFoamDetail'] is expected
    out.append(dict(case=case,site=site,foam=end['shoreFoamDetail'],movedM=((start['x']-end['x'])**2+(start['z']-end['z'])**2)**.5,pause=True))
    (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out[-1],flush=True)
   finally:page.close()
