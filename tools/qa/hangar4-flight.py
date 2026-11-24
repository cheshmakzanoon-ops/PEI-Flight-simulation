"""Run the game's compiled CYSU departure without overriding the sim or renderer.

The speed/height thresholds below are software-regression input timings, not
real departure guidance. A slow SwiftShader device may need several minutes.
"""
import argparse, functools, http.server, json, math, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
if not (a.dist/'index.html').is_file():p.error('pass a built dist directory')
a.out.mkdir(exist_ok=True,parents=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist.resolve()))) as server, sync_playwright() as pw:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    try:
        page=browser.new_page(viewport={'width':460,'height':300})
        page.set_default_timeout(260000)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
        page.on('response',lambda res:errors.append(f'{res.status} {res.url}') if res.status>=400 else None)
        page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded')
        page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
        page.select_option('#site',label='Summerside · runway 05')
        page.get_by_role('button',name='Begin flight').click()
        page.wait_for_function("window.islandAirDiagnostics?.site==='cysu'&&window.islandAirDiagnostics.mode==='flight'")
        start=page.evaluate('window.islandAirDiagnostics')
        assert start['speed']<1,start
        page.locator('canvas').first.click(position={'x':230,'y':147})
        page.keyboard.down('Shift')
        try:
            page.wait_for_function("window.islandAirDiagnostics?.speed>12",timeout=150000)
            roll=page.evaluate('window.islandAirDiagnostics')
            (a.out/'ground-roll.json').write_text(json.dumps({'metres':math.hypot(roll['x']-start['x'],roll['z']-start['z']),'speed':roll['speed'],'mode':roll['mode'],'tiles':roll['buildingTiles'],'errors':errors,'warnings':roll['layerWarnings']},indent=2)+'\n')
            page.wait_for_function("window.islandAirDiagnostics?.speed>40",timeout=300000)
        except Exception:
            diagnostic=page.evaluate("()=>({active:document.activeElement?.tagName,...window.islandAirDiagnostics})")
            (a.out/'failure.json').write_text(json.dumps({'snapshot':diagnostic,'errors':errors},indent=2))
            raise
        page.keyboard.down('ArrowDown')
        page.wait_for_function("(()=>{const d=window.islandAirDiagnostics;return d.altitude-d.groundY>17})()")
        page.keyboard.up('ArrowDown')
        page.keyboard.up('Shift')
        page.wait_for_function("""p=>{const d=window.islandAirDiagnostics,b=d.buildingTiles;return d.mode==='flight'&&d.altitude-d.groundY>12&&Math.hypot(d.x-p.x,d.z-p.z)>545&&d.roads&&d.mainland&&d.detail.ready>0&&d.detail.missing===0&&b.ready>0&&b.wanted===b.ready&&!b.failed&&!b.pending}""",arg=start,polling=250)
        after=page.evaluate('window.islandAirDiagnostics')
        page.screenshot(path=str(a.out/'runway-departure.png'),timeout=90000)
        page.keyboard.press('v')
        page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
        page.keyboard.press('Escape')
        page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
        assert not errors and not after['layerWarnings'],(errors,after['layerWarnings'])
        report={'metres':math.hypot(after['x']-start['x'],after['z']-start['z']),'altitudeAboveCurrentGround':after['altitude']-after['groundY'],'buildingTiles':after['buildingTiles'],'detail':after['detail'],'warnings':after['layerWarnings'],'errors':errors,'cockpitAndPause':True}
        (a.out/'flight.json').write_text(json.dumps(report,indent=2)+'\n')
        print(report)
    finally:
        browser.close()
        server.shutdown()
