#!/usr/bin/env python3
"""Independent atomic frames for the provisional CYYG 10/28 surface."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
from scipy.ndimage import binary_dilation
p=argparse.ArgumentParser(description=__doc__)
for k in ('checkout','out','deps','chromium'):p.add_argument('--'+k,required=True,type=Path if k!='chromium' else str)
p.add_argument('--views',default='near28,control03,summerside05,high');p.set_defaults(void_probe=False)
args=p.parse_args()
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fx=importlib.util.module_from_spec(sp);sp.loader.exec_module(fx)
origin=fx.stage
def stage(repo,root,deps,void):
 origin(repo,root,deps,void)
 shader=root/'src/render/runway-finish.ts';s=shader.read_text()
 s=fx.once(s,'vec3 cyygPaving(', 'uniform float qaRunwayGain;uniform float qaRunwayMask;\nvec3 cyygPaving(')
 s=fx.once(s,'if(max(paint.r,', 'if(qaRunwayGain<.1||max(paint.r,')
 shader.write_text(s)
 f=root/'src/render/world.ts';s=f.read_text()
 s=fx.once(s,'   if(i==${CYYG_FINISH_INDEX}){','''   if(i==${CYYG_FINISH_INDEX}){
    if(qaRunwayMask>.5&&(qaRunwayMask<1.5||max(paint.r,max(paint.g,paint.b))>.0620)){gl_FragColor=vec4(1.,0.,1.,1.);return;}
 ''')
 f.write_text(s)
 f=root/'src/main.ts';s=f.read_text()
 a='  renderer.render(scene,camera);'
 f.write_text(fx.once(s,a,'''
  const ua=(window as any).runwayGainUniform??=((window as any).runwayGainUniform={value:0});
  const ma=(window as any).runwayMaskUniform??=((window as any).runwayMaskUniform={value:0});
  const bind=()=>{const list:THREE.ShaderMaterial[]=[];
   scene.traverseVisible(o=>{
    if(o instanceof THREE.Mesh&&o.material instanceof THREE.ShaderMaterial&&o.material.fragmentShader.includes('qaRunwayGain')){
     o.material.uniforms.qaRunwayGain=ua;o.material.uniforms.qaRunwayMask=ma;list.push(o.material);
    }
   });return list;
  };
  bind();
  renderer.render(scene,camera);
  (window as any).runwaySurfaceFrames=()=>{
    const mats=bind(), shots={};
    try{
     for(const [key,gain,mask] of [['stock',0,0],['active',1,0],['mask',0,1],['marks',0,2],['stockAgain',0,0]] as const){
      ua.value=gain;ma.value=mask;
      for(const m of mats)m.uniformsNeedUpdate=true;
      renderer.render(scene,camera);
      shots[key]={pic:renderer.domElement.toDataURL(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
     }
     ua.value=1;ma.value=0;
     const restore=camera.position.clone();
     try{
      camera.position.x+=.017;camera.position.z+=.009;camera.updateMatrixWorld(true);
      for(const m of mats)m.uniformsNeedUpdate=true;
      renderer.render(scene,camera);
      shots.motion={pic:renderer.domElement.toDataURL(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
     }finally{camera.position.copy(restore);camera.updateMatrixWorld(true);}
    }finally{ua.value=ma.value=0;}
    return shots;
  };
 '''))
fx.stage=stage
def capture(a,browser,url):
 pose={
  'near28':dict(lon=-63.110173042756934,lat=46.29643757486046,dist=87,agl=4.2,h=0,
               east=.9680384740,south=-.2603872363),
  'control03':dict(lon=-63.12522470598626,lat=46.28947140052539,dist=80,agl=3.7,h=0,
               east=.0895706199,south=-.9984373310),
  'summerside05':dict(lon=-63.83624431298212,lat=46.43767372198485,dist=80,agl=4.8,h=0,
               east=.5283883420,south=-.8518836541),
  'high':dict(lon=-63.1153282,lat=46.2957423,dist=390,east=.12,south=.99277,fixedBaseH=43,
              fixedEyeY=1950,h=0,agl=0),
 }
 report={}
 for key in a.views.split(','):
  page=browser.new_page(viewport={'width':1024,'height':640});err=[]
  page.on('pageerror',lambda e:err.append(str(e)));page.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
  page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose[key])),wait_until='domcontentloaded')
  page.wait_for_function('window.runwaySurfaceFrames&&window.reviewCamera?.frame>22&&window.islandAirDiagnostics?.mainland&&window.islandAirDiagnostics?.detail?.ready>0',timeout=140000)
  got=page.evaluate('window.runwaySurfaceFrames()'); diag=page.evaluate('window.islandAirDiagnostics')
  assert not err and not diag['layerWarnings'],(err,diag['layerWarnings'])
  images={}
  for n,o in got.items():
   f=a.out/f'{key}-{n}.png';f.write_bytes(base64.b64decode(o.pop('pic').split(',',1)[1]));images[n]=np.asarray(Image.open(f).convert('RGB'),dtype=np.int16)
  delta=abs(images['stock']-images['active']).max(2)
  m=images['mask'];pure=(m[:,:,0]>220)&(m[:,:,1]<15)&(m[:,:,2]>220)
  tint=m-images['stock']
  partial=(tint[:,:,0]>5)&(tint[:,:,1]<-4)&(tint[:,:,2]>6)
  scope=binary_dilation(pure|partial,iterations=3)
  assert np.array_equal(images['stock'],images['stockAgain']) and got['stock']==got['active'],got
  report[key]={'changed':int(np.count_nonzero(delta)), 'over2':int(np.count_nonzero(delta>2)),
   'outside':int(np.count_nonzero((delta>2)&~scope)),'max':int(delta.max()),'scope':int(np.count_nonzero(scope)),**got['stock']}
  if key=='near28':
   from scipy.ndimage import binary_erosion
   mark=images['marks'];protected=(mark[:,:,0]>220)&(mark[:,:,1]<15)&(mark[:,:,2]>220)
   report[key]['paintPixels']=int(np.count_nonzero(protected))
   report[key]['paintTouched']=int(np.count_nonzero((delta>0)&protected))
   solid=binary_erosion(pure,iterations=4)&~binary_dilation(protected,iterations=4)
   values=abs(images['active']-images['motion']).max(2)[solid]
   report[key]['motionP99']=float(np.percentile(values,99));report[key]['motionPixels']=int(values.size)
  r=report[key]
  assert not r['outside'],r
  if key=='near28':assert r['over2']>1500 and r['paintPixels']>100 and r['paintTouched']==0 and r['motionP99']<=6,r
  if key=='high':assert not r['changed'] and r['scope']>500,r
  if key in ('control03','summerside05'):assert not r['changed'],r
  print(key,r,flush=True)
  (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  page.close()
fx.capture=capture
fx.run(args)
