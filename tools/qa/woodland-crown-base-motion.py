#!/usr/bin/env python3
"""Locked renderer motion and exact fallback for corrupt woodland source responses."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageFilter
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base_stage=fixed.stage
def stage(repo,root,deps,void):
 base_stage(repo,root,deps,void)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
          const wc=projectSite(qp.lon,qp.lat),wn=Math.hypot(qp.east,qp.south);
          const startPoint={x:wc.x+qp.dist*qp.east/wn,z:wc.z+qp.dist*qp.south/wn},warmForest=''')
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).captureWoodlandVolume=()=>{
   const v=vegetation as any,volume=v.volume;
   const groups=volume?.groups??[],enabled=groups.map(g=>g.mesh.visible);
   const info=()=>({draws:renderer.info.render.calls,triangles:renderer.info.render.triangles});
   const snap=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),...info()};};
   const n=volume?.count??0;
   const buffers=groups.map(g=>g.lift?.array.slice(0,g.geometry.instanceCount));
   const lifts=buffers.flatMap(a=>a?Array.from(a).filter(q=>q>0):[]);
   const layer=()=>groups.forEach((g,i)=>{if(buffers[i]){g.lift.array.set(buffers[i]);g.lift.needsUpdate=true}});
   const after=snap();
   groups.forEach(g=>{if(g.lift){g.lift.array.fill(0,0,g.geometry.instanceCount);g.lift.needsUpdate=true}});
   const before=snap();
   groups.forEach(g=>g.mesh.visible=false);const bare=snap();
   groups.forEach((g,i)=>g.mesh.visible=enabled[i]);layer();
   return {before,after,bare,n,lifts:lifts.length,exactRestored:snap().image===after.image};
  };''')
 if args.no_msaa:s=fixed.once(s,'antialias:true','antialias:false')
 s=fixed.once(s,"const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;", """const step=(window as any).crownMove;
      const norm=Math.hypot(qa.east,qa.south),distance=qa.dist+(step?.d??0),ex=center.x+distance*qa.east/norm,ez=center.z+distance*qa.south/norm;""")
 s=fixed.once(s,"f.y=qa.fixedEyeY??terrain.elevation(ex,ez)+qa.agl;", """f.y=step?world.groundHeight(ex,ez)+step.a:qa.fixedEyeY??terrain.elevation(ex,ez)+qa.agl;""")
 s=fixed.once(s,"return {before,after,bare,n,lifts:lifts.length,exactRestored:", """const crownValues=groups.flatMap(g=>{
    if(!g.lift)return [];
    const a=[];
    for(let i=0;i<g.geometry.instanceCount;i++){
     const dx=g.stem.getX(i)-camera.position.x,dz=g.stem.getZ(i)-camera.position.z;
     const weight=(1-THREE.MathUtils.smoothstep(Math.hypot(dx,dz),27,38))*(volume?.crownVertical.value??0);
     a.push({stem:[g.stem.getX(i),g.stem.getZ(i)],m:g.lift.getX(i)*weight,d:Math.hypot(dx,dz)});
    }
    return a;
   });
   return {before,after,bare,n,crownValues,lifts:lifts.length,exactRestored:""")
 p.write_text(s)
fixed.stage=stage
P={
 'queens-close':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=18),
 'prince-close':dict(lon=-64.238,lat=46.674,dist=54,east=.53,south=.85,h=10,agl=23),
 'kings-close':dict(lon=-62.169,lat=46.414,dist=56,east=.53,south=.85,h=10,agl=22),
 'queens-mid-control':dict(lon=-63.373,lat=46.400,dist=46,east=.53,south=.85,h=12,agl=42),
 'queens-high-control':dict(lon=-63.373,lat=46.400,dist=62,east=.53,south=.85,h=8,agl=152),
}
P.update({'prince-grazing': {'lon': -64.23742108644893, 'lat': 46.674592790684684, 'dist': 26, 'east': -0.8660254037844388, 'south': -0.4999999999999997, 'agl': 4.5, 'h': 17.115747419377726, 'fixedBaseH': 22.99635020922593, 'fixedEyeY': 27.982200182291795}, 'queens-grazing': {'lon': -63.37304312827413, 'lat': 46.399546529914325, 'dist': 26, 'east': -0.7071067811865479, 'south': -0.7071067811865471, 'agl': 2.7, 'h': 13.05925039233503, 'fixedBaseH': 38.32404072790475, 'fixedEyeY': 43.2847173505938}, 'kings-grazing': {'lon': -62.16821337178259, 'lat': 46.413126704406004, 'dist': 23.5, 'east': -0.9659258262890683, 'south': -0.2588190451025208, 'agl': 4.5, 'h': 8.631676831574865, 'fixedBaseH': 39.42139035923698, 'fixedEyeY': 43.829067562749714}})
def capture(a,browser,url):
 out=[]
 for label in ['motion','corrupt']:
  c=browser.new_context(viewport={'width':460,'height':338})
  try:
   p=c.new_page();errors=[];fault=[]
   p.on('pageerror',lambda e:errors.append(str(e)))
   p.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   def broken(route):
    response=route.fetch();content=bytearray(response.body())
    if len(content):
     for i in range(12,len(content),1024):content[i]^=0x40
     fault.append(len(content))
    route.fulfill(response=response,body=bytes(content))
   if label=='corrupt':p.route('**/crown-v1/*.pack',broken)
   p.goto(url+'/?woodlandCrownBase&diagnostics&qa='+quote(json.dumps(P['prince-grazing'])),wait_until='domcontentloaded')
   p.set_default_timeout(120000)
   condition='activeReady' if label=='motion' else 'failed'
   p.wait_for_function(f'window.reviewCamera?.frame>10 && window.islandAirDiagnostics?.woodlandVolume>0 && window.islandAirDiagnostics?.woodlandCrown?.{condition}')
   if label=='corrupt':
    x=p.evaluate('window.captureWoodlandVolume()')
    assert fault and x['lifts']==0 and x['before']['image']==x['after']['image'] and not errors
    out.append({'case':'corrupt','packBytes':fault,'sameFrame':True})
    continue
   pts=[(i*.8,7.) for i in range(19)]+[(0.,a) for a in [12,18,22,27,31,35,38,39,42]]
   previous=None;changes=[];hot=0;exact=[]
   for d,e in pts:
    p.evaluate("""q=> {window.crownMove=q;return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}""",{'d':d,'a':e})
    x=p.evaluate('window.captureWoodlandVolume()')
    assert x['after']['draws']==x['before']['draws'] and x['after']['triangles']==x['before']['triangles'] and x['exactRestored'] and not errors
    cur={tuple(v['stem']):v['m'] for v in x['crownValues']}
    for v in x['crownValues']:
     assert 0<=v['m']<=1.65001 and (v['d']<38 or v['m']==0)
    if previous is not None and d>.0:
     for k in previous.keys()|cur.keys():changes.append(abs(previous.get(k,0.)-cur.get(k,0.)))
    previous=cur
    if any(v>0 for v in cur.values()):hot+=1
    if e>=39:
     assert x['before']['image']==x['after']['image'] and max(cur.values(),default=0.)==0.
     exact.append(int(e))
   assert hot>=12 and max(changes)<.22 and exact==[39,42]
   out.append({'case':'motion','lockedMotionFrames':len(pts),'visibleLiftFrames':hot,
    'stepMaxM':max(changes),'exactAglControlsM':exact,'canvas':[460,338]})
  finally:c.close()
 (a.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
 print(out,flush=True)
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.add_argument('--views',default='prince-grazing,queens-grazing,kings-grazing,queens-mid-control,queens-high-control');p.add_argument('--no-msaa',action='store_true');p.set_defaults(void_probe=False)
args=p.parse_args();fixed.run(args)
