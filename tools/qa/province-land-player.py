"""Exercise packaged grass and farmland together through ordinary Dispatch and flight."""
import argparse,functools,http.server,json,math,re,threading
from pathlib import Path,PurePosixPath
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--departure',default='prince-grassland')
p.add_argument('--distance',type=float,default=150)
p.add_argument('--corrupt',choices=['grass','fields'])
p.add_argument('--use-range',action='store_true')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Local(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
 def do_GET(self):
  spec=self.headers.get('Range','')
  path=Path(self.translate_path(self.path))
  r=re.fullmatch(r'bytes=(\d+)-(\d+)',spec)
  if a.use_range and r and path.suffix=='.pack' and (path.parent.name=='grass-study' or (path.parent.name=='v2' and path.parent.parent.name=='fields-province')) and path.is_file():
   lo,hi=map(int,r.groups());total=path.stat().st_size
   if 0<=lo<=hi<total:
    with path.open('rb') as f:
     f.seek(lo);raw=f.read(hi-lo+1)
    self.send_response(206);self.send_header('Content-Range',f'bytes {lo}-{hi}/{total}')
    self.send_header('Content-Length',str(len(raw)));self.send_header('Content-Type','application/octet-stream')
    self.end_headers();self.wfile.write(raw);return
  return super().do_GET()
 def translate_path(self,url):
  name=urlsplit(url).path
  return super().translate_path(name[len(prefix):]if name.startswith(prefix)else '/unrelated/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Local,directory=str(a.dist.resolve())))as server,sync_playwright()as p:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 with p.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  page=b.new_page(viewport={'width':680,'height':500});page.set_default_timeout(170000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  url=f'http://127.0.0.1:{server.server_port}'+prefix+'?diagnostics&departure='+a.departure+'&unrelated=keep'
  assert a.departure in ('prince-grassland','kings-grassland','queens-grassland')
  if a.corrupt:
   folder,size=('grass-study',249810)if a.corrupt=='grass' else ('fields-province/v2',115861)
   page.route('**/'+folder+'/index.fcr.gz',lambda r:r.fulfill(status=200,body=bytes(size)))
  reads=[]
  page.on('response',lambda r:reads.append({'asset':PurePosixPath(urlsplit(r.url).path).name,'layer':('fields-province' if '/fields-province/v2/' in r.url else PurePosixPath(urlsplit(r.url).path).parent.name),'status':r.status,'range':r.headers.get('content-range')}) if '/fields-province/' in r.url or '/grass-study/' in r.url else None)
  page.goto(url,wait_until='domcontentloaded');page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  assert page.evaluate("window.islandAirDiagnostics.provinceGrass===null")
  assert not reads
  page.locator('.scenery-reviews summary').click();page.get_by_label('Ground vegetation').check();page.get_by_label('Expanded farmland').check()
  with page.expect_navigation(wait_until='domcontentloaded'):page.get_by_role('button',name='Apply studies').click()
  assert 'sourceGrassStudy' in page.url and 'provinceFieldsReview' in page.url and 'unrelated=keep' in page.url and a.departure in page.url
  page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  all_layers={'grass':'provinceGrass','fields':'provinceFields'}
  for name,layer in all_layers.items():
   if name==a.corrupt:
    assert page.evaluate("window.islandAirDiagnostics."+layer) is None
   else:
    page.wait_for_function("window.islandAirDiagnostics."+layer+"?.ready>0")
  initial=page.evaluate('window.islandAirDiagnostics')
  page.get_by_role('button',name='Begin flight').click()
  page.wait_for_function("""([x,z,target])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>target}""",arg=[initial['x'],initial['z'],a.distance],polling=200)
  d=page.evaluate('window.islandAirDiagnostics')
  remains={name:d[layer] for name,layer in all_layers.items()}
  for name,state in remains.items():
   if name==a.corrupt:assert state is None
   else:assert state['slots']==4 and state['pending']<=2
  bad={'grass':'grass-study','fields':'fields-province'}.get(a.corrupt)
  if a.use_range:assert all(r['status']==206 and r['range'] for r in reads if r['asset'].endswith('.pack'))
  if bad:assert not any(r['layer']==bad and r['asset'].endswith('.pack') for r in reads)
  assert d['site']==a.departure and d['altitude']-d['groundY']>50 and not errors
  out={'normalDispatch':True,'standardFetchedNeitherLayer':True,'departure':a.departure,'corruptArchive':a.corrupt,
      'travelM':math.hypot(d['x']-initial['x'],d['z']-initial['z']),'activeLayers':remains,'requests':reads,'errors':errors}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
