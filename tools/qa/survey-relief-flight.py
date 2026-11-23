#!/usr/bin/env python3
"""Exercise the uninstrumented production flight application over the static relief pack."""
import argparse,http.server,json,os,socketserver,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
FLAGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist']
p=argparse.ArgumentParser();p.add_argument('dist',type=Path);p.add_argument('out',type=Path)
p.add_argument('--shots',action='store_true')
p.add_argument('--cases',default='default,healthy,missing,corrupt')
p.add_argument('--chromium', default=os.getenv('CHROMIUM','/usr/bin/chromium'))
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
ledger=[]
class H(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(a.dist.absolute()),**kwargs)
 def log_message(self,*args):pass
 def do_GET(self):
  isrelief='/terrain-adaptive/' in self.path
  if isrelief:ledger.append((self.path,self.headers.get('Range')))
  if isrelief and a.case=='missing':self.send_error(404);return
  if isrelief and '.pack' in self.path and a.case=='corrupt':
   # Full-length wrong bytes: the range fallback header cannot bypass member validation.
   file=Path(self.translate_path(self.path));n=file.stat().st_size
   self.send_response(200);self.send_header('Content-Length',str(n));self.end_headers()
   self.wfile.write(bytes(n));return
  return super().do_GET()
with http.server.ThreadingHTTPServer(('127.0.0.1',0),H) as server:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 base='http://127.0.0.1:'+str(server.server_address[1])
 with sync_playwright() as pw:
  br=pw.chromium.launch(executable_path=a.chromium,args=FLAGS)
  results={}
  for case in a.cases.split(','):
   a.case=case;start=len(ledger)
   pg=br.new_page(viewport={'width':736,'height':480})
   errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   extra='' if case=='default' else '&surveyRelief'
   pg.goto(base+'/?diagnostics'+extra,wait_until='domcontentloaded')
   pg.locator('#start').wait_for(timeout=60000)
   pg.bring_to_front()
   pg.locator('#start').click(timeout=45000)
   wanted='window.islandAirDiagnostics?.mode === "flight" && window.islandAirDiagnostics?.mainland'
   pg.wait_for_function(wanted,timeout=45000)
   before=pg.evaluate('window.islandAirDiagnostics')
   if case=='healthy':
    pg.wait_for_function('window.islandAirDiagnostics.adaptiveTerrain?.active?.length>0',timeout=90000)
   if case=='corrupt':
    pg.wait_for_function('window.islandAirDiagnostics.adaptiveTerrain?.failed>0',timeout=90000)
   if case=='missing':
    pg.wait_for_timeout(8000)
   try:
    pg.wait_for_function('([x,z])=>Math.hypot(window.islandAirDiagnostics.x-x,window.islandAirDiagnostics.z-z)>35',arg=[before['x'],before['z']],timeout=90000)
   except Exception:
    print('Flight diagnostic',case,pg.evaluate('window.islandAirDiagnostics'),errors,flush=True)
    raise
   after=pg.evaluate('window.islandAirDiagnostics')
   if a.shots: pg.screenshot(path=str(a.out/(case+'.png')),timeout=90000)
   rel=after['adaptiveTerrain'];expected=case=='healthy'
   assert not errors and after['mode']=='flight' and bool(rel and rel['active'])==expected, (case,after,errors)
   if case=='default':assert len(ledger)==start
   result=dict(active=rel,site=after['site'],mode=after['mode'],meshDraws=after['drawCalls'],triangles=after['triangles'],
       travelled=round(((after['x']-before['x'])**2+(after['z']-before['z'])**2)**.5,3),
       requests=ledger[start:])
   print(case,result,flush=True);results[case]=result;pg.close()
   (a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
  br.close()
 server.shutdown()
