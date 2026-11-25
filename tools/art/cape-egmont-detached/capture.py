#!/usr/bin/env python3
"""Render and verify the real standalone Cape Egmont art station."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True)
views={}
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
with ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=a.dist.resolve())) as srv,sync_playwright() as pw:
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']) as browser:
        cases={'exterior':'','deck':'deck','weather':'weather'}
        for name,q in cases.items():
            page=browser.new_page(viewport={'width':900,'height':750})
            errors=[]
            page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{srv.server_port}/?{q}')
            page.wait_for_function('window.ready',timeout=90000)
            image=page.screenshot(path=str(a.out/(name+'.png')),timeout=90000)
            m=page.evaluate('window.ready')
            assert image and not errors and 2<m['draws']<80 and 300<m['triangles']<24000,(name,m,errors)
            lo,hi=m['bounds']
            assert (-4<lo[0]<-3 and -.1<lo[1]<.01 and -4<lo[2]<-3) and 13<hi[1]<14,(name,lo,hi)
            views[name]=m
            page.close()
    srv.shutdown()
assert len(views)==3 and len({tuple(x['bounds'][1]) for x in views.values()})==1
(a.out/'studio.json').write_text(json.dumps(views,indent=2)+'\n')
