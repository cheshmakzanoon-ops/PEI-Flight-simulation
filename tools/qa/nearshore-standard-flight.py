#!/usr/bin/env python3
"""Unmodified production Standard flights using the real Dispatch and flight controls."""
import argparse, functools, gzip, http.server, json, math, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--cases',default='prince,kings,stock,wrong-cover,distant,detail,explicit')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
raw=bytearray(gzip.decompress((a.dist/'world/cover.bin.gz').read_bytes()));raw[0]^=1
bad=gzip.compress(raw,compresslevel=4,mtime=0)
handler=functools.partial(Quiet,directory=str(a.dist.resolve()))
with http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)as srv,sync_playwright() as pw:
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader',
     '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    cases={}
    for case in a.cases.split(','):
      page=browser.new_page(viewport={'width':404,'height':272})
      page.set_default_timeout(120000)
      errors=[]; reads=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
      page.on('request',lambda x:reads.append(1)if '/world/cover.bin.gz' in x.url else None)
      if case=='wrong-cover':page.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=bad,content_type='application/gzip'))
      site='prince-open-shore-pass'if case=='prince' else 'charlottetown' if case=='distant' else 'kings-coastal-ridge'
      opt={'stock':'&stockNearshoreFoam','detail':'&scenery=detail','explicit':'&nearshoreFoamStudy'}.get(case,'')
      page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure={site}'+opt,wait_until='domcontentloaded')
      page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
      if case!='explicit':assert page.evaluate('()=>!window.islandAirDiagnostics.nearshoreFoamStudy')
      page.get_by_role('button',name='Begin flight').click()
      page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
      start=page.evaluate('window.islandAirDiagnostics')
      page.wait_for_function('a=>Math.hypot(window.islandAirDiagnostics.x-a.x,window.islandAirDiagnostics.z-a.z)>a.m',
       arg=dict(x=start['x'],z=start['z'],m=225 if case=='prince'else 95))
      if case in ('prince','kings'):
        page.wait_for_function("window.islandAirDiagnostics?.nearshoreStandard?.gain===1",timeout=12000)
      if case=='wrong-cover':
        page.wait_for_function("window.islandAirDiagnostics?.nearshoreStandard?.proof==='stock'",timeout=12000)
      page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
      page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
      d=page.evaluate('window.islandAirDiagnostics');state=d['nearshoreStandard']
      assert len(reads)==1 and d['site']==site and not d['layerWarnings'] and not errors,(case,reads,d['layerWarnings'],errors)
      assert d['nearshoreFoamStudy']==(case in ('prince','kings','explicit')),(case,state)
      if case=='distant':assert state=={'proof':'cold','gain':0},state
      if case=='wrong-cover':assert state=={'proof':'stock','gain':0},state
      if case in ('stock','detail','explicit'):assert state is None,state
      cases[case]={'site':site,'state':state,'active':d['nearshoreFoamStudy'],'flownM':round(math.hypot(d['x']-start['x'],d['z']-start['z']),3),'coverRequests':len(reads),'errors':errors}
      (a.out/'compiled.json').write_text(json.dumps(cases,indent=2)+'\n')
      print(case,cases[case],flush=True);page.close()
    browser.close();srv.shutdown()
