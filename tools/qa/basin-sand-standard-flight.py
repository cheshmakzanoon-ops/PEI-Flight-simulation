#!/usr/bin/env python3
"""Exact compiled Basin Head ordinary, stock and material failure replays."""
import argparse,functools,gzip,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--modes',default='ordinary,stock,wrong-cover,corrupt,held,distant,shore-tone')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
cover=bytearray(gzip.decompress((a.dist/'world/cover.bin.gz').read_bytes()));cover[0]^=1
changed=gzip.compress(cover,mtime=0,compresslevel=5)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 out=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']) as br:
  for mode in a.modes.split(','):
   pg=br.new_page(viewport={'width':394,'height':264});assets=[];errors=[];logs=[];held=[]
   try:
    pg.on('pageerror',lambda v:errors.append(str(v)));pg.on('console',lambda e:logs.append(e.text)if e.type=='error' else None)
    pg.on('request',lambda r:assets.append(urlsplit(r.url).path.rsplit('/',1)[-1]) if '/ground/basin-head/v1/' in urlsplit(r.url).path else None)
    if mode=='wrong-cover':pg.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=changed,content_type='application/gzip'))
    if mode=='corrupt':
     def bad(r):
      b=bytearray(r.fetch().body());b[9]^=1;r.fulfill(status=200,body=bytes(b),content_type='application/gzip')
     pg.route('**/basin-head-seaward.rg.gz',bad)
    if mode=='held':pg.route('**/basin-head-seaward.rg.gz',lambda r:held.append(r))
    site='charlottetown' if mode=='distant'else 'basin-head-low'
    flag={'stock':'&stockBasinSand','shore-tone':'&shoreToneStudy'}.get(mode,'')
    pg.set_default_timeout(110000)
    pg.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+flag,wait_until='domcontentloaded')
    try:pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'",timeout=35000)
    except Exception as e:raise AssertionError((mode,'dispatch',errors,logs,pg.locator('body').inner_text()[:420]))from e
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
    s=pg.evaluate('window.islandAirDiagnostics');assert s['site']==site
    pg.wait_for_function("(q)=>Math.hypot(window.islandAirDiagnostics.x-q.x,window.islandAirDiagnostics.z-q.z)>93",arg={k:s[k]for k in ('x','z')})
    if mode=='ordinary':pg.wait_for_function("window.islandAirDiagnostics?.basinSandStandard?.active",timeout=12000)
    if mode in ('corrupt','held','wrong-cover'):pg.wait_for_function("window.islandAirDiagnostics?.basinSandStandard?.proof==='stock'",timeout=12000)
    if mode=='held':
     assert len(held)==1,held
     r=held.pop()
     try:r.fulfill(path=str(a.dist/urlsplit(r.request.url).path.lstrip('/')),content_type='application/gzip')
     except Exception:pass # the actual fetch may have been aborted by now
    pg.keyboard.press('v');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    d=pg.evaluate('window.islandAirDiagnostics');state=d.get('basinSandStandard')or{}
    assert not errors and not d['layerWarnings'],(mode,errors,logs,d['layerWarnings'])
    assert bool(state.get('active'))==(mode=='ordinary'),(mode,state,assets)
    assert (sorted(assets)==['basin-head-seaward.rg.gz','basin-sand-scan.rgba.gz'] if mode in ('ordinary','held','corrupt')else assets==[]),(mode,assets,state)
    row=dict(mode=mode,site=site,motionM=round(((d['x']-s['x'])**2+(d['z']-s['z'])**2)**.5,3),approved=state,assets=assets,console=logs)
    out.append(row);(a.out/'compiled.json').write_text(json.dumps(out,indent=2)+'\n');print(row,flush=True)
   finally:pg.close()
