#!/usr/bin/env python3
"""Actual Standard Tracadie detail join and independently selected same-scene controls."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base=fixed.stage
P={
 'tracadie':dict(lon=-62.97173126551944,lat=46.41460590631685,east=.72,south=-.68,h=0,dist=80,agl=47),
 'reciprocal':dict(lon=-62.97173126551944,lat=46.41460590631685,east=-.72,south=.68,h=0,dist=65,agl=38),
 'high':dict(lon=-62.97173126551944,lat=46.41460590631685,east=.72,south=-.68,h=0,dist=250,agl=360),
 'offsite':dict(lon=-62.681616001322986,lat=46.42270226494891,east=.8,south=.6,h=0,dist=53,agl=28),
}
def stage(repo,root,deps,void):
 base(repo,root,deps,void)
 p=root/'src/render/orthophoto-seams.ts';s=p.read_text()
 s=fixed.once(s,'uniform float orthoRowsGain;', 'uniform float orthoRowsGain,qaOrthoID;')
 s=fixed.once(s,'col=mix(col,canonical,w*orthoRowsGain);',
 'col=qaOrthoID>0.&&w>.000001?(qaOrthoID<1.5?vec3(.98,.01,.72):vec3(.02,.87,.07)):mix(col,canonical,w*orthoRowsGain);')
 s=fixed.once(s,'orthoRowsGain:pair.gain};','orthoRowsGain:pair.gain,qaOrthoID:{value:0}};')
 p.write_text(s)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).seamFrame=()=>{
   const q=(ortho as any)?.pairs?.[0],u=(world as any).tiles.filter(t=>t.id==='18-12'||t.id==='18-13')
       .map(t=>t.local.uniforms.qaOrthoID).filter(Boolean);
   const save=()=>{
      renderer.render(scene,camera);
      return {image:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};
   };
   const gain=q?.gain.value??0;
   if(q)q.gain.value=0;
   const old=save();
   if(q)q.gain.value=gain;
   const art=save();
   u.forEach(v=>v.value=1);const idA=save();
   u.forEach(v=>v.value=2);const idB=save();
   u.forEach(v=>v.value=0);
   if(q)q.gain.value=0;
   const exact=old.image===save().image;
   if(q)q.gain.value=gain;
   const d=(world as any).tiles.filter(t=>t.id==='18-12'||t.id==='18-13')
       .map(t=>({id:t.id,loaded:!!t.detail,status:t.status,lod:t.lod,n:t.local.uniforms.hasDetail.value}));
   // Independent XZ boundary measured from manifest grid; stock visual Y
   // is used only to project matched nearby sample coordinates to pixels.
   const z=terrain.top+13*(terrain.bottom-terrain.top)/22;
   const focus=project(qa.lon,qa.lat);
   const rays=[];
   for(let x=focus.x-230;x<focus.x+230;x+=2){
    const y=(a)=>world.visualGroundHeight(x,a);
    const pts=[z-1.3,z-.35,z+.35,z+1.3].map(a=>{
      const p=new THREE.Vector3(x,y(a),a).project(camera);
      return [(p.x*.5+.5)*innerWidth,(.5-.5*p.y)*innerHeight];
    });
    if(pts.every(([a,b])=>a>=1&&a<innerWidth-1&&b>=1&&b<innerHeight-1))rays.push([x,pts]);
   }
   return {old,art,idA,idB,gain,exact,slots:d,rays,seam:ortho?.diagnostics()??[]};
  };
 ''')
 p.write_text(s)
fixed.stage=stage

def capture(a,browser,url):
 results={}
 for site in a.views.split(','):
  pg=browser.new_page(viewport={'width':840,'height':540});errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  try:
   pg.goto(url+'/?diagnostics'+('&stockTracadieOrtho' if a.stock else '')+'&qa='+quote(json.dumps(P[site])),wait_until='domcontentloaded')
   live=fixed.settle(pg,errors)
   if not a.stock and site!='offsite':
    pg.wait_for_function('window.islandAirDiagnostics?.orthophotoSeams?.[0]?.gain===1',polling=250,timeout=120000)
   r=pg.evaluate('window.seamFrame()')
   def consume(label):
    p=a.out/(site+'-'+label+'.png')
    p.write_bytes(base64.b64decode(r[label].pop('image').split(',',1)[1]))
    return np.asarray(Image.open(p).convert('RGB'),np.float32)
   old,art,qa,qb=[consume(v) for v in ('old','art','idA','idB')]
   assert r['old']==r['art'] and r['exact'] and not errors,(site,r,errors)
   marker=np.any(qa!=qb,axis=2)
   bound=np.asarray(Image.fromarray(np.uint8(marker)*255).filter(ImageFilter.MaxFilter(3)))>0
   diff=np.max(abs(old-art),axis=2)
   r['pixelGate']=dict(changed=int((diff>0).sum()),over2=int((diff>2).sum()),outside=int((diff[~bound]>0).sum()),mask=int(marker.sum()))
   assert not r['pixelGate']['outside'],r['pixelGate']
   def tap(im,xy):
    x,y=xy;x-=.5;y-=.5
    j,i=int(x),int(y);u,v=x-j,y-i
    return im[i,j]*(1-u)*(1-v)+im[i,j+1]*u*(1-v)+im[i+1,j]*(1-u)*v+im[i+1,j+1]*u*v
   pairs=[]
   for metre,points in r.pop('rays'):
    (a0,b0,c0,d0)=points
    x=np.mean([b0[0],c0[0]]);y=np.mean([b0[1],c0[1]])
    if not marker[int(y),int(x)]:continue
    if np.linalg.norm(np.array(b0)-c0)<1.6:continue
    oldd=float(np.linalg.norm(tap(old,b0)-tap(old,c0)))
    newd=float(np.linalg.norm(tap(art,b0)-tap(art,c0)))
    if oldd>=3.:pairs.append([oldd,newd])
   if pairs:
    q=np.array(pairs);r['edgeContrast']=dict(samples=len(pairs),medianOld=float(np.median(q[:,0])),medianArt=float(np.median(q[:,1])),oldP90=float(np.quantile(q[:,0],.9)),artP90=float(np.quantile(q[:,1],.9)))
   if site in ('high','offsite') or a.stock:assert not r['pixelGate']['changed'],r['pixelGate']
   else:assert r['pixelGate']['over2']>100,r['pixelGate']
   results[site]=r
   (a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
   print(site,r['pixelGate'],r.get('edgeContrast'),r['seam'],flush=True)
  finally:pg.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True);p.add_argument('--views',default=','.join(P));p.add_argument('--stock',action='store_true')
p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
