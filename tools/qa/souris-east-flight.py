#!/usr/bin/env python3
"""Verify the original Souris departure and its local building-art lease in compiled play."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from urllib.parse import urlsplit
import argparse,json,threading,functools
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dist',type=Path,required=True)
parser.add_argument('--chromium',required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
dist=args.dist
args.out.parent.mkdir(parents=True,exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 for profile,suffix in [('standard',''),('town','&townWallStudy'),('shadow-stock','&buildingShadows'),('detail-stock','&scenery=detail')]:
  ctx=browser.new_context(viewport={'width':624,'height':400});p=ctx.new_page();p.set_default_timeout(110000)
  req=[]
  p.on('request',lambda r:req.append(urlsplit(r.url).path))
  errors=[]
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  p.goto(url+'/?diagnostics&departure=souris-waterfront-pass'+suffix,wait_until='domcontentloaded')
  p.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch" && window.islandAirDiagnostics?.buildingTiles?.ready>=7')
  assert p.locator('#site option:checked').inner_text()=='Souris · waterfront pass'
  p.get_by_role('button',name='Begin flight').click()
  p.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
  before=p.evaluate('window.islandAirDiagnostics')
  p.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>50',arg=before)
  expected=not profile.endswith('stock')
  p.wait_for_function('a=>window.islandAirDiagnostics?.buildingTiles?.ready===window.islandAirDiagnostics?.buildingTiles?.wanted&&window.islandAirDiagnostics?.sourisEastExterior===a',arg=expected)
  p.keyboard.press('v');p.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
  d=p.evaluate('window.islandAirDiagnostics')
  p.keyboard.press('Escape');p.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  art=[x for x in req if '/assets/art-' in x]
  assert not errors and not d['layerWarnings'],(profile,errors,d['layerWarnings'])
  assert bool(art)==expected,(profile,art)
  rec=dict(profile=profile,active=d['sourisEastExterior'],moveM=((d['x']-before['x'])**2+(d['z']-before['z'])**2)**.5,
   sight=d['camera'],tiles=d['buildingTiles'],errors=errors,artRequests=art)
  results.append(rec);print(rec,flush=True);args.out.write_text(json.dumps(results,indent=2)+'\n')
  ctx.close()
 browser.close()
server.shutdown()
