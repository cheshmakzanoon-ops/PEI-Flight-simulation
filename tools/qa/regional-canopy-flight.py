#!/usr/bin/env python3
"""Browser smoke on the exact compiled regional woodland app."""
import argparse,functools,http.server,json,threading,re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--modes',default='queens,kings,stock,wrong-cover,corrupt-pack,held-pack,distant,detail')
p.add_argument('--minimum',type=float,default=95)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
route=lambda s:s+'-canopy-pass'
digest_fn="window.islandAirDiagnostics?.regionalCanopy"
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 out=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])as br:
  for mode in a.modes.split(','):
   pg=br.new_page(viewport={'width':398,'height':266});packs=[];errors=[];con=[];held=[]
   try:
    pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:con.append(e.text)if e.type=='error'else None)
    pg.on('request',lambda r:packs.append(urlsplit(r.url).path.split('/')[-1]) if re.search(r'\d+-canopy-v2\.rcv\.gz$',urlsplit(r.url).path) else None)
    if mode=='wrong-cover':
     def wrong(req):
      d=req.fetch().json();d['compressedSha256']='0'*64;req.fulfill(status=200,json=d)
     pg.route('**/world/cover.json',wrong)
    if mode=='corrupt-pack':
     def corrupt(req):
      b=bytearray(req.fetch().body());b[len(b)//2]^=1
      req.fulfill(status=200,body=bytes(b),content_type='application/gzip')
     pg.route('**/*-canopy-v2.rcv.gz',corrupt)
    if mode=='held-pack':pg.route('**/*-canopy-v2.rcv.gz',lambda r:held.append(r))
    site='charlottetown' if mode=='distant'else route('kings'if mode=='kings'else 'queens')
    extra={'stock':'&stockRegionalCanopy','detail':'&scenery=detail'}.get(mode,'')
    pg.set_default_timeout(140000)
    pg.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics&regionalCanopyStudy'+extra,wait_until='domcontentloaded')
    try:pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'",timeout=35000)
    except Exception as e:raise AssertionError((mode,'dispatch',errors,con,pg.locator('body').inner_text()[:460])) from e
    assert not packs,(mode,packs)
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
    start=pg.evaluate('window.islandAirDiagnostics');assert start['site']==site,(mode,start['site'])
    pg.wait_for_function("(s)=>Math.hypot(s.x-window.islandAirDiagnostics.x,s.z-window.islandAirDiagnostics.z)>s.min",arg={'x':start['x'],'z':start['z'],'min':a.minimum})
    positive=mode in ('queens','kings')
    if positive:
     expected=364 if mode=='queens' else 201
     try:pg.wait_for_function("(n)=>window.islandAirDiagnostics?.regionalCanopy?.draw===n&&window.islandAirDiagnostics?.regionalCanopy?.gain>.97",arg=expected,timeout=16000)
     except Exception as e:raise AssertionError((mode,pg.evaluate(digest_fn),packs,errors,con)) from e
    if mode=='held-pack':
     assert len(held)==1,(mode,held,pg.evaluate(digest_fn),packs)
     r=held.pop()
     try:r.fulfill(path=str(a.dist/urlsplit(r.request.url).path.lstrip('/')),content_type='application/gzip')
     except Exception:pass
    end=pg.evaluate('window.islandAirDiagnostics');proof=end.get('regionalCanopy')or{}
    assert not errors and not end['layerWarnings'],(mode,errors,con,end['layerWarnings'])
    if not positive:assert not proof.get('draw') and not proof.get('active'),(mode,packs,proof)
    expected_requests=int(positive or mode in ('corrupt-pack','held-pack'))
    assert len(packs)==expected_requests,(mode,packs,proof)
    pg.keyboard.press('v');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    row=dict(mode=mode,site=end['site'],distanceM=round(((end['x']-start['x'])**2+(end['z']-start['z'])**2)**.5,3),packRequests=packs,state=proof,console=con)
    out.append(row);(a.out/'compiled.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
   finally:pg.close()
