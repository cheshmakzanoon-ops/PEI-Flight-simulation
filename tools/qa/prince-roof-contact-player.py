#!/usr/bin/env python3
"""Fly the compiled roof-contact controls on the existing QA-only route.

After npm ci, choose a new path outside the checkout, then from the repo root:
  python tools/qa/inland-aerial-joins-fixture.py --out /tmp/pei-roof-flight
  npm --prefix /tmp/pei-roof-flight run build
  python tools/qa/prince-roof-contact-player.py --dist /tmp/pei-roof-flight/dist \
    --out /tmp/pei-roof-flight.json --chromium /path/to/chromium

Requires Python Playwright. Low cap is emulated admission, not a hardware test.
"""
import argparse
import functools
import http.server
import json
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
a=p.parse_args()
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
Thread(target=server.serve_forever,daemon=True).start()
dest='qa-inland-image-crossing'
out={}
try:
    with sync_playwright() as w:
        browser=w.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
        for mode,flag,want_roof,want_contact in [
          ('standard','',True,True),
          ('own-stock','&stockPrinceRoofContact',True,False),
          ('old-roof-stock','&stockPrinceSurveyRoof',False,False),
          ('independent-imagery-stock','&stockInlandOrtho',True,True),
          ('emulated-low-cap','',True,False),
        ]:
            c=browser.new_context(viewport={'width':520,'height':350})
            try:
                page=c.new_page();page.set_default_timeout(130000)
                if mode=='emulated-low-cap':
                    page.add_init_script("""(()=>{const p=WebGL2RenderingContext.prototype, f=p.getParameter;
                     p.getParameter=function(id){if(id===this.MAX_FRAGMENT_UNIFORM_VECTORS)return 191;return f.call(this,id)}
                    })()""")
                errors=[];assets=set()
                page.on('pageerror',lambda err:errors.append(str(err)))
                page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
                page.on('request',lambda q:assets.add(q.url.split('/world/',1)[1]) if '/world/' in q.url else None)
                page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics&departure={dest}{flag}',wait_until='domcontentloaded')
                page.get_by_role('button',name='Begin flight').click()
                page.wait_for_function("s=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site===s",arg=dest)
                start=page.evaluate("({x:window.islandAirDiagnostics.x,z:window.islandAirDiagnostics.z})")
                page.wait_for_function("p=>window.islandAirDiagnostics.x-p.x>120",arg=start)
                page.wait_for_function("()=>window.islandAirDiagnostics?.buildingTiles?.ready>0&&window.islandAirDiagnostics.buildingTiles.loading===0&&window.islandAirDiagnostics.buildingTiles.pending===0")
                if want_roof:
                    page.wait_for_function("window.islandAirDiagnostics?.princeSurveyRoof===true")
                result=page.evaluate("window.islandAirDiagnostics")
                assert not errors and not result['layerWarnings'] and result['buildingTiles']['failed']==0,(mode,errors,result['layerWarnings'])
                assert result['princeSurveyRoof']==want_roof,(mode,result['princeSurveyRoof'])
                assert result['princeRoofContact']==want_contact,(mode,result['princeRoofContact'])
                west=any(q['edge']=='7-12 / 8-12' for q in result.get('orthophotoSeams') or [])
                assert west==(mode!='independent-imagery-stock'),(mode,west)
                assert abs(result['z']-start['z'])<15 and result['altitude']-result['groundY']>35
                page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
                page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
                data=dict(site=dest,positionSource='Private QA fixture only; shipping code has no added departure',
                  travelledEastM=result['x']-start['x'],groundClearanceM=result['altitude']-result['groundY'],
                  crossTrackM=result['z']-start['z'],roof=result['princeSurveyRoof'],contact=result['princeRoofContact'],emulatedUniformVectorCap=191 if mode=='emulated-low-cap' else None,buildingTiles=result['buildingTiles'],
                  independentInlandImagery=west,requestedBuildingPaths=sorted(q for q in assets if q.startswith('buildings/')),
                  cockpit=True,pause=True,errors=errors)
                out[mode]=data;a.out.write_text(json.dumps(out,indent=2)+'\n');print(mode,data,flush=True)
            finally:
                c.close()
        browser.close()
finally:
    server.shutdown()
