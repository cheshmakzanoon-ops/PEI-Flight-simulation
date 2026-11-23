#!/usr/bin/env python3
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
load=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(load);load.loader.exec_module(fixed)
old=fixed.stage
ATTR='''
 const seatMask=new THREE.ShaderMaterial({side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,uniforms:{gain:{value:0}},vertexShader:`
 #include <common>
 #include <logdepthbuf_pars_vertex>
 attribute float roadSeatDelta;uniform float gain;
 void main(){
   vec3 p=position;
   float dist=length((modelMatrix*vec4(p,1.)).xz-cameraPosition.xz);
   p.y+=roadSeatDelta*gain*(1.-smoothstep(350.,900.,dist));
   gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
   #include <logdepthbuf_vertex>
 }`,fragmentShader:`
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 gl_FragColor=vec4(1.,0.,1.,1.);
 }`});
'''
def stage(repo,root,deps,voi):
 old(repo,root,deps,False)
 p=root/'src/main.ts';src=p.read_text()
 src=fixed.once(src,'const diagnostic=',ATTR+'\n const diagnostic=')
 src=fixed.once(src,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).captureSeats=()=>{
   const r=(roads as any),gain=r.seatGain,m=Array.from(r.visible.values()) as THREE.Mesh[];
   const prior=m.map(q=>q.material);
   const target=gain.value;
   const dra=()=>{renderer.render(scene,camera);return {b64:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};};
   gain.value=0;const base=dra();
   gain.value=target;const fitted=dra();
   gain.value=0;const clean=dra().b64===base.b64;
   m.forEach(q=>q.material=seatMask);const baseMask=dra();
   seatMask.uniforms.gain.value=target;const fittedMask=dra();
   seatMask.uniforms.gain.value=0;
   const shown=m.map(q=>q.visible);m.forEach(q=>q.visible=false);const bare=dra();
   m.forEach((q,i)=>{q.material=prior[i];q.visible=shown[i];});
   gain.value=target;
   let deformed=0,largest=0;
   for(const q of m){
    const buf=q.geometry.getAttribute('roadSeatDelta');
    for(const v of buf.array){if(v)deformed++;largest=Math.max(largest,Math.abs(v));}
   }
   return {base,fitted,baseMask,fittedMask,bare,clean,target,deformed,largest};
  };''')
 p.write_text(src)
fixed.stage=stage
POSES={
 'summerside-curb':dict(lon=-63.7906004765,lat=46.3916149864,east=.825345,south=.564629,dist=23.595,h=3.8,agl=2.9),
 'summerside-low':dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=29,h=0,agl=18),
 'east-point-high':dict(lon=-61.9718333333,lat=46.452527778,east=.91,south=-.415,dist=80,h=19.5,agl=215),
}
def capture(a,browser,url):
 out={}
 for k in a.views.split(','):
  pg=browser.new_page(viewport={'width':864,'height':528});errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  try:
   pg.goto(url+'/?diagnostics&seatedRoads&qa='+quote(json.dumps(POSES[k])),wait_until='domcontentloaded')
   for _ in range(120):
    d,c=pg.evaluate('()=>[window.islandAirDiagnostics,window.reviewCamera?.frame]')
    s=(d or {}).get('seatedRoads',{})
    if errors:raise RuntimeError(errors)
    if (c or 0)>15 and (d or {}).get('roads') and ('high' in k or (s and s['ready']>=1 and s['gain']>.99)):break
    pg.wait_for_timeout(500)
   else:raise RuntimeError((k,d,c))
   rec=pg.evaluate('window.captureSeats()')
   def save(l):
    p=a.out/(k+'-'+l+'.png')
    p.write_bytes(base64.b64decode(rec[l].pop('b64').split(',',1)[1]))
    return np.asarray(Image.open(p))[:,:,:3].astype(int)
   b,f,u,v,back=[save(l) for l in ('base','fitted','baseMask','fittedMask','bare')]
   mask=np.asarray(Image.fromarray(np.uint8(np.any(u!=back,axis=2)|np.any(v!=back,axis=2))*255).filter(ImageFilter.MaxFilter(3)))>0
   dd=np.max(np.abs(b-f),axis=-1)
   rec['pixels']={'n':int(dd.size),'changed':int((dd>0).sum()),'over2':int((dd>2).sum()),'outside':int((dd[~mask]>0).sum()),'max':int(dd.max())}
   assert rec['clean'] and rec['base']==rec['fitted'] and rec['pixels']['outside']==0,rec
   if 'high' in k:assert not rec['target'] and not rec['deformed'] and not dd.max()
   else:assert rec['deformed']>0 and rec['pixels']['over2']>100,rec
   out[k]=rec;print(k,rec,flush=True)
  finally:pg.close()
 (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(POSES));p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
