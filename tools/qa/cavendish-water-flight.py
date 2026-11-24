"""Fly the compiled public Cavendish departure without changing camera, clock, or physics."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--cases',default='stock,live,invalid')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*x):pass
 def translate_path(self,url):
  q=urlsplit(url).path
  return super().translate_path(q[len(prefix):]if q.startswith(prefix)else '/no-app/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(a.dist.resolve())))as s,sync_playwright()as pw:
 threading.Thread(target=s.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 target={'x':(-63.38714448+63.2)*76766.24,'z':(46.5-46.49503501)*111161.2}
 try:
  results={}
  for variant in a.cases.split(','):
   if variant not in ('stock','live','invalid','blocked'):raise ValueError(variant)
   t=b.new_page(viewport={'width':640,'height':420});t.set_default_timeout(165000)
   notices=[];assets=[];hits=[]
   t.on('pageerror',lambda e:notices.append(str(e)))
   t.on('console',lambda m:notices.append(m.text)if m.type=='error'else None)
   t.on('request',lambda r:assets.append(urlsplit(r.url).path)if r.url.endswith(('/cavendish-water-2020.r8.gz','/bowley-2020-water.r8.gz','/green-gables-v3.bin.gz'))else None)
   t.on('response',lambda r:hits.append(r.status)if r.url.endswith('/cavendish-water-2020.r8.gz')else None)
   if variant=='invalid':t.route('**/cavendish-water-2020.r8.gz',lambda r:r.fulfill(status=200,body=b'Invalid optional input test.'))
   flag='&cavendishWaterReview' if variant!='stock'else ''
   flag+='&buildingShadows' if variant=='blocked'else ''
   active=variant=='live'
   t.goto(f'http://127.0.0.1:{s.server_port}'+prefix+'?diagnostics&bowleySurveyPreview'+flag,wait_until='domcontentloaded')
   t.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
   t.select_option('#site',label='Cavendish Dunelands · coastal pass')
   t.get_by_role('button',name='Begin flight').click()
   t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='cavendish-dunelands-low'")
   start=t.evaluate('window.islandAirDiagnostics')
   if variant in ('stock','live'):
    t.wait_for_function("""p=>{const d=window.islandAirDiagnostics;return d.mode==='flight'&&d.site==='cavendish-dunelands-low'&&Math.hypot(d.x-p.x,d.z-p.z)<165&&d.roads&&d.detail.ready>0&&!d.detail.missing}""",arg=target,polling=220)
   else:
    t.wait_for_function("""p=>{const d=window.islandAirDiagnostics;return d.mode==='flight'&&Math.hypot(d.x-p.x,d.z-p.z)>105&&d.roads}""",arg=start,polling=220)
   end=t.evaluate('window.islandAirDiagnostics')
   assert bool(end['cavendishWaterCore'])==active and end['bowleyPond']=='bowley-pond-survey-2020'
   assert end['mode']=='flight'and end['altitude']>90 and not notices and not end['layerWarnings'],(end,notices)
   assert sum(x.endswith('/cavendish-water-2020.r8.gz')for x in assets)==int(variant in ('live','invalid'))
   assert sum(x.endswith('/bowley-2020-water.r8.gz')for x in assets)==1
   t.screenshot(path=str(a.out/(variant+'.png')),timeout=94000)
   results[variant]={'flightMetres':round(math.hypot(end['x']-start['x'],end['z']-start['z']),2),
     'distanceFromPond':round(math.hypot(end['x']-target['x'],end['z']-target['z']),2),
     'altitude':round(end['altitude'],2),'speedMps':round(end['speed'],2),
     'activePond':end['cavendishWaterCore'],'unchangedBowley':end['bowleyPond'],
     'optionalSiteResponseCodes':hits,'warnings':end['layerWarnings'],'errors':notices}
   (a.out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
   print(variant,results[variant],flush=True);t.close()
 finally:
  b.close();s.shutdown()
