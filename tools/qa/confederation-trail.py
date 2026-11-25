#!/usr/bin/env python3
"""Actual Standard Three capture, exact same-frame trail R/G/B A/B and no-write ID.

Patches a temporary copy via fixed-scenery. The flight and source checkout remain
unchanged. Uses no screenshots or pixels from an external website.
"""
import argparse
import base64
import importlib.util
import json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[2])
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',default='chromium')
p.add_argument('--deps',type=Path)
p.add_argument('--views',default='princeOpen,queens,kings,flight,high,off,missing,bad')
p.set_defaults(void_probe=False)
a=p.parse_args()
fixtures={
 'prince':dict(lon=-63.6387592608,lat=46.4376862409,east=.81017,south=.66785,dist=31.,agl=7.8,h=.04),
 'queens':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=31.,agl=7.8,h=.04),
 'kings':dict(lon=-62.6354084039,lat=46.4214545261,east=-.945,south=.327,dist=24.,agl=7.8,h=.04),
 'princeOpen':dict(lon=-63.6860628524,lat=46.4262323223,east=-.911,south=.412,dist=22.,agl=6.8,h=.04),
 'flight':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=178.,agl=105.,h=.04),
 'high':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=810.,agl=520.,h=.04),
 'off':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=31.,agl=7.8,h=.04),
 'missing':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=31.,agl=7.8,h=.04),
 'bad':dict(lon=-63.3480649803,lat=46.3511121287,east=-.60136,south=.86068,dist=31.,agl=7.8,h=.04),
}
qx=(Path(__file__).resolve().parent/'fixed-scenery.py')
spec=importlib.util.spec_from_file_location('fixed',qx)
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f);stage0=f.stage

def stage(repo,temp,deps,unused):
 stage0(repo,temp,deps,unused)
 file=temp/'src/main.ts';old=file.read_text()
 injection=r'''
  (window as any).reviewConfederation=()=>{
   const root=scene.getObjectByName('Main Confederation Trail – mapped stone dust');
   const snap=()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};
   const diagnostic=(window as any).islandAirDiagnostics;
   const ground=()=>{
    const q=project(qa.lon,qa.lat),r=[-24,-8,0,9,23],a=[];
    for(const x of r)for(const z of r)a.push([world.visualGroundHeight(q.x+x,q.z+z),world.groundHeight(q.x+x,q.z+z)]);
    return a;
   };
   const previous=!!root?.visible,normals:THREE.Material[]=[],pos=ground(),meshes=(root?.children??[]) as THREE.Mesh[];
   let minDiagonalLift=Infinity,maxDiagonalLift=-Infinity,vertices=0,measured=0;
   const visible=previous?meshes.filter(m=>m.visible):[];
   for(const m of visible){
    const t=m.geometry.getAttribute('position');vertices+=t.count;
    const step=Math.max(1,Math.floor(t.count/43));
    for(let i=0;i<t.count;i+=step){
     const x=m.position.x+t.getX(i),z=m.position.z+t.getZ(i),y=t.getY(i);
     const g=y-world.visualGroundHeight(x,z);measured++;minDiagonalLift=Math.min(g,minDiagonalLift);maxDiagonalLift=Math.max(g,maxDiagonalLift);
    }
   }
   const idMat=new THREE.MeshBasicMaterial({color:0xf200b4,toneMapped:false,side:THREE.FrontSide});
   try{
    const candidate=snap();
    if(root)root.visible=false;
    const stock=snap(),groundStock=ground();
    if(root)root.visible=previous;
    for(const m of meshes){normals.push(m.material as THREE.Material);m.material=idMat;}
    const id=snap();
    meshes.forEach((m,k)=>m.material=normals[k]);
    return {candidate,stock,id,restore:snap(),groundUnchanged:JSON.stringify(pos)===JSON.stringify(groundStock),
     vertices,measured,minLift:measured?minDiagonalLift:null,maxLift:measured?maxDiagonalLift:null,
     diagnostics:{trail:diagnostic.confederationTrail,terrain:diagnostic.detail,roads:diagnostic.roads,
      scenery:diagnostic.scenery,buildingTiles:diagnostic.buildingTiles,layerWarnings:diagnostic.layerWarnings,
      drawCalls:diagnostic.drawCalls,triangles:diagnostic.triangles}};
   }finally{
    if(root)root.visible=previous;meshes.forEach((m,k)=>{if(normals[k])m.material=normals[k];});idMat.dispose();
   }
  };
'''
 anchor='  renderer.render(scene,camera);'
 file.write_text(f.once(old,anchor,anchor+injection))
f.stage=stage

def dilate(m):
 n=m.copy()
 n[1:]|=m[:-1];n[:-1]|=m[1:];n[:,1:]|=m[:,:-1];n[:,:-1]|=m[:,1:]
 return n

def capture(a,browser,url):
 observations=[]
 for name in a.views.split(','):
  pose=fixtures[name]
  query='?diagnostics&departure=cyyg&qa='+quote(json.dumps(pose,separators=(',',':')))
  if name=='off':query+='&stockConfederationTrail'
  positive=name in ('prince','princeOpen','queens','kings','flight')
  with browser.new_context(viewport={'width':860,'height':595},device_scale_factor=1)as c:
   page=c.new_page();page.set_default_timeout(165000);errors=[];calls=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda m:errors.append(m.text)if m.type=='error'else None)
   page.on('request',lambda r:calls.append(r.url.split('?')[0].rsplit('/',1)[-1])if 'confederation-main.bin.gz' in r.url else None)
   if name=='missing':
    page.route('**/world/trails/odbl/v1/confederation-main.bin.gz',lambda r:r.fulfill(status=404,body='missing'))
   if name=='bad':
    page.route('**/world/trails/odbl/v1/confederation-main.bin.gz',lambda r:r.fulfill(status=200,body=b'x'*1731))
   page.goto(url+query,wait_until='domcontentloaded')
   page.wait_for_function('() => window.reviewCamera?.frame>9 && window.islandAirDiagnostics?.mode==="dispatch"')
   assert not calls,(name,'no trail transfer in dispatch',calls)
   page.get_by_role('button',name='Begin flight').click()
   page.wait_for_function('() => window.islandAirDiagnostics?.mode==="flight"')
   page.wait_for_function('() => window.reviewCamera?.frame>16 && window.islandAirDiagnostics?.buildingTiles?.loading===0 && window.islandAirDiagnostics?.detail?.loading===0')
   if positive:
    page.wait_for_function('() => {const t=window.islandAirDiagnostics?.confederationTrail;return t?.status==="ready"&&t.visible>0&&t.pending===0;}')
   if name in ('missing','bad'):
    page.wait_for_function('() => window.islandAirDiagnostics?.confederationTrail?.status==="unavailable"')
   r=page.evaluate('window.reviewConfederation()')
   pixels={}
   for k in ('candidate','stock','id','restore'):
    data=base64.b64decode(r.pop(k).split(',')[1])
    fn=a.out/(name+'-'+k+'.png')
    fn.write_bytes(data)
    pixels[k]=np.asarray(Image.open(fn).convert('RGB'))
   diff=np.any(pixels['candidate']!=pixels['stock'],axis=2)
   mask=np.any(pixels['id']!=pixels['stock'],axis=2)
   outside=int((diff&~dilate(mask)).sum())
   strong=int(np.any(np.abs(pixels['candidate'].astype('int16')-pixels['stock'])>12,axis=2).sum())
   assert outside==0 and r['groundUnchanged'] and np.array_equal(pixels['candidate'],pixels['restore']),(name,r)
   # Browser reports shader link errors before the visible-pixel criterion.
   errors=[e for e in errors if not(name=='missing' and '404' in e)]
   assert not errors,(name,errors)
   if positive:
    assert diff.sum()>160 and strong>100 and len(calls)==1 and r['minLift']>=.0198 and r['maxLift']<=.0332,(name,r)
   else:
    assert not diff.any() and not mask.any() and len(calls)==int(name in ('missing','bad')),(name,r,calls)
   item=dict(name=name,pose=pose,changedPixels=int(diff.sum()),strongPixels=strong,idPixels=int(mask.sum()),
    outsideOnePixelMask=outside,repeatIdentical=True,assetRequestCount=len(calls),**r)
   observations.append(item);print(name,item,flush=True)
   (a.out/'results.json').write_text(json.dumps(observations,indent=2)+'\n')
f.capture=capture
f.run(a)
