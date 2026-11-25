#!/usr/bin/env python3
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image, ImageFilter
import numpy as np
w=Path(__file__).resolve().parent
m=importlib.util.spec_from_file_location('fixed',w/'fixed-scenery.py')
f=importlib.util.module_from_spec(m);m.loader.exec_module(f)
base=f.stage
P={
 'tracadie':dict(lon=-62.97173126551944,lat=46.414650886087024,east=.72,south=-.68,h=.3,dist=7,agl=5),
 'tracadie-approach':dict(lon=-62.97173126551944,lat=46.414650886087024,east=.72,south=-.68,h=.25,dist=24,agl=18),
 'cascumpec':dict(lon=-64.1212494924029,lat=46.76014050082513,east=.76,south=.65,h=.30,dist=8,agl=6),
 'morell':dict(lon=-62.68155086543071,lat=46.42274724471909,east=.8,south=.6,h=.30,dist=8,agl=5.5),
 'high':dict(lon=-62.97173126551944,lat=46.414650886087024,east=.72,south=-.68,h=0,dist=210,agl=450),
}
def stage(repo,root,deps,void):
 base(repo,root,deps,void)
 p=root/'src/render/marsh-foliage/marsh-material.ts';q=p.read_text()
 q=f.once(q,'const uniforms={marshTime:', 'const uniforms={qaMarshMarker:{value:0},marshTime:')
 q=f.once(q,'uniform float marshAGL;', 'uniform float marshAGL,qaMarshMarker;')
 q=f.once(q,'gl_FragColor=vec4(mix(color,vec3(.28,.34,.30),air),fade);',
 'gl_FragColor=vec4(qaMarshMarker>.5?(qaMarshMarker<1.5?vec3(.97,.02,.62):vec3(.02,.93,.04)):mix(color,vec3(.28,.34,.30),air),fade);')
 p.write_text(q)
 p=root/'src/main.ts';q=p.read_text()
 q=f.once(q,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).marshFrame=()=>{
    const g=scene.getObjectByName('Marsh vegetation / original geometry'),q=foliage?.diagnostics();
    const meshes=(g?.children??[]) as THREE.Mesh[];
    const hidden=g?.visible??false;
    const save=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
    if(g)g.visible=false;
    const before=save();
    if(g)g.visible=hidden;
    const after=save();
    const tagged=[...new Set(meshes.map(m=>(m.material as THREE.ShaderMaterial).uniforms))];
    tagged.forEach(u=>u.qaMarshMarker.value=1);const idA=save();
    tagged.forEach(u=>u.qaMarshMarker.value=2);const idB=save();
    tagged.forEach(u=>u.qaMarshMarker.value=0);
    if(g)g.visible=false;
    const repeat=before.image===save().image;
    if(g)g.visible=hidden;
    const ray=new THREE.Raycaster(),m4=new THREE.Matrix4(),pp=new THREE.Vector3();
    const axes=new THREE.Vector3(0,-1,0);
    const tiles=(world as any).tiles.filter(t=>t.coarse?.visible||t.fine?.visible).map(t=>t.fine?.visible?t.fine:t.coarse);
    const roots=[];
    for(const m of meshes as THREE.InstancedMesh[])for(let j=0;j<m.count;j+=Math.max(1,Math.floor(m.count/9))){
      m.getMatrixAt(j,m4);pp.setFromMatrixPosition(m4).applyMatrix4(m.matrixWorld);
      ray.set(new THREE.Vector3(pp.x,pp.y+12,pp.z),axes);
      const ground=ray.intersectObjects(tiles,false)[0]?.point;
      roots.push([pp.x,pp.y,pp.z,ground?pp.y-ground.y:null]);
    }
    return {before,after,idA,idB,q,repeat,roots};
  };
 ''')
 p.write_text(q)
f.stage=stage

def capture(a,browser,url):
 data={}
 for v in a.views.split(','):
  c=browser.new_context(viewport={'width':840,'height':540})
  pg=c.new_page();pg.set_default_timeout(90000);err=[];requests=[]
  pg.on('pageerror',lambda e:err.append(str(e)))
  pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
  pg.on('request',lambda r:requests.append(r.url.rsplit('/',1)[-1]) if 'coastal-marsh' in r.url else None)
  try:
   pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(P[v])),wait_until='domcontentloaded')
   try:f.settle(pg,err)
   except Exception:
    print('boot did not settle',v,err,pg.evaluate('()=>({camera:window.reviewCamera?.frame,diagnostics:window.islandAirDiagnostics?.mode,text:document.body.innerText.slice(-500)})'),flush=True)
    raise
   if v!='high':
    print('pre',v,pg.evaluate('()=>window.islandAirDiagnostics?.marsh'),requests,flush=True)
    try:pg.wait_for_function('id=>window.islandAirDiagnostics?.marsh?.find(x=>x.id===id)?.gain===1',arg=v.split('-')[0],timeout=34000)
    except Exception:
     print('fail',v,pg.evaluate('()=>({at:window.reviewCamera,marsh:window.islandAirDiagnostics?.marsh,details:window.islandAirDiagnostics?.detail})'),requests,err,flush=True)
     raise
   if v!='high':pg.wait_for_function('d=>{const a=window.islandAirDiagnostics?.marshFoliage;return a?.id===d&&(a.near+a.mid)>0}',arg=v.split('-')[0],timeout=50000)
   r=pg.evaluate('window.marshFrame()')
   def clear(label):
    p=a.out/f'{v}-{label}.png';p.write_bytes(base64.b64decode(r[label].pop('image').split(',',1)[1]))
    return np.array(Image.open(p).convert('RGB'),dtype=np.int16)
   old,candidate,aa,bb=[clear(k) for k in ['before','after','idA','idB']]
   assert not err and r['repeat'],err
   rgb=np.max(np.abs(old-candidate),axis=2)
   mask=np.any(aa!=bb,axis=2);halo=np.asarray(Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.MaxFilter(3)))>0
   r['pixelGate']=dict(above2=int((rgb>2).sum()),outside=int((rgb[~halo]>0).sum()),max=int(rgb.max()),marked=int(mask.sum()))
   r['resources']=requests.copy();data[v]=r
   assert r['pixelGate']['outside']==0,r['pixelGate']
   assert all(row[3] is not None and abs(row[3]-.005)<.0002 for row in r['roots']),r['roots']
   (a.out/'report.json').write_text(json.dumps(data,indent=2)+'\n')
   print(v,r['pixelGate'],requests,flush=True)
   if v=='high':assert not requests and not rgb.any(),r
   else:assert r['pixelGate']['above2']>=500 and requests==[v.split('-')[0]+'.red.gz'],r
  finally:c.close()
f.capture=capture
a=argparse.ArgumentParser(description=__doc__)
a.add_argument('--views',default=','.join(P));a.add_argument('--out',type=Path,required=True);a.add_argument('--checkout',type=Path,required=True);a.add_argument('--chromium',required=True)
args=a.parse_args()
args.deps=None;args.void_probe=False;f.run(args)
