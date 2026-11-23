#!/usr/bin/env python3
"""Smoke-test live aileron and elevator art in the production bundle."""
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
p.add_argument('--chromium',required=True)
args=p.parse_args()
if not (args.dist/'index.html').is_file():
    p.error('--dist must contain a completed production build')
with ThreadingHTTPServer(('127.0.0.1',0), partial(QuietServer,directory=str(args.dist.resolve()))) as server:
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=args.chromium,
                args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':1000,'height':640},device_scale_factor=1)
            errors=[]
            page.on('pageerror',lambda err:errors.append(str(err)))
            page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded')
            page.locator('#start').click()
            page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'",timeout=65000)
            page.keyboard.down('d')
            page.keyboard.down('s')
            page.wait_for_function("""()=>{
              const c=window.islandAirDiagnostics?.controlAngles;
              return c&&c[0][0]>=.075&&c[0][1]<=-.075&&c[1][0]<=-.075&&c[1][1]<=-.075;
            }""",timeout=35000)
            page.keyboard.up('d')
            page.keyboard.up('s')
            page.wait_for_function("""()=>{
              const c=window.islandAirDiagnostics?.controlAngles;
              return c&&c.flat().every(a=>Math.abs(a)<.005);
            }""",timeout=35000)
            assert not errors, errors
            print('Actual flight controls moved the correct mirrored groups and returned to neutral.',flush=True)
    finally:
        server.shutdown()
