#!/usr/bin/env python3
"""Independent atomic frames for the provisional East Point stone shading."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
from scipy.ndimage import binary_dilation
p=argparse.ArgumentParser(description=__doc__)
for k in ('checkout','out','deps','chromium'):p.add_argument('--'+k,required=True,type=Path if k!='chromium' else str)
p.add_argument('--views',default='face,reveal,west');p.set_defaults(void_probe=False)
args=p.parse_args()
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fx=importlib.util.module_from_spec(sp);sp.loader.exec_module(fx)
origin=fx.stage
def stage(repo,root,deps,void):
 origin(repo,root,deps,void)
 shader=root/'src/render/east-sandstone.ts';s=shader.read_text()
 s=fx.once(s,' float eastStoneLight(', ' uniform float qaEastRelief;uniform float qaEastMask;\n float eastStoneLight(')
 s=fx.once(s,'if(large<.001)return base;', 'if(large<.001||qaEastRelief<.1)return base;')
 if 'if(contact>.001)' in s:s=fx.once(s,'if(contact>.001)', 'if(contact>.001&&qaEastRelief>.5)')
 shader.write_text(s)
 f=root/'src/render/world.ts';s=f.read_text()
 s=fx.once(s,' if(eastCover>.001){\n  if(dot(face,',' if(eastCover>.001){\n  if(qaEastMask>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}\n  if(dot(face,')
 s=fx.once(s,' if(eastCover>.001){\n  col=mix',' if(eastCover>.001){\n  if(qaEastMask>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}\n  col=mix')
 f.write_text(s)
 f=root/'src/main.ts';s=f.read_text()
 a='  renderer.render(scene,camera);'
 f.write_text(fx.once(s,a,'''
  const ua=(window as any).rockUniform??=((window as any).rockUniform={value:0});
  const ma=(window as any).rockMask??=((window as any).rockMask={value:0});
  const bind=()=>{const list:THREE.ShaderMaterial[]=[];
   scene.traverseVisible(o=>{
    if(o instanceof THREE.Mesh&&o.material instanceof THREE.ShaderMaterial&&o.material.fragmentShader.includes('qaEastRelief')){
     o.material.uniforms.qaEastRelief=ua;o.material.uniforms.qaEastMask=ma;list.push(o.material);
    }
   });return list;
  };
  bind();
  renderer.render(scene,camera);
  (window as any).rockFrames=()=>{
    const mats=bind(), shots={};
    try{
     for(const [key,gain,mask] of [['stock',0,0],['active',1,0],['mask',0,1],['stockAgain',0,0]] as const){
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
 corner=dict(lon=-61.97195911804511,lat=46.451417608605276,h=0,fixedBaseH=7.5,agl=0)
 pose={
  'face':dict(corner,dist=52,fixedEyeY=7.2,east=.96,south=.28),
  'reveal':dict(corner,dist=72,fixedEyeY=42,east=.72,south=.69),
  'far':dict(corner,dist=1060,fixedEyeY=150,east=.96,south=.28),
  'west':dict(fx.VIEWS['west'],dist=125,agl=45,fixedEyeY=45,fixedBaseH=1.79),
 }
 report={}
 for key in a.views.split(','):
  page=browser.new_page(viewport={'width':1024,'height':640});err=[]
  page.on('pageerror',lambda e:err.append(str(e)));page.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
  page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose[key])),wait_until='domcontentloaded')
  page.wait_for_function('window.rockFrames&&window.reviewCamera?.frame>22&&window.islandAirDiagnostics?.mainland&&window.islandAirDiagnostics?.detail?.ready>0',timeout=140000)
  got=page.evaluate('window.rockFrames()'); diag=page.evaluate('window.islandAirDiagnostics')
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
  if key=='face':
   # Erode the stable stone mask so the moving cliff silhouette is not
   # counted as material shimmer.
   from scipy.ndimage import binary_erosion
   solid=binary_erosion((m[:,:,0]>220)&(m[:,:,1]<15)&(m[:,:,2]>220),iterations=4)
   values=abs(images['active']-images['motion']).max(2)[solid]
   report[key]['motionP99']=float(np.percentile(values,99));report[key]['motionPixels']=int(values.size)
  r=report[key]
  assert not r['outside'],r
  if key in ('face','reveal'):assert r['over2']>10000,r
  if key=='west':assert not r['changed'] and not r['scope'],r
  if key=='far':assert not r['changed'] and r['scope']>500,r
  print(key,r,flush=True)
  (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
  page.close()
fx.capture=capture
fx.run(args)
