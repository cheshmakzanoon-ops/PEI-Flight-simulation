#!/usr/bin/env python3
"""Render same-tick roof-contact A/B and two-color projective receiver masks.
Capture the *live* linked Three.js program, not a standalone fragment compile.
A patched temporary checkout only supplies probes, reference program, and locked camera.
"""
import argparse,base64,hashlib,importlib.util,io,json,statistics
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).resolve().with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed)
base=fixed.stage
def stage(repo,tmp,deps,void):
 base(repo,tmp,deps,void);p=tmp/'src/render/buildings.ts';s=p.read_text()
 m='   if(tapped&&observer){observer.content=observed;observer.mesh=mesh;}'
 s=fixed.once(s,m,"""   if(tile.id==='q0322'){
    const ref=new THREE.ShaderMaterial({vertexShader:buildingV,fragmentShader:buildingF(false,this.shadowedBuildings,false,false,false,false,true),
     uniforms:this.mat.uniforms,vertexColors:true,side:THREE.DoubleSide});
    (mesh as any).qaContact={ref,span:this.generate(features,tile,false,47,false,massingChunk).userData.beaconTriangles};
   }
"""+m)
 # Reserved temporary vertex IDs carry true visible roof ownership without an added GPU sampler/uniform.
 m=' vec3 c=tint,n=normalize(normalW);';s=fixed.once(s,m,""" if(facade>252.5){gl_FragColor=facade>253.5?vec4(.03,.98,.27,1.):vec4(.97,.02,.64,1.);return;}
"""+m);p.write_text(s)
 p=tmp/'src/main.ts';s=p.read_text()
 if args.under_budget:s=fixed.once(s,'princeSkyBudget(renderer.capabilities.maxFragmentUniforms)','princeSkyBudget(191)')
 m='\n  renderer.render(scene,camera);'
 s=fixed.once(s,m,m+"""
  (window as any).captureRoofContact=()=>{
   const live=(buildings as any).meshes.get('q0322'),o=live.qaContact,g=live.geometry,actual=live.material,
    gl=renderer.getContext() as WebGL2RenderingContext,stats={};
   const snap=(label)=>{
    let shader=null;
    live.onAfterRender=()=>{const program=gl.getParameter(gl.CURRENT_PROGRAM),items=[];
     for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i);items.push([u.name,u.type,u.size]);}
     const samplers=items.filter(u=>[gl.SAMPLER_2D,gl.SAMPLER_CUBE,gl.SAMPLER_2D_SHADOW,gl.SAMPLER_2D_ARRAY,gl.SAMPLER_3D,
      gl.INT_SAMPLER_2D,gl.UNSIGNED_INT_SAMPLER_2D].includes(u[1]));
     const field=items.find(q=>q[0].startsWith('princeSkyWords'))??null;
     let words=null,match=null;if(field){
      words=[];const expected=live.material.uniforms.princeSkyWords?.value;
      for(let i=0;i<field[2];i++){
       const loc=gl.getUniformLocation(program,'princeSkyWords['+i+']');
       if(!loc)throw Error('Missing indexed live packed field location '+i);
       const slot=gl.getUniform(program,loc);if(slot.length!==4)throw Error('Wrong uint4 size');
       words.push(...slot);
      }
      match=words.length===expected?.length&&words.every((w,j)=>w===expected[j]);
     }
     shader={samplers:samplers.map(q=>q[0]),field,uploadedWords:words,exactlyMatchesMountedJS:match,
      hardwareVec4Limit:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),linked:gl.getProgramParameter(program,gl.LINK_STATUS)};};
    renderer.render(scene,camera);return {im:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles,shader};
   };
   const facade=g.attributes.facadeStyle,flags=g.attributes.topFlag,[a,b]=o.span,orig=facade.array.slice(a,b);
   const setId=(id)=>{for(let i=a;i<b;i++)if(flags.getX(i)>.5)facade.array[i]=id;facade.needsUpdate=true;};
   try{
    live.material=o.ref;const old=snap('old');setId(253);const oldA=snap('oldA');setId(254);const oldB=snap('oldB');
    facade.array.set(orig,a);facade.needsUpdate=true;
    live.material=actual;const lit=snap('lit');setId(253);const litA=snap('litA');setId(254);const litB=snap('litB');
    facade.array.set(orig,a);facade.needsUpdate=true;const repeat=snap('repeat');
    if(repeat.im!==lit.im)throw Error('same-tick repeat moved');
    return {old,lit,oldA,oldB,litA,litB,actual:buildings?.princeRoofContactActive??false,shape:buildings?.princeSurveyRoofActive??false};
   }finally{facade.array.set(orig,a);facade.needsUpdate=true;live.material=actual;live.onAfterRender=()=>{};}
  };
""")
 p.write_text(s)
fixed.stage=stage
poses={'west':dict(east=.95,south=.31,h=4.,dist=102,agl=39),'south':dict(east=-.57,south=-.821,h=4.,dist=100,agl=35),
 'north':dict(east=.05,south=-.997,h=7.,dist=72,agl=43),'far':dict(east=.95,south=.31,h=2.,dist=620,agl=390)}
def capture(a,browser,url):
 rows=[]
 for name in a.views.split(','):
  c=browser.new_context(viewport=dict(width=840,height=540),device_scale_factor=1)
  p=c.new_page();p.set_default_timeout(160000);errors=[]
  p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  try:
   pose={'lon':-63.83385771428571,'lat':46.44841914285714,**poses[name]}
   p.goto(url+'/?diagnostics'+('&'+a.query if a.query else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   fixed.settle(p,errors);r=p.evaluate('window.captureRoofContact()')
   assert not errors and r['shape']
   expect=a.query!='stockPrinceRoofContact' and not a.under_budget
   assert r['actual']==expect
   def take(tag):
    b=base64.b64decode(r[tag].pop('im').split(',',1)[1]);r[tag]['sha256']=hashlib.sha256(b).hexdigest()
    rec=r[tag]['shader'];w=rec.pop('uploadedWords')
    if w is not None:
     assert len(w)==440 and rec['exactlyMatchesMountedJS'];rec['uploadedU32LE_SHA256']=hashlib.sha256(np.asarray(w,dtype='<u4').tobytes()).hexdigest();rec['exactU32Words']=len(w)
    if tag in ['old','lit']:(a.out/(name+'-'+tag+'.png')).write_bytes(b)
    return np.array(Image.open(io.BytesIO(b)).convert('RGB'),np.int16)
   O,L,A,B,C,D=[take(k)for k in ['old','lit','oldA','oldB','litA','litB']]
   old=np.any(A!=B,axis=2);new=np.any(C!=D,axis=2);assert np.array_equal(old,new) and old.any()
   ecc=(O-L);dif=abs(ecc).max(axis=2);outside=int(np.count_nonzero(dif[~old]));peak=int(dif.max());above=int(np.count_nonzero(dif>2))
   assert outside==0, (name,outside)
   assert int(ecc.min())>=-1 and not np.any(ecc[~old]),name
   assert all(r[k]['draws']==r['old']['draws'] and r[k]['tris']==r['old']['tris'] for k in ('lit','oldA','oldB','litA','litB'))
   assert r['old']['shader']['linked'] and r['lit']['shader']['linked'] and r['lit']['shader']['samplers']==r['old']['shader']['samplers']
   assert r['old']['shader']['field'] is None and (r['lit']['shader']['field'] is not None)==expect
   if expect:assert r['lit']['shader']['field'][2]==110
   if expect and name!='far':assert above>100
   else:assert not np.any(dif)
   result=dict(view=name,query=a.query or 'standard',artificiallyLowBudget=a.under_budget,pose=pose,render=r,affected=dict(roofPixels=int(old.sum()),changedAny=int(np.count_nonzero(dif)),changedOver2=above,peakChannelDelta=peak,changedOutsideExactRoof=outside,brighteningMax=int(np.maximum(-ecc,0).max())),glErrors=errors)
   rows.append(result);print(name,result['affected'],r['lit']['shader'],flush=True);(a.out/'gpu-scope.json').write_text(json.dumps(rows,indent=2)+'\n')
  finally:c.close()
 return rows
fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
for k in ('checkout','out'):p.add_argument('--'+k,required=True,type=Path)
p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True);p.add_argument('--views',default='west,south,north,far');p.add_argument('--under-budget',action='store_true');p.add_argument('--query',default='',choices=['','stockPrinceRoofContact','stockInlandOrtho'])
args=p.parse_args();args.pose_baseline=None;args.void_probe=False;args.size='840x540';fixed.run(args)
