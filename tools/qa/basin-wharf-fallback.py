#!/usr/bin/env python3
"""Check that the compiled, opt-in wharf cannot replace a missing inlet or bank."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
root=f'http://127.0.0.1:{server.server_port}/?diagnostics'
asset='basin-bank-terrain-v2.cm.gz'
both='&basinChannel&basinWharf&legacyShoreArcs&montagueFoundationPreview'
cases=[
 ('default','',False,False,False,False),
 ('plain-basin','&basinChannel',False,True,False,False),
 ('all-previews',both,False,True,True,True),
 ('model-hidden',both+'&noBasinWharf',False,True,True,True),
 ('bank-absent',both,True,False,False,True),
 ('inlet-unrequested','&basinWharf',False,False,False,False),
]
out=[]
with sync_playwright() as api:
 b=api.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 for name,flags,fail,channel,toe,montague in cases:
  c=b.new_context(viewport={'width':640,'height':405},device_scale_factor=1);page=c.new_page()
  errors=[];requests=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.on('request',lambda req:requests.append(req.url))
  if fail:page.route('**/'+asset,lambda r:r.fulfill(status=404,body=b''))
  page.goto(root+flags,wait_until='domcontentloaded',timeout=90000)
  page.wait_for_function('''()=>window.islandAirDiagnostics?.roads===true &&
    typeof window.islandAirDiagnostics?.basinWharfToe==='boolean' &&
    window.islandAirDiagnostics?.buildings===true''',timeout=115000)
  row=page.evaluate('window.islandAirDiagnostics')
  assert bool(row['basinShoreline'])==channel and (row['basinWharfToe'] is toe), (name,row)
  assert (row['montagueBridge'] is montague) and bool(row['harbourShoreline']), (name,row)
  assert bool(row['legacyShore'])==('legacyShoreArcs' in flags)
  assert not errors and not row['layerWarnings'], (name,errors,row)
  assert sum(asset in r for r in requests)==(1 if 'basinChannel' in flags else 0), (name,requests)
  result=dict(case=name,basin=channel,wharfToe=toe,montague=montague,quartermaster=True,
              activeStockArcs=bool(row['legacyShore']),bankRequests=sum(asset in r for r in requests),jsErrors=errors)
  out.append(result);a.out.write_text(json.dumps(out,indent=2)+'\n');print(result,flush=True)
  c.close()
 b.close()
server.shutdown()
