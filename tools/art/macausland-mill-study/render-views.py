import socket, urllib.request, subprocess,time,json,base64,argparse,os
from pathlib import Path
from playwright.sync_api import sync_playwright
q=argparse.ArgumentParser(description='Render six detached mill cameras through actual Three.js.')
q.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[3]);q.add_argument('--out',type=Path,required=True)
q.add_argument('--chromium',default=os.environ.get('CHROMIUM','chromium'));args=q.parse_args()
proj=args.checkout.resolve();out=args.out.resolve()
if proj==out or proj in out.parents:raise ValueError('Use an output directory outside the checkout')
out.mkdir(parents=True,exist_ok=True)
s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close();url=f'http://127.0.0.1:{port}/tools/art/macausland-mill-study/'
with (out/'server.log').open('w')as log:
 p=subprocess.Popen(['node',str(proj/'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',str(port),'--strictPort'],cwd=proj,stdout=log,stderr=log)
 try:
  for _ in range(60):
   try:urllib.request.urlopen(url,timeout=1);break
   except OSError:
    if p.poll()is not None:raise RuntimeError('vite exited')
    time.sleep(.12)
  else:raise RuntimeError('no localhost')
  with sync_playwright() as pw:
   b=pw.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
   page=b.new_page(viewport={'width':1160,'height':798});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
   page.on('request',lambda req:errors.append('Unexpected external request: '+req.url) if not req.url.startswith(url.split('/tools/')[0]+'/') else None);
   page.goto(url,wait_until='domcontentloaded');
   try: page.wait_for_function('typeof window.millStudio==="function"',timeout=12000)
   except Exception as e: raise RuntimeError(errors) from e
   records=[]
   for k in ('full','elevation','service','slider','return','roof'):
    a,c=page.evaluate('x=>[window.millStudio(x),window.millStudio(x)]',k);assert a==c,k
    (out/(k+'.png')).write_bytes(base64.b64decode(a.pop('png').split(',')[1]));records.append(dict(name=k,repeatIdentical=True,**a));
    print(k,a['calls'],a['triangles'],flush=True)
   assert not errors,errors
   (out/'studio.json').write_text(json.dumps(dict(mode='Detached original mill frontage vocabulary, no flight insertion',errors=errors,views=records),indent=2)+'\n')
   b.close()
 finally:p.terminate();p.wait(timeout=6)
