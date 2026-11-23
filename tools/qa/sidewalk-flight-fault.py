#!/usr/bin/env python3
"""WebGL flight continuity with a healthy or unavailable independent sidewalk pack."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit
import gzip
from playwright.sync_api import Error as PlaywrightError

q=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(q)
q.loader.exec_module(fixed)
PATH='/world/pedestrian/odbl/v1/sidewalks.bin.gz'
CASES=('healthy','missing','corrupt','stalled')


def stage(repo,root,deps,void_probe):
    for name in ('index.html','package.json','package-lock.json','tsconfig.json'):
        shutil.copy2(repo/name,root/name)
    shutil.copytree(repo/'src',root/'src')
    (root/'public').symlink_to(repo/'public',target_is_directory=True)
    (root/'node_modules').symlink_to(deps,target_is_directory=True)
    (root/'vite.config.ts').write_text("import {defineConfig} from 'vite'; export default defineConfig({base:'./',cacheDir:"+json.dumps(str(root/'cache'))+"});")


def capture(args,browser,url):
    body=(args.checkout/'public'/PATH.lstrip('/')).read_bytes()
    corrupt=bytearray(gzip.decompress(body));corrupt[len(corrupt)//2]^=0x33
    results=[]
    for case in args.case or CASES:
        ctx=browser.new_context(viewport={'width':608,'height':380},device_scale_factor=1)
        try:
            page=ctx.new_page();page.set_default_timeout(100000)
            hits=[];aborts=[];errors=[];held=[]
            def request(route):
                hits.append(route.request.url)
                if case=='missing':route.fulfill(status=404,body='not installed')
                elif case=='corrupt':route.fulfill(status=200,content_type='application/gzip',body=gzip.compress(corrupt,mtime=0))
                elif case=='stalled':held.append(route)
                else:route.continue_()
            page.route('**'+PATH,request)
            page.on('requestfailed',lambda r:aborts.append(r.failure) if urlsplit(r.url).path==PATH else None)
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' and urlsplit(m.location.get('url','')).path!=PATH else None)
            page.goto(url+'/?diagnostics',wait_until='domcontentloaded')
            page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
            page.evaluate("document.querySelector('#start').click()")
            page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
            a=page.evaluate('window.islandAirDiagnostics')
            page.wait_for_function("""([x,z])=>{
             const d=window.islandAirDiagnostics;
             return d.mode==='flight'&&d.roads&&d.buildings&&d.mainland&&Math.hypot(d.x-x,d.z-z)>35;
            }""",arg=[a['x'],a['z']])
            if case=='healthy':
                page.wait_for_function("window.islandAirDiagnostics?.sidewalks?.id==='mapped-sidewalks-v1'")
            elif case=='stalled':
                page.wait_for_timeout(6800)
                assert len(held)==1 and aborts==['net::ERR_ABORTED'],(len(held),aborts)
                try:held[0].abort()
                except PlaywrightError:pass  # The browser already aborted it.
            b=page.evaluate('window.islandAirDiagnostics')
            assert b['mode']=='flight' and len(hits)==1 and not errors and not b['layerWarnings'],(b,errors,hits)
            assert (b['sidewalks'] is not None)==(case=='healthy'),b
            result=dict(case=case,site=b['site'],movedMetres=round(((b['x']-a['x'])**2+(b['z']-a['z'])**2)**.5,2),
                installed=b['sidewalks'],packRequests=len(hits),aborts=aborts,errors=errors)
            results.append(result);print(json.dumps(result),flush=True)
            (args.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
        finally:ctx.close()


fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path)
    p.add_argument('--case',choices=CASES,action='append');p.set_defaults(void_probe=False)
    fixed.run(p.parse_args())
