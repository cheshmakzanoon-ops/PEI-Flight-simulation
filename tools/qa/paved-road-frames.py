#!/usr/bin/env python3
"""Match actual Three.js paved ribbons with the optional photo material on/off."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base=fixed.stage
CAP='''  const pavementMask=new THREE.ShaderMaterial({side:THREE.DoubleSide,depthWrite:true,
    polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
    vertexShader:`
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec2 roadSurface;varying float surfaceKind;
    void main(){surfaceKind=roadSurface.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    #include <logdepthbuf_vertex>
    }`,fragmentShader:`
    #include <common>
    #include <logdepthbuf_pars_fragment>
    varying float surfaceKind;
    void main(){
    #include <logdepthbuf_fragment>
    if(surfaceKind<.22||surfaceKind>=.76)discard;
    gl_FragColor=vec4(1.,0.,1.,1.);}
    `});'''
def stage(repo,root,deps,void):
 base(repo,root,deps,False)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'const diagnostic=',CAP+'\n  const diagnostic=')
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).capturePavedQA=()=>{
   const pave=(roads as any)?.pavement,visible=Array.from(((roads as any)?.visible??new Map()).values()) as THREE.Mesh[];
   if(!pave||!visible.length)throw Error('No active road ribbons');
   const draw=()=>{renderer.render(scene,camera);return {blob:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   const gain=pave.uniforms.roadPaveBlend.value;
   pave.uniforms.roadPaveBlend.value=0;
   const baseline=draw();pave.uniforms.roadPaveBlend.value=gain>0?1:0;
   const candidate=draw();pave.uniforms.roadPaveBlend.value=0;
   const restored=draw().blob===baseline.blob;
   const cons=visible.map(m=>m.material);visible.forEach(m=>m.material=pavementMask);
   const mask=draw();visible.forEach((m,i)=>m.material=cons[i]);pave.uniforms.roadPaveBlend.value=gain;
   return {baseline,candidate,mask,restored,gain};
  };''')
 p.write_text(s)
fixed.stage=stage
POSES={
 'summerside-curb':dict(lon=-63.7906004765,lat=46.3916149864,east=.825345,south=.564629,dist=23.595,h=3.8,agl=2.9),
 'summerside-low':dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=29,h=0,agl=18),
 'country-paved':dict(lon=-63.517509,lat=46.490633,east=.51,south=-.86,dist=39,h=0,agl=8),
 'inland-dirt':dict(lon=-63.62936,lat=46.33953,dist=105,east=.67,south=.74,h=0,agl=13),
 'east-point-control':dict(lon=-61.9718333333,lat=46.452527778,east=.91,south=-.415,dist=80,h=19.5,agl=215),
}
def capture(a,browser,url):
 result={}
 for name in a.views.split(','):
  ctx=browser.new_context(viewport={'width':900,'height':550},device_scale_factor=1)
  try:
   pg=ctx.new_page();errors=[];requests=[]
   pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' and not (a.fault and '404' in e.text) else None)
   if a.fault:
    pg.route('**/art/pavement/asphalt_07.webp',lambda r:r.fulfill(status=404,body=''))
   pg.on('request',lambda e:requests.append(e.url.split('/')[-1]) if '/art/pavement/' in e.url else None)
   pose=POSES[name]
   pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   for _ in range(140):
    d=pg.evaluate('()=>[window.islandAirDiagnostics,window.reviewCamera?.frame]')
    if errors:raise RuntimeError(errors)
    if d[0] and (d[1] or 0)>14 and d[0]['roads'] and (name.endswith('control') or d[0]['pavement']==('failed' if a.fault else 'ready')):
     break
    pg.wait_for_timeout(500)
   else:raise RuntimeError(d)
   pieces=pg.evaluate('window.capturePavedQA()')
   def copy(k):
    obj=pieces[k];raw=base64.b64decode(obj.pop('blob').split(',',1)[1])
    p=a.out/(name+'-'+k+'.png');p.write_bytes(raw);return np.asarray(Image.open(p))[:,:,:3].astype(int)
   before,after,mask=[copy(k) for k in ('baseline','candidate','mask')]
   from PIL import ImageFilter
   delta=np.max(np.abs(before-after),axis=-1)
   eligible0=(mask[:,:,0]>92)&(mask[:,:,1]<140)&(mask[:,:,2]>92)&((mask[:,:,0]-mask[:,:,1])>80)&((mask[:,:,2]-mask[:,:,1])>80)
   eligible=np.asarray(Image.fromarray(np.uint8(eligible0)*255).filter(ImageFilter.MaxFilter(3)))>0
   assert pieces['restored'] and (pieces['baseline']['draws'],pieces['baseline']['tris'])==(pieces['candidate']['draws'],pieces['candidate']['tris']),pieces
   outside=int((delta[~eligible]>0).sum());assert outside==0,outside
   if name.endswith('control'):assert not np.any(delta) and not requests
   if a.fault:assert not np.any(delta) and len(requests)==2
   if name=='summerside-curb' and not a.fault:assert (delta>2).sum()>1500
   pieces['pixels']={'seen':int(eligible0.sum()),'changed':int((delta>0).sum()),'over2':int((delta>2).sum()),'over7':int((delta>7).sum()),'maximum':int(delta.max()),'unadmittedChanges':outside,'n':int(delta.size)}
   pieces['resources']=requests
   result[name]=pieces
   print(name,pieces,flush=True)
  finally:
   ctx.close()
 (a.out/'report.json').write_text(json.dumps(result,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--fault',action='store_true');p.add_argument('--views',default='summerside-curb,summerside-low,east-point-control');p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
