#!/usr/bin/env python3
import argparse,functools,gzip,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--modes',default='ordinary,stock,wrong-source,wrong-decoded,distant,detail,explicit')
p.add_argument('--legacy-explicit',action='store_true',help='Use the historical opt-in profile for the ordinary benchmark.')
p.add_argument('--width',type=int,default=600);p.add_argument('--height',type=int,default=390);p.add_argument('--minimum-motion',type=float,default=275)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 receipt=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])as br:
  for mode in a.modes.split(','):
   page=br.new_page(viewport={'width':a.width,'height':a.height});errors=[];loads=[]
   try:
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
    page.on('request',lambda r:loads.append(urlsplit(r.url).path)if '/assets/miscouche-fill-' in r.url else None)
    if mode=='wrong-source':
     def change(r):
      doc=r.fetch().json();doc['compressedSha256']='0'*64;r.fulfill(status=200,json=doc)
     page.route('**/world/cover.json',change)
    if mode=='wrong-decoded':
     raw=bytearray(gzip.decompress((a.dist/'world/cover.bin.gz').read_bytes()));raw[0]^=1
     bad=gzip.compress(raw,compresslevel=4,mtime=0)
     page.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=bad,content_type='application/gzip'))
    site='charlottetown' if mode=='distant' else 'miscouche-woodlot-pass'
    flag='&stockMiscouche' if mode=='stock' else '&scenery=detail' if mode=='detail' else (
     '&miscoucheCanopyStudy' if a.legacy_explicit or mode=='explicit' else '')
    positive=mode in ('ordinary','explicit')
    page.set_default_timeout(120000)
    page.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+flag,wait_until='domcontentloaded')
    page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    if mode!='explicit' and not a.legacy_explicit:assert not loads,(mode,loads)
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
    start=page.evaluate("window.islandAirDiagnostics")
    page.wait_for_function("(s)=>Math.hypot(s.x-window.islandAirDiagnostics.x,s.z-window.islandAirDiagnostics.z)>s.minimum",arg={'x':start['x'],'z':start['z'],'minimum':a.minimum_motion})
    if positive:page.wait_for_function("window.islandAirDiagnostics?.miscoucheFillGain>.98")
    d=page.evaluate("window.islandAirDiagnostics");assert not errors and not d['layerWarnings'],(d,errors)
    assert d['miscoucheFill']==(215 if positive else 0) and len(loads)==int(positive),(mode,d['miscoucheFill'],d['woodlandStream'],loads)
    page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    page.keyboard.press('Escape');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    row=dict(mode=mode,site=d['site'],motionM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),count=d['miscoucheFill'],gain=d['miscoucheFillGain'],assets=len(loads))
    receipt.append(row);(a.out/'compiled.json').write_text(json.dumps(receipt,indent=2)+'\n');print(row,flush=True)
   finally:page.close()
