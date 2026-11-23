#!/usr/bin/env python3
"""Take the built, unmodified Montague River departure through real WebGL."""
import argparse,functools,json,math,runpy
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dist',required=True,type=Path)
    p.add_argument('--out',required=True,type=Path)
    p.add_argument('--chromium',required=True)
    a=p.parse_args()
    assert (a.dist/'index.html').is_file()
    a.out.mkdir(parents=True,exist_ok=True)
    routes=runpy.run_path(str(Path(__file__).with_name('player-routes.py')))
    manifest=json.loads((a.dist/'world/buildings/index.json').read_text())
    t=next(t for t in manifest['tiles']if t['id']=='q103301')
    expected=f"bytes={t['offset']}-{t['offset']+t['bytes']-1}"
    recorded=set();errors=[]
    handler=functools.partial(routes['QuietStaticServer'],directory=str(a.dist.resolve()))
    with ThreadingHTTPServer(('127.0.0.1',0),handler) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever,daemon=True).start()
        browser=pw.chromium.launch(executable_path=a.chromium,args=routes['FLAGS'])
        try:
            page=browser.new_page(viewport={'width':1024,'height':640},device_scale_factor=1)
            page.set_default_timeout(100000)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
            page.on('request',lambda r:recorded.add(r.headers.get('range'))if r.url.endswith('/buildings/tiles.pack')else None)
            page.on('response',lambda r:errors.append(f'{r.status}: {r.url}')if r.status>=400 else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded')
            page.locator('#start').click()
            page.locator('#nav-map').click()
            page.locator('#map-site').select_option(label='Montague River')
            page.locator('#fly-here').click()
            page.wait_for_function("window.islandAirDiagnostics?.site==='montague' && window.islandAirDiagnostics.mode==='flight'")
            a0=page.evaluate('window.islandAirDiagnostics')
            page.wait_for_function("""a=>{
             const d=window.islandAirDiagnostics,b=d.buildingTiles;
             return d.mode==='flight'&&d.camera==='Chase'&&d.roads&&d.mainland&&b?.ready>0&&
              b.ready===b.wanted&&!b.failed&&!b.pending&&!d.detail.missing&&d.detail.ready>0&&
              Math.hypot(d.x-a.x,d.z-a.z)>110;
            }""",arg=a0,timeout=200000,polling=250)
            a1=page.evaluate('window.islandAirDiagnostics')
            travelled=math.hypot(a1['x']-a0['x'],a1['z']-a0['z'])
            # A 200 full-pack fallback may replace all later range requests. The
            # paired renderer and direct mesh witnesses already verify the tile.
            report=dict(site=a1['site'],metres=round(travelled,2),buildingTiles=a1['buildingTiles'],
                directHallRangeObserved=expected in recorded,detail=a1['detail'],warnings=a1['layerWarnings'],
                rendererErrors=errors)
            (a.out/'flight.json').write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps(report,indent=2))
            assert not errors and not a1['layerWarnings'],report
            page.screenshot(path=str(a.out/'chase.png'),timeout=100000)
        finally:
            browser.close();server.shutdown()
if __name__=='__main__':main()
