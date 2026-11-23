#!/usr/bin/env python3
"""Static A/B previews in the actual vanilla Three.js terrain and atmosphere."""
import argparse,base64,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed)
original=fixed.stage
def stage(repo,tmp,deps,_):
 original(repo,tmp,deps,False)
 p=tmp/'src/main.ts'
 s=p.read_text().replace('northCape?.update(camera.position,time);','northCape?.update(camera.position,18.7);')
 a='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,a,a+'''
  (window as any).capeQA=()=>{
   if(!northCape)throw Error('Missing North Cape');
   const state=northCape.root.visible;
   const pins=world.capeShadow?.data??[];
   const w=pins.map(pin=>pin.w);
   const snap=()=>{renderer.render(scene,camera);return {png:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   const receipt={counts:{...northCape.counts},camera:camera.position.toArray(),before:null as any,after:snap(),unshaded:null as any,exact:false};
   pins.forEach(pin=>pin.w=0);
   receipt.unshaded=snap();
   northCape.root.visible=false;receipt.before=snap();
   northCape.root.visible=state;pins.forEach((pin,i)=>pin.w=w[i]);
   receipt.exact=receipt.after.png===snap().png;
   return receipt;
  };
 '''))
fixed.stage=stage
P={
 'north-cape-close':dict(lon=-63.9945475,lat=47.0543426,dist=118,east=-.74,south=-.69,h=68,agl=31),
 'north-cape-near':dict(lon=-64.003975,lat=47.0502983,dist=460,east=-.54,south=.83,h=60,agl=119),
 'north-cape-cruise':dict(lon=-64.003975,lat=47.0502983,dist=1530,east=.33,south=-.94,h=40,agl=310),
 'queens-control':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=8,agl=150),
}
def locked(checkout,k):
 raw=json.loads((checkout/'data/north-cape/reference-poses.json').read_text())[k]
 lon,lat=raw['aimLL'];eyeLon,eyeLat=raw['eyeLL']
 a=6378137;e2=6.69437999014e-3;phi=math.radians(46.5);t=1-e2*math.sin(phi)**2
 scale=a*math.pi/180;east=(eyeLon-lon)*scale*math.cos(phi)/math.sqrt(t);south=(lat-eyeLat)*scale*(1-e2)/t**1.5
 return dict(lon=lon,lat=lat,dist=math.hypot(east,south),east=east,south=south,h=0,
             agl=0,fixedEyeY=raw['y'],fixedBaseH=raw['aimY'])
def capture(args,browser,url):
 for k,v in [('north-cape-cinematic','cinematicSeawardN'),('north-cape-reciprocal','cinematicReciprocalS')]:P[k]=locked(args.checkout,v)
 out={}
 for name in args.views.split(','):
  pg=browser.new_page(viewport={'width':930,'height':610});errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  pg.set_default_timeout(125000)
  pg.goto(url+'/?diagnostics&northCapeWind&qa='+quote(json.dumps(P[name])),wait_until='domcontentloaded')
  state=fixed.settle(pg,errors)
  x=pg.evaluate('window.capeQA()')
  for k in ('before','after','unshaded'):(args.out/(name+'-'+k+'.png')).write_bytes(base64.b64decode(x[k].pop('png').split(',')[1]))
  b,c=[np.asarray(Image.open(args.out/(name+'-'+k+'.png')).convert('RGB')).astype(int) for k in ('before','after')]
  d=np.max(np.abs(b-c),axis=2)
  u=np.asarray(Image.open(args.out/(name+'-unshaded.png')).convert('RGB')).astype(int)
  x['pixels']={'over2':int((d>2).sum()),'max':int(d.max()),'shadowOnlyOver2':int((np.max(np.abs(c-u),axis=2)>2).sum())}
  x['errors']=errors
  assert x['exact'] and not errors,x
  if 'control' in name:assert x['pixels']['max']==0 and x['after']==x['before'],x
  else: assert x['counts']['registered']==16 and x['after']['draws']-x['before']['draws']<=4 and x['pixels']['over2']>0,x
  out[name]=x;print(name,x,flush=True);pg.close()
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default='north-cape-close,north-cape-cinematic,north-cape-reciprocal,queens-control');p.add_argument('--checkout',type=Path,default=Path.cwd());p.add_argument('--deps',type=Path);args=p.parse_args()
args.pose_baseline=None;args.void_probe=False
fixed.run(args)
