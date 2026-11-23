#!/usr/bin/env python3
"""Smoke-test the pilot camera and return to chase in the production bundle."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

class QuietServer(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
args=p.parse_args()
if not (args.dist/'index.html').is_file():
    p.error('--dist must contain a completed production build')
args.out.mkdir(parents=True,exist_ok=True)
with ThreadingHTTPServer(('127.0.0.1',0), partial(QuietServer,directory=str(args.dist.resolve()))) as server:
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=args.chromium,
                args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
            for width,height in [(1200,760),(850,640)]:
                page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
                page.set_default_timeout(65000)
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
                page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded')
                page.locator('#start').click()
                page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
                for camera in ['Cockpit','Wide chase','Chase','Cockpit']:
                    page.keyboard.press('v')
                    page.wait_for_function('name=>window.islandAirDiagnostics?.camera===name',arg=camera)
                before=page.evaluate('window.islandAirDiagnostics')
                page.keyboard.down('=')
                page.wait_for_function("t=>window.islandAirDiagnostics?.throttle>t",arg=before['throttle'])
                page.keyboard.up('=')
                page.screenshot(path=str(args.out/f'cockpit-{width}x{height}.png'))
                assert not errors, errors
                page.close()
                print(f'{width}×{height}: camera cycle, throttle signal, cockpit capture passed',flush=True)
    finally:
        server.shutdown()
