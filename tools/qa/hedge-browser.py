#!/usr/bin/env python3
"""Check optional stock Three.js hedgerow runtime, healthy ranges and fallbacks."""
import argparse
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
p.add_argument('--chromium',required=True);p.add_argument('--modes',default='range,static,corrupt,absent,wrong-source')
a=p.parse_args()
origin=[]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if '/woodland/hedgerows-v1/' in self.path and self.path.endswith('.pack'):
            origin.append(self.path)
        return super().do_GET()
manifest=json.loads((a.dist/'world/woodland/hedgerows-v1/index.json').read_text())
pack={(f['file']):(a.dist/'world/woodland/hedgerows-v1'/f['file']).read_bytes() for f in manifest['packs']}
def run(b,url,mode):
    ctx=b.new_context(viewport={'width':700,'height':430})
    try:
        page=ctx.new_page();page.set_default_timeout(110000);page_errors=[];ranges=[];done=[]
        page.on('pageerror',lambda e:page_errors.append(str(e)))
        page.on('requestfinished',lambda req:done.append(req.url) if '/woodland/hedgerows-v1/' in req.url and req.url.endswith('.pack') else None)
        def cat(route):
            if mode=='absent':route.fulfill(status=404,body='')
            elif mode=='wrong-source':route.fulfill(status=200,json={**manifest,'roadsSHA256':'0'*64})
            else:route.continue_()
        def block(route):
            name=route.request.url.rsplit('/',1)[-1];raw=pack[name]
            rg=route.request.headers.get('range','')
            first,last=map(int,rg.removeprefix('bytes=').split('-'));payload=raw[first:last+1]
            ranges.append((name,first,last,len(payload)))
            if mode=='corrupt':payload=b'0'*len(payload)
            route.fulfill(status=206,body=payload,headers={'Content-Range':f'bytes {first}-{last}/{len(raw)}'})
        boundary=len(origin)
        # Installing any route disables Chromium's normal HTTP cache. For
        # the stock static-host case use no routing and measure origin GETs,
        # not cache hits reported as complete by the page event API.
        if mode!='static':
            page.route('**/woodland/hedgerows-v1/index.json',cat)
            page.route('**/woodland/hedgerows-v1/*.pack',block)
        page.goto(url+'/?diagnostics',wait_until='domcontentloaded')
        page.locator('#start').click()
        page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.hedgerows")
        if mode in ('range','static'):
            page.wait_for_function("window.islandAirDiagnostics.hedgerows.visible>0")
        elif mode=='corrupt':
            page.wait_for_function("window.islandAirDiagnostics.hedgerows.failed>0")
        else:
            page.wait_for_function("window.islandAirDiagnostics.hedgerows.missing")
        diag=page.evaluate('window.islandAirDiagnostics');s=diag['hedgerows']
        assert not page_errors and not diag['layerWarnings'],(page_errors,diag)
        assert s['loaded']<=9 and s['loading']<=2,s
        if mode in ('absent','wrong-source'):assert s['visible']==s['loaded']==0 and not ranges and not done
        if mode=='corrupt':assert s['visible']==s['loaded']==0 and ranges
        if mode=='range':assert s['visible']>0 and ranges and sum(r[3] for r in ranges)<manifest['bytes']
        actual=origin[boundary:] if mode=='static' else []
        if mode=='static':assert s['visible']>0 and actual and all(n==1 for n in Counter(actual).values()),actual
        return {'mode':mode,'start':diag['site'],'state':s,'ranges':len(ranges),'rangeBytes':sum(r[3] for r in ranges),
          'completePacks':len(actual) if mode=='static' else None,
          'staticBytes':sum(len(pack[x.rsplit('/',1)[-1]]) for x in actual) if mode=='static' else None}
    finally:
        ctx.close()
with ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(a.dist))) as host:
    Thread(target=host.serve_forever,daemon=True).start()
    with sync_playwright() as pw:
        b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
        receipts=[]
        for m in a.modes.split(','):
            one=run(b,f'http://127.0.0.1:{host.server_port}',m)
            receipts.append(one);print(json.dumps(one),flush=True)
            a.out.write_text(json.dumps(receipts,indent=2)+'\n')
        b.close()
    host.shutdown()
