#!/usr/bin/env python3
"""Freeze matched real app cameras on the western measured terrain and an eastern control."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
P=Path(__file__).resolve()
spec=importlib.util.spec_from_file_location('fixed',P.with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixed)
orig=fixed.stage
def stage(repo,tmp,deps,_):
 orig(repo,tmp,deps,False)
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(fixed.once(s,a,a+'''
   (window as any).qaHogPhoto=()=>world.hogPhoto?.opacity.value===1;
   (window as any).measureDune=()=>{
    const pts=[];
    for(const lon of [-63.842795759,-63.841378348])for(const lat of [46.640048702,46.639107140])
     for(const h of [0,8]){
      const p=project(lon,lat),q=new THREE.Vector3(p.x,h,p.z).project(camera);
      pts.push([q.x,q.y,q.z]);
     }
    const pworld=world as any,time=pworld.detailClock.value;
    pworld.detailClock.value=time+60;renderer.render(scene,camera);
    const png=renderer.domElement.toDataURL('image/png');
    const active=world.groundGradeInstalled('hog-island-west-native-ground');
    const d={active,tris:renderer.info.render.triangles,draws:renderer.info.render.calls,photo:pworld.hogPhoto?.opacity.value===1};
    const receptors=[];
    let stock:string|undefined,restored:boolean|undefined;
    if(active){
     const t=pworld.byId.get('7-8'),keep=t.fine.geometry,g=pworld.grades;
     pworld.grades=undefined;
     const old=pworld.patch(t.x0,t.z0,t.w,t.d,112);
     pworld.grades=g;
     const from=keep.getAttribute('position'),to=old.geometry.getAttribute('position');
     for(let j=0;j<=112;j++)for(let i=0;i<=112;i++)if(i===0||j===0||i===112||j===112){
      const k=j*113+i;to.setY(k,from.getY(k));
     }
     const mat=t.fine.material,u=mat.uniforms.duneAerialOrigin,value=u.value;
     /* Force the whole optional texture lookup outside its spatial mask. */
     u.value=new THREE.Vector2(1000000,1000000);
     t.fine.geometry=old.geometry;renderer.render(scene,camera);
     stock=renderer.domElement.toDataURL('image/png');t.fine.geometry=keep;u.value=value;old.geometry.dispose();
     renderer.render(scene,camera);restored=png===renderer.domElement.toDataURL('image/png');
     const ray=new THREE.Raycaster();
     for(const yi of [121,123,125,127,129,131,134,138])for(const xi of [20,100,230,300,420]){
      ray.setFromCamera(new THREE.Vector2(2*(xi+.5)/460-1,1-2*(yi+.5)/338),camera);
      const hit=ray.intersectObject(t.fine,false)[0];
      if(hit)receptors.push([xi,yi,hit.point.x,hit.point.y,hit.point.z,pworld.grades.get('7-8').weight(hit.point.x,hit.point.z)]);
     }
    }
    pworld.detailClock.value=time;return {png,pts,d,stock,restored,receptors};
   };
 '''))
fixed.stage=stage
V={
 'west-core':dict(lon=-63.8421353919,lat=46.6396520698,h=0,east=.18,south=.985,dist=83,agl=7,fixedBaseH=2.6,fixedEyeY=15),
 'west-close':dict(lon=-63.8421353919,lat=46.6396520698,h=0,east=.31,south=.95,dist=26,agl=6,fixedBaseH=3.3,fixedEyeY=11.5),
 'east-control':dict(lon=-63.8219679261,lat=46.6291784831,h=0,east=.8,south=-.6,dist=77,agl=16,fixedBaseH=7.6,fixedEyeY=18),
}
def capture(args,browser,url):
 out={};w,h=460,338
 for name in args.views.split(','):
  pose=V[name]
  current=[];results=[]
  for opt in (False,True):
   pg=browser.new_page(viewport={'width':w,'height':h});err=[];fetches=[]
   pg.on('pageerror',lambda e:err.append(str(e)));pg.on('console',lambda e:err.append(e.text)if e.type=='error'else None)
   pg.on('request',lambda r:fetches.append(r.url)if 'west-dune-ground.g11.gz' in r.url else None)
   pg.set_default_timeout(100000)
   pg.goto(url+'/?diagnostics&hogIslandPhotoStudy'+('&hogIslandWestGround' if opt else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   fixed.settle(pg,err)
   pg.wait_for_function('window.qaHogPhoto?.()',polling=400)
   q=pg.evaluate('window.measureDune()')
   assert not err and len(fetches)==int(opt),(name,err,fetches)
   if name.startswith('west-'):assert q['d']['active']==opt,(name,q['d'])
   f=args.out/(name+('-candidate' if opt else '-stock')+'.png');f.write_bytes(base64.b64decode(q.pop('png').split(',')[1]))
   current.append(np.asarray(Image.open(f).convert('RGB')).astype(np.int16))
   if q.get('stock'):
    f=args.out/(name+'-within-context-stock.png')
    f.write_bytes(base64.b64decode(q.pop('stock').split(',')[1]))
    q['sameStockFrame']=bool(np.array_equal(current[0],np.asarray(Image.open(f).convert('RGB'))))
   results.append(q);pg.close()
  background=current[0]
  if (args.out/(name+'-within-context-stock.png')).exists():background=np.asarray(Image.open(args.out/(name+'-within-context-stock.png')).convert('RGB')).astype(np.int16)
  d=np.abs(current[1]-background).max(2);outside=0
  if name.startswith('west-'):
   p=np.asarray(results[1]['pts']);a=(1+p[:,0])*w/2;b=(1-p[:,1])*h/2
   if np.all((p[:,2]>-1)&(p[:,2]<1)):
    a0=max(0,int(np.floor(a.min()-3)));a1=min(w,int(np.ceil(a.max()+3)))
    b0=max(0,int(np.floor(b.min()-3)));b1=min(h,int(np.ceil(b.max()+3)))
    safe=np.ones(d.shape,dtype=bool);safe[b0:b1,a0:a1]=False
    outside=int(np.count_nonzero(d[safe]))
   print('west-diagnostic before assertion',int((d>2).sum()),outside,[(r['d'],r.get('sameStockFrame')) for r in results],flush=True)
   assert (d>2).sum()>900 and outside==0 and results[1]['d']['draws']==results[0]['d']['draws'] and results[1]['restored'],(name,outside,results)
  else:assert np.count_nonzero(d)==0,(name, np.count_nonzero(d),results)
  out[name]={'width':w,'height':h,'differenceOver2':int((d>2).sum()),'differenceOutsideProjectedGrade':(outside if name!='west-close' else None),'exactTotal':int((d==0).sum()),'renders':[r['d'] for r in results],'pose':pose}
  print(name,out[name],flush=True)
  (args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--views',default=','.join(V));p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
a=p.parse_args();a.pose_baseline=None;a.void_probe=False;a.size='460x338';fixed.run(a)
