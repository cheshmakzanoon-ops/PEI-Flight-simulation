"""Compiled player smoke for the optional longer gravel connection."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
root='/PEI-Flight-simulation/'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,path):
  p=urlsplit(path).path
  return super().translate_path(p[len(root):]if p.startswith(root)else '/no-app/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 report={}
 try:
  for active in (False,True):
   errors=[];custom=[]
   t=b.new_page(viewport={'width':630,'height':404});t.set_default_timeout(130000)
   t.on('pageerror',lambda e:errors.append(str(e)))
   t.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
   t.on('request',lambda r:custom.append(urlsplit(r.url).path)if 'trail' in urlsplit(r.url).path.lower()else None)
   opts='?diagnostics&departure=cavendish-dunelands-low&greenGablesReview&greenGablesBarnReview&gablesGradeReview'
   if active:opts+='&gablesTrailReview'
   t.goto(f'http://127.0.0.1:{server.server_port}'+root+opts,wait_until='domcontentloaded')
   t.wait_for_function("""active=>{const d=window.islandAirDiagnostics;return d?.mode==='dispatch'&&d.greenGablesReview&&d.greenGablesBarnReview&&d.localGroundGrade&&d.gablesTrailReview===active}""",arg=active)
   t.get_by_role('button',name='Begin flight').click()
   t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
   first=t.evaluate('window.islandAirDiagnostics')
   t.wait_for_function("""p=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&d.site===p.site&&Math.hypot(d.x-p.x,d.z-p.z)>75&&d.roads&&d.detail.ready>0&&!d.detail.missing}""",arg=first,polling=240)
   end=t.evaluate('window.islandAirDiagnostics')
   assert not errors and not end['layerWarnings']and not custom,(errors,end['layerWarnings'],custom)
   assert end['gablesTrailReview']==active and end['greenGablesReview']and end['greenGablesBarnReview']and end['localGroundGrade']
   report['live'if active else 'standard']={'distanceMetres':round(math.hypot(end['x']-first['x'],end['z']-first['z']),2),
        'site':end['site'],'trailAdmitted':active,'downloadedTrailFiles':custom,'warnings':end['layerWarnings'],'errors':errors}
   (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
   print(report,flush=True);t.close()
 finally:
  b.close();server.shutdown()
