"""Exercise default, opt-in, and missing optional art in built Charlottetown flight."""
import argparse, functools, http.server, json, math, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--dist',type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--cases',default='stock,preview,missing',help='Comma-separated subset: stock, preview, missing.')
a=p.parse_args()
cases=a.cases.split(',')
if not cases or not set(cases)<=set(('stock','preview','missing')):p.error('unknown case')
if not (a.dist/'index.html').is_file():p.error('pass a built dist directory')
a.out.mkdir(exist_ok=True,parents=True)
class SiteServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def translate_path(self,path):
        # The deployed game uses a project-relative URL, not the host root.
        path=path.split('?',1)[0]
        return super().translate_path(path.removeprefix('/PEI-Flight-simulation/') if path.startswith('/PEI-Flight-simulation/') else '/NONEXISTENT_QA_PREFIX/')
with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(SiteServer,directory=str(a.dist.resolve()))) as server, sync_playwright() as pw:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    browser=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
    try:
        for name in cases:
            page=browser.new_page(viewport={'width':500,'height':322})
            page.set_default_timeout(140000)
            errors=[];requests=[];responses=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            def on_error(message):
                if message.type!='error':return
                if name=='missing' and message.location.get('url','').endswith('/beaconsfield-v1.bin.gz'):return
                errors.append(message.text)
            page.on('console',on_error)
            page.on('request',lambda request:requests.append(request.url) if request.url.endswith('/beaconsfield-v1.bin.gz') else None)
            def on_response(response):
                if response.url.endswith('/beaconsfield-v1.bin.gz'):
                    responses.append(response.status)
                elif response.status>=400:
                    errors.append(f'{response.status} {response.url}')
            page.on('response',on_response)
            if name=='missing':page.route('**/beaconsfield-v1.bin.gz',lambda route:route.fulfill(status=404,body='Optional art unavailable for test'))
            page.goto(f'http://127.0.0.1:{server.server_port}/PEI-Flight-simulation/?diagnostics'+('&beaconsfieldReview' if name!='stock' else ''),wait_until='domcontentloaded')
            page.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
            page.select_option('#site',label='Charlottetown waterfront · low pass')
            page.get_by_role('button',name='Begin flight').click()
            page.wait_for_function("window.islandAirDiagnostics?.site==='harbour-low'&&window.islandAirDiagnostics.mode==='flight'")
            start=page.evaluate('window.islandAirDiagnostics')
            page.wait_for_function("""q=>{const d=window.islandAirDiagnostics,b=d.buildingTiles;return d.mode==='flight'&&d.beaconsfieldReview===q[2]&&Math.hypot(d.x-q[0],d.z-q[1])>35&&d.roads&&d.mainland&&d.detail.ready>0&&d.detail.missing===0&&b.ready>0&&b.wanted===b.ready&&!b.loading&&!b.failed&&!b.pending}""",arg=[start['x'],start['z'],name=='preview'],polling=250)
            after=page.evaluate('window.islandAirDiagnostics')
            assert not after['layerWarnings'] and not errors,(name,errors,after['layerWarnings'])
            assert len(requests)==(0 if name=='stock' else 1),(name,requests)
            assert responses==([] if name=='stock' else [404 if name=='missing' else 200]),(name,responses)
            page.screenshot(path=str(a.out/(name+'.png')),timeout=95000)
            result={'mode':after['mode'],'previewActive':after['beaconsfieldReview'],'metres':math.hypot(after['x']-start['x'],after['z']-start['z']),'buildingTiles':after['buildingTiles'],'detail':after['detail'],'artRequests':len(requests),'artResponses':responses,'warnings':after['layerWarnings'],'errors':errors}
            (a.out/(name+'.json')).write_text(json.dumps(result,indent=2)+'\n')
            print(name,result,flush=True)
            page.close()
    finally:
        browser.close()
        server.shutdown()
