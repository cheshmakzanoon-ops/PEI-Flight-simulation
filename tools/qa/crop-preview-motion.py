import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
spec=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
orig=fixed.stage
def stage(repo,tmp,deps,_):
 orig(repo,tmp,deps,False)
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,a,a+'''
  (window as any).cropMotion=(dist:number)=>{qa.dist=dist;return (window as any).reviewCamera.frame+2;};
  (window as any).cropQA=()=>{
   const v=world.fieldPilot?.strength;
   if(!v)return;
   const draw=()=>{renderer.render(scene,camera);return {b64:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   v.value=0;const before=draw();v.value=1;const after=draw();v.value=-1;const mask=draw();
   v.value=0;const exact=before.b64===draw().b64;v.value=1;
   return {before,after,mask,exact,camera:camera.position.toArray()};
  };
 '''))
fixed.stage=stage
P={
 'prince':dict(lon=-63.87186370,lat=46.45305911,dist=73,east=.49,south=.87,h=10,agl=32),
 'queens':dict(lon=-63.50647740,lat=46.36342343,dist=58,east=-.73,south=.68,h=10,agl=39),
 'kings':dict(lon=-62.36842309,lat=46.34532357,dist=43,east=-.64,south=-.77,h=6,agl=28),
 'queens-high':dict(lon=-63.50647740,lat=46.36342343,dist=95,east=-.73,south=.68,h=10,agl=365)
}
def capture(args,browser,url):
 q=P['queens'];q['dist']=60
 pg=browser.new_page(viewport={'width':690,'height':438});errors=[]
 pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
 pg.set_default_timeout(150000)
 pg.goto(url+'/?diagnostics&cropRowsReview&qa='+quote(json.dumps(q)),wait_until='domcontentloaded')
 pg.wait_for_function('()=>window.reviewCamera?.frame>12 && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0')
 result=[]
 for index,d in enumerate((60.,60.25,60.51,60.76,61.01,61.27)):
  target=pg.evaluate('v=>window.cropMotion(v)',d)
  pg.wait_for_function('n=>window.reviewCamera?.frame>=n',arg=target)
  x=pg.evaluate('window.cropQA()');a=[]
  for label in ('before','after','mask'):
   path=args.out/(f'{index}-{label}.png')
   path.write_bytes(base64.b64decode(x[label].pop('b64').split(',',1)[1]))
   a.append(np.asarray(Image.open(path).convert('RGB')).astype(int))
  b,c,m=a
  potential=np.asarray(Image.fromarray(np.uint8(np.any(m!=b,axis=2))*255).filter(ImageFilter.MaxFilter(3)))>0
  delta=np.max(np.abs(b-c),axis=2)
  assert x['exact'] and x['before']==x['after'] and not errors and not np.any(delta[~potential]>0),x
  result.append({'distance':d,'over2':int((delta>2).sum()),'maximumChannelDelta':int(delta.max()),'protectedRGBPixels':int((~potential).sum()),'drawCalls':x['after']['draws']})
 print(json.dumps(result,indent=2),flush=True)
 (args.out/'motion-proof.json').write_text(json.dumps(result,indent=2)+'\n')
 pg.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--checkout',type=Path,default=Path.cwd());p.add_argument('--deps',type=Path);args=p.parse_args()
args.pose_baseline=None;args.void_probe=False;args.size='690x438'
fixed.run(args)
