#!/usr/bin/env python3
"""Locked shader-material swap of only the documented Victoria Row paved core."""
import argparse,base64,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
base_stage=fixed.stage
A=(-63.1269576,46.2337761);B=(-63.1257269,46.2345471)
f=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=(6378137*math.pi/180*math.cos(math.radians(46.5))/math.sqrt(f),-6378137*math.pi/180*(1-.00669437999014)/f**1.5)
e=[(b-a)*s for a,b,s in zip(A,B,scale)];span=math.hypot(*e);U=[t/span for t in e];N=[-U[1],U[0]]
def pos(at,off,agl,h,eye,eo):
    lon,lat=[x+(at*u+off*n)/s for x,u,n,s in zip(A,U,N,scale)]
    d=[(eye-at)*u+(eo-off)*n for u,n in zip(U,N)]
    return dict(lon=lon,lat=lat,h=h,east=d[0],south=d[1],dist=math.hypot(*d),agl=agl)
poses={
 'curb-lenses':pos(35,-.25,2.18,1.9,15,1.15),
 'cross-lower':pos(54,-.05,7.5,1.20,84,2.65),
 'above-core':pos(61,.5,39.0,0,62,-23),
 'east-control':dict(lon=-61.9718333333,lat=46.452527778,h=19.5,east=.91,south=-.415,dist=125,agl=45)
}

def stage(repo,root,deps,probe):
    base_stage(repo,root,deps,probe)
    p=root/'src/render/road-surface.ts'
    r=p.read_text()
    r=fixed.once(r,' material.onBeforeCompile=(shader)=>{','''
 const qaPaverVisibility={value:0};
 if(victoria)material.userData.qaPaverVisibility=qaPaverVisibility;
 material.onBeforeCompile=(shader)=>{
  if(victoria)shader.uniforms.qaPaverVisibility=qaPaverVisibility;''')
    r=fixed.once(r,"   ${victoria?victoriaPavingGLSL:''}","   ${victoria?'uniform float qaPaverVisibility;'+victoriaPavingGLSL:''}")
    r=fixed.once(r,"  if(victoria)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`","""  if(victoria)shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`
   if(qaPaverVisibility>.5&&victoriaBlend>.0001)gl_FragColor=vec4(1.,.01,.94,1.);
   #include <tonemapping_fragment>
  `).replace('#include <roughnessmap_fragment>',`""")
    p.write_text(r)
    m=root/'src/main.ts'
    m.write_text(fixed.once(m.read_text(),'renderer.render(scene,camera);','''
    renderer.render(scene,camera);
    (window as any).captureVictoriaPaving=()=>{
      const r=roads as any, local=r?.victoriaMaterial, base=r?.material;
      const meshes=(Array.from(r?.visible?.values()??[]) as THREE.Mesh[]).filter(x=>x.material===local);
      const shot=()=>{renderer.render(scene,camera);return {png:renderer.domElement.toDataURL('image/png'),
        calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
      const newFrame=shot();
      let oldFrame=shot(),maskFrame=shot(),replay=newFrame.png===oldFrame.png;
      if(meshes.length){
       meshes.forEach(x=>x.material=base);oldFrame=shot();
       meshes.forEach(x=>x.material=local);
       local.userData.qaPaverVisibility.value=1.;maskFrame=shot();
       local.userData.qaPaverVisibility.value=0.;replay=newFrame.png===shot().png;
      }
      return {newFrame,oldFrame,maskFrame,replay,markedMeshes:meshes.length,
       tileState:buildings?.diagnostics(),roadState:roads?.seatState??null,
       pose:{eye:camera.position.toArray(),motion:camera.matrixWorld.elements}};
    };
    '''))

def capture(args,browser,url):
    results=[]
    for k in args.views.split(','):
        ctx=browser.new_context(viewport={'width':960,'height':600},device_scale_factor=1)
        p=ctx.new_page();errors=[]
        try:
            p.on('pageerror',lambda e:errors.append(str(e)))
            p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            p.goto(url+'/?diagnostics'+('&seatedRoads' if args.seated else '')+'&qa='+quote(json.dumps(poses[k])),wait_until='domcontentloaded')
            p.add_style_tag(content='body * {visibility:hidden!important} #world{visibility:visible!important}')
            p.wait_for_function("""([seated,local])=>{
              const d=window.islandAirDiagnostics,b=d?.buildingTiles;
              return d?.roads&&d?.mainland&&b?.ready===b?.wanted&&d.detail.ready>0&&
                !d.detail.loading&&!d.detail.missing&&window.reviewCamera?.frame>16&&
                (!d.pavement||d.pavement.status!=='loading')&&
                (!seated||!local||(d.seatedRoads?.ready>0&&d.seatedRoads.gain>.989));
            }""",arg=[args.seated,k!='east-control'],polling=600,timeout=220000)
            rec=p.evaluate('window.captureVictoriaPaving()')
            if errors:raise RuntimeError(errors)
            def read(field):
                r=rec[field]
                fname=args.out/(k+'-'+field+'.png')
                fname.write_bytes(base64.b64decode(r['png'].split(',',1)[1]))
                rec[field]={key:v for key,v in r.items() if key!='png'}
                return np.asarray(Image.open(fname).convert('RGB'),np.int16)
            old,new,mask=(read(f)for f in ('oldFrame','newFrame','maskFrame'))
            sc=np.max(np.abs(new-mask),axis=-1)>0
            dilated=np.asarray(Image.fromarray(sc.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(3)))>0
            dif=np.max(np.abs(old-new),axis=-1)
            rec['visibleSourcePixels']=int(sc.sum())
            rec['changed']=int((dif>0).sum())
            rec['noticeable']=int((dif>4).sum())
            rec['protected']=int((~dilated).sum())
            rec['outOfScope']=int((dif[~dilated]>0).sum())
            assert rec['replay'] and rec['oldFrame']==rec['newFrame'] and not rec['outOfScope'],rec
            if k=='east-control':assert rec['changed']==0 and rec['markedMeshes']==0,rec
            else:assert rec['noticeable']>2000 and rec['markedMeshes']==1,rec
            results.append(dict(view=k,**rec))
            (args.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
            print(k,rec['oldFrame'],rec['noticeable'],rec['protected'],flush=True)
        finally:ctx.close()

fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--checkout',type=Path,required=True)
    a.add_argument('--out',type=Path,required=True)
    a.add_argument('--deps',type=Path);a.add_argument('--chromium',required=True)
    a.add_argument('--views',default=','.join(poses))
    a.add_argument('--seated',action='store_true')
    a.set_defaults(void_probe=False)
    fixed.run(a.parse_args())
