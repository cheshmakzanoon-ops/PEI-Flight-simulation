#!/usr/bin/env python3
"""Paired actual Standard Three.js sidewalk finish, semantic ID and subpixel motion."""
import argparse
import base64
import json
import os
from pathlib import Path
from urllib.parse import quote

import numpy as np
from PIL import Image
import importlib.util
spec = importlib.util.spec_from_file_location("fixed_scenery", Path(__file__).with_name("fixed-scenery.py"))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)

stage_base = fixed.stage
POSES = {
 'charlottetown': dict(lon=-63.1233501012,lat=46.2419428722,east=.7339666,south=-.6791855,dist=18,h=0,agl=11),
 'residential': dict(lon=-63.1283761169,lat=46.2532569486,east=-.4278601,south=-.903845,dist=21,h=0,agl=10),
 'kensington': dict(lon=-63.6368658433,lat=46.436972277,east=-.8459997,south=.5331834,dist=14,h=0,agl=10),
 'summerside': dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=19,h=0,agl=10),
 'far': dict(lon=-63.1233501012,lat=46.2419428722,east=.7339666,south=-.6791855,dist=210,h=0,agl=105),
 'offsite': dict(lon=-61.9718333333,lat=46.452527778,east=.91,south=-.415,dist=125,h=19.5,agl=45),
}

def stage(repo,root,deps,void_probe):
    stage_base(repo,root,deps,void_probe)
    p=root/'src/render/sidewalk-material.ts'
    src=p.read_text()
    src=fixed.once(src,'uniforms:{walkSun', 'uniforms:{qaConcrete:{value:1},walkSun')
    src=fixed.once(src,'uniform vec3 walkSun', 'uniform float qaConcrete; uniform vec3 walkSun')
    src=fixed.once(src,'c=concreteSidewalkFinish(c,wp.xz,spectral,dist,walk.x>=.5);',
      'if(qaConcrete==1.)c=concreteSidewalkFinish(c,wp.xz,spectral,dist,walk.x>=.5);')
    src=fixed.once(src,'#include <tonemapping_fragment>', '''if(qaConcrete>=2.){
        gl_FragColor=vec4((walk.y<.5&&walk.x<1.5)?
          (qaConcrete==2.?vec3(.008,.98,.012):vec3(.97,.01,.96)):
          (qaConcrete==4.?vec3(.012,.84,.98):vec3(.92,.045,.014)),fade);
        return;
      }
      #include <tonemapping_fragment>''')
    p.write_text(src)
    p=root/'src/main.ts'
    p.write_text(fixed.once(p.read_text(),'renderer.render(scene,camera);','''renderer.render(scene,camera);
    (window as any).walkRegions=(world as any).tiles.filter((t:any)=>Math.hypot(camera.position.x-t.x0-t.w*.5,camera.position.z-t.z0-t.d*.5)<14500)
      .every((t:any)=>t.status==='ready'||t.status==='uncovered');
    (window as any).captureConcrete=()=>{
      const g=scene.getObjectByName('Mapped PEI sidewalk ribbons');
      const meshes=(g?.children??[]) as THREE.Mesh[];
      const mats=[...new Set(meshes.map(o=>o.material as THREE.ShaderMaterial))];
      const saved=camera.position.clone();
      const positions=[0,.005,.010,.015,.020],samples=['old','new','idA','idB','protected'];
      const result=positions.map((dx)=>{
        camera.position.x=saved.x+dx;camera.updateMatrixWorld();
        return Object.fromEntries(samples.map((kind,index)=>{
          for(const mat of mats)mat.uniforms.qaConcrete.value=index;
          renderer.render(scene,camera);
          return [kind,{image:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,tris:renderer.info.render.triangles}];
        }));
      });
      camera.position.copy(saved);camera.updateMatrixWorld();
      for(const mat of mats)mat.uniforms.qaConcrete.value=1;
      return {result,owners:meshes.length};
    };
    '''))

def capture(args,browser,url):
    report=[]
    for site in args.views.split(','):
        pose=POSES[site]
        ctx=browser.new_context(viewport={'width':896,'height':592},device_scale_factor=1)
        try:
            page=ctx.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.wait_for_function('''(()=>{const d=window.islandAirDiagnostics,t=d?.buildingTiles;
               return window.reviewCamera?.frame>28 && window.walkRegions && d.roads && d.mainland &&
               !d.detail.loading && !d.detail.missing && !d.layerWarnings.length &&
               t && !t.pending && !t.loading && !t.failed && t.ready===t.wanted &&
               d.sidewalks?.pending===0 && (!d.hedgerows||!d.hedgerows.inflight);
             })()''',timeout=175000,polling=240)
            raw=page.evaluate('window.captureConcrete()')
            assert not errors,errors
            diffs=[]; rows=[]
            for i,pair in enumerate(raw['result']):
                arrays=[]
                for label in ('old','new','idA','idB','protected'):
                    data=base64.b64decode(pair[label].pop('image').split(',',1)[1])
                    path=args.out/f'{site}-{i}-{label}.png'
                    path.write_bytes(data)
                    arrays.append(np.asarray(Image.open(path).convert('RGB'),np.int16))
                old,new,id_a,id_b,id_p=arrays
                delta=id_a-id_b
                full=(delta[:,:,0]<-161)&(delta[:,:,1]>142)&(delta[:,:,2]<-153)
                covered=np.any(delta!=0,axis=2)
                other=id_b-id_p
                opposite=(other[:,:,0]>148)&(other[:,:,1]<-122)&(other[:,:,2]<-152)&~covered
                # Sample exact solid output. Exterior coverage may occupy one AA fringe only.
                pad=np.pad(covered,1)
                h,w=full.shape
                admit=np.zeros_like(full)
                for y in range(3):
                    for x in range(3):admit|=pad[y:y+h,x:x+w]
                signed=new-old; diff=np.max(np.abs(signed),axis=2)
                assert pair['old']==pair['new'],pair
                rows.append(dict(concrete=int(full.sum()),other=int(opposite.sum()),over2=int((diff>2).sum()),
                  changed=int((diff>0).sum()),max=int(diff.max()),outside=int(((diff>0)&~admit).sum()),
                  protected=int(((diff>0)&opposite).sum()),counts=pair['new']))
                diffs.append((signed,full))
            motion=np.concatenate([np.max(np.abs(b-a),axis=2)[u&v] for (a,u),(b,v) in zip(diffs,diffs[1:])])
            row=dict(site=site,pose=pose,owners=raw['owners'],pairs=rows,
                motionCount=len(motion),motionP99=float(np.percentile(motion,99)) if len(motion) else 0)
            report.append(row)
            (args.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
            print(site,raw['owners'],rows[0], row['motionP99'],flush=True)
            assert all(not x['outside'] and not x['protected'] for x in rows),row
            if site in ('far','offsite'): assert all(not x['changed'] for x in rows),row
            if site in ('charlottetown','residential','kensington'):
                assert all(x['over2']>=500 for x in rows) and row['motionP99']<=4.,row
        finally:
            ctx.close()

fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--deps',type=Path)
    parser.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    parser.add_argument('--views',default=','.join(POSES))
    parser.set_defaults(void_probe=False)
    fixed.run(parser.parse_args())
