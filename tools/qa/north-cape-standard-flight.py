#!/usr/bin/env python3
"""Compiled flight smoke: ordinary local turbine module, stock and corrupt-source fallback."""
import argparse,functools,gzip,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--modes',default='cold,ordinary,stock,corrupt,stalled-explicit');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
base=a.dist/'world/cover.bin.gz'
raw=bytearray(gzip.decompress(base.read_bytes()))
raw[0]^=1 # map-corner land class: correct dimensions and unchanged Cape positions
changed=gzip.compress(raw,compresslevel=5,mtime=0)
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 result=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']) as browser:
  for mode in a.modes.split(','):
   assert mode in ('cold','ordinary','stock','corrupt','stalled-explicit'),mode
   page=browser.new_page(viewport={'width':590,'height':380});errors=[];assets=[];cover=[];held=[]
   try:
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
    def request(req):
     url=urlsplit(req.url).path
     if '/assets/north-cape-' in url:assets.append(url)
     if url.endswith('/world/cover.bin.gz'):cover.append(url)
    page.on('request',request)
    if mode=='corrupt': page.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=changed,content_type='application/octet-stream'))
    if mode=='stalled-explicit':page.route('**/assets/north-cape-*.js',lambda r:held.append(r))
    page.set_default_timeout(110000)
    site='charlottetown' if mode=='cold' else 'northcape-wind-low'
    suffix={'stock':'&stockNorthCapeWind','stalled-explicit':'&northCapeWind'}.get(mode,'')
    page.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+suffix,wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    if mode=='stalled-explicit':
     assert len(held)==1,held
     held[0].fulfill(path=str(a.dist/urlsplit(held[0].request.url).path.lstrip('/')),content_type='application/javascript')
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
    start=page.evaluate('window.islandAirDiagnostics')
    page.wait_for_function('(s)=>Math.hypot(s.x-window.islandAirDiagnostics.x,s.z-window.islandAirDiagnostics.z)>150',arg={k:start[k] for k in ('x','z')})
    if mode=='ordinary':
     page.wait_for_function('window.islandAirDiagnostics?.northCape?.registered===16')
    page.keyboard.press('v');page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
    d=page.evaluate('window.islandAirDiagnostics')
    page.keyboard.press('Escape');page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    expected=mode=='ordinary'
    assert bool(d['northCape'])==expected and len(assets)==int(expected or mode=='stalled-explicit') and len(cover)==1 and not d['layerWarnings'] and not errors,(mode,d['northCape'],assets,cover,errors)
    if expected:assert d['northCape']['near']+d['northCape']['cruise']==16
    row=dict(mode=mode,site=d['site'],motionM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),array=d['northCape'],assetRequests=len(assets),coverRequests=len(cover))
    result.append(row);(a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(row,flush=True)
   finally:page.close()
