"""Replay the Green Gables exterior and province fields together in the compiled player."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
base='/PEI-Flight-simulation/'
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,path):
  path=urlsplit(path).path
  return super().translate_path(path[len(base):] if path.startswith(base) else '/no-site/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 try:
  report={}
  for extra in (False,True):
   t=b.new_page(viewport={'width':640,'height':420})
   t.set_default_timeout(125000);requests=[];errors=[]
   t.on('request',lambda r:requests.append(urlsplit(r.url).path)if '/fields-province/'in r.url or r.url.endswith('/green-gables-v3.bin.gz')else None)
   t.on('pageerror',lambda e:errors.append(str(e)))
   t.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
   url=f'http://127.0.0.1:{server.server_port}'+base+'?diagnostics&departure=cavendish-low'+('&greenGablesReview&provinceFieldsReview'if extra else '')
   t.goto(url,wait_until='domcontentloaded')
   t.wait_for_function("""active=>{const d=window.islandAirDiagnostics;return d?.mode==='dispatch'&&d.site==='cavendish-low'&&d.greenGablesReview===active}""",arg=extra)
   assert not t.evaluate('!!window.gableLab')
   t.get_by_role('button',name='Begin flight').click()
   t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='cavendish-low'")
   d=t.evaluate('window.islandAirDiagnostics')
   t.wait_for_function("""({o,active})=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&d.site==='cavendish-low'&&d.greenGablesReview===active&&Math.hypot(d.x-o.x,d.z-o.z)>45&&d.roads&&d.detail.ready>0&&!d.detail.missing&&!d.buildingTiles?.failed}""",arg={'o':d,'active':extra})
   flight=t.evaluate('window.islandAirDiagnostics')
   assert not errors and not flight['layerWarnings'],(errors,flight['layerWarnings'])
   assert flight['speed']>30 and flight['altitude']>95,flight
   if extra:
    assert sum(x.endswith('/green-gables-v3.bin.gz')for x in requests)==1
    assert sum(x.endswith('/index.fcr.gz')for x in requests)==1 and flight['provinceFields']is not None
   else:assert not requests and flight['provinceFields']is None
   assert all(x.startswith(base)for x in requests)
   assert flight['greenGablesReview']==extra
   report['combined'if extra else 'baseline']={'distanceMetres':round(math.hypot(flight['x']-d['x'],flight['z']-d['z']),3),'speedMps':flight['speed'],'altitudeMetres':flight['altitude'],'requests':requests,'warnings':flight['layerWarnings'],'errors':errors}
   (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
   print(report,flush=True);t.close()
 finally:
  b.close();server.shutdown()
