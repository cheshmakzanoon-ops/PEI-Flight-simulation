#!/usr/bin/env python3
"""Unmodified built player with a controllable Range-capable stand-data host."""
import argparse
import json
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
    def do_GET(self):
        path=urlparse(self.path).path
        if args.mode=='full' and '/woodland/stream-v1/' in path and path.endswith('.pack'):
            name=path.rsplit('/',1)[-1];rg=self.headers.get('Range')
            assert rg
            ranges[(name,rg)]+=1
            network_bytes.append((asset/name).stat().st_size)
        super().do_GET()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',required=True,type=Path)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--mode',choices=['range','full','corrupt','absent'],default='range')
args=p.parse_args()
root=args.dist.resolve()
asset=root/'world'/'woodland'/'stream-v1'
index=json.loads((asset/'index.json').read_text())
sets={t['id'] for t in index['tiles']}
ranges=Counter();network_bytes=[];cache={};finished=[];failed=[]
def manifest_route(r):
    if args.mode=='absent':
        r.fulfill(status=404,body='missing optional layer')
    else:r.continue_()
def data_route(route):
    name=Path(urlparse(route.request.url).path).name
    rg=route.request.headers.get('range')
    assert name in {p['file'] for p in index['packs']} and rg, (name,rg)
    ranges[(name,rg)]+=1
    if name not in cache:cache[name]=(asset/name).read_bytes()
    body=cache[name]
    if args.mode=='full':
        network_bytes.append(len(body));route.fulfill(status=200,body=body)
        return
    a,b=map(int,rg.removeprefix('bytes=').split('-'))
    assert 0<=a<=b<len(body)
    it=body[a:b+1]
    network_bytes.append(len(it))
    if args.mode=='corrupt':it=b'0'*len(it)
    route.fulfill(status=206,body=it,headers={'Content-Range':f'bytes {a}-{b}/{len(body)}'})

with ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root))) as srv:
    Thread(target=srv.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=args.chromium,
              args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':720,'height':440})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            def record(req,bucket):
                if '/world/woodland/stream-v1/' in req.url:
                    bucket.append((req.url.rsplit('/',1)[-1],req.headers.get('range'),req.failure))
            page.on('requestfinished',lambda q:record(q,finished))
            page.on('requestfailed',lambda q:record(q,failed))
            page.route('**/world/woodland/stream-v1/index.json',manifest_route)
            if args.mode!='full':page.route('**/world/woodland/stream-v1/*.pack',data_route)
            page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics',wait_until='domcontentloaded')
            page.locator('#start').click()
            records=[]
            def wait(site):
                page.wait_for_function("s=>{const d=window.islandAirDiagnostics;return d?.site===s&&d.mode==='flight'&&d.woodlandStream?.active!=='Infinity-Infinity';}",arg=site,timeout=70000)
                diag=page.evaluate("window.islandAirDiagnostics")
                if args.mode in ('range','full') and diag['woodlandStream']['active'] in sets:
                    page.wait_for_function("window.islandAirDiagnostics?.woodlandStream?.activeReady",timeout=70000)
                elif args.mode=='corrupt':
                    page.wait_for_function("window.islandAirDiagnostics?.woodlandStream?.failed>0",timeout=70000)
                elif args.mode=='absent':
                    page.wait_for_function("window.islandAirDiagnostics?.woodlandStream?.missing",timeout=70000)
                diag=page.evaluate("window.islandAirDiagnostics")
                assert not errors and not diag['layerWarnings'],(errors,diag)
                records.append({'site':site,'state':diag['woodlandStream'],'rangesSoFar':len(network_bytes)})
            wait('cavendish')
            if args.mode in ('range','full'):
                for site,label in [('cysu','Summerside · runway 05'),('eastpoint','East Point')]:
                    page.locator('#nav-map').click()
                    page.locator('#map-site').select_option(label=label)
                    page.locator('#fly-here').click()
                    wait(site)
            assert all(x['state']['resident']<=26 and x['state']['inflight']<=2 for x in records)
            if args.mode=='absent':
                assert not ranges
            elif args.mode=='corrupt':
                assert not records[0]['state']['resident']
            elif args.mode=='range':
                assert 0<len(ranges)<len(sets),len(ranges)
            else:
                files=Counter(n for n,_ in ranges.keys())
                print('Full pack attempts',files,'finished',finished,'failed',failed,flush=True)
                completed=Counter(n for n,rg,_ in finished if rg)
                assert all(v==1 for v in completed.values()),(completed,failed)
                assert set(files)-set(completed)<=set(n for n,rg,_ in failed if rg), (files,completed,failed)
            d={'case':args.mode,'records':records,'uniqueRangeRequests':len(ranges),'transferBytes':sum(network_bytes)}
            print(json.dumps(d),flush=True)
            args.out.write_text(json.dumps(d,indent=2)+'\n')
            browser.close()
    finally:srv.shutdown()
