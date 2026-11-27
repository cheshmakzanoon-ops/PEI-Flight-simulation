#!/usr/bin/env python3
"""Exercise compiled opt-in motion, cold scopes and deliberate native program refusal."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--cases',default='active,unrequested,wet,stock-coast,cold,borden,decline')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
cases={'active':('cape-tryon-coast','&capeTryonSkySeatReview'),'unrequested':('cape-tryon-coast',''),
       'wet':('cape-tryon-coast','&capeTryonSkySeatReview&capeTryonWaterReview'),
       'stock-coast':('cape-tryon-coast','&capeTryonSkySeatReview&stockOpenCoast'),
       'cold':('harbour-low','&capeTryonSkySeatReview'),
       'borden':('bridge','&capeTryonSkySeatReview'),
       'decline':('cape-tryon-coast','&capeTryonSkySeatReview')}
proof=r'''(decline=>{
 window.seatSources=0;window.seatRefusals=0;
 const p=WebGL2RenderingContext.prototype,src=p.shaderSource;
 p.shaderSource=function(shader,code){
  if(code.includes('uniform float tryonSkySeatAllowed;')){
   window.seatSources++;
   if(decline){window.seatRefusals++;return src.call(this,shader,code+'\nnot_callable_gpu_fixture');}
  }
  return src.call(this,shader,code);
 };
})'''
r={}
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(a.dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']) as browser:
  for case in a.cases.split(','):
   page=browser.new_page(viewport={'width':600,'height':430});errors=[]
   page.on('pageerror',lambda err:errors.append(str(err)))
   page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
   page.add_init_script(proof+'('+json.dumps(case=='decline')+');')
   site,suffix=cases[case]
   page.goto(f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure={site}'+suffix,wait_until='domcontentloaded')
   page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.detail?.ready>0&&window.islandAirDiagnostics?.detail?.loading===0",timeout=125000)
   first=page.evaluate('window.islandAirDiagnostics')
   print(case,'dispatch',first.get('capeTryonSkySeat'),first.get('tryonRockState'),
     (first['x'],first['z'],first['altitude']),page.evaluate('()=>[window.seatSources,window.seatRefusals]'),flush=True)
   assert first['site']==site,(case,first['site'])
   page.get_by_role('button',name='Begin flight').click()
   data=[]
   start=page.evaluate('window.islandAirDiagnostics')
   for m in ((35,95,160,230,320,430) if case=='active' else (35,95,160,230)):
    page.wait_for_function('([x,z,m])=>window.islandAirDiagnostics?.mode==="flight"&&Math.hypot(x-window.islandAirDiagnostics.x,z-window.islandAirDiagnostics.z)>=m',
      arg=[start['x'],start['z'],m],timeout=90000)
    s=page.evaluate('window.islandAirDiagnostics')
    assert not s['layerWarnings'],s['layerWarnings']
    print(case,m,s.get('capeTryonSkySeat'),s['camera'],s['drawCalls'],s['triangles'],flush=True)
    data.append(dict(m=m,site=s['site'],state=s.get('capeTryonSkySeat'),rock=s['tryonRockState'],altitude=s['altitude'],
      calls=s['drawCalls'],triangles=s['triangles'],x=s['x'],z=s['z']))
   scans=page.evaluate('()=>[window.seatSources,window.seatRefusals]')
   row=r[case]={'dispatch':first.get('capeTryonSkySeat'),'frames':data,'sourceSubmits':scans,'errors':errors}
   print(case,row,flush=True);(a.out/'moving.json').write_text(json.dumps(r,indent=2)+'\n')
   if case=='active':assert scans==[1,0] and any(f['state']=='mounted' for f in data) and not errors,row
   elif case=='decline':assert scans==[1,1] and any(f['state']=='stock-shader' for f in data) and all(f['state'] in ('pending','checking','stock-shader') for f in data),row
   else:assert scans==[0,0] and all(f['state'] in (None,'pending','ready') for f in data) and not errors,row
   page.close()
