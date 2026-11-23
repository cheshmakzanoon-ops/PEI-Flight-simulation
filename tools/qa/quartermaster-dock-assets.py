#!/usr/bin/env python3
"""Local production-browser gate for the optional Quartermaster dock pack."""
import argparse
from collections import Counter
import functools
import gzip
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
from threading import Event, Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

DOCK='/world/harbour/odbl/v1/quartermaster-docks.json.gz'
COAST='/world/harbour/odbl/v1/quartermaster-coast.rg.gz'
CASES=('healthy','missing-dock','corrupt-dock','stalled-dock','missing-coast')
FLAGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
       '--disable-dev-shm-usage','--ignore-gpu-blocklist']


def probe(browser,dist,case):
    requests=Counter()
    held=Event()
    release=Event()
    missing=DOCK if case=='missing-dock' else COAST if case=='missing-coast' else None
    original=(dist/DOCK.lstrip('/')).read_bytes()
    raw=bytearray(gzip.decompress(original))
    raw[-73]^=7
    corrupt=gzip.compress(raw,mtime=0)

    class Fixture(SimpleHTTPRequestHandler):
        def log_message(self,*_):
            pass

        def do_GET(self):
            path=urlsplit(self.path).path
            if path in (DOCK,COAST):requests[path]+=1
            if path==missing:
                return self.send_error(404)
            if path==DOCK and case in ('corrupt-dock','stalled-dock'):
                body=corrupt if case=='corrupt-dock' else original
                self.send_response(200)
                self.send_header('Content-Length',str(len(body)))
                self.send_header('Content-Type','application/gzip')
                self.end_headers()
                try:
                    if case=='stalled-dock':
                        self.wfile.write(body[:32]);self.wfile.flush()
                        held.set();release.wait(60)
                        self.wfile.write(body[32:])
                    else:
                        self.wfile.write(body)
                except (BrokenPipeError,ConnectionResetError):
                    pass
            else:
                try:
                    super().do_GET()
                except (BrokenPipeError,ConnectionResetError):
                    pass

    with ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Fixture,directory=str(dist))) as http:
        worker=Thread(target=http.serve_forever,daemon=True);worker.start()
        context=browser.new_context(viewport={'width':560,'height':352},device_scale_factor=1)
        try:
            page=context.new_page()
            net=context.new_cdp_session(page)
            net.send('Network.enable')
            request_ids=set();aborts=[];errors=[]
            def started(e):
                if urlsplit(e['request']['url']).path==DOCK:
                    request_ids.add(e['requestId'])
            net.on('Network.requestWillBeSent',started)
            net.on('Network.loadingFailed',lambda e:aborts.append(e['errorText']) if e['requestId'] in request_ids else None)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' and urlsplit(m.location.get('url','')).path!=missing else None)
            page.on('response',lambda r:errors.append(f'{r.status} {r.url}') if r.status>=400 and urlsplit(r.url).path!=missing else None)
            page.goto(f'http://127.0.0.1:{http.server_port}/?diagnostics',wait_until='domcontentloaded',timeout=60000)
            page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'",timeout=85000)
            if case=='healthy':
                page.wait_for_function("window.islandAirDiagnostics?.quartermasterDocks?.id==='quartermaster-floating-docks-v1'",timeout=12000)
            if case=='stalled-dock':
                assert held.is_set() and not release.is_set()
                page.wait_for_timeout(250)
                assert aborts==['net::ERR_ABORTED'],aborts
                release.set()
            get=lambda:page.evaluate('window.islandAirDiagnostics')
            def check(d):
                assert d['harbourShoreline']==(None if case=='missing-coast' else 'quartermaster-coast-v1'),d
                if case=='healthy':
                    assert d['quartermasterDocks']=={'id':'quartermaster-floating-docks-v1','spines':3,'fingers':30,'triangles':540},d
                else:
                    assert d['quartermasterDocks'] is None,d
                assert all(math.isfinite(d[k]) for k in ('groundY','altitude','speed','x','z')),d
            check(get())
            page.evaluate("""()=> {
             document.querySelector('#start').click();
             document.querySelector('#nav-map').click();
             const sel=document.querySelector('#map-site');
             sel.value=[...sel.options].find(o=>o.text.startsWith('Charlottetown waterfront')).value;
             sel.dispatchEvent(new Event('change',{bubbles:true}));
             document.querySelector('#fly-here').click();
            }""")
            page.wait_for_function("window.islandAirDiagnostics?.site==='harbour-low' && window.islandAirDiagnostics.mode==='flight'",timeout=80000)
            a=get()
            page.wait_for_function("""a=>{const d=window.islandAirDiagnostics;
             return d.mode==='flight' && Math.hypot(d.x-a.x,d.z-a.z)>12}""",arg=a,timeout=85000)
            b=get();check(b)
            assert requests=={DOCK:1,COAST:1},requests
            assert not errors,errors
            return {'case':case,'docks':b['quartermasterDocks'],'shore':b['harbourShoreline'],
                    'movedMetres':round(math.hypot(b['x']-a['x'],b['z']-a['z']),2),'aborts':aborts,'errors':errors}
        finally:
            release.set()
            context.close()
            http.shutdown()
            worker.join()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dist',type=Path,required=True)
    p.add_argument('--chromium',required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--case',choices=CASES,action='append')
    a=p.parse_args()
    a.out.parent.mkdir(parents=True,exist_ok=True)
    rows=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=a.chromium,args=FLAGS)
        for case in a.case or CASES:
            row=probe(browser,a.dist.resolve(),case)
            rows.append(row)
            print(json.dumps(row),flush=True)
            a.out.write_text(json.dumps(rows,indent=2)+'\n')


if __name__=='__main__':
    main()
