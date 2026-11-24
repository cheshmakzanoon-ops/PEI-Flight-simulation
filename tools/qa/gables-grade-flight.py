"""Exercise the activated grade in an ordinary project-path flight."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--cases',default='live,blocked,missing')
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
 centre={'x':(-63.382612+63.2)*76766.24,'z':(46.5-46.487148)*111161.2}
 result={}
 try:
  for mode in a.cases.split(','):
   if mode not in ('live','blocked','missing'):raise ValueError(mode)
   t=b.new_page(viewport={'width':640,'height':420});t.set_default_timeout(170000)
   errors=[];requests=[];file='native-grade.g11.gz'
   t.on('pageerror',lambda e:errors.append(str(e)))
   t.on('request',lambda r:requests.append(urlsplit(r.url).path)if r.url.endswith(file)else None)
   t.on('console',lambda m:errors.append(m.text)if m.type=='error'and not(mode=='missing' and m.location.get('url','').endswith(file))else None)
   if mode=='missing':t.route('**/'+file,lambda r:r.fulfill(status=404,body='Expected optional native grade absence'))
   flags='&buildingShadows'if mode=='blocked'else ''
   url=f'http://127.0.0.1:{s.server_port}'+prefix+'?diagnostics&departure=cavendish-dunelands-low&gablesGradeReview&greenGablesReview&cavendishWaterReview'+flags
   t.goto(url,wait_until='domcontentloaded')
   t.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
   assert not t.evaluate('!!window.gradeQA')
   t.get_by_role('button',name='Begin flight').click()
   t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='cavendish-dunelands-low'")
   start=t.evaluate('window.islandAirDiagnostics')
   if mode=='live':
    t.wait_for_function("""p=>{const d=window.islandAirDiagnostics;return d.mode==='flight'&&Math.hypot(d.x-p.x,d.z-p.z)>450&&d.localGroundGrade&&d.greenGablesReview&&d.cavendishWaterCore&&d.detail.ready>0&&!d.detail.missing}""",arg=start,polling=250)
   else:t.wait_for_function("""a=>{const d=window.islandAirDiagnostics;return d.mode==='flight'&&Math.hypot(d.x-a.x,d.z-a.z)>105&&d.roads&&d.detail.ready>0}""",arg=start,polling=250)
   end=t.evaluate('window.islandAirDiagnostics')
   assert (end['localGroundGrade'] is not None)==(mode=='live')
   assert len(requests)==int(mode!='blocked')
   assert end['speed']>30 and end['altitude']>90 and not errors and not end['layerWarnings'],(end,errors)
   result[mode]={'flightMetres':round(math.hypot(end['x']-start['x'],end['z']-start['z']),2),'distanceToSlope':round(math.hypot(end['x']-centre['x'],end['z']-centre['z']),2),
      'altitudeMetres':end['altitude'],'activeGrade':end['localGroundGrade'],'houseActive':end['greenGablesReview'],'waterActive':end['cavendishWaterCore'],'paths':requests,'errors':errors}
   (a.out/'results.json').write_text(json.dumps(result,indent=2)+'\n')
   print(mode,result[mode],flush=True);t.close()
 finally:
  b.close();s.shutdown()
