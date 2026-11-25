#!/usr/bin/env python3
"""Verify ownership of all changed pixels in two real, reciprocal Three.js views.
QA-only private build: temporary camera, frozen water, and a reserved style ID for
two-color captures from the same mounted old/new tile. The production build is not instrumented.
"""
import argparse,base64,hashlib,importlib.util,io,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image,ImageFilter
sp=importlib.util.spec_from_file_location('fixed',Path(__file__).resolve().with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed)
stage0=fixed.stage
def stage(repo,tmp,deps,void):
 stage0(repo,tmp,deps,void)
 p=tmp/'src/render/buildings.ts';s=p.read_text()
 m='   if(tapped&&observer){observer.content=observed;observer.mesh=mesh;}'
 s=fixed.once(s,m,"""   if(tile.id==='q0322'){
     const stock=this.generate(features,tile,false,47,false,undefined);
     const art=this.generate(features,tile,false,47,false,massingChunk);
     (mesh as any).qaPrince={stock,art};
   }
"""+m)
 m=' vec3 c=tint,n=normalize(normalW);';s=fixed.once(s,m,""" if(facade>252.5){gl_FragColor=facade>253.5?vec4(.03,.98,.27,1.):vec4(.97,.02,.64,1.);return;}
"""+m);p.write_text(s)
 p=tmp/'src/main.ts';s=p.read_text();m='\n  renderer.render(scene,camera);'
 s=fixed.once(s,m,m+"""
  (window as any).princeRenderProof=()=>{
   const live=(buildings as any).meshes.get('q0322'),{stock,art}=live.qaPrince;
   const geom=live.geometry,mat=live.material;
   const save=()=>{
    renderer.render(scene,camera);
    return {im:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
   };
   const groups=(o)=>{
    live.geometry=o.geometry;live.material=o.material;
    const rgb=save(),attr=live.geometry.attributes.facadeStyle,[a,b]=o.userData.beaconTriangles;
    const orig=attr.array.slice(a,b);
    attr.array.fill(253,a,b);attr.needsUpdate=true;const left=save();
    attr.array.fill(254,a,b);attr.needsUpdate=true;const right=save();
    attr.array.set(orig,a);attr.needsUpdate=true;const repeat=save();
    if(repeat.im!==rgb.im)throw Error('Non-identical same-tick repeat');
    return {rgb,left,right,span:[a,b],neutral:!!o.userData.princeSurveyRoof};
   };
   try{return {stock:groups(stock),candidate:groups(art),actualAccepted:!!live.userData.princeSurveyRoof};}
   finally{live.geometry=geom;live.material=mat;}
  };
""")
 p.write_text(s)
fixed.stage=stage
poses={'west':dict(east=.95,south=.31,h=4.,dist=102,agl=39),'reverse':dict(east=-.57,south=-.821,h=4.,dist=100,agl=35)}
def capture(a,browser,url):
 rows=[]
 for name in a.views.split(','):
  c=browser.new_context(viewport=dict(width=840,height=540),device_scale_factor=1)
  p=c.new_page();p.set_default_timeout(150000);errors=[]
  p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  try:
   pose={'lon':-63.83385771428571,'lat':46.44841914285714,**poses[name]}
   p.goto(url+'/?diagnostics'+('&'+a.query if a.query else '')+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   live=fixed.settle(p,errors);r=p.evaluate('window.princeRenderProof()')
   assert not errors and live['buildings']
   expect=a.query!='stockPrinceSurveyRoof'
   assert r['actualAccepted']==expect and r['candidate']['neutral']==expect and not r['stock']['neutral']
   def consume(k,part):
    row=r[k][part];data=base64.b64decode(row.pop('im').split(',',1)[1]);
    if part=='rgb':(a.out/(name+'-'+k+'.png')).write_bytes(data)
    row['pngSha256']=hashlib.sha256(data).hexdigest()
    return np.array(Image.open(io.BytesIO(data)).convert('RGB'),np.int16)
   data={k:{tag:consume(k,tag) for tag in ['rgb','left','right']} for k in ['stock','candidate']}
   mask0=np.any(data['stock']['left']!=data['stock']['right'],axis=2);mask1=np.any(data['candidate']['left']!=data['candidate']['right'],axis=2);mask=mask0|mask1
   expanded=np.array(Image.fromarray(np.uint8(mask)*255).filter(ImageFilter.MaxFilter(3)))>0;diff=np.max(np.abs(data['stock']['rgb']-data['candidate']['rgb']),axis=2)
   extra=r['candidate']['rgb']['triangles']-r['stock']['rgb']['triangles']
   assert r['candidate']['rgb']['draws']==r['stock']['rgb']['draws'] and extra==(58 if expect else 0)
   assert not (diff[~expanded]>0).any() and (np.count_nonzero(diff>2)>7000 if expect else not np.any(diff)),(name,r)
   for k in ('stock','candidate'):assert all(r[k][j]['draws']==r[k]['rgb']['draws'] and r[k][j]['triangles']==r[k]['rgb']['triangles'] for j in ('left','right'))
   result=dict(view=name,query=a.query or 'standard',pose=pose,render=r,
    pixels=dict(stockId=int(mask0.sum()),candidateId=int(mask1.sum()),either=int(mask.sum()),changedAny=int((diff>0).sum()),changedOver2=int((diff>2).sum()),
    changedOutsideId=int((diff[~mask]>0).sum()),changedBeyondIdPlusOnePixel=int((diff[~expanded]>0).sum())),glErrors=errors)
   rows.append(result);print(name,result['pixels'],flush=True)
   (a.out/'gpu-owner-masks.json').write_text(json.dumps(rows,indent=2)+'\n')
  finally:c.close()
 return rows
fixed.capture=capture
p=argparse.ArgumentParser(description=__doc__)
for k in ('checkout','out'):p.add_argument('--'+k,required=True,type=Path)
p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True);p.add_argument('--views',default='west,reverse');p.add_argument('--query',default='',choices=['','stockPrinceSurveyRoof','stockInlandOrtho'])
a=p.parse_args();a.pose_baseline=None;a.void_probe=False;a.size='840x540';fixed.run(a)
