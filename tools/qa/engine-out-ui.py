#!/usr/bin/env python3
"""Exercise the opt-in failure and restore in the unmodified production WebGL player."""
import argparse
import functools
import json
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


class QuietServer(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main(dist, chromium):
    if not (dist / 'index.html').is_file():
        raise ValueError('Build first, then pass --dist dist')
    handler = functools.partial(QuietServer, directory=str(dist.resolve()))
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(executable_path=chromium, args=[
                    '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                    '--disable-dev-shm-usage', '--ignore-gpu-blocklist'])
                page = browser.new_page(viewport={'width': 960, 'height': 600})
                page.set_default_timeout(90000)
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
                page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)

                def state(mode, failed):
                    page.wait_for_function('([m,f])=>{const d=window.islandAirDiagnostics;'
                                           'return d?.mode===m && d.engineOut===f}',
                                           arg=[mode, failed])
                    return page.evaluate('window.islandAirDiagnostics')

                page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics', wait_until='domcontentloaded')
                page.locator('#start').click()
                state('flight', False)
                pause = page.get_by_role('button', name='Pause', exact=True)
                resume = page.get_by_role('button', name='Resume flight')
                cut = page.get_by_role('button', name='Simulate engine failure')
                restore = page.get_by_role('button', name='Restore engine power')
                pause.click()
                state('paused', False)
                cut.click()
                state('paused', True)
                expect(restore).to_be_enabled()
                # Avoid testing a synthetic key shortcut; the real menu control is keyboard-accessible.
                restore.focus()
                page.keyboard.press('Enter')
                state('paused', False)
                cut.click()
                resume.click()
                a = state('flight', True)
                expect(page.locator('#annun')).to_contain_text('ENGINE OUT', timeout=90000)
                page.wait_for_function('a=>{const d=window.islandAirDiagnostics;'
                                       'return d?.engineOut && Math.hypot(d.x-a.x,d.z-a.z)>12}',
                                       arg=a)
                pause.click()
                restore.click()
                resume.click()
                state('flight', False)
                expect(page.locator('#annun')).not_to_contain_text('ENGINE OUT', timeout=90000)
                # A *new* runway flight after failure must not inherit the cut.
                pause.click()
                cut.click()
                page.get_by_role('button', name='Choose departure').click()
                page.locator('#site').select_option(label='Charlottetown · runway 03')
                page.locator('#start').click()
                ground = state('flight', False)
                assert ground['site'] == 'cyyg', ground
                pause.click()
                expect(cut).to_be_disabled()
                assert not errors, errors
                print(json.dumps({'cutAndRestore': True, 'keyboardActivation': True,
                                  'flownWithCut': True, 'freshDeparture': ground['site'],
                                  'runwayFailureDisabled': True, 'browserErrors': errors}))
                browser.close()
        finally:
            server.shutdown()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', required=True, type=Path)
    parser.add_argument('--chromium', required=True)
    args = parser.parse_args()
    main(args.dist, args.chromium)
