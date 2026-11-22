#!/usr/bin/env python3
"""Unmodified production player: two landmark flights and a coastal overdraw regression.

Run against `npm run build` output. No camera/terrain/shader hooks are injected.
The Cavendish pixel ROI is only valid for the exact 1200×760, 1× chase route below.
"""
import argparse
import functools
import json
import math
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

FLAGS = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--disable-dev-shm-usage', '--ignore-gpu-blocklist']
STATIONS = [('east-light', 'East Point · lighthouse pass'),
            ('west-light', 'West Point · lighthouse pass')]
COAST = [('bridge', 'Confederation Bridge'),
         ('harbour-low', 'Charlottetown waterfront · low pass'),
         ('cavendish-low', 'Cavendish shore · low pass')]


class QuietStaticServer(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def run(args):
    if not (args.dist / 'index.html').is_file():
        raise ValueError('Pass the output of `npm run build` to --dist')
    args.out.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(QuietStaticServer, directory=str(args.dist.resolve()))
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/?diagnostics'
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(executable_path=args.chromium, args=FLAGS)
                ctx = browser.new_context(viewport={'width': 1200, 'height': 760}, device_scale_factor=1)
                page = ctx.new_page()
                page.set_default_timeout(90000)
                errors, events = [], []
                def save():
                    (args.out / 'player-routes.json').write_text(json.dumps({
                        'viewport': [1200, 760], 'DPR': 1, 'events': events,
                        'errors': errors, 'renderer': 'Chromium / SwiftShader; not a device performance result'
                    }, indent=2))
                def check():
                    if errors:
                        save()
                        raise RuntimeError(str(errors))
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
                page.on('pageerror', lambda err: errors.append(str(err)))
                page.on('response', lambda res: errors.append(f'{res.status} {res.url}') if res.status >= 400 else None)
                def state():
                    return page.evaluate('window.islandAirDiagnostics')
                def go(site, label):
                    check()
                    page.locator('#nav-map').click()
                    page.locator('#map-site').select_option(label=label)
                    page.locator('#fly-here').click()
                    page.wait_for_function('id=>{ const d=window.islandAirDiagnostics; return d?.site===id && d.mode==="flight" && d.camera==="Chase" && d.roads && d.buildings && d.mainland && d.detail.ready>0; }', arg=site)
                    check()
                    return state()
                page.goto(url, wait_until='domcontentloaded')
                page.locator('#start').click()
                for site, label in STATIONS if args.suite in ('all', 'stations') else []:
                    start = go(site, label)
                    page.wait_for_function('s=>{ const d=window.islandAirDiagnostics; return Math.hypot(d.x-s.x,d.z-s.z)>25; }', arg=start)
                    check()
                    page.screenshot(path=str(args.out / (site + '.png')), timeout=100000)
                    end = state()
                    travelled = math.hypot(end['x'] - start['x'], end['z'] - start['z'])
                    assert travelled > 25 and end['mode'] == 'flight' and not end['layerWarnings'] and not end['detail']['missing'], end
                    check()
                    events.append({'site': site, 'start': start, 'end': end, 'travelledMetres': round(travelled, 2)})
                    save()
                    print(site, round(travelled, 1), 'metres', flush=True)
                if args.suite in ('all', 'coast'):
                    for site, label in COAST:
                        go(site, label)
                    page.evaluate('()=>new Promise(resolve=>{let n=10; const step=()=>--n?requestAnimationFrame(step):resolve(); requestAnimationFrame(step);})')
                    check()
                    image = args.out / 'cavendish-low.png'
                    page.screenshot(path=str(image), timeout=100000)
                    d = state()
                    assert d['site'] == 'cavendish-low' and d['camera'] == 'Chase' and not d['layerWarnings'] and not d['detail']['missing'], d
                    with Image.open(image) as im:
                        assert im.size == (1200, 760)
                        a = np.asarray(im.convert('RGB').crop((480, 595, 865, 675)), dtype=np.int16)
                    blue = (a[:, :, 2] - a[:, :, 0] > 15) & (a[:, :, 2] - a[:, :, 1] > -15)
                    ratio = float(blue.mean())
                    events.append({'site': 'cavendish-low', 'state': d, 'waterColouredPixels': int(blue.sum()),
                                   'totalPixels': int(blue.size), 'ratio': ratio, 'maximumExclusive': .25})
                    save()
                    check()
                    assert ratio < .25, f'Water-coloured ground beneath Cavendish woodland: {ratio:.2%}'
                    print(f'cavendish-low {ratio:.3%} water-coloured ground; gate <25%.', flush=True)
                browser.close()
        finally:
            server.shutdown()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--chromium', required=True)
    parser.add_argument('--suite', choices=('all', 'stations', 'coast'), default='all')
    run(parser.parse_args())
