#!/usr/bin/env python3
"""Read the real compiled Dispatch briefings in ordinary and stock comparison profiles."""
import argparse
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def run(page, url, ordinary):
    page.goto(url, wait_until='domcontentloaded')
    page.get_by_role('button', name='Begin flight').wait_for()
    result = {}
    labels = [
        ('Point Prim · lighthouse pass', 'surveyed lighthouse and', 'surveyed lighthouse is off'),
        ('Basin Head · low pass', 'pale sand on the seaward beach', 'pale sand treatment is off'),
        *[(f'{county} County · coastal grass pass', 'Look for close grass detail',
           'close grass treatment is off') for county in ('Prince', 'Queens', 'Kings')],
    ]
    for label, standard, blocked in labels:
        page.locator('#site').select_option(label=label)
        note = page.locator('#site-note').inner_text()
        assert (standard if ordinary else blocked) in note, (label, note)
        result[label] = note
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--chromium', type=Path, required=True)
    args = parser.parse_args()
    assert (args.dist / 'index.html').is_file()
    args.out.mkdir(parents=True, exist_ok=True)
    handler = functools.partial(Quiet, directory=str(args.dist.resolve()))
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            address = f'http://127.0.0.1:{server.server_port}/'
            browser = pw.chromium.launch(executable_path=args.chromium, args=[
                '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                '--disable-dev-shm-usage', '--ignore-gpu-blocklist'])
            page = browser.new_page(viewport={'width': 394, 'height': 760})
            page.set_default_timeout(80000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            result = {'standard': run(page, address, True),
                      'stock': run(page, address+'?stockDuneGrass&stockBasinSand&stockPointPrim', False)}
            assert not errors, errors
            (args.out / 'departure-briefing.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
            print('10 production Dispatch selections passed.', flush=True)
            browser.close()
        finally:
            server.shutdown()
