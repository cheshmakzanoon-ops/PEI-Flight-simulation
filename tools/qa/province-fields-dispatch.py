"""Exercise the province field atlas through the compiled Dispatch controls."""
import argparse,functools,http.server,json,math,threading
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from playwright.sync_api import expect,sync_playwright
p=argparse.ArgumentParser(description=__doc__)
for name in ('dist','out'):p.add_argument('--'+name,type=Path,required=True)
p.add_argument('--chromium',required=True)
args=p.parse_args();args.out.mkdir(exist_ok=True,parents=True)
base='/PEI-Flight-simulation/'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def translate_path(self,path):
  path=urlsplit(path).path
  return super().translate_path(path[len(base):] if path.startswith(base) else '/no-site/')

with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(args.dist.resolve())))as server,sync_playwright()as pw:
 threading.Thread(target=server.serve_forever,daemon=True).start()
 root=f'http://127.0.0.1:{server.server_port}'+base
 b=pw.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 failures=[]
 def tab(width,height):
  t=b.new_page(viewport={'width':width,'height':height});requests=[]
  t.set_default_timeout(120000)
  t.on('pageerror',lambda e:failures.append(str(e)))
  t.on('console',lambda m:failures.append(m.text)if m.type=='error'else None)
  t.on('request',lambda r:requests.append((urlsplit(r.url).path,query_url(r.headers.get('referer',''))))if '/fields-province/' in r.url else None)
  return t,requests
 def ready(t):t.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
 def disclosure(t):return t.locator('.scenery-reviews summary')
 def choice(t):return t.get_by_label('Expanded farmland')
 def query_url(url):return parse_qs(urlsplit(url).query,keep_blank_values=True)
 def query(t):return query_url(t.url)
 def nav(t,button):
  with t.expect_navigation(wait_until='domcontentloaded'):button.click()
  ready(t)
 def diagnose(t):return t.evaluate('window.islandAirDiagnostics')
 try:
  t,requests=tab(970,655)
  t.goto(root+'?diagnostics&qa-keep=1#controls',wait_until='domcontentloaded')
  ready(t);disclosure(t).click();choice(t).check()
  assert not requests and diagnose(t)['provinceFields']is None
  t.select_option('#site',label='Prince County · fields low pass')
  nav(t,t.get_by_role('button',name='Apply studies'))
  assert query(t).get('departure')==['prince-fields'] and query(t).get('qa-keep')==['1']
  assert urlsplit(t.url).path==base and urlsplit(t.url).fragment=='controls'
  assert sum(x.endswith('/index.fcr.gz')for x,_ in requests)==1
  nav(t,t.get_by_role('button',name='Use detailed preview'))
  assert not any(q.get('scenery')==['detail'] for _,q in requests) and diagnose(t)['provinceFields']is None,(requests,diagnose(t)['provinceFields'])
  disclosure(t).click()
  assert choice(t).is_checked() and choice(t).is_enabled()
  assert 'Saved' in t.get_by_text('Switch to Standard',exact=False).inner_text()
  assert disclosure(t).locator('span').inner_text()==''
  nav(t,t.get_by_role('button',name='Use standard'))
  assert 'provinceFieldsReview' in query(t) and query(t).get('departure')==['prince-fields']
  assert sum(x.endswith('/index.fcr.gz')for x,_ in requests)==2 and diagnose(t)['provinceFields']is not None,requests
  t.get_by_role('button',name='Begin flight').click()
  t.wait_for_function("window.islandAirDiagnostics?.mode==='flight'&&window.islandAirDiagnostics.site==='prince-fields'")
  start=diagnose(t)
  t.wait_for_function("""s=>{const f=window.islandAirDiagnostics;return f.mode==='flight'&&f.site===s.site&&f.provinceFields?.ready>0&&Math.hypot(f.x-s.x,f.z-s.z)>75}""",arg=start)
  end=diagnose(t)
  packs=sum(x.endswith('.pack')for x,_ in requests)
  assert packs>0,requests
  travel=math.hypot(end['x']-start['x'],end['z']-start['z'])
  t.close()
  m,mobile_requests=tab(390,760)
  m.goto(root+'?diagnostics&buildingShadows',wait_until='domcontentloaded');ready(m)
  disclosure(m).focus();m.keyboard.press('Enter')
  assert choice(m).is_disabled() and not choice(m).is_checked()
  assert m.locator('.review-choice').filter(has=choice(m)).get_by_text('Unavailable with the current terrain or shadow options.').is_visible()
  assert m.evaluate('document.documentElement.scrollWidth===innerWidth')
  m.get_by_role('button',name='Begin flight').scroll_into_view_if_needed()
  expect(m.get_by_role('button',name='Begin flight')).to_be_in_viewport()
  assert not mobile_requests and not failures,(mobile_requests,failures)
  m.screenshot(path=str(args.out/'blocked-mobile.png'),timeout=90000)
  report={'projectPath':base,'selectedDeparture':'prince-fields','preservedHashAndUnrelatedOptions':True,'stockAndPendingRequests':0,'detailRequests':0,'savedThroughProfileSwitch':True,'standardIndexRequestsPerLaunch':1,'standardPackRequests':packs,'flightDistanceMetres':round(travel,3),'readyTiles':end['provinceFields']['ready'],'blockedMobile':{'width':390,'keyboardDisclosure':True,'horizontalOverflow':False,'blockedRequests':len(mobile_requests)},'errors':failures}
  (args.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  print(report)
 finally:
  b.close();server.shutdown()
