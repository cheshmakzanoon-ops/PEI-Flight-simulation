#!/usr/bin/env python3
"""Compare the shipped Three.js scenery in fixed residential scenery, with exact matched inputs."""
import argparse,base64,importlib.util,json,math,os
from PIL import Image
from pathlib import Path
from urllib.parse import quote

s=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(s)
s.loader.exec_module(fixed)
base_stage=fixed.stage
poses={
 'queens-house-low':dict(lon=-63.10588925,lat=46.2657475,h=6.07,east=-31,south=6,dist=32,agl=16),
 'queens-neighborhood-air':dict(lon=-63.1069640,lat=46.26511125,h=5.56,east=-69,south=-58,dist=97,agl=43),
 'prince-house-low':dict(lon=-63.7970225,lat=46.40764225,h=4.94,east=24,south=-7,dist=32,agl=16),
 'prince-neighborhood-air':dict(lon=-63.79341075,lat=46.40663725,h=5.54,east=48,south=-81,dist=77,agl=43),
 'kings-house-low':dict(lon=-62.636780166666675,lat=46.16462716666667,h=6.99,east=24,south=17,dist=30,agl=16),
 'east-coast-control':dict(lon=-61.9718333333,lat=46.452527778,h=19.5,east=.91,south=-.415,dist=125,agl=45),
}

def stage(repo,root,deps,void_probe):
    base_stage(repo,root,deps,void_probe)
    b=root/'src/render/buildings.ts'
    b.write_text(fixed.once(b.read_text(),'this.homes=homeRoofAtlas(atlasHash);',
      "this.homes=homeRoofAtlas(atlasHash)&&!new URLSearchParams(location.search).has('preHome');"))
    path=root/'src/main.ts'
    path.write_text(fixed.once(path.read_text(),'renderer.render(scene,camera);','''
      renderer.render(scene,camera);
      (window as any).homesReady=(world as any).tiles.filter((t:any)=>Math.hypot(camera.position.x-t.x0-t.w*.5,camera.position.z-t.z0-t.d*.5)<14500)
        .every((t:any)=>t.status==='ready'||t.status==='uncovered');
      (window as any).homesFrame=()=>{renderer.render(scene,camera);const probe=[];
        const ray=new THREE.Raycaster(),surfaces:THREE.Object3D[]=[];
        scene.traverseVisible(o=>{if(o instanceof THREE.Mesh)surfaces.push(o);});
        for(const [x,y] of [[514,12],[4,3],[500,2]]) {
          ray.setFromCamera(new THREE.Vector2(x/512-1,1-y/320),camera);
          probe.push(ray.intersectObjects(surfaces,false).slice(0,5).map(q=>({dist:q.distance,
             name:q.object.name||q.object.parent?.name,label:(q.object as THREE.Mesh).material?.type,
             isInstanced:(q.object as any).isInstancedMesh??false,uuid:q.object.uuid,size:(q.object as THREE.Mesh).geometry.getAttribute('position')?.count})));
        }
        return {probe,
       png:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles,
       surfaces:[[center.x,center.z],[center.x,center.z+9],[center.x+12,center.z],[center.x,center.z+35],[f.x,f.z]].map(([x,z])=>world.surface(x,z)),
       details:(world as any).tiles.filter((t:any)=>t.status==='ready').map((t:any)=>t.id).sort(),
       meshes:buildings?.diagnostics(),camera:{eye:[f.x,f.y,f.z],target:[center.x,baseH+qa.h*.5,center.z],m:camera.projectionMatrix.elements.slice(),view:camera.matrixWorldInverse.elements.slice()},
       homeMeshes:scene.children.filter(m=>m instanceof THREE.Mesh&&m.geometry.getAttribute('facadeStyle')?.array.some((v:number)=>v>=10))
        .map(m=>{const a=(m as THREE.Mesh).geometry.getAttribute('facadeStyle').array as Uint8Array;
         return {homeTriangles:a.reduce((c,v)=>c+Number(v>=10),0)/3,position:m.position.toArray()};})
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
    suffix=('&preHome' if before else '')+('&buildingShadows' if args.shadows else '')
    page.goto(url+'/?diagnostics'+suffix+'&qa='+quote(json.dumps(p)),wait_until='domcontentloaded')
    page.add_style_tag(content='body *{visibility:hidden!important} #world{visibility:visible!important}')
    page.wait_for_function('''(()=>{
     const d=window.islandAirDiagnostics,t=d?.buildingTiles;
     return window.reviewCamera?.frame>12&&window.homesReady&&d.roads&&d.mainland&&!d.detail.loading&&
       !d.detail.missing&&!d.layerWarnings.length&&t&&t.pending===0&&t.loading===0&&t.failed===0&&t.ready===t.wanted&&
       (!d.hedgerows||!d.hedgerows.inflight);
    })()''',timeout=210000)
    if args.shadows:page.wait_for_function('window.islandAirDiagnostics?.buildingShadows?.active',timeout=90000)
    frame=page.evaluate('window.homesFrame()')
    frame['shadows']=page.evaluate('window.islandAirDiagnostics.buildingShadows??null')
    png=base64.b64decode(frame.pop('png').split(',',1)[1])
    (args.out/f'{site}-{"old" if before else "home"}.png').write_bytes(png)
    if errors:raise RuntimeError(str(errors))
    result.append(frame)
   finally:context.close()
  assert not result[0]['homeMeshes'],result
  assert result[0]['surfaces']==result[1]['surfaces'] and result[0]['camera']==result[1]['camera'],result
  assert result[0]['draws']==result[1]['draws'],result
  assert result[0]['meshes']==result[1]['meshes'] and result[0]['details']==result[1]['details'],result
  old=Image.open(args.out/f'{site}-old.png').convert('RGB')
  updated=Image.open(args.out/f'{site}-home.png').convert('RGB')
  eye=result[1]['camera']['eye']
  aim=result[1]['camera']['target']
  # In a steep 16m low view the geometric horizon can be right
  # at the top of the frame. Do not classify distant suburbs as sky.
  pitch=(aim[1]-eye[1])/math.hypot(aim[0]-eye[0],aim[2]-eye[2])
  sky=max(0,min(95,int(320*(1.+pitch/math.tan(math.radians(53*.5))))-27))
  if sky:
   assert old.crop((0,0,1024,sky)).tobytes()==updated.crop((0,0,1024,sky)).tobytes(),'Sky control changed'
  if site=='east-coast-control':assert old.tobytes()==updated.tobytes(),'Offsite coast changed'
  stat=dict(site=site,pose=p,exactSkyPixels=sky*1024,old=result[0],home=result[1])
  reports.append(stat)
  (args.out/'frames.json').write_text(json.dumps(reports,indent=2)+'\n')
  print(site,result[1]['camera']['eye'],result[0]['draws'],result[1]['draws'],
        result[0]['tris'],result[1]['tris'],sum(r['homeTriangles'] for r in result[1]['homeMeshes']),flush=True)

fixed.stage,fixed.capture=stage,capture
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--checkout',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--deps',type=Path)
    ap.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    ap.add_argument('--views',default=','.join(poses))
    ap.add_argument('--shadows',action='store_true')
    ap.set_defaults(void_probe=False)
    fixed.run(ap.parse_args())
