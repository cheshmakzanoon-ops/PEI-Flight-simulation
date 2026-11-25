#!/usr/bin/env python3
"""Play the ordinary compiled Confederation Bridge route; no camera injection."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def run(dist, chromium):
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(dist))) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}'
        with pw.chromium.launch(executable_path=chromium, args=[
            '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage', '--ignore-gpu-blocklist',
        ]) as browser:
            page = browser.new_page(viewport={'width': 640, 'height': 400})
            page.set_default_timeout(120000)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('console', lambda e: errors.append(e.text) if e.type == 'error' else None)
            page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.url.startswith(url) and r.status >= 400 else None)
            page.goto(f'{url}/?departure=bridge&diagnostics', wait_until='domcontentloaded')
            page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
            page.get_by_role('button', name='Begin flight').click()
            page.wait_for_function('window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.mainland')
            start = page.evaluate('window.islandAirDiagnostics')
            # The normal Borden departure flies southwest across the Strait.
            page.wait_for_function('s=>window.islandAirDiagnostics.x < s.x - 160 && window.islandAirDiagnostics.z > s.z + 140',
                                   arg={k: start[k] for k in ('x', 'z')})
            page.keyboard.press('v')
            page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
            end = page.evaluate('window.islandAirDiagnostics')
            page.keyboard.press('Escape')
            page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
            if end['site'] != 'bridge' or end['altitude'] < 190 or end['layerWarnings'] or errors:
                raise RuntimeError((end, errors))
            return {'route': end['site'], 'westMetres': round(start['x']-end['x'], 3),
                    'southMetres': round(end['z']-start['z'], 3),
                    'startAltitudeM': round(start['altitude'], 3), 'endAltitudeM': round(end['altitude'], 3),
                    'cam': end['camera'], 'warnings': len(end['layerWarnings']), 'playbackErrors': len(errors)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', required=True, type=Path)
    parser.add_argument('--chromium', required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.dist, args.chromium), indent=2))
