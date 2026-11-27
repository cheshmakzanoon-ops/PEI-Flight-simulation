from pathlib import Path
import argparse, functools, hashlib, http.server, json, threading
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--checkout',required=True,type=Path)
p.add_argument('--chromium',required=True,type=Path)
p.add_argument('--out',required=True,type=Path)
a=p.parse_args()
pages=a.out.resolve()
pages.mkdir(parents=True,exist_ok=True)
assert (a.checkout/'dist'/'index.html').is_file(), 'Build the detached studio first'
report=[]
class Static(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
handler=functools.partial(Static,directory=str(a.checkout/'dist'))
with http.server.ThreadingHTTPServer(('127.0.0.1',0),handler) as server, sync_playwright() as playwright:
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base=f'http://127.0.0.1:{server.server_port}/'
    browser=playwright.chromium.launch(executable_path=str(a.chromium),args=[
        '--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    for width,height,views,label in [(1280,820,['Apron side','Straight on','Reciprocal'],'desktop'),(490,1050,['Apron side'],'small')]:
        with browser.new_context(viewport={'width':width,'height':height}) as context:
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
            assert page.goto(base,wait_until='domcontentloaded').ok
            page.wait_for_function("window.reviewReady && document.querySelectorAll('canvas').length === 2")
            for idx,name in enumerate(views):
                page.get_by_role('button',name=name).click()
                assert page.get_by_role('button',name=name).get_attribute('aria-pressed')=='true'
                filename=f'{label}-{idx}.png'
                pixels=page.screenshot(path=str(pages/filename),full_page=True)
                meta=page.evaluate("""()=>({review:window.reviewReady,canvases:[...document.querySelectorAll('canvas')].map(x=>[x.width,x.height])})""")
                assert meta['review']['sourceBounds'][1][1]>=.999 and meta['review']['midBounds'][1][1]>=.999
                assert abs(meta['review']['thumb']['heightCssPx']-75)<1,meta
                assert all(min(x)>200 for x in meta['canvases']) and not errors,errors
                report.append({'filename':filename,'view':name,'sha256':hashlib.sha256(pixels).hexdigest(),**meta})
    browser.close()
(pages/'receipt.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified detached studio captures:',len(report))
