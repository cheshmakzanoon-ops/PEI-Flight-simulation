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

# Keep the two original close camera windows and their independent controls.
INLAND=[]
for key,lon,lat,first,second,edge,z,slot,held in [
 ('west-field',-63.835,46.4485298,'7-12','8-12',8,12,227,197),
 ('central-field',-63.596875,46.4814844,'10-11','11-11',11,11,467,619),
]:
 for tail,sample,high,reverse,vertical in [
   ('',slot,False,False,False),('-reciprocal',slot,False,True,False),('-high',slot,True,False,False),
   ('-outside',held,False,False,True),('-flipped',639-slot,False,False,True)]:
  sign=-1 if reverse else 1
  y=47.10-(z+(sample+.5)/640)/22*1.16
  P[key+tail]=dict(lon=lon,lat=y,first=first,second=second,axis='x',edge=edge,
   east=-.91*sign,south=.42*sign,h=0,dist=.15 if vertical else (240 if high else (65 if reverse else 75)),
   agl=17 if vertical else (550 if high else (38 if reverse else 44)))
  INLAND.append(key+tail)
# New finite source windows. Coordinates are recomputed here rather than
# borrowed from the production renderer or selected using its art output.
EXPANDED=[
 ('south-central-fields',11,16,'x',325,368,268),
 ('west-forest-fields',6,9,'x',422,465,None),
 ('east-fields',21,16,'z',623,590,None),
 ('queens-southwest-fields',13,16,'z',51,84,None),
 ('queens-inland-fields',14,16,'x',104,138,None),
]
for name,x,z,axis,center,outside,north_control in EXPANDED:
 first,second=f'{x}-{z}',f'{x+(axis=="x")}-{z+(axis=="z")}'
 for suffix,reverse,high,held in [
   ('',False,False,None),('-reciprocal',True,False,None),('-high',False,True,None),
   ('-outside',False,False,outside),
   # South-central lies near mid-tile. Mirroring the center lands beside
   # the live window, so use a separate non-overlapping northern control.
   ('-flipped' if north_control is None else '-north-control',False,False,
    639-center if north_control is None else north_control),
 ]:
  along=(center if held is None else held+.5)/640
  lon=-64.47+2.54*(x+(1 if axis=='x' else along))/32
  lat=47.10-1.16*(z+(1 if axis=='z' else along))/22
  ex,sz=((-.91,.42) if axis=='x' else (.42,-.91))
  sign=-1 if reverse else 1
  P[name+suffix]=dict(lon=lon,lat=lat,first=first,second=second,axis=axis,
   edge=x+1 if axis=='x' else z+1,east=ex*sign,south=sz*sign,h=0,
   dist=.15 if held is not None else (240 if high else (65 if reverse else 75)),
   agl=17 if held is not None else (550 if high else (38 if reverse else 44)))
  INLAND.append(name+suffix)
GROUPS={'inland':INLAND,'counties':COUNTIES,'tracadie':TRACADIE}

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
 selections=a.views.split(',') if a.views else GROUPS[a.cohort]
 for site in selections:
  if site not in GROUPS[a.cohort]:raise ValueError('Wrong camera for selected cohort: '+site)
  pose=P[site];edge=pose['first']+' / '+pose['second']
  own={'counties':'stockCountyOrtho','tracadie':'stockTracadieOrtho','inland':'stockInlandOrtho'}[a.cohort]
  peer={'counties':'stockTracadieOrtho','tracadie':'stockCountyOrtho','inland':'stockCountyOrtho&stockTracadieOrtho'}[a.cohort]
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
   oldCounties={'27-13 / 27-14','5-2 / 5-3','10-12 / 11-12'}
   inlands={'7-12 / 8-12','10-11 / 11-11','11-16 / 12-16','6-9 / 7-9','21-16 / 21-17',
            '13-16 / 13-17','14-16 / 15-16'}
   expect|=inlands;flags=(switch or '').split('&')
   if 'stockCountyOrtho' in flags:expect-=oldCounties
   if 'stockTracadieOrtho' in flags:expect.discard('18-12 / 18-13')
   if 'stockInlandOrtho' in flags:expect-=inlands
   assert {x['edge'] for x in r['seam']}==expect and not any(x['errors'] for x in r['seam']),(site,r['seam'])
   r.update(edge=edge,heightAGL=pose['agl'],stockSwitch=switch)
   def consume(label):
    p=a.out/(site+'-'+label+'.png')
    p.write_bytes(base64.b64decode(r[label].pop('image').split(',',1)[1]))
    return np.asarray(Image.open(p).convert('RGBA'),np.float32)
   old,art,qa,qb=[consume(v) for v in ('old','art','idA','idB')]
   r['alphaChanges']=int(np.sum(old[:,:,3]!=art[:,:,3]))
   assert r['old']==r['art'] and r['exact'] and not errors and r['alphaChanges']==0,(site,r,errors)
   old,art,qa,qb=(v[:,:,:3] for v in (old,art,qa,qb))
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
   if site in ('high','offsite') or site.endswith(('-high','-outside','-flipped','-north-control')) or a.stock:assert not r['pixelGate']['changed'],r['pixelGate']
   else:
    assert r['pixelGate']['over2']>100,r['pixelGate']
    if a.cohort in ('counties','inland'):
     e=r.get('edgeContrast',{});assert e.get('samples',0)>=8 and e['medianArt']<e['medianOld'] and e['artP90']<e['oldP90'],(site,e)
   results[site]=r
   (a.out/'report.json').write_text(json.dumps(results,indent=2)+'\n')
   print(site,r['pixelGate'],r.get('edgeContrast'),r['seam'],flush=True)
  finally:pg.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True);p.add_argument('--views')
p.add_argument('--cohort',choices=['tracadie','counties','inland'],default='tracadie')
switch=p.add_mutually_exclusive_group();switch.add_argument('--stock',action='store_true');switch.add_argument('--peer-stock',action='store_true')
p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
