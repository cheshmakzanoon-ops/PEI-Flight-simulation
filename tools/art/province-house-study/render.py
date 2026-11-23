"""Standalone Three.js cloud render of original art only; source photos never referenced by runtime."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
import io,json,os,numpy as np
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from functools import partial
D=Path(__file__).parent
O=D/'proof';O.mkdir(exist_ok=True)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(D/'dist')))
Thread(target=server.serve_forever,daemon=True).start()
chrome=os.environ.get('CHROMIUM_EXECUTABLE')
report={}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=chrome,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1096,'height':680},device_scale_factor=1)
  errors=[]; loaded=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.on('response',lambda e: loaded.append(e.url))
  page.goto(f'http://127.0.0.1:{server.server_port}',wait_until='networkidle',timeout=50000)
  page.wait_for_function('()=>!!window.porticoBoot',timeout=20000)
  page.evaluate('()=>porticoBoot.ready')
  assert page.evaluate("()=>porticoBoot.result.status") == 'ready'
  poses=['street','bay','capital','fly']
  for pose in poses:
   frames=[]
   for enabled in ([False,True] if pose in ('street','bay','fly') else [True]):
    cloudy=pose!='fly' and pose!='capital'
    counts=page.evaluate('([on,pose,c])=>portico.render(on,pose,c)',[enabled,pose,cloudy]);
    pic=page.locator('canvas').screenshot(animations='disabled',type='png',timeout=30000)
    im=Image.open(io.BytesIO(pic)).convert('RGB');im.save(O/f'{pose}-{int(enabled)}.png');frames.append((counts,np.asarray(im).astype(np.int16)))
   if len(frames)==2:
    (a,pix0),(b,pix1)=frames
    dx=np.max(np.abs(pix0-pix1),axis=2);ups=dx[:85,:64]; assert (dx>2).sum()>40000 and not np.any(ups), (pose,np.sum(dx>2),np.max(ups))
    report[pose]={'compare':a,'detail':b,'pixelsChangedAbove2':int((dx>2).sum()),'topRowStripUnchanged':int(ups.size)}
   else: report[pose]={'detail':frames[0][0]}
  report['distanceTiers']={}
  for pose in ('street','fly'):
   cloudy=pose!='fly'
   threshold=page.evaluate('([p,c])=>portico.render(true,p,c,"auto")',[pose,cloudy]);assert threshold['tier']=='approach'
   pic=page.locator('canvas').screenshot(animations='disabled',type='png',timeout=30000)
   im=Image.open(io.BytesIO(pic)).convert('RGB');im.save(O/f'{pose}-approach.png')
   near=np.asarray(Image.open(O/f'{pose}-1.png').convert('RGB')).astype(np.int16)
   delta=np.max(np.abs(near-np.asarray(im).astype(np.int16)),axis=2)
   report['distanceTiers'][pose]={**threshold,'pixelsDiffAbove2':int((delta>2).sum()),'pixelsDiffAbove16':int((delta>16).sum()),'bgSame':not bool(np.any(delta[:85,:64]))}
   assert report['distanceTiers'][pose]['bgSame'] and (delta>16).sum()<2900
  report['geometry']=page.evaluate('() => portico.inspect()');assert report['geometry']['finite'] and report['geometry']['insideBays'] and report['geometry']['approach'] < report['geometry']['detail']*.45 and report['geometry']['maxStairError'] < 0.0001, report['geometry']
  report['textures']=page.evaluate('''()=>{let max=0,r=0;for(let i=0;i<512;i++)for(let f of ['ashlar','rustic','cut','slate','apron']){let u=(i*389%997)/997,v=(i*431%991)/991;let a=portico.stonePoint(u,v,f),b=portico.stonePoint(u-1,v+2,f);max=Math.max(max,Math.abs(a.height-b.height),...a.color.map((c,k)=>Math.abs(c-b.color[k])));r=Math.max(r,Math.abs(a.rough-b.rough));}return {periodicHeightColor:max,roughness:r};}''')
  assert report['textures']['periodicHeightColor']<1e-11
  assert all(x.startswith(f'http://127.0.0.1:{server.server_port}/') for x in loaded) and not errors,errors
  report['requests']=[x.partition(str(server.server_port))[2] for x in loaded]
  browser.close()
finally: server.shutdown()
(O/'report.json').write_text(json.dumps(report,indent=2)+'\n')
panel=Image.new('RGB',(1096*2,680*2),(29,34,37));
for i,name in enumerate(('street-0','street-1','bay-1','capital-1')): panel.paste(Image.open(O/f'{name}.png'),((i%2)*1096,(i//2)*680))
panel.save(O/'portico-study.webp',quality=91)
print(json.dumps(report,indent=2),flush=True)
