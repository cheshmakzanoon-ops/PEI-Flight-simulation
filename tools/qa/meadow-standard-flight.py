#!/usr/bin/env python3
"""Production low-flight, comparison, and changed-source checks for open-ground detail."""
import argparse, functools, gzip, http.server, json, math, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--cases',default='prince,queens,kings,stock,wrong-cover,high')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
raw=bytearray(gzip.decompress((a.dist/'world/cover.bin.gz').read_bytes()))
raw[0]^=1
bad=gzip.compress(raw,compresslevel=4,mtime=0)
handler=functools.partial(Quiet,directory=str(a.dist.resolve()))
with http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)as srv,sync_playwright()as pw:
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader',
        '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    cases={}
    for case in a.cases.split(','):
        page=browser.new_page(viewport={'width':410,'height':274})
        page.set_default_timeout(115000)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        if case=='wrong-cover':
            page.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=bad,content_type='application/gzip'))
        site=(case+'-meadow-low' if case in ('prince','queens','kings') else
              'charlottetown' if case=='high' else 'queens-meadow-low')
        q='&stockMeadow' if case=='stock' else ''
        page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure={site}'+q,wait_until='domcontentloaded')
        page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
        page.get_by_role('button',name='Begin flight').click()
        page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
        start=page.evaluate('window.islandAirDiagnostics')
        page.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>90',
            arg={k:start[k] for k in ('x','z')})
        if case in ('prince','queens','kings'):
            page.wait_for_function('window.islandAirDiagnostics?.standardMeadow?.strength===1',timeout=16000)
        if case=='wrong-cover':
            page.wait_for_function("window.islandAirDiagnostics?.standardMeadow?.proof==='stock'",timeout=16000)
        page.keyboard.press('Escape')
        page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
        d=page.evaluate('window.islandAirDiagnostics')
        state=d['standardMeadow']
        assert d['site']==site and not d['layerWarnings'] and not errors,(d['site'],d['layerWarnings'],errors)
        if case=='high':assert state=={'proof':'cold','strength':0},state
        if case=='stock':assert state is None,state
        if case=='wrong-cover':assert state=={'proof':'stock','strength':0},state
        cases[case]={'site':site,'proof':state,'flownM':round(math.hypot(d['x']-start['x'],d['z']-start['z']),3),'errors':errors}
        (a.out/'compiled.json').write_text(json.dumps(cases,indent=2)+'\n')
        print(case,cases[case],flush=True)
        page.close()
    browser.close()
    srv.shutdown()
