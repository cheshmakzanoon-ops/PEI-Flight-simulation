"""Verify Standard dry dunes using ordinary flight from all three counties."""
import argparse,functools,http.server,json,math,threading,time
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--county',choices=['prince','queens','kings'],default='queens')
g=p.add_mutually_exclusive_group();g.add_argument('--fault',action='store_true');g.add_argument('--stock',action='store_true');g.add_argument('--far',action='store_true')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
PREFIX='/PEI-Flight-simulation/'
class Static(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*unused):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(PREFIX):]if path.startswith(PREFIX)else '/unrelated/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Static,directory=str(a.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 with pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-dev-shm-usage','--ignore-gpu-blocklist'])as b:
  pg=b.new_page(viewport={'width':460,'height':338});pg.set_default_timeout(115000)
  erro=[];reads=[]
  pg.on('pageerror',lambda e:erro.append(str(e)))
  pg.on('console',lambda e:erro.append(e.text)if e.type=='error'else None)
  def registered(r):
   u=urlsplit(r.url)
   if '/dune-sand/v1/' in u.path:reads.append((u.path.rsplit('/',1)[-1],r.status))
  pg.on('response',registered)
  if a.fault:
   pg.route('**/dune-sand/v1/micro-photometric.png',lambda route:route.fulfill(status=200,body=bytes(149949)))
  route='montague' if a.far else a.county+'-sand-dunes'
  url=f'http://127.0.0.1:{server.server_port}'+PREFIX+'?diagnostics&departure='+route+'&stable=1'+('&stockDuneSand' if a.stock else '')
  pg.goto(url,wait_until='domcontentloaded')
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
  before=pg.evaluate('window.islandAirDiagnostics');pg.get_by_role('button',name='Begin flight').click()
  pg.wait_for_function("([x,z])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>175}",
      arg=[before['x'],before['z']],polling=200)
  pg.keyboard.press('KeyV');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
  pg.wait_for_function("([x,z])=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-x,d.z-z)>380}",
      arg=[before['x'],before['z']],polling=200)
  if not (a.fault or a.stock or a.far):pg.wait_for_function("window.islandAirDiagnostics?.duneSand?.active.length>0")
  elif a.fault:pg.wait_for_function("window.islandAirDiagnostics?.duneSand?.failed>0")
  pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  after=pg.evaluate('window.islandAirDiagnostics')
  state=after['duneSand']
  expect=not(a.fault or a.stock or a.far)
  assert bool(state and state['active'])==expect and not erro and not after['layerWarnings'],(state,erro,after['layerWarnings'])
  assert after['site']==route and after['altitude']-after['groundY']>45,(after['site'],after['altitude'],after['groundY'])
  if a.stock or a.far:
   assert not reads and (state is None if a.stock else not state['approved'])
  else:
   assert sum(n=='micro-photometric.png' and s==200 for n,s in reads)==1
   assert sum(n=='macro-photometric.png' and s==200 for n,s in reads)==1
   assert sum(n.endswith('.g05.gz') and s==200 for n,s in reads)>=1
  out={'materialActive':expect,'diagnostics':state,
       'ordinaryTravelM':math.hypot(after['x']-before['x'],after['z']-before['z']),
       'heightAGLM':after['altitude']-after['groundY'],'fault':a.fault,'stock':a.stock,'far':a.far,'requests':reads,'errors':erro,'route':route}
  (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(out,flush=True)
