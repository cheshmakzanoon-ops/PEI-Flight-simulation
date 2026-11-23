"""Serve local worker fault fixtures; the original shape must remain visible and isolated."""
from argparse import ArgumentParser
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib, importlib.util, json, os

p=ArgumentParser();p.add_argument('--dist',type=Path,default=Path('dist'));p.add_argument('--out',type=Path,default=Path('proof/packed/faults.json')); p.add_argument('--chromium',default=os.environ.get('CHROMIUM_EXECUTABLE'));a=p.parse_args()
loader=importlib.util.spec_from_file_location('bench',Path(__file__).parent/'texture-replay.py');b=importlib.util.module_from_spec(loader);loader.loader.exec_module(b)
server=b.local(a.dist);url=f'http://127.0.0.1:{server.server_port}';receipts={}
try:
 with sync_playwright() as p:
  c=p.chromium.launch(executable_path=a.chromium,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  for label,source in {
   'bad-shape':"postMessage({kind:'stone-v1',planes:[{family:'cut',width:4,height:4,pixels:new Uint8Array(64)}]});",
   'late-no-payload':"setTimeout(()=>postMessage({kind:'stone-v1',planes:[]}),9000);",
  }.items():
   context=c.new_context(viewport={'width':1096,'height':680});page=context.new_page();hits=[]
   def replace(route): hits.append(route.request.url); route.fulfill(status=200,content_type='text/javascript',body=source)
   page.route('**/assets/masonry.worker-*.js',replace)
   errs,req=b.init(page,url);stat=b.boot(page);frame,counters=b.frame(page,'street','approach')
   assert len(hits)==1 and not errs and stat['gl']['maps']==0 and stat['detail']['status']=='fallback', (hits,errs,stat)
   if label.startswith('late'): assert 7350<stat['detail']['workerMs']<9000,stat
   after,_=b.frame(page,'street','approach');assert frame.tobytes()==after.tobytes()
   q=page.evaluate('()=>portico.geometryFingerprint()');assert q['sha256']=='71820c993f55564831b3b72f454d0a804901bdce1246db05ca531f093379a3f8'
   receipts[label]={'workerRequests':len(hits),'detail':stat['detail'],'actualResidentLargeBytes':stat['gl']['bytes'],'render':counters,'geometry':q,'stableRGB':hashlib.sha256(frame.tobytes()).hexdigest()}
   context.close()
  c.close()
finally:server.shutdown()
a.out.write_text(json.dumps(receipts,indent=2)+'\n');print(json.dumps(receipts,indent=2))
