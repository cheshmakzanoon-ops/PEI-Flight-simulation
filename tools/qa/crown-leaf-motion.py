#!/usr/bin/env python3
"""Same-tab original atlas silhouette and close leaf finish comparison."""
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
 p=tmp/'src/render/vegetation.ts';s=p.read_text()
 a="const daylightFragment='varying vec3 cardSun;"
 assert s.count(a)==1
 s=s.replace(a,"const daylightFragment='uniform float qaCrownMode; varying vec3 cardSun;")
 s=fixed.once(s,"'c=crownLeafFinish(", "'if(qaCrownMode>0.5)c=crownLeafFinish(")
 s=fixed.once(s,'gl_FragColor=vec4(lit,','gl_FragColor=vec4(qaCrownMode>2.5?vec3(0.,1.,0.):qaCrownMode>1.5?vec3(1.,0.,1.):lit,')
 s=s.replace('...(canopySun?{canopySun:{value:canopySun}}:{})','...(canopySun?{canopySun:{value:canopySun},qaCrownMode:{value:1}}:{})')
 p.write_text(s)
 p=tmp/'src/main.ts'
 s=p.read_text()
 anchor='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,anchor,anchor+'''
  (window as any).canopyFrame=()=>{
   const mesh=scene.getObjectByName('Mixed woodland canopies') as THREE.Mesh;
   const material=mesh.material as THREE.ShaderMaterial,u=material.uniforms.qaCrownMode;
   const d=(n:number)=>{u.value=n;renderer.render(scene,camera);return {png:renderer.domElement.toDataURL(),
           draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
   const real=camera.position.clone();
   const result=[0,.004,.008,.012,.016].map(east=>{
     camera.position.x=real.x+east;camera.updateMatrixWorld();
     return {before:d(0),after:d(1),maskA:d(2),maskB:d(3)};
   });
   camera.position.copy(real);camera.updateMatrixWorld();u.value=1;
   return result;
  };
 '''))
fixed.stage=stage
poses={
 'queens-understory':dict(lon=-63.373,lat=46.400,dist=24,east=.53,south=.85,h=0,agl=12),
 'prince-needle':dict(lon=-64.238,lat=46.674,dist=29,east=.53,south=.85,h=0,agl=16),
 'kings-native':dict(lon=-62.169,lat=46.414,dist=125,east=.53,south=.85,fixedBaseH=49,fixedEyeY=76,h=0,agl=0),
 'queens-far':dict(lon=-63.373,lat=46.400,dist=470,east=.53,south=.85,h=0,agl=280),
 'charlottetown':dict(lon=-63.1233501012,lat=46.2419428722,east=.7339666,south=-.6791855,dist=18,h=0,agl=11),
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
   samples=[]; row=dict(view=name,volumes=live['woodlandVolume'],samples=[],errors=errors)
   for i,res in enumerate(page.evaluate('window.canopyFrame()')):
    def load(k):
     p=a.out/f'{name}-{i}-{k}.png'
     p.write_bytes(base64.b64decode(res[k].pop('png').split(',',1)[1]))
     return np.array(Image.open(p),dtype=np.int16)[:,:,:3]
    assert live['canopyLight'],live
    before,after,id_a,id_b=[load(k) for k in ('before','after','maskA','maskB')]
    full=np.max(np.abs(id_a-id_b),axis=2)>149
    any_hit=np.any(id_a!=id_b,axis=2)
    signed=after-before
    delta=np.max(abs(signed),axis=2)
    assert res['before']==res['after'] and not errors and not delta[~any_hit].any(),row
    row['samples'].append(dict(draw=res['after'],countAboveTwo=int((delta>2).sum()),outsideChanges=int((delta[~any_hit]>0).sum())))
    samples.append((signed,full))
   motion=np.concatenate([np.max(np.abs(b-a),axis=2)[u&v] for ((a,u),(b,v)) in zip(samples,samples[1:])])
   row.update(motionCount=len(motion),motionP99=float(np.quantile(motion,.99)) if len(motion) else 0.)
   assert row['motionP99']<=6.,row
   result[name]=row;print(row,flush=True)
   (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
   page.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--view',choices=list(poses));p.add_argument('--volume',action='store_true');args=p.parse_args()
args.checkout=Path.cwd();args.deps=args.pose_baseline=None;args.void_probe=False
fixed.run(args)
