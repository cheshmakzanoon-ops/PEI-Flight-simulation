#!/usr/bin/env python3
"""Paired real Three.js roof geometry images for a measured footprint, with all non-target vertices checked."""
import argparse
import base64
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
base_stage=fixed.stage
QUARTERMASTER={
 'harbour-aerial':dict(lon=-63.12218866308732,lat=46.231650691117366,dist=136.70732846082151,
  east=136.38569541381275,south=-9.372072416794254,fixedEyeY=88.053,fixedBaseH=3,h=0,agl=0),
 'harbour-low':dict(lon=-63.12178,lat=46.23146,dist=141,east=78,south=117,fixedEyeY=19,fixedBaseH=.5,h=0,agl=0),
}
SOURIS={
 'souris-aerial':dict(lon=-62.242203,lat=46.346414,dist=265,east=-110,south=241,fixedEyeY=115,fixedBaseH=25,h=0,agl=0),
 'souris-low':dict(lon=-62.242203,lat=46.346414,dist=182,east=155,south=95,fixedEyeY=43,fixedBaseH=25,h=0,agl=0),
}
PROFILES={
 'quartermaster':dict(poses=QUARTERMASTER,tile='q12000111',index=22,anchor='supportedQuartermasterRoof(this.atlasHash'),
 'souris':dict(poses=SOURIS,tile='q131',index=221,anchor='matchesSurveyRoof(SOURIS_ROOF,this.atlasHash'),
}
profile=PROFILES['quartermaster']

def stage(repo,root,deps,void_probe):
    base_stage(repo,root,deps,void_probe)
    main=root/'src/main.ts'
    main.write_text(fixed.once(main.read_text(),'renderer.render(scene,camera);','''
      renderer.render(scene,camera);
      (window as any).captureRoof=()=>{
        const pair=(window as any).surveyRoofQA;
        if(!pair)throw Error('Measured target building tile has not loaded');
        const shots=[];
        for(const old of [true,false]){
          pair.toggle(old);renderer.render(scene,camera);
          shots.push({image:renderer.domElement.toDataURL('image/png'),triangles:renderer.info.render.triangles,calls:renderer.info.render.calls});
        }
        pair.toggle(false);
        return {shots,referenced:pair.referenced,excludedVertices:pair.excludedVertices};
      };
    '''))
    f=root/'src/render/buildings.ts'
    b=fixed.once(f.read_text(),'private generate(features:Bldg[],tile:BoundTile){',
                 'private generate(features:Bldg[],tile:BoundTile,fitTiers=true){')
    b=fixed.once(b,'if('+profile['anchor'],'if(fitTiers&&'+profile['anchor'])
    patch='''
      this.meshes.set(tile.id,mesh);this.scene.add(mesh);
      if(tile.id==='__TILE__'){
        const original=this.generate(chunk.features,tile,false);
        const prefix=this.generate(chunk.features.slice(0,__FEATURE__),tile,false).geometry;
        const oldOne=this.generate(chunk.features.slice(__FEATURE__,__AFTER__),tile,false).geometry;
        const newOne=this.generate(chunk.features.slice(__FEATURE__,__AFTER__),tile).geometry;
        const checked={};
        for(const n of Object.keys(mesh.geometry.attributes)){
          const a=original.geometry.attributes[n].array,b=mesh.geometry.attributes[n].array;
          const start=prefix.attributes[n].array.length,lenOld=oldOne.attributes[n].array.length,lenNew=newOne.attributes[n].array.length;
          if(a.length-lenOld!==b.length-lenNew)throw Error('Unrelated '+n+' count changed');
          for(let i=0;i<start;i++)if(!Object.is(a[i],b[i]))throw Error('Earlier '+n+' differs at '+i);
          for(let i=start+lenOld,j=start+lenNew;i<a.length;i++,j++)if(!Object.is(a[i],b[j]))throw Error('Later '+n+' differs at '+i);
          checked[n]=a.length-lenOld;
        }
        for(const h of [prefix,oldOne,newOne])h.dispose();
        original.visible=false;this.scene.add(original);
        (window as any).surveyRoofQA={
          referenced:tile.id,excludedVertices:checked,
          toggle:(old:boolean)=>{mesh.visible=!old;original.visible=old;}
        };
      }
    '''
    patch=patch.replace('__TILE__',profile['tile']).replace('__FEATURE__',str(profile['index'])).replace('__AFTER__',str(profile['index']+1))
    f.write_text(fixed.once(b,'this.meshes.set(tile.id,mesh);this.scene.add(mesh);',patch))

def capture(args,browser,url):
    reports=[]
    poses=profile['poses']
    for name in args.views.split(','):
        context=browser.new_context(viewport={'width':1000,'height':600},device_scale_factor=1)
        try:
            page=context.new_page();page.set_default_timeout(90000);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(poses[name])),wait_until='domcontentloaded')
            diag=fixed.settle(page,errors)
            page.wait_for_function('id=>window.surveyRoofQA?.referenced===id',arg=profile['tile'])
            data=page.evaluate('window.captureRoof()')
            readings=[]
            for label,shot in zip(('original','measured'),data['shots'],strict=True):
                payload=shot.pop('image').split(',',1)[1]
                (args.out/f'{name}-{label}.png').write_bytes(base64.b64decode(payload))
                readings.append(shot)
            assert readings[0]['calls']==readings[1]['calls'],readings
            assert readings[0]['triangles']<readings[1]['triangles']<=readings[0]['triangles']+1250,readings
            reports.append(dict(view=name,pose=poses[name],detail=diag['detail'],render=readings,
                  unchangedNeighbourScalars=data['excludedVertices']))
            print(json.dumps(reports[-1]),flush=True)
        finally:
            context.close()
    (args.out/'report.json').write_text(json.dumps(reports,indent=2)+'\n')


if __name__=='__main__':
    fixed.stage=stage;fixed.capture=capture
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'));p.add_argument('--deps',type=Path)
    p.add_argument('--site',choices=PROFILES,default='quartermaster');p.add_argument('--views')
    p.set_defaults(void_probe=False)
    args=p.parse_args();profile=PROFILES[args.site]
    if not args.views:args.views=','.join(profile['poses'])
    fixed.run(args)
