#!/usr/bin/env python3
"""Identical-camera older/newer streamed Water Street building batch comparison."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

from PIL import Image
import numpy as np

s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s)
s.loader.exec_module(fixed)
base_stage=fixed.stage

poses={
 'pavers-nineteen':dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=29,h=0,agl=18),
 'harbour-massing':dict(lon=-63.79263,lat=46.39170,east=.34,south=.94,dist=96,h=6.2,agl=46),
 'normal-approach':dict(lon=-63.79220,lat=46.39169,east=.53,south=.848,dist=227,h=5.5,agl=118),
 'curb-level-frontage':dict(lon=-63.7906004765,lat=46.3916149864,east=.825345,south=.564629,dist=23.595,h=3.8,agl=2.9),
 'low-journal-frontage':dict(lon=-63.7930929859,lat=46.3918544613,east=.996130,south=.087896,dist=22.882,h=6.2,agl=4.1),
 'low-shopfronts':dict(lon=-63.7906004765,lat=46.3916149864,east=.825345,south=.564629,dist=23.595,h=3.8,agl=9.5),
 'journal-block':dict(lon=-63.7930929859,lat=46.3918544613,east=.996130,south=.087896,dist=22.882,h=6.2,agl=11.5),
 'east-point-control':dict(lon=-61.9718333333,lat=46.452527778,h=19.5,east=.91,south=-.415,dist=125,agl=45)
}

def stage(repo,root,deps,void_probe):
    base_stage(repo,root,deps,void_probe)
    p=root/'src/render/buildings.ts'
    p.write_text(fixed.once(p.read_text(),'const mesh=this.generate(chunk.features,tile);','''
      const mesh=this.generate(chunk.features,tile);
      if(tile.id===WATER_STREET_TILE&&this.waterStreetMat){
       const material=this.waterStreetMat;
       try{(this as any).waterStreetMat=undefined;mesh.userData.priorShell=this.generate(chunk.features,tile);}
       finally{(this as any).waterStreetMat=material;}
      }
    '''))
    material=p.read_text()
    material=fixed.once(material,'  let facade=0;','  let facade=0,qMark=0; const qPick:number[]=[];')
    material=fixed.once(material,'=>{P.push(p.x-ox,y,p.z-oz);','=>{qPick.push(qMark);P.push(p.x-ox,y,p.z-oz);')
    material=fixed.once(material,'   const f=features[i];','''   const f=features[i];
     qMark=Number(!!waterStreetModel(this.atlasHash,tile.id,i,f.footprint,f.holes));''')
    material=fixed.once(material,'  const mesh=new THREE.Mesh(g,tile.id===','''  g.setAttribute('qaTarget',new THREE.Uint8BufferAttribute(qPick,1));
     const mesh=new THREE.Mesh(g,tile.id===''')
    p.write_text(material)
    m=root/'src/main.ts'
    m.write_text(fixed.once(m.read_text(),'renderer.render(scene,camera);','''
     renderer.render(scene,camera);
     const regions=(world as any).tiles.filter((t:any)=>Math.hypot(camera.position.x-t.x0-t.w*.5,camera.position.z-t.z0-t.d*.5)<14500);
     (window as any).buildingArtReady=regions.every((t:any)=>t.status==='ready'||t.status==='uncovered');
     (window as any).waterStreetFrames=()=>{
      const block=scene.children.find(o=>o.userData.priorShell) as THREE.Mesh|undefined;
      const save=()=>{renderer.render(scene,camera);return {png:renderer.domElement.toDataURL('image/png'),
       calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
      const surface=[world.surface(center.x,center.z),world.surface(f.x,f.z)];
      const newFrame=save();let oldFrame=save(),newMask=newFrame,oldMask=oldFrame,mark=0,roof=0;
      const saved=(m:THREE.Mesh)=>{
       const material=m.material as THREE.ShaderMaterial,t=material.clone();
       t.uniforms=material.uniforms;
       t.vertexShader='attribute float qaTarget;varying float qaPicked;\\n'
        + material.vertexShader.replace('void main(){','void main(){qaPicked=qaTarget;');
       t.fragmentShader='varying float qaPicked;\\n'
        + material.fragmentShader.replace('#include <tonemapping_fragment>',
         'if(qaPicked>.5)gl_FragColor=vec4(1.,0.,.94,1.);\\n #include <tonemapping_fragment>');
       m.material=t;
       try{return save();}finally{m.material=material;t.dispose();}
      };
      if(block){
       const g=block.geometry,m=block.material;
       const attributes=g.getAttribute('facadeStyle').array;
       const flags=g.getAttribute('topFlag').array;
       for(let i=0;i<attributes.length;i++)if(attributes[i]>=13){mark++;if(flags[i]===21)roof++;}
       newMask=saved(block);
       block.geometry=block.userData.priorShell.geometry;
       block.material=block.userData.priorShell.material;
       oldFrame=save();oldMask=saved(block);block.geometry=g;block.material=m;
      }
      return {oldFrame,newFrame,oldMask,newMask,surface,markTriangles:mark/3,roofTriangles:roof/3,
       tileState:buildings?.diagnostics(),details:regions.filter((a:any)=>a.status==='ready').map((a:any)=>a.id).sort(),
       camera:{eye:camera.position.toArray(),aim:[center.x,baseH+qa.h*.5,center.z],orientation:camera.matrixWorld.elements}};
     };
    '''))

def capture(args,browser,url):
    results=[]
    for label in args.views.split(','):
        pose=poses[label]
        context=browser.new_context(viewport=dict(width=1024,height=640),device_scale_factor=1)
        try:
            page=context.new_page();page.set_default_timeout(100000);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
            try:page.wait_for_function('''(()=>{
              const d=window.islandAirDiagnostics,t=d?.buildingTiles;
              return window.reviewCamera?.frame>30&&window.buildingArtReady&&d?.roads&&d?.mainland&&(!d?.sidewalks||d.sidewalks.pending===0)&&
               !d.detail.loading&&!d.detail.missing&&!d.layerWarnings.length&&t?.pending===0&&t?.loading===0&&t?.failed===0&&t?.ready===t?.wanted;
            })()''',timeout=170000,polling=250)
            except Exception:
                print('unsettled',label,page.evaluate('window.islandAirDiagnostics'),errors,flush=True)
                raise
            data=page.evaluate('window.waterStreetFrames()')
            if errors:raise RuntimeError(errors)
            for field in ('oldFrame','newFrame','oldMask','newMask'):
                raw=data[field]['png'];data[field]={k:v for k,v in data[field].items() if k!='png'}
                (args.out/f'{label}-{field}.png').write_bytes(base64.b64decode(raw.split(',',1)[1]))
            read=lambda x:np.asarray(Image.open(args.out/f'{label}-{x}.png').convert('RGB'),np.int16)
            old,new,oldM,newM=(read(k) for k in ('oldFrame','newFrame','oldMask','newMask'))
            diff=np.max(np.abs(old-new),axis=-1)
            pre=np.max(np.abs(old-oldM),axis=-1)>0
            post=np.max(np.abs(new-newM),axis=-1)>0
            zone=pre|post
            pad=np.pad(zone,1);h,w=zone.shape;scope=np.zeros_like(zone)
            for y in range(3):
                for x in range(3):scope|=pad[y:y+h,x:x+w]
            data['changedPixels']=int((diff>0).sum())
            data['perceptiblePixels']=int((diff>4).sum())
            data['protectedPixels']=int((~scope).sum())
            data['outOfScopePixels']=int((diff[~scope]>0).sum())
            data['outOfScopeMaxLevel']=int(diff[~scope].max(initial=0))
            npix=int((pre&post).sum())
            if npix:
                Y=np.array([.2126,.7152,.0722])
                data['commonFacadeMedianLuma']=[round(float(np.median(x[pre&post]@Y)),2)for x in (old,new)]
            assert not data['outOfScopePixels'],data
            if label.endswith('control'):assert not diff.any() and not data['markTriangles'],data
            else:assert data['markTriangles'] and data['perceptiblePixels']>1200,data
            results.append(dict(view=label,pose=pose,**data))
            (args.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
            print(label,data['oldFrame'],data['newFrame'],data['markTriangles'],data['perceptiblePixels'],flush=True)
        finally:context.close()

fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--deps',type=Path);p.add_argument('--views',default=','.join(poses))
    p.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    p.set_defaults(void_probe=False)
    fixed.run(p.parse_args())
