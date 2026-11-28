"""Ordinary compiled controls and actual submitted terrain owner, no camera hooks."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--samples',type=int,choices=(0,4),default=4);p.add_argument('--corridors',type=Path,required=True);p.add_argument('--chromium',required=True);a=p.parse_args()
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*v):pass
rows=json.loads(a.corridors.read_text());report={}
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist))) as srv,sync_playwright() as pw:
 threading.Thread(target=srv.serve_forever,daemon=True).start()
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])as b:
  for row in rows:
   n=row['name'];north=row['owners'][0];errors=[]
   page=b.new_page(viewport={'width':640,'height':400})
   page.set_default_timeout(150000)
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   url=f'http://127.0.0.1:{srv.server_port}/?diagnostics&departure=qa-{n}'
   assert page.goto(url,wait_until='domcontentloaded').ok
   page.wait_for_function("""n=>window.islandAirDiagnostics?.site===n&&window.islandAirDiagnostics.mode==='dispatch'""",arg='qa-'+n)
   O=page.evaluate("[window.islandAirDiagnostics.x,window.islandAirDiagnostics.z]")
   page.get_by_role('button',name='Begin flight').click()
   page.wait_for_function("n=>window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site===n",arg='qa-'+n)
   page.wait_for_function("""o=>{const d=window.islandAirDiagnostics;
     return d?.mode==='flight'&&d.camera==='Chase'&&Math.hypot(d.x-o[0],d.z-o[1])>=16;}""",arg=O)
   hit=page.wait_for_function("""s=>{const d=window.islandAirDiagnostics,r=d?.west2Rim;
     return d?.mode==='flight'&&d.camera==='Chase'&&r?.source==='verified'&&r.drawnFine.includes(s)&&d;}""",arg=north)
   k=hit.json_value();hit.dispose()
   page.wait_for_function("""o=>{const d=window.islandAirDiagnostics;
     return d?.mode==='flight'&&Math.hypot(d.x-o[0],d.z-o[1])>=150;}""",arg=O)
   profile=page.evaluate("()=>{const gl=document.querySelector('#world').getContext('webgl2'),a=gl.getContextAttributes();return {antialias:a.antialias,alpha:a.alpha,depth:a.depth,samples:gl.getParameter(gl.SAMPLES)}}")
   assert profile=={'antialias':a.samples==4,'alpha':True,'depth':True,'samples':a.samples},profile
   end=page.evaluate('window.islandAirDiagnostics')
   assert not errors and not end['layerWarnings'],(errors,end['layerWarnings'])
   page.keyboard.press('v');page.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
   page.keyboard.press('p');page.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
   report[n]={'actualCompiledPlayer':True,'profile':profile,'route':end['site'],'scope':'Private aircraft placement from signed dry corridor, no real navigation use.',
     'drawOwnerAtMovingChase':k['west2Rim'],'travelAtWitnessM':math.hypot(k['x']-O[0],k['z']-O[1]),
     'totalTravelM':math.hypot(end['x']-O[0],end['z']-O[1]),'witnessPose':[k['x'],k['altitude'],k['z'],k['heading']],
     'groundClearanceM':k['altitude']-k['groundY'],'drawsAtWitness':k['drawCalls'],'cockpitAndPause':True,'errors':errors}
   a.out.write_text(json.dumps(report,indent=2)+'\n')
   print(n,report[n]['travelAtWitnessM'],report[n]['totalTravelM'],flush=True)
   page.close()
