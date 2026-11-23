"""Probe the Dispatch scenery switch in the production application."""
import argparse, json, functools, threading
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('--dist',type=Path,required=True)
cli.add_argument('--chromium',required=True)
cli.add_argument('--out',type=Path,required=True)
args=cli.parse_args()
root=args.dist.resolve()
out=args.out.resolve()
out.mkdir(parents=True,exist_ok=True)
class Server(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
http=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(root)))
threading.Thread(target=http.serve_forever,daemon=True).start()
host=f'http://127.0.0.1:{http.server_port}/'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.chromium,
  args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
 page=browser.new_page(viewport={'width':844,'height':590});page.set_default_timeout(180000);errors=[]
 page.on('pageerror', lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 def capture(name):page.screenshot(path=str(out/(name+'.png')))
 page.goto(host+'?diagnostics',wait_until='domcontentloaded')
 page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch"')
 page.select_option('#site',label='Summerside waterfront · low pass')
 old=page.locator('#site').input_value()
 capture('standard')
 page.get_by_role('button',name='Use detailed preview').click()
 page.wait_for_url('**scenery=detail**')
 page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch"')
 assert page.locator('#site').input_value()==old
 assert 'departure=spinnakers-low' in page.url
 capture('detailed')
 page.get_by_role('button',name='Begin flight').click()
 page.wait_for_function('()=>{const x=window.islandAirDiagnostics;return x?.mode==="flight"&&x.site==="spinnakers-low"&&x.northBaywalkConcrete&&x.montagueBridge&&x.canopyLight&&x.shoreFoamDetail;}')
 x=page.evaluate('window.islandAirDiagnostics')
 assert not errors and not x['layerWarnings']
 page.keyboard.press('Escape')
 page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="paused"')
 page.get_by_role('button',name='Choose departure').click()
 page.select_option('#site',label='North Cape · wind farm low pass')
 page.get_by_role('button',name='Begin flight').click()
 page.wait_for_function('()=>{const x=window.islandAirDiagnostics;return x?.mode==="flight"&&x.site==="northcape-wind-low"&&x.northCape?.registered===16;}')
 north=page.evaluate('window.islandAirDiagnostics')
 assert not errors and not north['layerWarnings']
 page.keyboard.press('Escape')
 page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="paused"')
 page.get_by_role('button',name='Choose departure').click()
 page.select_option('#site',label='North Cape · wind farm low pass')
 page.get_by_role('button',name='Use standard').click()
 page.wait_for_function('()=>window.islandAirDiagnostics?.mode==="dispatch"&&window.islandAirDiagnostics.northCape===null')
 assert page.locator('#site').get_by_role('option',name='North Cape · wind farm low pass',exact=True).get_attribute('value')==page.locator('#site').input_value()
 assert 'scenery=' not in page.url and 'diagnostics' in page.url and 'departure=northcape-wind-low' in page.url
 (out/'report.json').write_text(json.dumps({'copiedDeparture':True,'workedWithKnownFlags':True,'maskScope':x['northBaywalkConcrete'],
 'montagueBridge':x['montagueBridge'],'northCapeTurbines':north['northCape']['registered'],'standardRestored':True,'errors':errors},indent=2)+'\n')
 print((out/'report.json').read_text(),flush=True)
 browser.close()
http.shutdown()
