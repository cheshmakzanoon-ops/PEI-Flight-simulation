"""Verify normal project-path flight with the Barn, House, Dunelands and local grade composed."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*x):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(prefix):]if path.startswith(prefix)else '/no-site/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(a.dist.resolve())))as server,sync_playwright() as p:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 b=p.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--ignore-gpu-blocklist','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 route=f'http://127.0.0.1:{server.server_port}'+prefix
 art={'house':'green-gables-v3.bin.gz','barn':'green-gables-barn-v1.bin.gz','water':'cavendish-water-2020.r8.gz','grade':'native-grade.g11.gz'}
 results={}
 try:
  for mode in ('live','stock','bad'):
   t=b.new_page(viewport={'width':630,'height':400});t.set_default_timeout(155000)
   req=[];err=[]
   t.on('request',lambda r:req.append(urlsplit(r.url).path)if any(r.url.endswith('/'+f)for f in art.values())else None)
   t.on('pageerror',lambda r:err.append(str(r)))
   t.on('console',lambda r:err.append(r.text)if r.type=='error'else None)
   if mode=='bad':t.route('**/'+art['barn'],lambda r:r.fulfill(status=200,body='Invalid same-origin Barn rehearsal.'))
   args='?diagnostics&departure=cavendish-dunelands-low&greenGablesReview&cavendishWaterReview&gablesGradeReview'
   args+='&stockGreenGablesBarn' if mode=='stock' else '&greenGablesBarnReview'
   t.goto(route+args,wait_until='domcontentloaded')
   t.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics.greenGablesReview&&window.islandAirDiagnostics.cavendishWaterCore")
   t.get_by_role('button',name='Begin flight').click()
   t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='cavendish-dunelands-low'")
   start=t.evaluate('window.islandAirDiagnostics')
   match={'start':start,'live':mode=='live'}
   t.wait_for_function("""({start,live})=>{const d=window.islandAirDiagnostics;return d.mode==='flight'&&d.site===start.site&&Math.hypot(d.x-start.x,d.z-start.z)>72&&
      d.greenGablesBarnReview===live&&d.greenGablesReview&&d.cavendishWaterCore&&d.localGroundGrade&&d.roads&&d.detail.ready>0&&!d.detail.missing}""",arg=match,polling=200)
   end=t.evaluate('window.islandAirDiagnostics')
   for k,f in art.items():assert sum(x.endswith('/'+f)for x in req)==int(k!='barn'or mode!='stock'),(mode,req)
   assert all(path.startswith(prefix)for path in req)
   assert end['speed']>30 and end['altitude']>100 and not err and not end['layerWarnings'],(end,err)
   results[mode]={'ordinaryFlightMetres':round(math.hypot(end['x']-start['x'],end['z']-start['z']),2),'mslM':round(end['altitude'],2),
    'barn':end['greenGablesBarnReview'],'house':end['greenGablesReview'],'water':end['cavendishWaterCore'],'grade':end['localGroundGrade'],'requests':req,'warnings':end['layerWarnings'],'errors':err}
   (a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
   print(mode,results[mode],flush=True)
   t.close()
 finally:
  b.close();server.shutdown()
