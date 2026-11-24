#!/usr/bin/env python3
"""Matched Three.js bark scan and legacy material on the same tree scene."""
import argparse,base64,importlib.util,json
from pathlib import Path
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
   const alt=(mat,noScan)=>{
    const defines={...mat.defines};if(noScan)delete defines.BARK_SCAN;
    const fragmentShader=mat.fragmentShader;
    return new THREE.ShaderMaterial({vertexShader:mat.vertexShader,fragmentShader,side:mat.side,
     alphaToCoverage:true,uniforms:mat.uniforms,defines});
   };
   const set=(m)=>groups.forEach((g,i)=>g.mesh.material=m[i]);
   const legacy=original.map(mat=>alt(mat,true));
   const gain=volume.barkGain.value;const after=snap();
   volume.barkGain.value=0;const zero=snap();volume.barkGain.value=gain;
   set(legacy);const before=snap();set(original);
   const gl=renderer.getContext(),time={stock:[],bark:[]};
   function timed(batch,materials){
    set(materials);
    gl.finish();const a=performance.now();
    for(let i=0;i<batch;i++){renderer.render(scene,camera);gl.finish();}
    return (performance.now()-a)/batch;
   }
   // All program compilation and the initial texture upload preceded timing.
   for(let i=0;i<7;i++){
    if(i%2){time.bark.push(timed(2,original));time.stock.push(timed(2,legacy));}
    else{time.stock.push(timed(2,legacy));time.bark.push(timed(2,original));}
   }
   const meshes=new Set(groups.map(g=>g.mesh)),nodes=scene.children.map(m=>[m,m.visible]);
   const background=scene.background;scene.background=new THREE.Color(0);
   for(const [m] of nodes)if(!meshes.has(m))m.visible=false;
   for(const [i,g] of groups.entries())g.mesh.material=probes[i];
   const bare=snap();
   for(const [m,visible] of nodes)m.visible=visible;
   scene.background=background;
   for(const [i,g] of groups.entries())g.mesh.material=original[i];
   const exactRestored=snap().image===after.image;for(const probe of [...probes,...legacy])probe.dispose();
   return {after,before,bare,n:volume.count,exactRestored,zeroAndStock:zero.image===before.image,
    warmedCombinedMS:time};
  };""")
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
 out={}
 for name in a.views.split(','):
  c=browser.new_context(viewport={'width':460,'height':338},device_scale_factor=1)
  try:
   pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   pg.goto(url+'/?woodlandBark&diagnostics'+('&woodlandCrownBase' if a.crown else '')+'&qa='+quote(json.dumps(P[name])),wait_until='domcontentloaded')
   for _ in range(180):
    state,frame=pg.evaluate('()=>[window.islandAirDiagnostics,window.barkPreviewGain===1?window.reviewCamera?.frame:0]')
    if errors:raise RuntimeError(errors)
    if frame and frame>12 and state and ('control' in name or a.no_msaa or state.get('woodlandVolume',0)>0):break
    pg.wait_for_timeout(500)
   else:raise RuntimeError((name,state,frame))
   x=pg.evaluate('window.captureWoodlandVolume()')
   def img(k):
    p=a.out/(name+'-'+k+'.png');p.write_bytes(base64.b64decode(x[k].pop('image').split(',',1)[1]))
    return np.asarray(Image.open(p))[:,:,:3].astype(int)
   b,cand,bare=[img(k) for k in ('before','after','bare')]
   m=(bare[:,:,0]>2)&(bare[:,:,1]==0)&(bare[:,:,2]>2)
   accept=np.asarray(Image.fromarray(np.uint8(m)*255).filter(ImageFilter.MaxFilter(3)))>0
   dd=np.max(np.abs(b-cand),axis=2)
   x['pixels']={'n':int(dd.size),'changed':int((dd>0).sum()),'over2':int((dd>2).sum()),'max':int(dd.max()),'outsideFoliage':int((dd[~accept]>0).sum())}
   assert m.sum()>40 and x['exactRestored'] and x['zeroAndStock'] and x['n']<=121 and x['before']['draws']==x['after']['draws'] and x['before']['triangles']==x['after']['triangles'] and x['pixels']['outsideFoliage']==0,x
   assert x['pixels']['over2']>25,x
   out[name]=x
   print(name,x,flush=True)
  finally:c.close()
 (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default='queens-macro-0,queens-macro-1,kings-grazing');p.add_argument('--no-msaa',action='store_true');p.add_argument('--crown',action='store_true');p.set_defaults(void_probe=False)
args=p.parse_args();fixed.run(args)
