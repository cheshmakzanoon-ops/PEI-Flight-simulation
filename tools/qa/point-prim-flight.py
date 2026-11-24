#!/usr/bin/env python3
"""Point Prim flight lease from a served production build."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--modes',default='active,stock,wrong-cover,corrupt-grade,held-grade,distant')
p.add_argument('--width',type=int,default=420);p.add_argument('--height',type=int,default=286)
p.add_argument('--minimum',type=float,default=90)
p.add_argument('--ordinary',action='store_true')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 receipt=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])as br:
  for mode in a.modes.split(','):
   page=br.new_page(viewport={'width':a.width,'height':a.height});errors=[];console=[];grade=[];held=[]
   try:
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:console.append(e.text)if e.type=='error'else None)
    def observe(req):
     uri=urlsplit(req.url).path
     if uri.endswith('/point-prim-grade.bin.gz'):grade.append(uri)
    page.on('request',observe)
    if mode=='wrong-cover':
     def change(r):
      doc=r.fetch().json();doc['compressedSha256']='0'*64;r.fulfill(status=200,json=doc)
     page.route('**/world/cover.json',change)
    if mode=='corrupt-grade':
     def corrupt(r):
      body=bytearray(r.fetch().body());body[len(body)//2]^=1
      r.fulfill(status=200,body=bytes(body),content_type='application/gzip')
     page.route('**/point-prim-grade.bin.gz',corrupt)
    if mode=='held-grade':page.route('**/point-prim-grade.bin.gz',lambda r:held.append(r))
    site='charlottetown' if mode=='distant' else 'point-prim-offshore'
    flag='&stockPointPrim' if mode=='stock' else ''
    page.set_default_timeout(170000)
    explicit='' if a.ordinary else '&pointPrimStudy'
    page.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+explicit+flag,wait_until='domcontentloaded')
    page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    attract=page.evaluate("window.islandAirDiagnostics")
    assert not grade and not (attract.get('pointPrim') or {}).get('active'),(mode,grade,attract.get('pointPrim'))
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
    start=page.evaluate("window.islandAirDiagnostics")
    assert start['site']==site,(mode,start['site'],site)
    page.wait_for_function("(s)=>Math.hypot(s.x-window.islandAirDiagnostics.x,s.z-window.islandAirDiagnostics.z)>s.min",arg={'x':start['x'],'z':start['z'],'min':a.minimum})
    if mode=='active':
     page.wait_for_function("window.islandAirDiagnostics?.pointPrim?.active===true")
    if mode in ('held-grade','corrupt-grade'):
     assert len(grade)==1,(mode,grade)
     if mode=='held-grade':
      assert len(held)==1,(mode,held)
      rr=held.pop()
      try:rr.fulfill(path=str(a.dist/urlsplit(rr.request.url).path.lstrip('/')),content_type='application/gzip')
      except Exception:pass # The actual fetch may already have aborted.
    d=page.evaluate("window.islandAirDiagnostics")
    assert not errors and not d['layerWarnings'],(d,errors)
    lease=d.get('pointPrim') or {}
    assert bool(lease.get('active'))==(mode=='active'),(mode,lease,grade,console)
    if mode=='active':assert len(grade)==1 and bool(lease.get('grade')),(lease,grade)
    if mode in ('stock','wrong-cover','distant'):assert len(grade)==0,(mode,lease,grade,console)
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    row=dict(mode=mode,site=d['site'],motionM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),lease=lease,gradeRequests=len(grade),console=console)
    receipt.append(row);(a.out/'compiled.json').write_text(json.dumps(receipt,indent=2)+'\n');print(row,flush=True)
   finally:page.close()
