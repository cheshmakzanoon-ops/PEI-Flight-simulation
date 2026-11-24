"""Test the regional pack from normal, compiled Dispatch and live flight."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from playwright.sync_api import expect,sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(prefix):]if path.startswith(prefix)else '/wrong-app/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(a.dist.resolve())))as s,sync_playwright()as pw:
 threading.Thread(target=s.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 url=f'http://127.0.0.1:{s.server_port}'+prefix
 name='Cavendish Dunelands · coastal pass';errors=[]
 def page(w,h,**kw):
  t=b.new_page(viewport={'width':w,'height':h},**kw);t.set_default_timeout(130000)
  t.on('pageerror',lambda e:errors.append(str(e)))
  t.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  return t
 def ready(t):t.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
 def request_args(t):return parse_qs(urlsplit(t.url).query,keep_blank_values=True)
 def nav(t,button):
  with t.expect_navigation(wait_until='domcontentloaded'):button.click()
  ready(t)
 def assets(t):
  return t.evaluate('''()=>performance.getEntriesByType('resource').map(r=>r.name).filter(x=>
    /green-gables-barn-v1\\.bin\\.gz|cavendish-water-2020\\.r8\\.gz|native-grade\\.g11\\.gz|fairway-ground\\.r8\\.gz/.test(x))''')
 try:
  t=page(980,660)
  t.goto(url+'?diagnostics&qa-keep=1&greenGablesReview=manual#dispatch',wait_until='domcontentloaded')
  ready(t)
  assert t.locator('#cavendish-package').is_hidden()
  t.select_option('#site',label=name)
  assert t.locator('#cavendish-package').is_visible()and not assets(t)
  nav(t,t.get_by_role('button',name='Enable Cavendish detail'))
  t.wait_for_function('''()=>{const d=window.islandAirDiagnostics;return d?.greenGablesReview&&d.greenGablesBarnReview&&d.cavendishWaterCore&&d.localGroundGrade&&d.gablesFairwayReview&&d.gablesTrailReview}''')
  q=request_args(t)
  assert q.get('departure')==['cavendish-dunelands-low'] and q.get('qa-keep')==['1'] and q.get('greenGablesReview')==['manual'] and urlsplit(t.url).fragment=='dispatch'
  assert 'cavendishDetail' in q and not any(x in q for x in ['greenGablesBarnReview','cavendishWaterReview','gablesGradeReview','gablesFairwayReview','gablesTrailReview'])
  active_assets=assets(t);assert len(active_assets)==4 and all(urlsplit(x).path.startswith(prefix)for x in active_assets)
  t.locator('.scenery-reviews summary').click()
  a1=t.get_by_label('Dunelands freshwater');assert a1.is_disabled()and a1.is_checked()
  assert t.get_by_text('Included in Cavendish detail').count()==2
  t.get_by_label('Field surface relief').check()
  nav(t,t.get_by_role('button',name='Apply studies'))
  assert 'cropRowsReview'in request_args(t) and 'cavendishWaterReview'not in request_args(t)
  assert 'cavendishDetail' in request_args(t)
  t.get_by_role('button',name='Begin flight').click()
  t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='cavendish-dunelands-low'")
  start=t.evaluate('window.islandAirDiagnostics')
  t.wait_for_function('''s=>{const d=window.islandAirDiagnostics;return d?.mode==='flight'&&Math.hypot(d.x-s.x,d.z-s.z)>74&&d.greenGablesReview&&d.greenGablesBarnReview&&d.cavendishWaterCore&&d.localGroundGrade&&d.gablesFairwayReview&&d.gablesTrailReview}''',arg=start,polling=240)
  d=t.evaluate('window.islandAirDiagnostics');travel=round(math.hypot(d['x']-start['x'],d['z']-start['z']),2)
  assert not d['layerWarnings']
  # Reuse the published bookmarked departure, not a camera or state override.
  t.reload(wait_until='domcontentloaded');ready(t)
  nav(t,t.get_by_role('button',name='Turn off Cavendish detail'))
  q=request_args(t)
  assert 'cavendishDetail'not in q and q.get('greenGablesReview')==['manual'] and 'cropRowsReview'in q and not assets(t)
  t.close()
  mobile=page(390,760,has_touch=True)
  mobile.goto(url+'?diagnostics&buildingShadows',wait_until='domcontentloaded');ready(mobile)
  mobile.select_option('#site',label=name)
  toggle=mobile.get_by_role('button',name='Enable Cavendish detail')
  assert toggle.is_disabled()and not assets(mobile)and mobile.evaluate('document.documentElement.scrollWidth===innerWidth')
  for control in (toggle,mobile.get_by_role('button',name='Begin flight')):
   control.scroll_into_view_if_needed();expect(control).to_be_in_viewport()
  reach=toggle.evaluate('(e)=>e.getBoundingClientRect().height')
  assert reach>=44 and not errors,(reach,errors)
  mobile.screenshot(path=str(a.out/'mobile.png'),timeout=90000)
  report={'activeStudies':6,'newMatchedAssets':[urlsplit(a).path for a in active_assets],'independentSelectionPreservedOnDisable':True,
    'route':'cavendish-dunelands-low','flightMetres':travel,'manualStudyTestOnlyAddedOneFlag':True,'mismatchedTerrainDisabled':True,'mobileTapTargetCssPixels':reach,'errors':errors}
  (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  print(report,flush=True)
 finally:
  b.close();s.shutdown()
