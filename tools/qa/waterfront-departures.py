#!/usr/bin/env python3
"""Fly the two waterfront starts through the normal compiled UI."""
import argparse, functools, http.server, json, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--foam-detail',action='store_true')
args=p.parse_args()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(args.dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/?diagnostics&basinChannel&basinWharf&spinnakersPreview'+('&shoreFoamDetail' if args.foam_detail else '')
views=[('Basin Head · low pass','basin-head-low',96,'basinWharfVisible','Chase'),
       ('Summerside waterfront · low pass','spinnakers-low',82,'spinnakersDeck','Cockpit')]
rows=[]
with sync_playwright() as api:
  browser=api.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  page=browser.new_page(viewport={'width':680,'height':416},device_scale_factor=1)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.set_default_timeout(120000)
  page.goto(url,wait_until='domcontentloaded')
  for label,key,y,visible,camera in views:
    page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch" && document.querySelector("#site")')
    page.select_option('#site',label=label)
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function('k=>window.islandAirDiagnostics?.mode==="flight" && window.islandAirDiagnostics?.site===k',arg=key)
    before=page.evaluate('window.islandAirDiagnostics')
    assert abs(before['altitude']-y)<4,(label,before)
    page.wait_for_function('p=>Math.hypot(window.islandAirDiagnostics.x-p.x,window.islandAirDiagnostics.z-p.z)>40',arg={'x':before['x'],'z':before['z']})
    page.wait_for_function('k=>window.islandAirDiagnostics?.[k]===true',arg=visible)
    if camera=='Cockpit':
      page.keyboard.press('v')
      page.wait_for_function('()=>window.islandAirDiagnostics?.camera==="Cockpit"')
    after=page.evaluate('window.islandAirDiagnostics')
    if args.foam_detail:assert after['shoreFoamDetail'] is True
    assert not errors and not after['layerWarnings'],(errors,after['layerWarnings'])
    assert after['mode']=='flight' and abs(after['altitude']-y)<20
    page.keyboard.press('Escape')
    page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="paused"')
    data=dict(site=key,startY=before['altitude'],afterY=after['altitude'],camera=after['camera'],
              visualOption=visible,active=after[visible],
              movementM=((before['x']-after['x'])**2+(before['z']-after['z'])**2)**.5,
              pauseSucceeded=True,errors=errors[:])
    rows.append(data);args.out.write_text(json.dumps(rows,indent=2)+'\n');print(data,flush=True)
    if key!='spinnakers-low':
      page.get_by_role('button',name='Choose departure').click()
  browser.close()
server.shutdown()
