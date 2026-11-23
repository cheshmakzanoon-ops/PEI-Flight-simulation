#!/usr/bin/env python3
"""Real production player: recover from temporary catalogue and tile failures."""
import argparse
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

class QuietServer(SimpleHTTPRequestHandler):
    def log_message(self,*_):
        pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist', type=Path, required=True)
p.add_argument('--chromium', required=True)
args=p.parse_args()
args.dist=args.dist.resolve()
requests=Counter()
injected={}
small_cache={}

def route_detail(route):
    path=urlparse(route.request.url).path
    name=path.rsplit('/',1)[-1]
    range_header=route.request.headers.get('range','')
    key=(name,range_header)
    requests[key]+=1
    group='index' if name=='index.json' else 'tile'
    if group not in injected:
        injected[group]=key
        route.fulfill(status=503, body='Injected temporary failure')
        return
    if not range_header:
        route.continue_()
        return
    if name not in small_cache:
        small_cache[name]=(args.dist/'world'/'detail'/name).read_bytes()
    data=small_cache[name]
    low,high=map(int,range_header.removeprefix('bytes=').split('-'))
    assert 0<=low<=high<len(data)
    route.fulfill(status=206, headers={'content-type':'application/octet-stream',
                  'content-range':f'bytes {low}-{high}/{len(data)}'}, body=data[low:high+1])

with ThreadingHTTPServer(('127.0.0.1',0),partial(QuietServer,directory=str(args.dist))) as server:
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as w:
            browser=w.chromium.launch(executable_path=args.chromium,
                args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':900,'height':550})
            page.set_default_timeout(85000)
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/world/detail/**',route_detail)
            page.goto(f'http://127.0.0.1:{server.server_port}/?diagnostics',wait_until='domcontentloaded')
            page.locator('#start').click()
            page.wait_for_function("""()=>{const d=window.islandAirDiagnostics;
                return d?.mode==='flight'&&d.detail.ready>=6&&d.detail.loading===0&&d.detail.retrying===0;
            }""")
            d=page.evaluate('window.islandAirDiagnostics')
            assert not errors and not d['detail']['missing'], (errors,d)
            assert set(injected)=={'index','tile'}
            assert all(requests[key]==2 for key in injected.values()), (injected,requests)
            print('Recovered catalogue and tile after one retry each; stayed in flight.',d['detail'],flush=True)
            browser.close()
    finally:
        server.shutdown()
