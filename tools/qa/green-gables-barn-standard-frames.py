#!/usr/bin/env python3
"""Verify the ordinary Barn changes only the exact projected source owner."""
import argparse,base64,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
from PIL import Image
import numpy as np
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'));f=importlib.util.module_from_spec(m);m.loader.exec_module(f)
base=f.stage
views={
 'courtyard':dict(lon=-63.38222,lat=46.48832,dist=78,east=.71,south=.70,h=8.,agl=20),
 'overflight':dict(lon=-63.38222,lat=46.48832,dist=142,east=-.53,south=.848,h=8.,agl=93),
}
def stage(repo,tmp,deps,void):
 base(repo,tmp,deps,void);main=tmp/'src/main.ts'
 main.write_text(f.once(main.read_text(),'  renderer.render(scene,camera);','''  renderer.render(scene,camera);
   (window as any).qaBarn=()=>{
    const barn=(buildings as any)?.barn;
    if(!barn?.group.visible)throw Error('Barn not active in normal scenery');
    const {group,owner,views}=barn,actual=owner.geometry;
    const xy: [number,number][]=[];
    const position=new THREE.Vector3();
    const observe=(m:THREE.Mesh,lo:number,hi:number)=>{
     const a=m.geometry.getAttribute('position');
     for(let i=lo;i<hi;i++){
      position.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).project(camera);
      if(position.z<=-1||position.z>=1)throw Error('Scope clip outside validated camera');
      xy.push([(1+position.x)*innerWidth/2,(1-position.y)*innerHeight/2]);
     }
    };
    group.traverse((m:any)=>{if(m.isMesh)observe(m,0,m.geometry.getAttribute('position').count);});
    owner.geometry=views.stock;observe(owner,BARN.span[0],BARN.span[1]);owner.geometry=actual;
    const render=()=>{renderer.render(scene,camera);return {image:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
    const active=render();group.visible=false;owner.geometry=views.stock;
    const stock=render();owner.geometry=actual;group.visible=true;
    const bounds=[Math.min(...xy.map(p=>p[0])),Math.min(...xy.map(p=>p[1])),Math.max(...xy.map(p=>p[0])),Math.max(...xy.map(p=>p[1]))];
    return {active,stock,repeat:active.image===render().image,bounds};
   };'''))
def test(args,browser,url):
 out=[]
 for key,p in views.items():
  w,h=620,416;c=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1)
  try:
   page=c.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)));page.on('console',lambda e:errs.append(e.text) if e.type=='error' else None)
   page.set_default_timeout(120000);page.goto(url+'/?diagnostics&qa='+quote(json.dumps(p)),wait_until='domcontentloaded')
   page.wait_for_function('window.islandAirDiagnostics?.greenGablesBarnReview===true')
   d=f.settle(page,errs)
   assert d['greenGablesBarnReview'] and not d['greenGablesReview'] and not errs
   q=page.evaluate('window.qaBarn()');assert q['repeat']
   images=[]
   for k in ('stock','active'):
    fn=args.out/f'{key}-{k}.png';fn.write_bytes(base64.b64decode(q[k].pop('image').split(',',1)[1]));images.append(np.asarray(Image.open(fn).convert('RGB')))
   diff=np.any(images[0]!=images[1],axis=2);x0,y0,x1,y1=q['bounds']
   x0=max(0,math.floor(x0)-3);y0=max(0,math.floor(y0)-3);x1=min(w,math.ceil(x1)+3);y1=min(h,math.ceil(y1)+3)
   keep=np.ones(diff.shape,dtype=bool);keep[y0:y1,x0:x1]=False
   assert not np.any(diff[keep]) and np.count_nonzero(diff)>500
   assert q['active']['triangles']-q['stock']['triangles']==1331 and q['active']['draws']-q['stock']['draws']==11
   result=dict(view=key,protected=int(keep.sum()),changedProtected=0,changed=int(diff.sum()),stock=q['stock'],active=q['active'],mask=[x0,y0,x1,y1],activeRestored=True)
   out.append(result);(args.out/'report.json').write_text(json.dumps(out,indent=2)+'\n');print(result,flush=True)
  finally:c.close()
f.stage=stage;f.capture=test
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.set_defaults(void_probe=False)
f.run(p.parse_args())
