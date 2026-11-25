#!/usr/bin/env python3
"""Input-driven flight in the compiled app, without camera/physics overrides."""
import argparse
import functools
import http.server
import json
import math
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--modes',default='active,off,corrupt')
a=p.parse_args()
a.out.mkdir(parents=True,exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*_):
        pass

FLAGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
       '--disable-dev-shm-usage','--ignore-gpu-blocklist']
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist)))as srv,sync_playwright() as pw:
    threading.Thread(target=srv.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{srv.server_port}/?departure=hunter-river-trail&diagnostics'
    records=[]
    with pw.chromium.launch(executable_path=a.chromium,args=FLAGS)as browser:
        for mode in a.modes.split(','):
            page=browser.new_page(viewport={'width':700,'height':452})
            page.set_default_timeout(130000)
            attempted=[]
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda e:errors.append(e.text)if e.type=='error' else None)
            page.on('request',lambda r:attempted.append(r.url.rsplit('/',1)[-1]) if r.url.endswith('/confederation-main.bin.gz') else None)
            if mode=='corrupt':
                def inject(route):
                    q=bytearray(route.fetch().body())
                    q[len(q)//2]^=1
                    route.fulfill(status=200,body=bytes(q),content_type='application/gzip')
                page.route('**/world/trails/odbl/v1/confederation-main.bin.gz',inject)
            page.goto(url+('&stockConfederationTrail' if mode=='off' else ''),wait_until='domcontentloaded')
            page.wait_for_function("()=>window.islandAirDiagnostics?.mode==='dispatch'")
            assert not attempted,(mode,'transfer during dispatch',attempted)
            page.get_by_role('button',name='Begin flight').click()
            page.wait_for_function("()=>window.islandAirDiagnostics?.mode==='flight'")
            first=page.evaluate('window.islandAirDiagnostics')
            assert first['site']=='hunter-river-trail'
            page.wait_for_function('''q=>{const d=window.islandAirDiagnostics,t=d?.confederationTrail;
               return d?.mode==="flight"&&d?.status!=="stopped"&&Math.hypot(d.x-q.x,d.z-q.z)>q.min&&
               (q.mode==="active"?t?.status==="ready"&&t.active:q.mode==="corrupt"?t?.status==="unavailable":t===null);
            }''',arg=dict(x=first['x'],z=first['z'],min=155,mode=mode),polling=230)
            page.keyboard.press('v')
            page.wait_for_function("()=>window.islandAirDiagnostics?.camera==='Cockpit'")
            page.keyboard.press('v')
            page.wait_for_function("()=>window.islandAirDiagnostics?.camera==='Wide chase'")
            last=page.evaluate('window.islandAirDiagnostics')
            if mode=='active':
                page.screenshot(path=str(a.out/'hunter-river-flight.png'))
            page.keyboard.press('Escape')
            page.wait_for_function("()=>window.islandAirDiagnostics?.mode==='paused'")
            tr=last['confederationTrail']
            assert len(attempted)==int(mode!='off') and not errors and not last['layerWarnings'],(mode,attempted,errors,last['layerWarnings'])
            if mode=='active':
                assert tr['active'] and tr['resident']<=12
            else:
                assert not (tr or {}).get('active')
            r=dict(mode=mode,site=last['site'],distance=round(math.hypot(last["x"]-first["x"],last["z"]-first["z"]),3),
                   camera=last['camera'],endedPaused=True,tr=tr,attempted=attempted,errors=errors)
            records.append(r)
            print(r,flush=True)
            (a.out/'compiled-player.json').write_text(json.dumps(records,indent=2)+'\n')
            page.close()
