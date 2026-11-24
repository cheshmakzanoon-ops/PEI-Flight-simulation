#!/usr/bin/env python3
"""Matched Three.js bark scan and legacy material on the same tree scene."""
import argparse,base64,importlib.util,json
from pathlib import Path
from io import BytesIO
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base_stage=fixed.stage
def stage(repo,root,deps,void):
 base_stage(repo,root,deps,void)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
          const wc=projectSite(qp.lon,qp.lat),wn=Math.hypot(qp.east,qp.south);
          const startPoint={x:wc.x+qp.dist*qp.east/wn,z:wc.z+qp.dist*qp.south/wn},warmForest=''')
 s=fixed.once(s,'\n  renderer.render(scene,camera);',"""
  renderer.render(scene,camera);
  (window as any).barkPreviewGain=(vegetation as any).volume?.barkGain?.value;
  (window as any).captureWoodlandVolume=()=>{
   const volume=(vegetation as any).volume;
   const groups=volume.groups,original=groups.map(g=>g.mesh.material);
   const info=()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles});
   const snap=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),...info()};};
   const probes=original.map(mat=>new THREE.ShaderMaterial({vertexShader:mat.vertexShader,fragmentShader:`
      varying vec2 fDetail;varying float fFade;
      #include <logdepthbuf_pars_fragment>
      void main(){
       #include <logdepthbuf_fragment>
       if(fFade<.003||fDetail.x>.5)discard;
       gl_FragColor=vec4(1.,0.,1.,fFade);
      }`,side:THREE.DoubleSide,alphaToCoverage:true,uniforms:mat.uniforms,defines:mat.defines}));
   const gain=volume.barkGain.value;const after=snap();
   volume.barkGain.value=0;const before=snap();volume.barkGain.value=gain;
   const meshes=new Set(groups.map(g=>g.mesh)),nodes=scene.children.map(m=>[m,m.visible]);
   const background=scene.background;scene.background=new THREE.Color(0);
   for(const [m] of nodes)if(!meshes.has(m))m.visible=false;
   for(const [i,g] of groups.entries())g.mesh.material=probes[i];
   const bare=snap();
   for(const [m,visible] of nodes)m.visible=visible;
   scene.background=background;
   for(const [i,g] of groups.entries())g.mesh.material=original[i];
   const exactRestored=snap().image===after.image;for(const probe of probes)probe.dispose();
   return {after,before,bare,n:volume.count,exactRestored};
  };""")
 s=fixed.once(s,"const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;", """const barkDistance=qa.dist+((window as any).barkWalk??0);
      const norm=Math.hypot(qa.east,qa.south),ex=center.x+barkDistance*qa.east/norm,ez=center.z+barkDistance*qa.south/norm;""")
 if args.no_msaa:s=fixed.once(s,'antialias:true','antialias:false')
 p.write_text(s)
fixed.stage=stage
P={
 'queens-close':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=18),
 'prince-close':dict(lon=-64.238,lat=46.674,dist=54,east=.53,south=.85,h=10,agl=23),
 'kings-close':dict(lon=-62.169,lat=46.414,dist=56,east=.53,south=.85,h=10,agl=22),
 'queens-mid-control':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=42),
 'queens-high-control':dict(lon=-63.373,lat=46.400,dist=62,east=.53,south=.85,h=8,agl=152),
}
P.update({'queens-macro-0': {'lon': -63.373268353850335, 'lat': 46.3996815817607, 'dist': 4.4, 'east': 0.9683722859108358, 'south': -0.24950975107162116, 'agl': 2.1172758126189706, 'h': 0, 'fixedBaseH': 42.31936375714227, 'fixedEyeY': 42.41936375714227}, 'queens-macro-1': {'lon': -63.373268353850335, 'lat': 46.3996815817607, 'dist': 4.4, 'east': 0.9918413699883807, 'south': 0.12747822080485743, 'agl': 2.2952517478292265, 'h': 0, 'fixedBaseH': 42.31936375714227, 'fixedEyeY': 42.41936375714227}})
P.update({'prince-grazing': {'lon': -64.23742108644893, 'lat': 46.674592790684684, 'dist': 26, 'east': -0.8660254037844388, 'south': -0.4999999999999997, 'agl': 4.5, 'h': 17.115747419377726, 'fixedBaseH': 22.99635020922593, 'fixedEyeY': 27.982200182291795}, 'queens-grazing': {'lon': -63.37304312827413, 'lat': 46.399546529914325, 'dist': 26, 'east': -0.7071067811865479, 'south': -0.7071067811865471, 'agl': 2.7, 'h': 13.05925039233503, 'fixedBaseH': 38.32404072790475, 'fixedEyeY': 43.2847173505938}, 'kings-grazing': {'lon': -62.16821337178259, 'lat': 46.413126704406004, 'dist': 23.5, 'east': -0.9659258262890683, 'south': -0.2588190451025208, 'agl': 4.5, 'h': 8.631676831574865, 'fixedBaseH': 39.42139035923698, 'fixedEyeY': 43.829067562749714}})
def capture(a,browser,url):
 out=[]
 for mode in ('motion','corrupt','high'):
  ctx=browser.new_context(viewport={'width':460,'height':338});requests=[];bad=[];errors=[]
  try:
   p=ctx.new_page();p.set_default_timeout(120000)
   p.on('pageerror',lambda e:errors.append(str(e)))
   p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   p.on('request',lambda x:requests.append(x.url.rsplit('/',1)[-1]) if '/art/bark/' in x.url else None)
   if mode=='corrupt':
    def corrupt(route):
     reply=route.fetch();bits=bytearray(reply.body());bad.append(len(bits))
     bits[len(bits)//2+1024]^=0x20
     h=dict(reply.headers);h.pop('content-encoding',None);h.pop('content-length',None)
     route.fulfill(status=200,headers=h,body=bytes(bits))
    p.route('**/art/bark/wood-v1.rgba.gz',corrupt)
   pose=P['queens-high-control'] if mode=='high' else P['queens-macro-0']
   p.goto(url+'/?woodlandBark&woodlandCrownBase&diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   p.wait_for_function('window.reviewCamera?.frame>12')
   def snap():
    r=p.evaluate('window.captureWoodlandVolume()')
    x,y,z=[np.asarray(Image.open(BytesIO(base64.b64decode(r[k]['image'].split(',',1)[1]))))[:,:,:3].astype('i2') for k in ('before','after','bare')]
    wood=(z[:,:,0]>2)&(z[:,:,1]==0)&(z[:,:,2]>2)
    scope=np.asarray(Image.fromarray(np.uint8(wood)*255).filter(ImageFilter.MaxFilter(3)))>0
    dd=np.abs(x-y).max(axis=2)
    assert r['exactRestored'] and r['before']['draws']==r['after']['draws'] and r['before']['triangles']==r['after']['triangles']
    assert not np.any(dd[~scope]),int((dd[~scope]>0).sum())
    return int((dd>2).sum()),int(dd.max())
   if mode=='motion':
    p.wait_for_function('window.barkPreviewGain===1')
    rows=[]
    for move in (0,1.1,2.2,3.3,4.4,5.5,6.6,7.7,8.8,9.9,11,13.2,15.4,17.6,19.8,22,24.2,26.4):
     p.evaluate('x=>{window.barkWalk=x;return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}',move)
     n,peak=snap();rows.append(dict(m=move,woodPixels=n,peak=peak))
    assert rows[0]['woodPixels']>500 and len(requests)==1
    out.append({'case':mode,'frames':rows,'download':requests})
   elif mode=='corrupt':
    p.wait_for_function('window.islandAirDiagnostics.woodlandBark==="optional"')
    n,peak=snap()
    assert bad and n==0 and peak==0
    out.append({'case':mode,'sameFrame':True,'damagedByteLengths':bad})
   else:
    p.wait_for_function('window.islandAirDiagnostics.woodlandVolume===0')
    n,peak=snap()
    assert not requests and n==0 and peak==0
    out.append({'case':mode,'sameFrame':True,'download':requests})
   assert not errors,errors
   (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
   print(mode,out[-1],flush=True)
  finally:ctx.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default='queens-macro-0,queens-macro-1,kings-grazing');p.add_argument('--no-msaa',action='store_true');p.add_argument('--crown',action='store_true');p.set_defaults(void_probe=False)
args=p.parse_args();fixed.run(args)
