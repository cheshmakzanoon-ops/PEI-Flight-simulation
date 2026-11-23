#!/usr/bin/env python3
"""Compare the shipped Three.js scenery in fixed low farm scenes, with exact matched inputs."""
import argparse,base64,importlib.util,json,os
from PIL import Image
from pathlib import Path
from urllib.parse import quote

s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s)
s.loader.exec_module(fixed)
base_stage=fixed.stage
poses={
 'prince-gambrel-low':dict(lon=-64.1104305,lat=46.682399,h=8.45,east=-87,south=-42,dist=57,agl=16),
 'prince-gambrel-air':dict(lon=-64.1104305,lat=46.682399,h=8.45,east=48,south=-57,dist=131,agl=43),
 'queens-shed-low':dict(lon=-63.292177,lat=46.37246875,h=7.90,east=50,south=51,dist=48,agl=18),
 'queens-shed-mid':dict(lon=-63.292177,lat=46.37246875,h=7.90,east=-29,south=-30,dist=82,agl=28),
 'kings-farm-low':dict(lon=-62.3507815,lat=46.33487925,h=8.30,east=-33,south=55,dist=57,agl=18),
 'kings-farm-air':dict(lon=-62.3507815,lat=46.33487925,h=8.30,east=-38,south=55,dist=134,agl=43),
 'urban-control':dict(lon=-63.12577,lat=46.23798,h=10.0,east=-38,south=-55,dist=56,agl=22),
}

def stage(repo,root,deps,void_probe):
    base_stage(repo,root,deps,void_probe)
    b=root/'src/render/buildings.ts'
    b.write_text(fixed.once(b.read_text(),'this.farms=farmRoofAtlas(atlasHash);',
      "this.farms=farmRoofAtlas(atlasHash)&&!new URLSearchParams(location.search).has('preFarm');"))
    path=root/'src/main.ts'
    path.write_text(fixed.once(path.read_text(),'renderer.render(scene,camera);','''
      renderer.render(scene,camera);
      (window as any).farmReady=(world as any).tiles.filter((t:any)=>Math.hypot(camera.position.x-t.x0-t.w*.5,camera.position.z-t.z0-t.d*.5)<14500)
        .every((t:any)=>t.status==='ready'||t.status==='uncovered');
      (window as any).farmFrame=()=>{renderer.render(scene,camera);return {
       png:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles,
       surfaces:[[center.x,center.z],[center.x,center.z+9],[center.x+12,center.z],[center.x,center.z+35],[f.x,f.z]].map(([x,z])=>world.surface(x,z)),
       details:(world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort(),
       meshes:buildings?.diagnostics(),camera:{eye:[f.x,f.y,f.z],target:[center.x,baseH+qa.h*.5,center.z],m:camera.projectionMatrix.elements.slice(),view:camera.matrixWorldInverse.elements.slice()},
       farmMeshes:scene.children.filter(m=>m instanceof THREE.Mesh&&m.geometry.getAttribute('facadeStyle')?.array.some((v:number)=>v>=7))
        .map(m=>{const a=(m as THREE.Mesh).geometry.getAttribute('facadeStyle').array as Uint8Array;
         return {farmTriangles:a.reduce((c,v)=>c+Number(v>=7),0)/3,position:m.position.toArray()};})
      };};
    '''))
def capture(args,browser,url):
 reports=[]
 for site in args.views.split(','):
  result=[];p=poses[site]
  for before in (True,False):
   context=browser.new_context(viewport=dict(width=1024,height=640),device_scale_factor=1)
   try:
    page=context.new_page();page.set_default_timeout(100000);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    suffix='&preFarm' if before else ''
    page.goto(url+'/?diagnostics'+suffix+'&qa='+quote(json.dumps(p)),wait_until='domcontentloaded')
    page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
    page.wait_for_function('''(()=>{
     const d=window.islandAirDiagnostics,t=d?.buildingTiles;
     return window.reviewCamera?.frame>12&&window.farmReady&&d.roads&&d.mainland&&!d.detail.loading&&
       !d.detail.missing&&!d.layerWarnings.length&&t&&t.pending===0&&t.loading===0&&t.failed===0&&t.ready===t.wanted&&
       (!d.hedgerows||!d.hedgerows.inflight);
    })()''',timeout=210000)
    frame=page.evaluate('window.farmFrame()')
    png=base64.b64decode(frame.pop('png').split(',',1)[1])
    (args.out/f'{site}-{"old" if before else "farm"}.png').write_bytes(png)
    if errors:raise RuntimeError(str(errors))
    result.append(frame)
   finally:context.close()
  assert not result[0]['farmMeshes'],result
  assert result[0]['surfaces']==result[1]['surfaces'] and result[0]['camera']==result[1]['camera'],result
  assert result[0]['draws']==result[1]['draws'],result
  assert result[0]['meshes']==result[1]['meshes'] and result[0]['details']==result[1]['details'],result
  old=Image.open(args.out/f'{site}-old.png').convert('RGB')
  updated=Image.open(args.out/f'{site}-farm.png').convert('RGB')
  assert old.crop((0,0,1024,95)).tobytes()==updated.crop((0,0,1024,95)).tobytes(),'Sky control changed'
  if site=='urban-control':assert old.tobytes()==updated.tobytes(),'Urban control changed'
  stat=dict(site=site,pose=p,old=result[0],farm=result[1])
  reports.append(stat)
  (args.out/'frames.json').write_text(json.dumps(reports,indent=2)+'\n')
  print(site,result[1]['camera']['eye'],result[0]['draws'],result[1]['draws'],
        result[0]['tris'],result[1]['tris'],sum(r['farmTriangles'] for r in result[1]['farmMeshes']),flush=True)

fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--checkout',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--deps',type=Path)
    ap.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    ap.add_argument('--views',default=','.join(poses))
    ap.set_defaults(void_probe=False)
    fixed.run(ap.parse_args())
