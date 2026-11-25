#!/usr/bin/env python3
"""Play the compiled Summerside shoreline approach, including independent stock fallbacks."""
import argparse
from functools import partial
import gzip
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dist', type=Path, required=True)
parser.add_argument('--chromium', required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--device-scale', type=float, default=1.)
parser.add_argument('--cases', default='both,rail,wharf,stock,missing,corrupt,rail-corrupt,distant,legacy')
args = parser.parse_args()
args.out.parent.mkdir(parents=True, exist_ok=True)
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(args.dist)))
threading.Thread(target=server.serve_forever, daemon=True).start()
prefix = f'http://127.0.0.1:{server.server_port}'
deck_suffix = '/measured-deck.gz'
statuses = {
    'both': (True, True, 1, 1), 'rail': (True, False, 1, 0), 'wharf': (False, True, 0, 1),
    'stock': (False, False, 0, 0), 'missing': (True, False, 1, 1), 'corrupt': (True, False, 1, 1),
    'rail-corrupt': (False, True, 1, 1), 'distant': (False, False, 0, 0), 'legacy': (False, True, 0, 1),
}
flags = {
    'rail': '&stockSpinnakersDeck', 'wharf': '&stockStationExterior',
    'stock': '&stockStationExterior&stockSpinnakersDeck', 'legacy': '&spinnakersPreview'
}
body = bytearray(gzip.decompress((args.dist / 'world/spinnakers/v0/measured-deck.gz').read_bytes()))
body[225] ^= 1
damaged_deck = gzip.compress(body, mtime=0)
samples = []
read = '()=>window.islandAirDiagnostics'
browser_flags = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                 '--disable-dev-shm-usage', '--ignore-gpu-blocklist']
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium, args=browser_flags)
        for case in args.cases.split(','):
            station, deck, station_requests, deck_requests = statuses[case]
            with browser.new_context(viewport={'width': 540, 'height': 390}, device_scale_factor=args.device_scale) as context:
                page = context.new_page()
                page.set_default_timeout(150000)
                errors, transfers = [], []
                page.on('pageerror', lambda err: errors.append(str(err)))
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' or 'WebGL: INVALID_' in msg.text else None)
                page.on('response', lambda r: transfers.append((r.url, r.status)) if
                        r.url.endswith(deck_suffix) or '/art/summerside-station-C' in r.url else None)
                if case == 'corrupt':
                    page.route('**/measured-deck.gz', lambda r: r.fulfill(
                        status=200, body=damaged_deck, content_type='application/gzip'))
                if case == 'missing':
                    page.route('**/measured-deck.gz', lambda r: r.fulfill(status=404, body=b''))
                if case == 'rail-corrupt':
                    def bad_rail(route):
                        response = route.fetch()
                        data = bytearray(response.body())
                        data[len(data) // 2] ^= 1
                        route.fulfill(response=response, body=bytes(data))
                    page.route('**/art/summerside-station-C*', bad_rail)
                site = 'cavendish' if case == 'distant' else 'spinnakers-low'
                page.goto(prefix + f'/?diagnostics&departure={site}' + flags.get(case, ''), wait_until='domcontentloaded')
                page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
                page.get_by_role('button', name='Begin flight').click()
                page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
                before = page.evaluate(read)
                if deck:
                    page.wait_for_function('window.islandAirDiagnostics?.spinnakersDeck===true')
                if station:
                    page.wait_for_function('window.islandAirDiagnostics?.summersideStation===true')
                page.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>285',
                                       arg={'x': before['x'], 'z': before['z']})
                page.keyboard.press('v')
                page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
                observed = page.evaluate(read)
                page.keyboard.press('Escape')
                page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
                assert observed['site'] == site and observed['mode'] == 'flight', observed
                assert (observed['summersideStation'], observed['spinnakersDeck']) == (station, deck), observed
                if case not in ('distant','legacy'):
                    assert observed['summersideMeasuredRoofs'] >= 3 and observed['buildingShadows'] is None, observed
                assert not any(observed[k] for k in ('northBaywalkCourt', 'northBaywalkRamp', 'northBaywalkRoad')), observed
                found_deck = [status for url, status in transfers if url.endswith(deck_suffix)]
                found_rail = [status for url, status in transfers if '/art/summerside-station-C' in url]
                assert found_deck == [404 if case == 'missing' else 200] * deck_requests, transfers
                assert found_rail == [200] * station_requests, transfers
                # Chromium logs an expected network error for the intended missing body only.
                unexpected = [e for e in errors if not (case == 'missing' and '404' in e)]
                assert not unexpected and not observed['layerWarnings'], (unexpected, observed['layerWarnings'])
                row = {'case': case, 'site': site, 'station': station, 'deck': deck, 'deck_http': found_deck,
                       'station_http': found_rail, 'movement_m': round(math.hypot(observed['x']-before['x'], observed['z']-before['z']), 3),
                       'measured_roofs': observed['summersideMeasuredRoofs'], 'ground_m': observed['groundY'],
                       'town_wall_profile': observed.get('townWallProfile'), 'device_scale_factor': args.device_scale, 'draws': observed['drawCalls'], 'triangles': observed['triangles'],
                       'cockpit_and_pause': True, 'errors': unexpected}
                samples.append(row)
                args.out.write_text(json.dumps(samples, indent=2) + '\n')
                print(json.dumps(row), flush=True)
        browser.close()
finally:
    server.shutdown()
