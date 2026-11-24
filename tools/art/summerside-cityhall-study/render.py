from pathlib import Path
import json,base64,os
from playwright.sync_api import sync_playwright
from argparse import ArgumentParser
p=ArgumentParser();p.add_argument('url');p.add_argument('--poses',default='southwest,aerial,clock,masonry,roof,northeast');p.add_argument('--width',type=int,default=1340);p.add_argument('--height',type=int,default=850);a=p.parse_args()
T=Path(__file__).parent/'proof';T.mkdir(exist_ok=True);R={}
with sync_playwright()as q:
 b=q.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
 for opt in a.poses.split(','):
  kind=opt.split('+')[0];opts={'wet':'overcast','historical':'annex=survey2020'};pairs=[opts[x] for x in opt.split('+')[1:]];url=a.url+'/?pose='+kind+''.join('&'+x for x in pairs)
  p=b.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
  err=[];rq=[]
  p.on('console',lambda v:err.append(v.text) if v.type=='error' else None)
  p.on('pageerror',lambda v:err.append(str(v)))
  p.on('request',lambda v:rq.append(v.url))
  p.goto(url,wait_until='domcontentloaded',timeout=40000)
  p.wait_for_function("()=>window.cityHallReview&&!!window.cityHallStill",timeout=45000)
  if err:raise RuntimeError(err)
  stats=p.evaluate('()=>cityHallReview');s=p.evaluate('()=>cityHallStill()')
  (T/(opt+'.png')).write_bytes(base64.b64decode(s.split(',',1)[1]))
  R[opt]={**stats,'requests':rq,'errors':err};(T/'render.json').write_text(json.dumps(R,indent=2)+'\n')
  print(opt,stats,flush=True);p.close()
 b.close()
