#!/usr/bin/env python3
"""Normal compiled flight, optional asset fault, and North Cape/Baywalk coexistence."""
import argparse
from functools import partial
import gzip
from hashlib import sha256
import json
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):
        pass
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
archive=(a.dist/'world/greenwich/v0/bowley-2020-water.r8.gz').read_bytes()
data=bytearray(gzip.decompress(archive));data[313]^=9 # same decoded dimensions, CRC must fail
broken=gzip.compress(data,mtime=0)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(a.dist)))
Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/?diagnostics'
all_flags='&bowleySurveyPreview&northCapeWind&spinnakersPreview&northBaywalkPreview&baywalkConcrete&shoreFoamDetail'
cases=[
 ('stock-cape','&stockBowleyPond','northcape','North Cape',False,False,False),
 ('composed-cape',all_flags,'northcape','North Cape',True,True,False),
 ('composed-baywalk',all_flags,'spinnakers-low','Summerside waterfront · low pass',True,True,False),
 ('bowley-crc-baywalk',all_flags,'spinnakers-low','Summerside waterfront · low pass',False,True,True),
]
rows=[]
try:
 with sync_playwright() as api:
  browser=api.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader',
      '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  for mode,suffix,site,label,bowley,coexists,should_break in cases:
   c=browser.new_context(viewport={'width':650,'height':405},device_scale_factor=1)
   page=c.new_page();page.set_default_timeout(120000);er=[];req=[]
   page.on('pageerror',lambda e:er.append(str(e)))
   page.on('console',lambda e:er.append(e.text) if e.type=='error' else None)
   page.on('request',lambda r:req.append(r.url) if r.url.endswith('/bowley-2020-water.r8.gz') else None)
   if should_break:
    page.route('**/bowley-2020-water.r8.gz',lambda r:r.fulfill(status=200,body=broken,headers={'content-type':'application/gzip'}))
   page.goto(url+suffix,wait_until='domcontentloaded')
   page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"&&window.islandAirDiagnostics?.mainland')
   page.select_option('#site',label=label)
   page.get_by_role('button',name='Begin flight').click()
   page.wait_for_function('id=>window.islandAirDiagnostics?.site===id&&window.islandAirDiagnostics.mode==="flight"',arg=site)
   init=page.evaluate('window.islandAirDiagnostics')
   if coexists and site=='spinnakers-low':
    page.wait_for_function('window.islandAirDiagnostics?.northBaywalkCourt&&window.islandAirDiagnostics?.northBaywalkRamp&&window.islandAirDiagnostics?.northBaywalkRoad&&window.islandAirDiagnostics?.northBaywalkConcrete')
   if coexists and site=='northcape':
    page.wait_for_function('window.islandAirDiagnostics?.northCape?.registered===16&&window.islandAirDiagnostics.northCape.near+window.islandAirDiagnostics.northCape.cruise===16')
   page.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>35',arg={'x':init['x'],'z':init['z']})
   page.keyboard.press('v');page.wait_for_function('window.islandAirDiagnostics?.camera==="Cockpit"')
   d=page.evaluate('window.islandAirDiagnostics')
   assert d.get('bowleyPond')==('bowley-pond-survey-2020' if bowley else None),d
   assert (d['northCape'] is not None)==coexists,d
   assert len(req)==int(bowley or should_break),req
   assert d['mode']=='flight' and not er and not d['layerWarnings'],(mode,er,d)
   page.keyboard.press('Escape');page.wait_for_function('window.islandAirDiagnostics?.mode==="paused"')
   row={'case':mode,'site':site,'bowley':d['bowleyPond'],'bytesSHA256':sha256(archive).hexdigest(),'requests':len(req),
     'simTravelMetres':((d['x']-init['x'])**2+(d['z']-init['z'])**2)**.5,
     'otherOptions':{k:d[k] for k in ('northCape','spinnakersDeck','northBaywalkCourt','northBaywalkRamp','northBaywalkRoad','northBaywalkConcrete')},
     'mainland':d['mainland'],'departureCockpitPause':True,'errors':er}
   rows.append(row);a.out.write_text(json.dumps(rows,indent=2)+'\n');print(row,flush=True)
   c.close()
  browser.close()
finally:
 server.shutdown()
