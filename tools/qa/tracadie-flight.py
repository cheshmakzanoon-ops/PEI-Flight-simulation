#!/usr/bin/env python3
"""Exercise the compiled Tracadie seam and corrupted upstream imagery fallback."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
a=p.parse_args()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
u=f'http://127.0.0.1:{srv.server_port}/?diagnostics'
receipt=[]
try:
 with sync_playwright() as s:
  b=s.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode in ('standard','stock','corrupt-north'):
   ctx=b.new_context(viewport={'width':580,'height':360},device_scale_factor=1)
   try:
    pg=ctx.new_page();pg.set_default_timeout(140000);errors=[];alterations=[]
    pg.on('pageerror',lambda err:errors.append(str(err)))
    pg.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
    if mode=='corrupt-north':
     def fault(route):
      res=route.fetch();raw=bytearray(res.body())
      # The test's ordinary SimpleHTTP server uses complete bounded packs.
      assert res.status==200 and len(raw)>337200,(res.status,len(raw))
      raw[333992+129]^=0x04;alterations.append(len(raw))
      route.fulfill(response=res,body=bytes(raw))
     pg.route('**/world/detail/sentinel-01.pack',fault)
    pg.goto(u+('&stockTracadieOrtho' if mode=='stock' else ''),wait_until='domcontentloaded')
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    pg.select_option('#site',label='Queens County · coastal grass pass')
    pg.get_by_role('button',name='Begin flight').click()
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site==='queens-coastal-grass'")
    start=pg.evaluate('window.islandAirDiagnostics')
    pg.wait_for_function("p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>120",arg={'x':start['x'],'z':start['z']})
    if mode=='standard':
     pg.wait_for_function("window.islandAirDiagnostics?.orthophotoSeams?.find(p=>p.edge==='18-12 / 18-13')?.gain===1")
    if mode=='corrupt-north':
     pg.wait_for_function("window.islandAirDiagnostics?.detail?.missing>0&&window.islandAirDiagnostics?.orthophotoSeams?.find(p=>p.edge==='18-12 / 18-13')?.uploads===0")
    live=pg.evaluate('window.islandAirDiagnostics')
    assert not errors and not live['layerWarnings'],(errors,live['layerWarnings'])
    target=next((p for p in live.get('orthophotoSeams') or [] if p['edge']=='18-12 / 18-13'),None)
    if mode=='stock':assert target is None
    if mode=='corrupt-north':assert alterations and target and not target['resident']
    pg.keyboard.press('Escape')
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
    row=dict(mode=mode,site=live['site'],movesM=((live['x']-start['x'])**2+(live['z']-start['z'])**2)**.5,
             detail=live['detail'],seam=live.get('orthophotoSeams'),modifiedPackBytes=alterations,pauseSucceeded=True,errors=errors)
    receipt.append(row);a.out.write_text(json.dumps(receipt,indent=2)+'\n');print(row,flush=True)
   finally:
    ctx.close()
  b.close()
finally:
 srv.shutdown()
