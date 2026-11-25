#!/usr/bin/env python3
"""Matched Three.js frames across exact streamed image edges, with pixel and contrast controls."""
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
# Published source-grid pairs are repeated here, deliberately independent of production selection.
TRACADIE=list(P)
for k in TRACADIE:
 P[k].update(first='18-12',second='18-13',axis='z',edge=13)
COUNTIES=[]
for key,lon,lat,first,second,axis,edge in [
 ('souris',-62.281606,46.361818,'27-13','27-14','z',14),
 ('prince',-64.017376,46.941818,'5-2','5-3','z',3),
 ('queens',-63.596875,46.440085,'10-12','11-12','x',11),
]:
 for ending,reverse,high in [('',False,False),('-reciprocal',True,False),('-high',False,True)]:
  label=key+ending
  # See the line from both sides. Each view is independent of the source-strip plan.
  sign=-1 if reverse else 1
  ex,sz=((.42,-.91) if axis=='z' else (-.91,.42))
  P[label]=dict(lon=lon,lat=lat,east=sign*ex,south=sign*sz,h=0,
     dist=240 if high else (65 if reverse else 75),agl=380 if high else (38 if reverse else 44),
     first=first,second=second,axis=axis,edge=edge)
  COUNTIES.append(label)

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
   const isOwner=(t)=>t.id===qa.first||t.id===qa.second;
   const q=(ortho as any)?.pairs?.find(p=>p.plan.first===qa.first&&p.plan.second===qa.second),u=(world as any).tiles.filter(isOwner)
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
   const d=(world as any).tiles.filter(isOwner)
       .map(t=>({id:t.id,loaded:!!t.detail,status:t.status,lod:t.lod,n:t.local.uniforms.hasDetail.value}));
   // Independent XZ boundary measured from manifest grid; stock visual Y
   // is used only to project matched nearby sample coordinates to pixels.
   const ew=qa.axis==='x',cross=ew?terrain.left+qa.edge*(terrain.right-terrain.left)/32:
       terrain.top+qa.edge*(terrain.bottom-terrain.top)/22;
   const focus=project(qa.lon,qa.lat),along=ew?focus.z:focus.x;
   const rays=[];
   for(let a=along-230;a<along+230;a+=2){
    const pts=[cross-1.3,cross-.35,cross+.35,cross+1.3].map(c=>{
      const x=ew?c:a,z=ew?a:c;
      const p=new THREE.Vector3(x,world.visualGroundHeight(x,z),z).project(camera);
      return [(p.x*.5+.5)*innerWidth,(.5-.5*p.y)*innerHeight];
    });
    if(pts.every(([a,b])=>a>=1&&a<innerWidth-1&&b>=1&&b<innerHeight-1))rays.push([a,pts]);
   }
   return {old,art,idA,idB,gain,exact,slots:d,rays,seam:ortho?.diagnostics()??[]};
  };
 ''')
 p.write_text(s)
fixed.stage=stage

def capture(a,browser,url):
 results={}
 selections=a.views.split(',') if a.views else (COUNTIES if a.cohort=='counties' else TRACADIE)
 for site in selections:
  if site not in (COUNTIES if a.cohort=='counties' else TRACADIE):raise ValueError('Wrong camera for selected cohort: '+site)
  pose=P[site];edge=pose['first']+' / '+pose['second']
  own='stockCountyOrtho' if a.cohort=='counties' else 'stockTracadieOrtho'
  peer='stockTracadieOrtho' if a.cohort=='counties' else 'stockCountyOrtho'
  switch=own if a.stock else peer if a.peer_stock else None
  pg=browser.new_page(viewport={'width':840,'height':540});errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  try:
   pg.goto(url+'/?diagnostics'+('&'+switch if switch else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   live=fixed.settle(pg,errors)
   if not a.stock and site!='offsite':
    pg.wait_for_function("edge=>window.islandAirDiagnostics?.orthophotoSeams?.find(p=>p.edge===edge)?.gain===1",arg=edge,polling=250,timeout=120000)
   r=pg.evaluate('window.seamFrame()')
   expect={'18-12 / 18-13'}|{'27-13 / 27-14','5-2 / 5-3','10-12 / 11-12'}
   if switch=='stockCountyOrtho':expect={'18-12 / 18-13'}
   if switch=='stockTracadieOrtho':expect.remove('18-12 / 18-13')
   assert {x['edge'] for x in r['seam']}==expect and not any(x['errors'] for x in r['seam']),(site,r['seam'])
   r.update(edge=edge,heightAGL=pose['agl'],stockSwitch=switch)
   def consume(label):
    p=a.out/(site+'-'+label+'.png')
    p.write_bytes(base64.b64decode(r[label].pop('image').split(',',1)[1]))
    return np.asarray(Image.open(p).convert('RGB'),np.float32)
   old,art,qa,qb=[consume(v) for v in ('old','art','idA','idB')]
   assert r['old']==r['art'] and r['exact'] and not errors,(site,r,errors)
   marker=np.any(qa!=qb,axis=2)
   bound=np.asarray(Image.fromarray(np.uint8(marker)*255).filter(ImageFilter.MaxFilter(3)))>0
   diff=np.max(abs(old-art),axis=2)
   r['pixelGate']=dict(changed=int((diff>0).sum()),over2=int((diff>2).sum()),outside=int((diff[~bound]>0).sum()),
    outsideExact=int((diff[~marker]>0).sum()),mask=int(marker.sum()))
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
   if site in ('high','offsite') or site.endswith('-high') or a.stock:assert not r['pixelGate']['changed'],r['pixelGate']
   else:
    assert r['pixelGate']['over2']>100,r['pixelGate']
    if a.cohort=='counties':
     e=r.get('edgeContrast',{});assert e.get('samples',0)>=8 and e['medianArt']<e['medianOld'] and e['artP90']<e['oldP90'],(site,e)
   results[site]=r
   (a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
   print(site,r['pixelGate'],r.get('edgeContrast'),r['seam'],flush=True)
  finally:pg.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True);p.add_argument('--views')
p.add_argument('--cohort',choices=['tracadie','counties'],default='tracadie')
switch=p.add_mutually_exclusive_group();switch.add_argument('--stock',action='store_true');switch.add_argument('--peer-stock',action='store_true')
p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
