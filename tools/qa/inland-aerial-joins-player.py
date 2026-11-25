#!/usr/bin/env python3
"""Replay a private QA-only flight across the western source window. The build adds only a single fixture departure; all world code is unchanged."""
import argparse
import functools
import http.server
import json
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
p.add_argument('--chromium', required=True)
p.add_argument('--modes', default='standard,stock-inland,stock-county,corrupt-inland')
a = p.parse_args()

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(a.dist)))
Thread(target=srv.serve_forever, daemon=True).start()
seam = '7-12 / 8-12'
tracadie = '18-12 / 18-13'
county = '27-13 / 27-14'
other = '10-11 / 11-11'
atlas = json.loads((a.dist/'world/detail/index.json').read_text())
target = atlas['tiles']['7-12']
packfile = atlas['packs'][target['pack']]
if not isinstance(packfile, str):
    packfile = packfile.get('url') or packfile['file']

receipt = []
try:
    with sync_playwright() as w:
        chromium = w.chromium.launch(executable_path=a.chromium, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--ignore-gpu-blocklist'])
        for mode in a.modes.split(','):
            ctx = chromium.new_context(viewport={'width':520,'height':350})
            try:
                pg = ctx.new_page()
                pg.set_default_timeout(140000)
                errors, modifications, imagery = [], [], set()
                pg.on('pageerror', lambda e: errors.append(str(e)))
                pg.on('console', lambda e: errors.append(e.text) if e.type=='error' else None)
                pg.on('request', lambda req: imagery.add(req.url.split('/world/detail/')[-1]) if '/world/detail/' in req.url else None)
                if mode == 'corrupt-inland':
                    def corrupt(route):
                        res = route.fetch()
                        raw = bytearray(res.body())
                        assert res.status == 200 and target['offset']+target['bytes'] <= len(raw)
                        raw[target['offset']+target['bytes']//2] ^= 1
                        modifications.append(len(raw))
                        route.fulfill(response=res, body=bytes(raw))
                    pg.route('**/world/detail/'+packfile.rsplit('/',1)[-1], corrupt)
                flag = {'stock-county':'&stockCountyOrtho', 'stock-inland':'&stockInlandOrtho'}.get(mode,'')
                pg.goto(f'http://127.0.0.1:{srv.server_port}/?departure=qa-inland-image-crossing&diagnostics{flag}',wait_until='domcontentloaded')
                pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
                pg.get_by_role('button',name='Begin flight').click()
                pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site==='qa-inland-image-crossing'")
                start = pg.evaluate("({x:window.islandAirDiagnostics.x,z:window.islandAirDiagnostics.z})")
                print(mode, 'flight started', start, 'initial', pg.evaluate("({mode:window.islandAirDiagnostics.mode, speed:window.islandAirDiagnostics.speed, detail:window.islandAirDiagnostics.detail})"), flush=True)
                try:
                    pg.wait_for_function("p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>151",arg=start)
                except Exception:
                    print('final state after travel timeout', pg.evaluate('window.islandAirDiagnostics'), errors, flush=True)
                    raise
                if mode in ('standard','stock-county'):
                    pg.wait_for_function("edge=>window.islandAirDiagnostics?.orthophotoSeams?.find(x=>x.edge===edge)?.gain===1",arg=seam)
                if mode=='corrupt-inland':
                    pg.wait_for_function("edge=>window.islandAirDiagnostics?.detail?.missing>0&&window.islandAirDiagnostics?.orthophotoSeams?.find(x=>x.edge===edge)?.uploads===0",arg=seam)
                v = pg.evaluate('window.islandAirDiagnostics')
                seams = {q['edge']:q for q in v.get('orthophotoSeams') or []}
                assert tracadie in seams and (county in seams)==(mode!='stock-county'), (mode,seams)
                assert (seam in seams)==(mode!='stock-inland') and (other in seams)==(mode!='stock-inland'), (mode,seams)
                assert v['x']>start['x']+146 and abs(v['z']-start['z'])<15, (mode, v['x'], v['z'], start)
                assert v['altitude']-v['groundY']>=20, (mode, v.get('altitude'), v.get('groundY'))
                chosen=seams.get(seam)
                if mode in ('standard','stock-county'):
                    assert chosen['resident'] and chosen['bytes']==10240 and chosen['errors']==0,(mode,chosen)
                if mode=='corrupt-inland':
                    assert modifications and not chosen['resident'] and chosen['bytes']==0,(mode,chosen,modifications)
                assert not errors and not v['layerWarnings'], (mode,errors,v['layerWarnings'])
                pg.keyboard.press('v')
                pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
                pg.keyboard.press('Escape')
                pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
                row=dict(mode=mode,site=v['site'],movesM=((v['x']-start['x'])**2+(v['z']-start['z'])**2)**.5,
                         scope='QA-only injected Dispatch position, unmodified runtime image code', finalGroundClearanceM=v['altitude']-v['groundY'],axisOffsetM=[v['x']-start['x'],v['z']-start['z']],detail=v['detail'],edge=chosen,allEdges=sorted(seams),requestedImagery=sorted(imagery),
                         alteredPackSizes=modifications,cockpit=True,pause=True,errors=errors)
                receipt.append(row)
                a.out.write_text(json.dumps(receipt,indent=2)+'\n')
                print(json.dumps(row),flush=True)
            finally:
                ctx.close()
        chromium.close()
finally:
    srv.shutdown()
