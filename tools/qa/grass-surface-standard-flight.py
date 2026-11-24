#!/usr/bin/env python3
"""Standard dune-grass proof in compiled normal, stock and failure controls."""
import argparse,functools,gzip,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--modes',default='prince,queens,kings,stock,bad-cover,bad-photo,cold-distant,held-module')
p.add_argument('--minimum',type=float,default=175)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
contents=bytearray(gzip.decompress((a.dist/'world/cover.bin.gz').read_bytes()))
contents[0]^=1
corrupt_cover=gzip.compress(contents,mtime=0,compresslevel=5)
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))as srv,sync_playwright()as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 receipt=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']) as br:
  for mode in a.modes.split(','):
   pg=br.new_page(viewport={'width':396,'height':267});errors=[];console=[];assets=[];held=[]
   try:
    pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:console.append(e.text)if e.type=='error'else None)
    def track(r):
     path=urlsplit(r.url).path
     if '/dune-grass/v1/' in path:assets.append(path.rsplit('/',1)[-1])
    pg.on('request',track)
    if mode=='bad-cover':pg.route('**/world/cover.bin.gz',lambda r:r.fulfill(status=200,body=corrupt_cover,content_type='application/gzip'))
    if mode=='bad-photo':pg.route('**/dune-grass/v1/sparse-grass-photometric.png',lambda r:r.fulfill(status=200,body=bytes(480772),content_type='image/png'))
    if mode=='held-module':pg.route('**/assets/dune-grass-surface-*.js',lambda r:held.append(r))
    site='charlottetown' if mode=='cold-distant' else (mode if mode in ('prince','queens','kings') else 'queens')+'-coastal-grass'
    flag='&stockDuneGrass' if mode=='stock' else ''
    pg.set_default_timeout(110000)
    pg.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+flag,wait_until='domcontentloaded')
    try:pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'",timeout=32000)
    except Exception as e:raise AssertionError((mode,errors,console,pg.locator('body').inner_text()[:500]))from e
    if mode=='held-module':
     assert len(held)==1,(held,assets)
     r=held.pop()
     r.fulfill(path=str(a.dist/urlsplit(r.request.url).path.lstrip('/')),content_type='application/javascript')
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
    s=pg.evaluate('window.islandAirDiagnostics');assert s['site']==site,s['site']
    pg.wait_for_function("(s)=>Math.hypot(s.x-window.islandAirDiagnostics.x,s.z-window.islandAirDiagnostics.z)>s.min",arg={'x':s['x'],'z':s['z'],'min':a.minimum})
    good=mode in ('prince','queens','kings')
    if good:
     try:pg.wait_for_function('window.islandAirDiagnostics?.grassCoast?.active?.length>0',timeout=13000)
     except Exception as e:raise AssertionError((mode,pg.evaluate('window.islandAirDiagnostics'),assets,errors,console))from e
    if mode=='bad-photo':pg.wait_for_function('window.islandAirDiagnostics?.grassCoast?.failed>0')
    pg.keyboard.press('v');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
    pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    d=pg.evaluate('window.islandAirDiagnostics');state=d.get('grassCoast')or{}
    assert not errors and not d['layerWarnings'],(mode,errors,console,d['layerWarnings'])
    assert bool(state.get('active'))==good,(mode,state)
    assert assets==[] if not good and mode!='bad-photo' else sorted(assets)==['authority.pack','sparse-grass-photometric.png'],(mode,assets)
    row=dict(mode=mode,site=site,motionM=round(((d['x']-s['x'])**2+(d['z']-s['z'])**2)**.5,3),assets=assets,grass=state,console=console)
    receipt.append(row);(a.out/'compiled.json').write_text(json.dumps(receipt,indent=2)+'\n');print(row,flush=True)
   finally:pg.close()
