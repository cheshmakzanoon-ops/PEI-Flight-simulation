#!/usr/bin/env python3
"""Capture the optional sidewalk layer before/after within one loaded Three.js frame."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

from PIL import Image
import numpy as np

q = importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(q)
q.loader.exec_module(fixed)
base_stage = fixed.stage

POSES = {
 'charlottetown-concrete': dict(lon=-63.1233501012,lat=46.2419428722,east=.7339666,south=-.6791855,dist=30,h=0,agl=19),
 'charlottetown-district': dict(lon=-63.1268,lat=46.2413,east=.51,south=.86,dist=180,h=0,agl=75),
 'charlottetown-residential': dict(lon=-63.1283761169,lat=46.2532569486,east=-.4278601,south=-.903845,dist=31,h=0,agl=16),
 'summerside-pavers': dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=29,h=0,agl=18),
 'kensington-concrete': dict(lon=-63.6368658433,lat=46.436972277,east=-.8459997,south=.5331834,dist=19,h=0,agl=16),
 'east-coast-control': dict(lon=-61.9718333333,lat=46.452527778,east=.91,south=-.415,dist=125,h=19.5,agl=45),
}


def stage(repo,root,deps,void_probe):
    base_stage(repo,root,deps,void_probe)
    main=root/'src/main.ts'
    main.write_text(fixed.once(main.read_text(),'renderer.render(scene,camera);','''
    renderer.render(scene,camera);
    const regions=(world as any).tiles.filter((t:any)=>Math.hypot(camera.position.x-t.x0-t.w*.5,camera.position.z-t.z0-t.d*.5)<14500);
    (window as any).walkAtlasReady=regions.every((t:any)=>t.status==='ready'||t.status==='uncovered');
    (window as any).captureWalk=()=>{
     const g=scene.getObjectByName('Mapped PEI sidewalk ribbons');
     const save=()=>{
      renderer.render(scene,camera);
      return {image:renderer.domElement.toDataURL('image/png'),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
     };
     const samples=[[center.x,center.z],[center.x+2,center.z],[center.x,center.z+45],[f.x,f.z]];
     const surface=samples.map(([x,z])=>world.surface(x,z));
     const art=save();
     if(g)g.visible=false;
     const old=save();
     if(g)g.visible=true;
     const test=new THREE.MeshBasicMaterial({color:0x00ff16,toneMapped:false}),materials:THREE.Material[]=[];
     (g?.children??[]).forEach(o=>{const m=o as THREE.Mesh;materials.push(m.material as THREE.Material);m.material=test;});
     const mask=g?save():old;
     (g?.children??[]).forEach((o,i)=>(o as THREE.Mesh).material=materials[i]);test.dispose();
     const tiles=(g?.children??[]) as THREE.Mesh[];
     const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
     let checked=0,maxSeatError=0,maxAnalyticError=0,minSigned=Infinity;
     for(const m of tiles){
      const pos=m.geometry.getAttribute('position'),at=m.geometry.getAttribute('walkStyle'),n=m.geometry.drawRange.count;
      for(let i=0;i+2<n;i+=3){
       if(at.getY(i)>.5||i%39)continue;
       const x=m.position.x+(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3;
       const y=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3;
       const z=m.position.z+(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;
       const w=(world as any).tiles.find((p:any)=>x>p.x0&&x<p.x0+p.w&&z>p.z0&&z<p.z0+p.d);
       if(!w)throw Error('No rendered sidewalk substrate');
       ray.set(new THREE.Vector3(x,y+12,z),down);const k=ray.intersectObject((w.lod>8?w.fine:w.coarse),false)[0];
       if(!k)throw Error('No terrain ray below a rendered sidewalk');
       const p=world.visualGroundHeight(x,z),c=world.cover.distance(world.terrain,x,z);
       if(maxSeatError<Math.abs(y-k.point.y-.082))maxSeatError=Math.abs(y-k.point.y-.082);
       maxAnalyticError=Math.max(maxAnalyticError,Math.abs(p-k.point.y));minSigned=Math.min(c,minSigned);checked++;
      }
     }
     return {art,old,mask,surface,roadBefore:scene.getObjectByName('PEI National Road Network')?.children.length??0,
      meshes:buildings?.diagnostics(),groundSignature:regions.map((p:any)=>[p.id,p.status,p.lod]).sort(),
      state:sidewalks?.state??null,stats:{checked,maxSeatError,maxAnalyticError,minSigned:checked?minSigned:null},shadows:world.buildingShadows?.state??null};
    };
    '''))


def capture(args,browser,url):
    reports=[]
    for site in args.views.split(','):
        pose=POSES[site]
        context=browser.new_context(viewport=dict(width=1024,height=640),device_scale_factor=1)
        try:
            page=context.new_page();page.set_default_timeout(100000);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            q='&buildingShadows' if args.shadows else ''
            page.goto(url+'/?diagnostics'+q+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
            try:page.wait_for_function('''(()=>{
               const d=window.islandAirDiagnostics,t=d?.buildingTiles,v=d?.sidewalks;
               return window.reviewCamera?.frame>30&&window.walkAtlasReady&&d.roads&&d.mainland&&!d.detail.loading&&
                 !d.detail.missing&&!d.layerWarnings.length&&t&&t.pending===0&&t.loading===0&&t.failed===0&&t.ready===t.wanted&&
                 v?.pending===0&&(!d.hedgerows||!d.hedgerows.inflight);
            })()''',timeout=190000,polling=250)
            except Exception:
                print(site,'unsettled',page.evaluate('({diag:window.islandAirDiagnostics,qa:window.reviewCamera,walkAtlasReady:window.walkAtlasReady,ui:document.body.innerText.slice(-250)})'),errors,flush=True)
                raise
            if args.shadows:page.wait_for_function('window.islandAirDiagnostics?.buildingShadows?.active',timeout=90000)
            frame=page.evaluate('window.captureWalk()')
            if errors:raise RuntimeError(str(errors))
            for art in ('old','art','mask'):
                png=base64.b64decode(frame[art].pop('image').split(',',1)[1])
                (args.out/f'{site}-{art}.png').write_bytes(png)
            a,b,m=[np.asarray(Image.open(args.out/f'{site}-{x}.png').convert('RGB'),np.int16) for x in ('old','art','mask')]
            diff=np.max(np.abs(a-b),axis=-1);eligible=np.max(np.abs(a-m),axis=-1)>0
            # The semantic material and alpha-covered artwork can resolve
            # differently across an AA fringe. Admit only the adjacent pixel.
            front=eligible;pad=np.pad(front,1);h,w=front.shape
            eligible=np.zeros_like(front)
            for y in range(3):
                for x in range(3):eligible |= pad[y:y+h,x:x+w]
            if (diff[~eligible]>0).any():raise AssertionError((site,int((diff[~eligible]>0).sum())))
            if site=='east-coast-control':
                assert not diff.any() and not frame['state']['tiles'] and not frame['stats']['checked']
            else:
                assert (diff>4).sum()>300 and frame['stats']['checked']>0 and frame['stats']['maxSeatError']<.006,frame
            frame['pixels']=dict(changed=int((diff>0).sum()),perceptible=int((diff>4).sum()),
               unchangedOutside=int((~eligible).sum()),aaFringePixels=int(((diff>0)&(~front)).sum()),imageSize=list(a.shape[:2][::-1]))
            reports.append(dict(site=site,pose=pose,**frame))
            (args.out/'report.json').write_text(json.dumps(reports,indent=2)+'\n')
            print(site,frame['old']['calls'],frame['art']['calls'],frame['old']['triangles'],frame['art']['triangles'],
                  frame['pixels'],frame['stats'],flush=True)
        finally:
            context.close()


fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--checkout',type=Path,required=True);a.add_argument('--out',type=Path,required=True)
    a.add_argument('--deps',type=Path);a.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    a.add_argument('--views',default=','.join(POSES));a.add_argument('--shadows',action='store_true')
    a.set_defaults(void_probe=False)
    fixed.run(a.parse_args())
