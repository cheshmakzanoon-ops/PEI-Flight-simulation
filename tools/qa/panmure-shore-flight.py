#!/usr/bin/env python3
"""Ordinary Panmure Dispatch with masked-shore cover and extent guards."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--cases',default='panmure,stock,changed-source,shifted-bounds,detail,study,prince');a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 result=[]
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']) as browser:
  for mode in a.cases.split(','):
   page=browser.new_page(viewport={'width':500,'height':360});errors=[];raster=[]
   try:
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
    page.on('request',lambda r:raster.append(r.url)if r.url.endswith('/world/cover.bin.gz')else None)
    if mode=='changed-source':
     def change(r):
      rec=r.fetch().json();rec['compressedSha256']='0'*64
      r.fulfill(status=200,json=rec)
     page.route('**/world/cover.json',change)
    if mode=='shifted-bounds':
     def shift(r):
      rec=r.fetch().json();rec['bounds'][0]+=.000001
      r.fulfill(status=200,json=rec)
     page.route('**/world/terrain.json',shift)
    page.set_default_timeout(240000 if mode=='panmure' else 125000)
    suffix={'stock':'&stockOpenCoast','detail':'&scenery=detail','study':'&nearshoreFoamStudy'}.get(mode,'')
    site='prince-open-shore-pass' if mode=='prince' else 'panmure-head-coast'
    page.goto(f'http://127.0.0.1:{srv.server_port}/?departure={site}&diagnostics'+suffix,wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
    start=page.evaluate('window.islandAirDiagnostics')
    initialDist=430 if mode=='panmure' else 95
    page.wait_for_function('(s)=>Math.hypot(s.x-window.islandAirDiagnostics.x,s.z-window.islandAirDiagnostics.z)>s.distance',
      arg={**{k:start[k]for k in ('x','z')},'distance':initialDist})
    page.keyboard.press('v');page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
    d=page.evaluate('window.islandAirDiagnostics')
    page.keyboard.press('Escape');page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
    assert bool(d['panmureCoast'])==(mode in ('prince','panmure')) and d['site']==site and not d['layerWarnings'] and not errors and len(raster)==1,(mode,d['panmureCoast'],errors,raster)
    if mode in ('prince','panmure'):
     assert d['panmureCoast']['chunks']>=1
     assert d['panmureCoast']['refined']==(d['panmureCoast']['chunks']if mode=='panmure'else 0),d['panmureCoast']
     assert d['openCoast']=={'chunks':2,'refined':int(mode=='prince')},d['openCoast']
    if mode=='panmure':
     assert -0.5<start['groundY']<.5 and 72<start['altitude']<83 and d['altitude']>60,(start['groundY'],start['altitude'],d['altitude'])
     initialRange=((start['x']-56304.67)**2+(start['z']-39540.46)**2)**.5
     finalRange=((d['x']-56304.67)**2+(d['z']-39540.46)**2)**.5
     assert initialRange-finalRange>400,(initialRange,finalRange,start['heading'],d['heading'])
    if mode=='stock':assert bool(d['legacyShore']),d['legacyShore']
    result.append(dict(mode=mode,site=d['site'],motionM=round(((d['x']-start['x'])**2+(d['z']-start['z'])**2)**.5,3),
     startGroundY=start['groundY'],startAltitudeM=start['altitude'],endAltitudeM=d['altitude'],coverage=d['panmureCoast'],
     earlierOpenCoast=d['openCoast'],coverRequests=len(raster)))
    (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(result[-1],flush=True)
   finally:page.close()
