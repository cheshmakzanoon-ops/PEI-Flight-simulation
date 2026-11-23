"""Real WebGL boot at a nested deployment path; bare /assets deliberately doesn't exist."""
from pathlib import Path
from argparse import ArgumentParser
from PIL import Image
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
import hashlib, importlib.util, json, os, tempfile

p=ArgumentParser();p.add_argument('--dist',type=Path,default=Path('dist'));p.add_argument('--original-frame',type=Path,help='Optional F street-approach PNG from texture-replay');p.add_argument('--chromium',default=os.environ.get('CHROMIUM_EXECUTABLE'));a=p.parse_args()
loader=importlib.util.spec_from_file_location('bench',Path(__file__).parent/'texture-replay.py');b=importlib.util.module_from_spec(loader);loader.loader.exec_module(b)
with tempfile.TemporaryDirectory() as folder:
 d=Path(folder)/'repo'/'public-studies'/'portico';d.parent.mkdir(parents=True);d.symlink_to(a.dist.resolve())
 host=b.local(Path(folder));url=f'http://127.0.0.1:{host.server_port}/repo/public-studies/portico/'
 try:
  with sync_playwright() as p:
   c=p.chromium.launch(executable_path=a.chromium,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
   page=c.new_page(viewport={'width':1096,'height':680});all_paths=[];page.on('request',lambda rq:all_paths.append(urlsplit(rq.url).path));
   errors,_=b.init(page,url);st=b.boot(page)
   assert not errors and st['detail']['status']=='ready' and st['gl']['bytes']==18874356,st
   pic,stats=b.frame(page,'street','approach');rgbHash=hashlib.sha256(pic.tobytes()).hexdigest()
   assert rgbHash=='349b4b144e66dbf2559ec06abae2adbe069421765fcc78ee6ec9be00fa8404c0'
   if a.original_frame: assert pic.tobytes()==Image.open(a.original_frame).convert('RGB').tobytes()
   assert all(x.startswith('/repo/public-studies/portico/') for x in all_paths) and len(all_paths)==3 and sum('masonry.worker-' in x for x in all_paths)==1,all_paths
   assert page.evaluate('()=>portico.geometryFingerprint().then(q=>q.sha256)')=='71820c993f55564831b3b72f454d0a804901bdce1246db05ca531f093379a3f8'
   result={'subpath':'/repo/public-studies/portico/','actualRequests':all_paths,'sameFRenderedPixels':pic.width*pic.height,'sameFFrameSHA256':rgbHash,'render':stats,'actualMipBytes':st['gl']['bytes'],'noErrors':True}
   c.close()
 finally:host.shutdown()
Path('proof/packed/relative.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
