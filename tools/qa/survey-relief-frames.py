#!/usr/bin/env python3
"""Matched 3D before/after renders from exact province atlas data; scratch-only QA."""
import argparse,base64,gzip,hashlib,importlib.util,json,os,time
from urllib.parse import quote
from pathlib import Path
from PIL import Image
import numpy as np
spec=importlib.util.spec_from_file_location('fixed', Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
base_stage=fixed.stage
def stage(repo,root,deps,void_probe):
    base_stage(repo,root,deps,void_probe)
    p=root/'src/main.ts'
    src=p.read_text()
    prepend='''import {adaptiveGround} from './render/adaptive-ground.ts';
import {ReliefSeed} from './sim/relief-seed.ts';
'''
    src=prepend+src
    src=fixed.once(src,'const diagnostic=', '''const seedJob=fetch(import.meta.env.BASE_URL+'world/qa-relief/'+qa.tile+'.bin')
       .then(r=>{if(!r.ok)throw Error('Could not get QA terrain seed');return r.arrayBuffer();}).then(b=>new ReliefSeed(b));
      let seed:ReliefSeed|undefined;void seedJob.then(s=>seed=s);
      const diagnostic=''')
    src=fixed.once(src,'\n  renderer.render(scene,camera);','''   renderer.render(scene,camera);
    (window as any).geometryQA=!!seed&&!!(world as any).byId.get(qa.tile)?.fine&&(world as any).byId.get(qa.tile).lod===112;
    (window as any).captureRelief=()=>{
      const tile=(world as any).byId.get(qa.tile);
      if(!seed||!tile?.fine||tile.lod!==112)throw Error('No near terrain or measured seed');
      const old=tile.fine.geometry;
      const replacement=adaptiveGround(old,seed,terrain,tile.x0,tile.z0,tile.w,tile.d);
      const at=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};};
      const baseline=at();
      tile.fine.geometry=replacement.geometry;const measured=at();
      tile.fine.geometry=old;const restored=at();replacement.geometry.dispose();
      return {baseline,measured,restored:restored.image===baseline.image,refined:replacement.relief.refinedCells};
    };''')
    p.write_text(src)
fixed.stage=stage
POSES={
 'kensington-hills':dict(lon=-63.5320285,lat=46.514586,tile='11-11',dist=143,east=.68,south=-.72,h=0,agl=28),
 'bonshaw-valley':dict(lon=-63.3867439,lat=46.2382386,tile='13-16',dist=151,east=-.8,south=-.6,h=0,agl=32),
 'east-county-hills':dict(lon=-62.7170173,lat=46.0004951,tile='22-20',dist=174,east=.61,south=.795,h=0,agl=34),
}
def decode_fixture(repo,tile):
 spec=repo/'public/world/terrain-adaptive/v1'
 meta=json.loads((spec/'index.json').read_text())
 t=next(t for t in meta['tiles'] if t['id']==tile)
 body=(spec/meta['packs'][t['pack']]['file']).read_bytes()[t['offset']:t['offset']+t['bytes']]
 assert hashlib.sha256(body).hexdigest()==t['archiveSha256']
 raw=gzip.decompress(body)
 assert hashlib.sha256(raw).hexdigest()==t['sha256']
 q=np.cumsum(np.frombuffer(raw[1568:],'<i2').reshape(385,385),axis=1,dtype=np.int64).astype('<i2')
 return raw[:1568]+q.tobytes()
def capture(args,browser,url):
 results={}
 for name in args.views.split(','):
  pose=POSES[name];ctx=browser.new_context(viewport={'width':864,'height':528},device_scale_factor=1)
  try:
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   dummy=decode_fixture(args.checkout,pose['tile'])
   page.route('**/qa-relief/*.bin',lambda r:r.fulfill(status=200,content_type='application/octet-stream',body=dummy))
   page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   for k in range(90):
    status=page.evaluate('()=>[window.geometryQA,window.reviewCamera,window.islandAirDiagnostics]')
    qa,cam,d=status
    if errors:raise RuntimeError(errors)
    if qa and (cam or {}).get('frame',0)>16 and (d or {}).get('detail',{}).get('ready',0)>0:break
    page.wait_for_timeout(500)
   else: raise RuntimeError(status)
   data=page.evaluate('window.captureRelief()')
   def output(variant):
    obj=data[variant];raw=base64.b64decode(obj.pop('image').split(',',1)[1])
    f=args.out/(name+'-'+variant+'.png');f.write_bytes(raw);return np.asarray(Image.open(f))[:,:,:3].astype(int)
   before=output('baseline');after=output('measured');delta=np.max(np.abs(before-after),axis=2)
   assert data['restored'] and data['baseline']['calls']==data['measured']['calls'],data
   data['pixels']={'changed':int((delta>0).sum()),'over2':int((delta>2).sum()),'over8':int((delta>8).sum()),'max':int(delta.max())}
   results[name]=data
   print(name,data,flush=True)
  finally:ctx.close()
 (args.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(POSES));p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
