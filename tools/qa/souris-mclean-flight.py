#!/usr/bin/env python3
"""Run the compiled app and ordinary departure controls over Main Street.

The real checkout is never modified. A temporary dispatch entry starts the
compiled build offshore beside Souris. It doesn't override the renderer,
aircraft, scenery, flight controls or building streams.
"""
import argparse
from functools import partial
import json
import math
from http.server import ThreadingHTTPServer
from pathlib import Path
import runpy
import shutil
import subprocess
import tempfile
from threading import Thread

from playwright.sync_api import sync_playwright


def launch(a, root):
    entry = dict(id='qa-souris-main', name='Souris local QA', region='Kings County',
                 lon=-62.25756, lat=46.34833, heading=24, height=77,
                 note='Test-only offshore departure via ordinary flight controls.')
    for f in ('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'):
        shutil.copy2(a.checkout / f, root / f)
    shutil.copytree(a.checkout / 'src', root / 'src')
    (root / 'public').symlink_to((a.checkout / 'public').resolve(), target_is_directory=True)
    (root / 'node_modules').symlink_to((a.checkout / 'node_modules').resolve(), target_is_directory=True)
    target=root/'src/sim/places.ts'
    s=target.read_text()
    anchor='export const SITES: Site[] = ['
    assert s.count(anchor)==1
    target.write_text(s.replace(anchor, anchor+'\n '+json.dumps(entry)+','))
    with (a.out/'build.log').open('w') as log:
        subprocess.run(['node', str(root/'node_modules/vite/bin/vite.js'), 'build'], cwd=root,
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    routes=runpy.run_path(str(a.checkout/'tools/qa/player-routes.py'))
    serve=partial(routes['QuietStaticServer'],directory=str(root/'dist'))
    city=json.loads((root/'dist/world/buildings/index.json').read_text())
    owner=next(t for t in city['tiles'] if t['id']=='q130331')
    span=f'bytes={owner["offset"]}-{owner["offset"]+owner["bytes"]-1}'
    errors=[];requests=[]
    with ThreadingHTTPServer(('127.0.0.1',0),serve) as server, sync_playwright() as engine:
        Thread(target=server.serve_forever,daemon=True).start()
        browser=engine.chromium.launch(executable_path=a.chromium,args=routes['FLAGS'])
        try:
            page=browser.new_page(viewport={'width':820,'height':513},device_scale_factor=1)
            page.set_default_timeout(100000)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda message:errors.append(message.text) if message.type=='error' else None)
            def capture(request):
                if request.url.endswith('/buildings/tiles.pack'):
                    requests.append(request.headers.get('range'))
            page.on('request',capture)
            page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded')
            page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
            page.select_option('#site',label=entry['name'])
            page.get_by_role('button',name='Begin flight').click()
            page.wait_for_function("window.islandAirDiagnostics?.site==='qa-souris-main' && window.islandAirDiagnostics.mode==='flight'")
            begin=page.evaluate('window.islandAirDiagnostics')
            page.wait_for_function("""q=>{
             const d=window.islandAirDiagnostics,b=d.buildingTiles;
             return d.mode==='flight'&&d.camera==='Chase'&&d.roads&&d.mainland&&b?.ready>0&&
              b.ready===b.wanted&&!b.failed&&!b.pending&&!d.detail.missing&&d.detail.ready>0&&
              Math.hypot(d.x-q.x,d.z-q.z)>95;
            }""",arg=begin,polling=250)
            scene=page.evaluate('window.islandAirDiagnostics')
            page.screenshot(path=str(a.out/'chase.png'),timeout=100000)
            page.keyboard.press('v')
            page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
            page.keyboard.press('Escape')
            page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
            report=dict(privateRehearsalDispatchOnly=True,metres=round(math.hypot(scene['x']-begin['x'],scene['z']-begin['z']),2),
                buildingTiles=scene['buildingTiles'],owner206RangeRequested=span in requests,
                buildingDownloadRequests=len(requests),allAtlasMayBeReused=any(not r for r in requests),
                detail=scene['detail'],warn=scene['layerWarnings'],rendererErrors=errors,cockpitAndPausePassed=True)
            assert not errors and not scene['layerWarnings'],report
            (a.out/'flight.json').write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps(report,indent=2))
        finally:
            browser.close()
            server.shutdown()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[2])
    p.add_argument('--chromium',required=True)
    p.add_argument('--out',type=Path,required=True)
    a=p.parse_args()
    a.checkout=a.checkout.resolve();a.out=a.out.resolve();a.out.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pei-souris-main-production-') as t:launch(a,Path(t))


if __name__=='__main__':main()
