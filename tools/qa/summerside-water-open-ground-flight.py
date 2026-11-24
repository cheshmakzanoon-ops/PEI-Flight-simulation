#!/usr/bin/env python3
"""Check the Water Street exact fallback stem in normal and parked profile flights."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import argparse,functools,json,threading

profiles={'standard':('',True,False),'expanded':('&townWallStudy',True,False),
 'comparison':('&stockSummersideFrontage',False,False),'station':('&buildingShadows&summersideStationReview',False,True)}
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--profiles',nargs='+',choices=profiles,default=list(profiles));args=p.parse_args()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
results=[]
with ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.dist))) as server,sync_playwright() as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 url=f'http://127.0.0.1:{server.server_port}/?diagnostics&departure=spinnakers-low'
 b=pw.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 args.out.parent.mkdir(parents=True,exist_ok=True)
 try:
  for label in args.profiles:
   q,wants,station=profiles[label];errors=[]
   ctx=b.new_context(viewport={'width':560,'height':390},device_scale_factor=1)
   page=ctx.new_page();page.set_default_timeout(115000)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   page.goto(url+q,wait_until='domcontentloaded')
   page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"&&document.querySelector("#site")')
   assert page.locator('#site option:checked').inner_text()=='Summerside waterfront · low pass'
   page.get_by_role('button',name='Begin flight').click()
   page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
   start=page.evaluate('window.islandAirDiagnostics')
   page.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>80',arg=start)
   page.wait_for_function('a=>{const d=window.islandAirDiagnostics;return d?.buildingTiles?.wanted>0&&d.buildingTiles.wanted===d.buildingTiles.ready&&(!a[0]||d.summersideOpenGround?.removed===1)&&(!a[1]||d.summersideStation===true)}',arg=[wants,station])
   page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
   d=page.evaluate('window.islandAirDiagnostics')
   page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
   assert d['summersideOpenGround']==({'eligible':1,'removed':1} if wants else None)
   assert d['mappedLaneCanopy'] is None
   assert not errors and not d['layerWarnings'],(label,errors,d['layerWarnings'])
   results.append(dict(profile=label,exactOneRemoved=wants,stationActive=d['summersideStation'],tiles=d['buildingTiles'],movementM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),controls=True,errors=errors))
   print(results[-1],flush=True)
   args.out.write_text(json.dumps(results,indent=2)+'\n')
   ctx.close()
 finally:
  b.close();server.shutdown()
