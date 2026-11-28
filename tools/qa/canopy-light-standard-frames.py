#!/usr/bin/env python3
"""Same-tab original atlas silhouette and coherent light comparison."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed)
prep=fixed.stage
def stage(repo,tmp,deps,_):
 prep(repo,tmp,deps,False)
 p=tmp/'src/render/stock-crown-program.ts';s=p.read_text()
 a="const daylightFragment='varying vec3 cardSun;\\n'+crownF.replace"
 assert s.count(a)==1
 s=s.replace(a,"const daylightFragment='uniform float qaCrownMode; varying vec3 cardSun;\\n'+crownF.replace")
 a='gl_FragColor=vec4(lit,'
 assert s.count(a)==1
 s=s.replace(a,"gl_FragColor=vec4(qaCrownMode>2.5?vec3(0.,1.,0.):qaCrownMode>1.5?vec3(1.,0.,1.):mix(c*param.z,lit,qaCrownMode),")
 p.write_text(s)
 p=tmp/'src/render/vegetation.ts'
 p.write_text(fixed.once(p.read_text(),'...(canopySun?{canopySun:{value:canopySun}}:{})',
  '...(canopySun?{canopySun:{value:canopySun},qaCrownMode:{value:1}}:{})'))
 p=tmp/'src/main.ts'
 s=p.read_text()
 p.write_text(fixed.after_world_paint(s,'''
  (window as any).canopyFrame=()=>{
   const mesh=scene.getObjectByName('Mixed woodland canopies') as THREE.Mesh;
   const material=mesh.material as THREE.ShaderMaterial,u=material.uniforms.qaCrownMode;
   const d=(n:number)=>{u.value=n;renderer.render(scene,camera);return {png:renderer.domElement.toDataURL(),
           draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
   const before=d(0),after=d(1),maskA=d(2),maskB=d(3);
   const exact=before.png===d(0).png;u.value=1;
   return {before,after,maskA,maskB,exact};
  };
 '''))
fixed.stage=stage
poses={
 'queens-understory':dict(lon=-63.373,lat=46.400,dist=24,east=.53,south=.85,h=0,agl=12),
 'prince-needle':dict(lon=-64.238,lat=46.674,dist=29,east=.53,south=.85,h=0,agl=16),
 'kings-native':dict(lon=-62.169,lat=46.414,dist=125,east=.53,south=.85,fixedBaseH=49,fixedEyeY=76,h=0,agl=0),
}
def capture(a,browser,url):
  result={}
  targets=[a.view] if a.view else list(poses)
  for name in targets:
   pose=poses[name]
   page=browser.new_page(viewport={'width':680,'height':428});errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
   page.goto(url+'/?diagnostics'+('&woodland3D&canopyLight' if a.volume else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   if a.volume:page.wait_for_function('()=>window.islandAirDiagnostics?.woodlandVolume>0',timeout=125000)
   live=fixed.settle(page,errors)
   res=page.evaluate('window.canopyFrame()')
   def load(k):
    p=a.out/f'{name}-{k}.png';p.write_bytes(base64.b64decode(res[k].pop('png').split(',',1)[1]));return np.array(Image.open(p),dtype=np.int16)[:,:,:3]
   assert live['canopyLight'],live
   x,y,z,w=[load(k)for k in ('before','after','maskA','maskB')]
   marker=np.any(z!=w,axis=2)
   allowed=np.asarray(Image.fromarray(np.uint8(marker)*255).filter(ImageFilter.MaxFilter(3)))>0
   delta=np.max(abs(x-y),axis=2)
   data={'view':name,'volumes':live['woodlandVolume'],'groundedShadows':live['woodlandGroundedShadows'],'localRenderer':live['detail'],'stats':res,'markedCrownPixels':int(marker.sum()),
     'changedAboveTwo':int((delta>2).sum()),'offCrownAndAAAllowance':int((delta[~allowed]>0).sum()),'outsideComplementaryMaskPixels':int((~marker).sum()),'outsideComplementaryMaskRGBChanges':int((delta[~marker]>0).sum()),'errors':errors}
   assert res['exact'] and (res['before']==res['after']) and not errors
   assert data['changedAboveTwo']>100 and data['outsideComplementaryMaskRGBChanges']==0,data
   result[name]=data;print(data,flush=True)
   (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
   page.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--view',choices=list(poses));p.add_argument('--volume',action='store_true');args=p.parse_args()
args.checkout=Path.cwd();args.deps=args.pose_baseline=None;args.void_probe=False
fixed.run(args)
