#!/usr/bin/env python3
"""Fly the actual simulator with a QA-only Souris air start and optional asset faults.

The staged copy adds a dispatch location, not a camera override or physics hack.
"""
import argparse
import gzip
import importlib.util
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit

s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
PATH='/world/lighting/v1/souris-daylight-fields.gz'
CASES=('healthy','missing','corrupt','stalled')
POSE={'id':'qa-souris','name':'Souris approach (QA)','region':'Kings County','lon':-62.256,
      'lat':46.338,'heading':51,'height':112,'note':'Local daylight transfer QA departure.'}

def stage(repo,root,deps,void_probe):
    for name in ('index.html','package.json','package-lock.json','tsconfig.json'):
        shutil.copy2(repo/name,root/name)
    shutil.copytree(repo/'src',root/'src')
    (root/'public').symlink_to(repo/'public',target_is_directory=True)
    (root/'node_modules').symlink_to(deps,target_is_directory=True)
    (root/'vite.config.ts').write_text("import {defineConfig} from 'vite'; export default defineConfig({base:'./',cacheDir:"+json.dumps(str(root/'cache'))+"});")
    f=root/'src/sim/places.ts'
    with f.open('a') as app:app.write('\nSITES.push('+json.dumps(POSE)+');\n')

def capture(args,browser,url):
    data=[]
    body=(args.checkout/'public'/PATH.lstrip('/')).read_bytes()
    corrupt=bytearray(gzip.decompress(body));corrupt[len(corrupt)//2]^=0x52
    for case in args.case or CASES:
        ctx=browser.new_context(viewport={'width':560,'height':364},device_scale_factor=1)
        try:
            page=ctx.new_page();page.set_default_timeout(60000)
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
            assert not hits,'local pack loaded at the distant default departure'
            page.evaluate("""()=>{
             document.querySelector('#start').click();document.querySelector('#nav-map').click();
             const control=document.querySelector('#map-site');
             control.value=[...control.options].find(o=>o.text==='Souris approach (QA)').value;
             control.dispatchEvent(new Event('change',{bubbles:true}));
             document.querySelector('#fly-here').click();
            }""")
            page.wait_for_function("window.islandAirDiagnostics?.site==='qa-souris' && window.islandAirDiagnostics.mode==='flight'")
            state=lambda:page.evaluate('window.islandAirDiagnostics')
            a=state()
            page.wait_for_function("""a=>{
              const d=window.islandAirDiagnostics;
              return d?.mode==='flight' && d.buildings && Math.hypot(d.x-a.x,d.z-a.z)>18;
            }""",arg=a)
            if case=='healthy':
                page.wait_for_function("window.islandAirDiagnostics.sourisLighting==='souris-daylight-contact-v2'")
            else:
                page.wait_for_timeout(2100)
                assert state()['sourisLighting'] is None
            b=state()
            assert b['mode']=='flight' and len(hits)==1 and not errors,(b,hits,errors)
            if case=='stalled':assert len(held)==1 and aborts==['net::ERR_ABORTED'],(held,aborts)
            elif case!='missing':assert not aborts,aborts
            result=dict(case=case,movedMetres=round(((b['x']-a['x'])**2+(b['z']-a['z'])**2)**.5,2),
                 installed=b['sourisLighting'],packRequests=len(hits),aborts=aborts,errors=errors)
            data.append(result);print(json.dumps(result),flush=True)
            (args.out/'report.json').write_text(json.dumps(data,indent=2)+'\n')
        finally:ctx.close()

if __name__=='__main__':
    fixed.stage=stage;fixed.capture=capture
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--chromium',required=True);p.add_argument('--deps',type=Path)
    p.add_argument('--case',choices=CASES,action='append');p.set_defaults(void_probe=False)
    fixed.run(p.parse_args())
