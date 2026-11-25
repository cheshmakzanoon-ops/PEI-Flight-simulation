"""Exercise the built game, not the instrumented inspection scene."""
from pathlib import Path
import argparse,functools,http.server,json,threading
from playwright.sync_api import sync_playwright
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True);p.add_argument('--mode',choices=['active','missing','stock'],required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(a.dist.resolve())))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as w:
  b=w.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  pg=b.new_page(viewport={'width':620,'height':410});pg.set_default_timeout(105000)
  errors=[];expected=[];requests=[]
  def art(u):return '/assets/souris-knight-art-' in u and u.split('?',1)[0].endswith('.js')
  def console(m):
   if m.type!='error':return
   if a.mode=='missing' and art(m.location.get('url','')) and '404' in m.text:expected.append('expected console 404')
   else:errors.append(m.text)
  def response(r):
   if r.status<400:return
   if a.mode=='missing' and art(r.url) and r.status==404:expected.append('expected optional art response 404')
   else:errors.append(f'{r.status} {r.url}')
  pg.on('console',console);pg.on('response',response);pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('request',lambda q:requests.append(q.url) if art(q.url) else None)
  if a.mode=='missing':pg.route('**/assets/souris-knight-art-*.js',lambda q:q.fulfill(status=404,content_type='text/javascript',body=''))
  flag='&stockSourisKnight' if a.mode=='stock' else ''
  pg.goto(f'http://127.0.0.1:{server.server_port}/?departure=souris-waterfront-pass&diagnostics&sourisKnightExterior'+flag,wait_until='domcontentloaded')
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.site==='souris-waterfront-pass'")
  assert pg.locator('#site option:checked').inner_text()=='Souris · waterfront pass'
  start=pg.evaluate('window.islandAirDiagnostics')
  pg.get_by_role('button',name='Begin flight').click()
  pg.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics?.site==='souris-waterfront-pass'")
  pg.wait_for_function("s=>Math.hypot(window.islandAirDiagnostics.x-s.x,window.islandAirDiagnostics.z-s.z)>160",arg={'x':start['x'],'z':start['z']})
  pg.wait_for_function("""wanted=>{const d=window.islandAirDiagnostics,b=d?.buildingTiles;return b?.wanted>0&&b.ready===b.wanted&&b.loading===0&&b.pending===0&&b.failed===0&&d.sourisKnightExterior===wanted}""",arg='authored' if a.mode=='active' else 'stock')
  pg.keyboard.press('v');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Cockpit'")
  pg.keyboard.press('v');pg.wait_for_function("window.islandAirDiagnostics?.camera==='Wide chase'")
  pg.keyboard.press('Escape');pg.wait_for_function("window.islandAirDiagnostics?.mode==='paused'")
  last=pg.evaluate('window.islandAirDiagnostics')
  assert not errors and not last['layerWarnings'],(errors,last['layerWarnings'])
  assert last['site']=='souris-waterfront-pass' and last['sourisShoreline']['active']
  assert len(requests)==(0 if a.mode=='stock' else 1),(a.mode,requests,expected)
  if a.mode=='missing':assert 'expected optional art response 404' in expected
  receipt={'scope':'Actual compiled game and unchanged Souris waterfront flight start, not a real navigation procedure.', 'scenario':a.mode,'site':last['site'],
   'lastMode':last['mode'],'camera':last['camera'],'stockWaterCorrectionStillActive':last['sourisShoreline']['active'],
   'newTowerMode':last['sourisKnightExterior'],'localArtModuleRequests':len(requests),'expectedFaults':expected,'buildingTiles':last['buildingTiles'],
   'controls':['Begin flight','Cockpit','Wide chase','Pause'],'unexpectedErrors':errors}
  (a.out/'actual-compiled.json').write_text(json.dumps(receipt,indent=2)+'\n')
  b.close()
finally:server.shutdown()
