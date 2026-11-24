#!/usr/bin/env python3
"""Verify close wall profiles and preserve the previously authored railway scene."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,functools,json,threading

PROFILES={
 'standard':('',1,None,'core'),
 'expanded':('&townWallStudy',1,'townWallStudy','expanded'),
 'legacy':('&stockTownWalls',1,None,None),
 'station':('&summersideStationReview&buildingShadows',0,'summersideStation',None),
}
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--profiles',nargs='+',choices=PROFILES,default=list(PROFILES))
args=p.parse_args()
args.out.parent.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
rows=[]
with ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.dist))) as server,sync_playwright() as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/?diagnostics&departure=spinnakers-low'
 b=pw.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  for label in args.profiles:
   suffix,expected,authored,mode=PROFILES[label]
   ctx=b.new_context(viewport={'width':560,'height':390},device_scale_factor=1)
   page=ctx.new_page();errors=[]
   page.set_default_timeout(145000)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   page.goto(url+suffix,wait_until='domcontentloaded')
   page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
   assert page.locator('#site option:checked').inner_text()=='Summerside waterfront · low pass'
   page.get_by_role('button',name='Begin flight').click()
   page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
   start=page.evaluate('window.islandAirDiagnostics')
   page.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>65',arg=start)
   page.wait_for_function('a=>{const d=window.islandAirDiagnostics;return d?.buildingTiles?.wanted>0&&d.buildingTiles.pending===0&&d.buildingTiles.loading===0&&d.buildingTiles.wanted===d.buildingTiles.ready&&d.summersideMeasuredRoofs===a[0]&&(!a[1]||d[a[1]]===true)}',arg=[expected,authored])
   page.wait_for_function('k=>window.islandAirDiagnostics.townWallProfile===k',arg=mode)
   page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
   d=page.evaluate('window.islandAirDiagnostics')
   page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
   assert not errors and not d['layerWarnings'],(label,errors,d['layerWarnings'])
   rows.append(dict(profile=label,wallMode=d['townWallProfile'],measuredRoofs=d['summersideMeasuredRoofs'],resident=d['buildingTiles'],movedM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),
    preservedAuthoring=None if not authored else {authored:d[authored]},controls=True,errors=errors))
   args.out.write_text(json.dumps(rows,indent=2)+'\n')
   print(rows[-1],flush=True)
   ctx.close()
 finally:
  b.close();server.shutdown()
