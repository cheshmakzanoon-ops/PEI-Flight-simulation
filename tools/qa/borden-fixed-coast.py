#!/usr/bin/env python3
"""Native WebGL replay of Borden’s two fixed shoreline review views.

Only a temporary checkout is instrumented. The candidate is the actual Standard
code path. The ordinary sky marker is toggled only for measurement; it never
changes the playable shader or asset.
"""
import argparse, base64, hashlib, importlib.util, io, json
from pathlib import Path
from urllib.parse import quote
from PIL import Image
from scipy.ndimage import label
import numpy as np

m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
prior=fixed.stage
p=argparse.ArgumentParser(description=__doc__)
for name in ('checkout','out','deps'):p.add_argument('--'+name,type=Path,required=True)
p.add_argument('--chromium',required=True)
p.add_argument('--stock',action='store_true');p.add_argument('--no-msaa',action='store_true')
p.add_argument('--shader-controls',action='store_true',help='also exercise stale linked prefixes and active uniform owners')
a=p.parse_args()
if a.stock and a.no_msaa:p.error('choose one fallback control per run')
if (a.stock or a.no_msaa) and a.shader_controls:p.error('shader controls require the default render path')
a.void_probe=False;a.size='980x630';a.views='msw-close,mharbour-close';a.pose_baseline=None
VIEWS={
 'msw': dict(lon=-63.70507555,lat=46.2500575,h=12.8,east=-.70,south=.71,nearDist=95,nearAgl=34),
 'mharbour': dict(lon=-63.70507555,lat=46.2500575,h=12.8,east=.28,south=.96,nearDist=172,nearAgl=62),
}
REGIONS={'msw':(0,443,435,630),'mharbour':(130,258,570,548)}
HOOK=r"""
  (window as any).bordenOpaqueNegative=([x,y]:[number,number])=>{
   const gl=renderer.getContext(),W=gl.drawingBufferWidth,H=gl.drawingBufferHeight;
   const ndc=new THREE.Vector3(2*(x+.5)/W-1,1-2*(y+.5)/H,0);
   ndc.unproject(camera).sub(camera.position).normalize();
   const paint=(repair:boolean)=>{
    const done=repair?world.beginBordenShoreArc(camera):undefined;
    try{renderer.render(scene,camera);return {img:renderer.domElement.toDataURL(),calls:renderer.info.render.calls,tri:renderer.info.render.triangles,points:renderer.info.render.points};}
    finally{done?.();}
   };
   const geo=new THREE.PlaneGeometry(.9,.9),mat=new THREE.ShaderMaterial({
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'void main(){gl_FragColor=vec4(.91,.02,.64,1.);gl_FragDepth=1.;}'
   });
   const mesh=new THREE.Mesh(geo,mat);mesh.name='QA opaque genuine clear-depth colour';
   mesh.position.copy(camera.position).addScaledVector(ndc,9);mesh.quaternion.copy(camera.quaternion);
   const baseline=paint(false);scene.add(mesh);
   try{
    const obstruction=paint(false),guarded=paint(true);
    return {exercised:baseline.img!==obstruction.img,equal:obstruction.img===guarded.img,draws:guarded.calls-obstruction.calls,tris:guarded.tri-obstruction.tri,points:guarded.points-obstruction.points,gl:gl.getError()};
   }finally{mesh.removeFromParent();geo.dispose();mat.dispose();}
  };
  (window as any).bordenStaleDrawControls=async()=>{
   const r=renderer,gl=r.getContext();
   const snap=(repair:boolean)=>{
    const exit=repair?world.beginBordenShoreArc(camera):undefined;
    try{
     r.render(scene,camera);
     return {image:r.domElement.toDataURL(),counts:[r.info.render.calls,r.info.render.triangles,r.info.render.points]};
    }finally{exit?.();}
   };
   const same=(a:ReturnType<typeof snap>,b:ReturnType<typeof snap>)=>a.image===b.image&&a.counts.every((v,i)=>v===b.counts[i]);
   const coarse=()=>{
    const x=r.renderLists.get(scene,0).opaque.find(v=>v.geometry?.type==='PlaneGeometry'&&
     v.geometry.getAttribute('position')?.count===81&&v.material instanceof THREE.ShaderMaterial);
    return x?.material as THREE.ShaderMaterial|undefined;
   };
   const old=snap(false),m=coarse();if(!m)throw Error('missing coarse stock material');
   const props=()=>r.properties.get(m) as any,current=props().currentProgram;
   const originalDefines=m.defines,actualUniforms=m.uniforms;
   let prefix=false,sameStockPrefix=false,compiled=false,uniforms=false,sameStockUniforms=false,changedUniformOwner=false;
   try{
    m.defines={...originalDefines,PEI_BORDEN_QA_UNUSED:1};m.needsUpdate=true;
    const linkedStock=snap(false),foreignProgram=props().currentProgram;
    const f=gl.getShaderSource(foreignProgram.fragmentShader);
    compiled=!!f&&foreignProgram!==current&&f.includes('#define PEI_BORDEN_QA_UNUSED 1');
    m.defines=originalDefines; // Deliberately do not ask Three to relink.
    sameStockPrefix=same(old,linkedStock)&&same(linkedStock,snap(false));
    const first=snap(true);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    prefix=props().currentProgram===foreignProgram&&same(first,linkedStock)&&same(snap(true),linkedStock);

    m.needsUpdate=true;
    const uniformStock=snap(false);
    m.uniforms={...actualUniforms}; // Same values, but not the active linked dictionary.
    changedUniformOwner=props().uniforms!==m.uniforms;
    sameStockUniforms=same(old,uniformStock)&&same(uniformStock,snap(false));
    uniforms=props().uniforms!==m.uniforms&&same(snap(true),uniformStock);
   }finally{m.defines=originalDefines;m.uniforms=actualUniforms;m.needsUpdate=true;snap(false);}
   return {prefix,uniforms,sameStockPrefix,compiled,sameStockUniforms,changedUniformOwner,gl:gl.getError()};
  };
  (window as any).bordenResidentFixedQA=()=>{
   const sky=(world as any).sky.material.uniforms.skyDiagnostic,gl=renderer.getContext();
   if(sky.value!==0)throw Error('stock sky marker active outside measurement');
   const take=(mode:number,marker:number)=>{
    const done=mode?world.beginBordenShoreArc(camera):undefined;
    sky.value=marker;
    try{
     renderer.render(scene,camera);
     return {png:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,tris:renderer.info.render.triangles,
      points:renderer.info.render.points,armed:!!done,gl:gl.getError()};
    }finally{done?.();sky.value=0;}
   };
   const photos={stock:take(0,0),fill:take(2,0),beforeB:take(0,1),afterB:take(2,1),stockAgain:take(0,0)};
   return {photos,samples:gl.getParameter(gl.SAMPLES)};
  };
"""
def stage(repo,root,deps,void):
    prior(repo,root,deps,False)
    profile=root/'src/app/scenery-profile.ts'
    s=profile.read_text()
    s=fixed.once(s,"!q.has('qa')&&!q.has('legacyShoreArcs')&&!q.has('stockBordenCoast');",
       "!q.has('legacyShoreArcs')&&!q.has('stockBordenCoast');")
    profile.write_text(s)
    main=root/'src/main.ts';s=main.read_text()
    if 'world.trackBordenFrame(f.x,f.z);' in s:
        key='camera.updateMatrixWorld();aircraft.root.visible=false;'
        s=fixed.once(s,key,key+'world.trackBordenFrame(f.x,f.z);')
    if a.no_msaa:s=fixed.once(s,'antialias:true','antialias:false')
    key="  if(world.tryonRockState==='pending'"
    main.write_text(fixed.once(s,key,HOOK+key))
fixed.stage=stage

def capture(a,browser,url):
    receipt={}
    for site in ('msw','mharbour'):
        name=site+'-close';pose=dict(VIEWS[site])
        pose.update(dist=pose['nearDist'],agl=pose['nearAgl'])
        page=browser.new_page(viewport={'width':980,'height':630});errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        assert page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose))+('&stockBordenCoast' if a.stock else ''),wait_until='domcontentloaded').ok
        try:
            fixed.settle(page,errors)
            for i in range(30):
                res=page.evaluate('window.bordenResidentFixedQA()')
                if a.stock or a.no_msaa or res['photos']['fill']['points']>0:break
                page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
            info={};pics={}
            for k,x in res['photos'].items():
                img=base64.b64decode(x.pop('png').split(',')[1])
                info[k]={**x,'sha256':hashlib.sha256(img).hexdigest()}
                pics[k]=np.asarray(Image.open(io.BytesIO(img)).convert('RGBA'),dtype=np.int16)
                (a.out/f'{name}-{k}.png').write_bytes(img)
            assert res['samples']==(0 if a.no_msaa else 4)
            assert not errors and all(x['gl']==0 for x in info.values()),(errors,info)
            old=(pics['stock'][:,:,:3]!=pics['beforeB'][:,:,:3]).any(2)
            new=(pics['fill'][:,:,:3]!=pics['afterB'][:,:,:3]).any(2)
            diff=np.abs(pics['stock']-pics['fill']);role=(diff[:,:,:3]>0).any(2)
            assert not ((role&~old).any() or (new&~old).any() or (diff[:,:,3]>0).any())
            assert np.array_equal(pics['stock'],pics['stockAgain'])
            x,y,j,k=REGIONS[site]
            arr=old[y:k,x:j];parts,num=label(arr);h=np.bincount(parts.ravel());h[0]=0
            selected=parts==h.argmax() if h.max() else np.zeros(arr.shape,bool)
            pre=int(selected.sum());left=int((selected&new[y:k,x:j]).sum())
            passed=bool(info['fill']['armed'] and info['fill']['points']>0)
            result={'samples':res['samples'],'oldSkyComponent':pre,'residual':left,'changed':int(role.sum()),
                    'projectedPoints':info['fill']['points'],'pass':passed,
                    'photos':{k:{q:v for q,v in x.items() if q!='proof'} for k,x in info.items()}}
            receipt[name]=result
            print(name,{k:v for k,v in result.items() if k!='photos'},flush=True)
            if a.stock or a.no_msaa:
                assert not role.any() and not info['fill']['armed']
                for metric in ('draws','tris','points'):
                    assert info['fill'][metric]==info['stock'][metric],(site,metric)
            else:
                assert pre>500 and left<=.05*pre and passed,result
                assert info['fill']['tris']==info['stock']['tris']+58,result
                assert info['fill']['draws']==info['stock']['draws']+2,result
                yy,xx=np.argwhere(role&old)[len(np.argwhere(role&old))//2]
                negative=page.evaluate('p=>window.bordenOpaqueNegative(p)',[int(xx),int(yy)])
                assert negative=={'exercised':True,'equal':True,'draws':0,'tris':0,'points':0,'gl':0},negative
                result['opaqueControl']=negative
                if a.shader_controls:
                    controls=page.evaluate('()=>window.bordenStaleDrawControls()')
                    assert controls['gl']==0 and all(v for k,v in controls.items() if k!='gl'),controls
                    result['linkedControls']=controls
            (a.out/'results.json').write_text(json.dumps(receipt,indent=2)+chr(10))
        finally:page.close()
fixed.capture=capture
fixed.run(a)
