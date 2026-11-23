#!/usr/bin/env python3
"""Identical-camera older/newer streamed Montague former Town Hall building batch comparison."""
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

# WGS84 two sides of Main Street near the river bridge.
import math
m=6378137*math.pi/180;f=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=(m*math.cos(math.radians(46.5))/math.sqrt(f),-m*(1-.00669437999014)/f**1.5)
def geometric(eye,target,h,agl):
    dx,dz=[(a-b)*k for a,b,k in zip(eye,target,scale)]
    return dict(lon=target[0],lat=target[1],h=h,east=dx,south=dz,dist=math.hypot(dx,dz),agl=agl)
poses={
 'hall-at-sill':geometric((-62.647091,46.163701),(-62.647026,46.163527),7,3.75),
 'hall-bridge-side':geometric((-62.647449,46.163808),(-62.647023,46.163504),7,7.0),
 'hall-both-sides':geometric((-62.647751,46.163969),(-62.647036,46.163646),6,23.5),
 'hall-river-approach':geometric((-62.646721,46.164930),(-62.647037,46.163667),8,117.),
 'east-point-control':dict(lon=-61.9718333333,lat=46.452527778,h=19.5,east=.91,south=-.415,dist=125,agl=45)
}

def stage_target(repo,root,deps,void_probe,matcher,anchor,style,roof_roles):
    base_stage(repo,root,deps,void_probe)
    p=root/'src/render/buildings.ts'
    p.write_text(fixed.once(p.read_text(),'const mesh=this.generate(chunk.features,tile);','''
      const mesh=this.generate(chunk.features,tile);
      if(tile.id===MONTAGUE_HALL_TILE&&this.montagueMat)
       mesh.userData.priorShell=this.generate(chunk.features,tile,false);
    '''))
    material=p.read_text()
    material=fixed.once(material,'private generate(features:Bldg[],tile:BoundTile){',
                        'private generate(features:Bldg[],tile:BoundTile,qaUseTarget=true){')
    material=fixed.once(material,anchor,anchor.replace('this.montagueMat','qaUseTarget&&this.montagueMat'))
    material=fixed.once(material,'  let facade=0;','  let facade=0,qMark=0; const qPick:number[]=[];')
    material=fixed.once(material,'=>{P.push(p.x-ox,y,p.z-oz);','=>{qPick.push(qMark);P.push(p.x-ox,y,p.z-oz);')
    material=fixed.once(material,'   const f=features[i];','''   const f=features[i];
     qMark=Number(!!'''+matcher+'''(this.atlasHash,tile.id,i,f.footprint,f.holes));''')
    material=fixed.once(material,'  const mesh=new THREE.Mesh(g,tile.id===','''  g.setAttribute('qaTarget',new THREE.Uint8BufferAttribute(qPick,1));
     const mesh=new THREE.Mesh(g,tile.id===''')
    p.write_text(material)
    m=root/'src/main.ts'
    m.write_text(fixed.once(m.read_text(),'renderer.render(scene,camera);','''
     renderer.render(scene,camera);
     const ww=world as any;
     const regions=ww.tiles.filter((t:any)=>Math.hypot(camera.position.x-t.x0-t.w*.5,camera.position.z-t.z0-t.d*.5)<14500);
     // A decoded texture is still optically changing until the detail fade
     // reaches 1. Capture after it, including in fast offsite controls.
     (window as any).buildingArtReady=regions.every((t:any)=>t.status==='uncovered'||
      (t.status==='ready'&&(t.detailSince===undefined||ww.detailClock?.value-t.detailSince>=.40)));
     (window as any).hallFrames=()=>{
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
       for(let i=0;i<attributes.length;i++)if(attributes[i]===@STYLE@){mark++;if(@ROOFS@.includes(flags[i]))roof++;}
       newMask=saved(block);
       block.geometry=block.userData.priorShell.geometry;
       block.material=block.userData.priorShell.material;
       oldFrame=save();oldMask=saved(block);block.geometry=g;block.material=m;
      }
      return {oldFrame,newFrame,oldMask,newMask,surface,markTriangles:mark/3,roofTriangles:roof/3,
       tileState:buildings?.diagnostics(),details:regions.filter((a:any)=>a.status==='ready').map((a:any)=>a.id).sort(),
       camera:{eye:camera.position.toArray(),aim:[center.x,baseH+qa.h*.5,center.z],orientation:camera.matrixWorld.elements}};
     };
    '''.replace('@STYLE@',str(style)).replace('@ROOFS@',json.dumps(list(roof_roles)))))

def stage(repo,root,deps,void_probe):
    stage_target(repo,root,deps,void_probe,'montagueHallModel',
                 'const hall=this.montagueMat?',47,(41,))

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
              return window.reviewCamera?.frame>20&&window.buildingArtReady&&d?.roads&&d?.mainland&&(!d?.sidewalks||d.sidewalks.pending===0)&&
               !d.detail.loading&&!d.detail.missing&&!d.layerWarnings.length&&t?.pending===0&&t?.loading===0&&t?.failed===0&&t?.ready===t?.wanted;
            })()''',timeout=170000,polling=250)
            except Exception:
                print('unsettled',label,page.evaluate('window.islandAirDiagnostics'),errors,flush=True)
                raise
            data=page.evaluate('window.hallFrames()')
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
            else:assert data['markTriangles'] and data['perceptiblePixels']>600,data
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
