"""Verify normal Dispatch enables both adopted Cavendish studies in one reload."""
import argparse,functools,http.server,json,threading
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from playwright.sync_api import expect,sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
prefix='/PEI-Flight-simulation/'
class Server(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*x):pass
 def translate_path(self,url):
  path=urlsplit(url).path
  return super().translate_path(path[len(prefix):]if path.startswith(prefix)else '/invalid/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(a.dist.resolve())))as s,sync_playwright()as pw:
 threading.Thread(target=s.serve_forever,daemon=True).start()
 b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 root=f'http://127.0.0.1:{s.server_port}'+prefix
 errors=[]
 def ready(t):t.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
 def controls(t):return t.get_by_label('Green Gables House'),t.get_by_label('Dunelands freshwater')
 def summary(t):return t.locator('.scenery-reviews summary')
 def connect(width,height,**opts):
  t=b.new_page(viewport={'width':width,'height':height},**opts);t.set_default_timeout(125000)
  t.on('pageerror',lambda e:errors.append(str(e)))
  t.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
  return t
 try:
  t=connect(970,655);requests=[]
  t.on('request',lambda r:requests.append(urlsplit(r.url).path)if r.url.endswith(('/cavendish-water-2020.r8.gz','/green-gables-v3.bin.gz'))else None)
  t.goto(root+'?diagnostics&qa-keep=1#dispatch',wait_until='domcontentloaded');ready(t)
  t.select_option('#site',label='Cavendish Dunelands · coastal pass')
  summary(t).focus();t.keyboard.press('Enter')
  g,water=controls(t)
  g.focus();t.keyboard.press('Space');water.check()
  assert not requests
  with t.expect_navigation(wait_until='domcontentloaded'):t.get_by_role('button',name='Apply studies').click()
  ready(t)
  t.wait_for_function("window.islandAirDiagnostics?.greenGablesReview===true&&window.islandAirDiagnostics.cavendishWaterCore==='cavendish-dunelands-survey-2020'")
  q=urlsplit(t.url);d=parse_qs(q.query,keep_blank_values=True)
  assert q.fragment=='dispatch'and q.path==prefix and d.get('qa-keep')==['1'] and d.get('departure')==['cavendish-dunelands-low']
  assert all(k in d for k in ('greenGablesReview','cavendishWaterReview','diagnostics'))
  assert len(requests)==2 and all(x.startswith(prefix)for x in requests)
  assert summary(t).locator('span').inner_text()=='2 selected'
  t.get_by_role('button',name='Begin flight').click()
  t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='cavendish-dunelands-low'")
  t.close()
  layouts=[]
  for w,h in ((390,760),(844,390)):
   m=connect(w,h,has_touch=True)
   m.goto(root+'?diagnostics&buildingShadows',wait_until='domcontentloaded');ready(m);summary(m).click()
   g,water=controls(m)
   assert g.is_disabled() and water.is_disabled()
   assert m.evaluate('document.documentElement.scrollWidth===innerWidth')
   dims=[q.evaluate("e=>e.closest('label').getBoundingClientRect().height")for q in(g,water)]
   assert min(dims)>=44,dims
   apply=m.get_by_role('button',name='Apply studies')
   begin=m.get_by_role('button',name='Begin flight')
   for q in (apply,begin):
    q.scroll_into_view_if_needed();expect(q).to_be_in_viewport()
   m.screenshot(path=str(a.out/f'mobile-{w}x{h}.png'),timeout=95000)
   layouts.append({'width':w,'height':h,'touchTargets':dims,'applyAndBeginReachable':True})
   m.close()
  assert not errors,errors
  result={'sameProjectPath':prefix,'preservedHashAndQuery':True,'reloads':1,'desktopPendingAssetRequests':0,'sameOriginAssets':requests,
          'composedAndFlying':'cavendish-dunelands-low','blockedTouchLayouts':layouts,'errors':errors}
  (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
  print(result,flush=True)
 finally:
  b.close();s.shutdown()
