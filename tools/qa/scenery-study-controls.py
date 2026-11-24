"""Exercise named dispatch previews with a real unmodified production build."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--out',type=Path,required=True)
o=p.parse_args();o.out.mkdir(parents=True,exist_ok=True)
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,path):
  path=path.split('?',1)[0]
  return super().translate_path(path.removeprefix('/PEI-Flight-simulation/') if path.startswith('/PEI-Flight-simulation/') else '/no-site/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(o.dist.resolve()))) as server,sync_playwright() as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 root=f'http://127.0.0.1:{server.server_port}/PEI-Flight-simulation/'
 b=pw.chromium.launch(executable_path=o.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 errors=[]
 def page(w,h):
  tab=b.new_page(viewport={'width':w,'height':h})
  tab.set_default_timeout(120000)
  tab.on('pageerror',lambda e:errors.append(str(e)))
  tab.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  return tab
 def ready(tab):tab.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'&&document.querySelector('details.scenery-reviews')")
 try:
  t=page(970,655);assets=[]
  t.on('request',lambda r:assets.append(r.url) if r.url.endswith(('/fields-pilot.rgba.gz','/furrow-relief.webp')) else None)
  start=root+'?diagnostics&qa-preserve=1#controls'
  t.goto(start,wait_until='domcontentloaded');ready(t)
  assert not assets
  t.select_option('#site',label='Summerside · runway 05')
  t.locator('details.scenery-reviews summary').click()
  apply=t.get_by_role('button',name='Apply studies')
  assert apply.is_disabled()
  t.locator('input[value="cropRowsReview"]').check();assert apply.is_enabled()
  t.locator('input[value="cropRowsReview"]').uncheck();assert apply.is_disabled()
  t.locator('input[value="cropRowsReview"]').check()
  fits=t.evaluate("()=>{const p=document.querySelector('#dispatch').getBoundingClientRect(), b=document.querySelector('#start').getBoundingClientRect();return b.bottom<=p.bottom+.5&&b.bottom<=innerHeight;}")
  t.screenshot(path=str(o.out/'desktop-dispatch.png'),timeout=90000)
  assert fits,t.evaluate("()=>{const p=document.querySelector('#dispatch'),b=document.querySelector('#start');return {height:innerHeight,panel:p.getBoundingClientRect().toJSON(),begin:b.getBoundingClientRect().toJSON(),client:p.clientHeight,scroll:p.scrollHeight};}")
  with t.expect_navigation(wait_until='domcontentloaded'):apply.click()
  ready(t)
  q=urlsplit(t.url);args=parse_qs(q.query,keep_blank_values=True)
  assert q.path=='/PEI-Flight-simulation/'and q.fragment=='controls' and args.get('departure')==['cysu']and args.get('qa-preserve')==['1'] and 'cropRowsReview'in args
  assert t.locator('#site option:checked').inner_text()=='Summerside · runway 05'
  assert t.locator('input[value="cropRowsReview"]').is_checked()
  assert len(assets)==2 and t.evaluate('window.islandAirDiagnostics.cropRowsReview')
  t.locator('details.scenery-reviews summary').click()
  t.locator('input[value="cropRowsReview"]').uncheck()
  with t.expect_navigation(wait_until='domcontentloaded'):apply.click()
  ready(t)
  assert 'cropRowsReview'not in parse_qs(urlsplit(t.url).query,keep_blank_values=True) and len(assets)==2
  assert t.locator('#site option:checked').inner_text()=='Summerside · runway 05'
  t.close()
  m=page(390,760);m.goto(root+'?diagnostics&beaconsfieldReview',wait_until='domcontentloaded');ready(m)
  summary=m.locator('details.scenery-reviews summary');summary.focus();m.keyboard.press('Enter')
  assert m.locator('details.scenery-reviews').evaluate('(e)=>e.open')
  assert m.locator('input[value="beaconsfieldReview"]').is_checked()
  assert m.evaluate('document.documentElement.scrollWidth===innerWidth')
  m.locator('#apply-scenery-reviews').scroll_into_view_if_needed()
  m.screenshot(path=str(o.out/'mobile-dispatch.png'),timeout=90000)
  assert not errors,errors
  report={'desktop':{'enableAndDisable':True,'nativeReloads':2,'unchangedDeparture':'cysu','preservedProjectPathAndUrlState':True,'expandedStartVisible':fits,'optionalAssetsRequestedOnlyAfterApply':len(assets)},'mobile':{'keyboardDisclosure':True,'horizontalOverflow':False,'width':390},'errors':errors}
  (o.out/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
 finally:
  b.close();server.shutdown()
