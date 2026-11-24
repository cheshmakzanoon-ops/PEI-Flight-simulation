#!/usr/bin/env python3
"""Play compiled Standard routes and verify gravel admission, controls and fallback."""
import argparse, functools, gzip, http.server, json, math, threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--cases',default='prince,queens,kings,stock,wrong-cover,corrupt,held,high,detail')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
raw=bytearray(gzip.decompress((a.dist/'world/cover.bin.gz').read_bytes()));raw[0]^=1
bad=gzip.compress(raw,compresslevel=4,mtime=0)
asset='compact-aggregate-v1.rgba.gz'
asset_path=a.dist/'art/aggregate'/asset
correct=asset_path.read_bytes()
bad_art=bytearray(correct);bad_art[20]^=1
handler=functools.partial(Quiet,directory=str(a.dist.resolve()))
with http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)as srv,sync_playwright()as pw:
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader',
        '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    cases={}
    for case in a.cases.split(','):
        page=browser.new_page(viewport={'width':404,'height':274})
        page.set_default_timeout(95000)
        errors=[]; requests=[]; stalled=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(urlsplit(r.url).path)if r.url.endswith(asset)else None)
        if case=='wrong-cover':
            page.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=bad,content_type='application/gzip'))
        if case=='corrupt':
            page.route('**/'+asset,lambda r:r.fulfill(status=200,body=bytes(bad_art),content_type='application/gzip'))
        if case=='held':
            page.route('**/'+asset,lambda r:stalled.append(r))
        site=('kings-meadow-low' if case=='kings' else case+'-grassland' if case in ('prince','queens') else
              'charlottetown' if case=='high' else 'prince-grassland')
        q={'stock':'&stockGravelSurface','detail':'&scenery=detail'}.get(case,'')
        page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure={site}'+q,wait_until='domcontentloaded')
        page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
        assert not requests,requests
        page.get_by_role('button',name='Begin flight').click()
        page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
        start=page.evaluate('window.islandAirDiagnostics')
        page.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>97',
           arg={k:start[k]for k in ('x','z')})
        positive=case in ('prince','queens','kings')
        target='ready' if positive else 'scene-mismatch' if case=='wrong-cover' else 'failed' if case in ('corrupt','held') else None
        if target:
            page.wait_for_function('(s)=>window.islandAirDiagnostics?.gravelSurface?.status===s',arg=target,timeout=22000)
        if positive:page.wait_for_function('window.islandAirDiagnostics?.gravelSurface?.gain>.5',timeout=8500)
        if case=='held':
            assert len(stalled)==1
            try:stalled[0].fulfill(status=200,body=correct,content_type='application/gzip')
            except Exception:pass # Chromium may have already aborted the rejected body.
        page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
        page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
        d=page.evaluate('window.islandAirDiagnostics'); state=d['gravelSurface']
        assert d['site']==site and not errors and not d['layerWarnings'],(d['site'],errors,d['layerWarnings'],requests)
        expected=1 if positive or case in ('corrupt','held')else 0
        assert len(requests)==expected,(case,requests,state)
        if case in ('stock','detail'):assert state is None,(case,state)
        if case=='high':assert state['status']=='idle' and state['gain']==0,state
        if case=='wrong-cover':assert state['status']=='scene-mismatch' and state['gain']==0,state
        if case=='corrupt':assert state['status']=='failed' and state['reason']=='wire-hash' and state['gain']==0,state
        if case=='held':assert state['status']=='failed' and state['reason']=='timeout' and state['gain']==0,state
        cases[case]={'site':site,'state':state,'flownM':round(math.hypot(d['x']-start['x'],d['z']-start['z']),3),'requests':len(requests),'errors':errors}
        (a.out/'compiled.json').write_text(json.dumps(cases,indent=2)+'\n')
        print(case,cases[case],flush=True)
        page.close()
    browser.close();srv.shutdown()
