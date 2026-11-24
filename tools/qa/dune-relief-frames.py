#!/usr/bin/env python3
"""Compare exact live N112 mesh against stock at locked dry-dune locations."""
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
source=Path(__file__).with_name('fixed-scenery.py')
sp=importlib.util.spec_from_file_location('fixed',source)
f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
stage=f.stage
def add(repo,tmp,deps,void):
 stage(repo,tmp,deps,False)
 p=tmp/'src/main.ts';s=p.read_text()
 a='  renderer.render(scene,camera);'
 p.write_text(f.once(s,a,a+'''
 (window as any).reliefQA=()=>{
  const w=world as any,t=w.byId.get(qa.tile);
  if(!t?.fine||t.lod!==112)return;
  const actual=t.fine.geometry,grade=w.grades?.get(qa.tile);
  const draw=()=>{renderer.render(scene,camera);return {img:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,tris:renderer.info.render.triangles};};
  if(!grade)return {grade:false,render:draw()};
  const pts=[];
  const candidate=draw(),keep=w.grades;w.grades=undefined;
  const base=w.patch(t.x0,t.z0,t.w,t.d,112);w.grades=keep;
  const from=actual.getAttribute('position'),to=base.geometry.getAttribute('position');
  for(let j=0;j<=112;j++)for(let i=0;i<=112;i++)if(i===0||j===0||i===112||j===112){
   const n=j*113+i;to.setY(n,from.getY(n));
  }
  const source=base.geometry;
  const face=(I:number[],i:number)=>I[i]+'/'+I[i+1]+'/'+I[i+2];
  const list=(g:THREE.BufferGeometry)=>Array.from(g.index!.array);
  const join=(g:THREE.BufferGeometry,other:THREE.BufferGeometry)=>{
   const a=list(g),b=list(other),present=new Set<string>(),p=g.getAttribute('position');
   for(let i=0;i<b.length;i+=3)present.add(face(b,i));
   for(let j=0;j<a.length;j+=3)if(!present.has(face(a,j))){
    const tri=[];
    for(let i=j;i<j+3;i++){
     const k=a[i],v=new THREE.Vector3(p.getX(k),p.getY(k),p.getZ(k)).applyMatrix4(t.fine.matrixWorld).project(camera);
     tri.push([v.x,v.y,v.z]);
    }
    pts.push(tri);
   }
  };
  join(source,actual);join(actual,source);
  t.fine.geometry=base.geometry;const stock=draw();
  t.fine.geometry=actual;base.geometry.dispose();const stable=candidate.img===draw().img;
  return {grade:!!grade,stock,candidate,stable,pts};
 };
 '''))
f.stage=add
views={
 'prince':dict(tile='6-7',lon=-63.94301209666631,lat=46.703156293086195,dist=145,east=.33,south=.947,agl=23,h=0),
 'kings':dict(tile='30-11',lon=-62.05910430167234,lat=46.46798726964735,dist=145,east=.33,south=.947,agl=25,h=0),
}
def capture(args,browser,url):
 out={}
 for name in args.views.split(','):
  p=views[name];w,h=460,338;pg=browser.new_page(viewport={'width':w,'height':h});errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
  pg.set_default_timeout(105000)
  pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(p)),wait_until='domcontentloaded');f.settle(pg,errors)
  pg.wait_for_function("window.islandAirDiagnostics?.localGroundGrades?.length>0 && window.islandAirDiagnostics?.duneSand?.active?.length>0")
  q=pg.evaluate('window.reliefQA()');assert q['grade'] and q['stable'] and not errors,q
  rr={}
  for label in ('stock','candidate'):
   fn=args.out/(name+'-'+label+'.png'); fn.write_bytes(base64.b64decode(q[label].pop('img').split(',')[1]))
   rr[label]=np.asarray(Image.open(fn).convert('RGB')).astype(np.int16)
  delta=abs(rr['candidate']-rr['stock']).max(2)
  aa=np.asarray(q['pts']);xp=(aa[:,:,0]+1)*w*.5;yp=(1-aa[:,:,1])*h*.5
  assert np.all(aa[:,:,2]>-1) and np.all(aa[:,:,2]<1),[float(aa[:,:,2].min()),float(aa[:,:,2].max())]
  image=Image.new('L',(w,h));draw=ImageDraw.Draw(image)
  for xx,yy in zip(xp,yp):draw.polygon(list(zip(xx,yy)),fill=255)
  mask=np.asarray(image.filter(ImageFilter.MaxFilter(9)))==0
  out[name]={'rgbOver2':int((delta>2).sum()),'protectedPixels':int(mask.sum()),'protectedChanges':int(np.count_nonzero(delta[mask])),
      'width':w,'height':h,'pose':p,'draws':[q['stock']['draws'],q['candidate']['draws']],
      'triangles':[q['stock']['tris'],q['candidate']['tris']],'stable':q['stable']}
  print(out[name],flush=True);(args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n')
  assert out[name]['protectedPixels']>30000 and out[name]['protectedChanges']==0 and out[name]['rgbOver2']>300 and q['stock']['draws']==q['candidate']['draws'],out[name]
  pg.close()
f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--views',default=','.join(views));p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path)
a=p.parse_args();a.pose_baseline=None;a.void_probe=False;a.size='460x338';f.run(a)
