#!/usr/bin/env python3
import argparse,base64,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
p=argparse.ArgumentParser(description='Matched Cape Tryon shoreline coverage without changing the coast mask.')
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True)
p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--views',default='headland-north,headland-east,headland-grazing');
p.add_argument('--owners',action='store_true',help='hash exact CPU buffers attached to the local native opaque draw list');p.add_argument('--poses',type=Path,required=True);p.set_defaults(void_probe=False)
a=p.parse_args()
sp=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py')
fixed=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixed);original=fixed.stage
def stage(repo,root,deps,void):
 original(repo,root,deps,False)
 j=root/'src/render/world.ts';s=j.read_text();j.write_text(fixed.once(s,
 'if(skyDiagnostic>.5){gl_FragColor=vec4(1.,0.,1.,1.);return;}',
 'if(skyDiagnostic>.5){gl_FragColor=skyDiagnostic>1.5?vec4(0.,1.,0.,1.):vec4(1.,0.,1.,1.);return;}'))
 j=root/'src/main.ts';s=j.read_text();j.write_text(fixed.after_world_paint(s,'''
  (window as any).shoreSkyScout=async()=>{
    const pal=(world as any).sky.material.uniforms.skyDiagnostic,capture=()=>{
     renderer.render(scene,camera);return renderer.domElement.toDataURL();
    };
    const arcs=scene.children.filter(q=>q.name==='Cape Tryon coverage repair'&&q.visible);
    const draw=()=>{
      pal.value=0;const actual=capture();
      const stats=[renderer.info.render.calls,renderer.info.render.triangles];
      pal.value=1;const one=capture();pal.value=2;const two=capture();pal.value=0;
      return {actual,one,two,stats};
    };
    const saved=pal.value,visibility=arcs.map(m=>m.visible);
    try{
     for(const m of arcs)m.visible=false;const base=draw();
     for(const m of arcs)m.visible=true;const detail=draw();
     const gl=renderer.getContext();
     const armed=(window as any).islandAirDiagnostics.tryonCoast;
     const cameraState={eye:camera.position.toArray(),projection:camera.projectionMatrix.elements.slice(),
      matrixWorld:camera.matrixWorld.elements.slice(),view:camera.matrixWorldInverse.elements.slice(),
      width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,samples:gl.getParameter(gl.SAMPLES)};
     const buffers:any[]=[];
     if(__OWNER_REPORT__){
      const ids=new Map<any,any>();
      for(const [id,tile] of (world as any).byId){
       if(!/^(?:11|12|13)-(?:9|10|11)$/.test(id))continue;
       for(const pair of [['fine',tile.fine],['coarse',tile.coarse]])if(pair[1])
        ids.set(pair[1],{tile:id,kind:pair[0],lod:tile.lod,seams:tile.seams??null});
      }
      const snapshot=(attr:any)=>{
       if(!ArrayBuffer.isView(attr?.array)||!(attr.array.buffer instanceof ArrayBuffer))return;
       return {data:new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength).slice(),
        count:attr.count,itemSize:attr.itemSize,version:attr.version??null};
      };
      const localShore=(g:any)=>{
       const p=g?.getAttribute('position');
       if(!p?.array||p.itemSize!==3||p.count>100000)return false;
       for(let k=0;k<p.array.length;k+=3){
        const x=p.array[k],z=p.array[k+2];
        if(x>-25000&&x< -22000&&z>-5100&&z< -2850)return true;
       }
       return false;
      };
      const actual=renderer.renderLists.get(scene,0).opaque;
      const picked=actual.flatMap(({object,geometry,material})=>{
       if(!geometry)return [];
       const isCurve=object.name==='Cape Tryon coverage repair';
       const isStock=object.name==='shore-to-sea surface'&&localShore(geometry);
       const owner=ids.get(object);if(!owner&&!isStock&&!isCurve)return [];
       return [{...owner,role:isCurve?'tryon-curve':isStock?'shore-stock':'terrain',
        objectName:object.name,shader:material.type,matrix:object.matrixWorld.elements.slice(),
        range:[geometry.drawRange.start,Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:null],
        attrs:[['position',snapshot(geometry.getAttribute('position'))],
         ['uv',snapshot(geometry.getAttribute('uv'))],['index',snapshot(geometry.index)]] as const}];
      });
      const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a),b=>b.toString(16).padStart(2,'0')).join('');
      for(const {attrs,...entry} of picked){
       const pairs=await Promise.all(attrs.map(async([name,value])=>{
        if(!value)return [name,null];
        const {data,...meta}=value;
        return [name,{...meta,sha256:hex(await globalThis.crypto.subtle.digest('SHA-256',data))}];
       }));
       buffers.push({...entry,attributes:Object.fromEntries(pairs)});
      }
     }
     return {base,detail,buffers,armed,visible:arcs.length,camera:cameraState};
    }finally{
     pal.value=saved;
     arcs.forEach((m,i)=>{m.visible=visibility[i];});
    }
  };'''.replace('__OWNER_REPORT__','true' if a.owners else 'false')))
# Separate the screen area below the open sky and above foreground open
# water. The north-east framing includes the foreground shore at the
# bottom edge; a shallower band would truncate that known foreground.
# Extents are image pixels, not grade or distance limits.
bands={'headland-north':[213,540],'headland-east':[258,540],'headland-grazing':[291,540],'orby-protected':[215,550],'panmure-protected':[255,540]}
def sky_components(mask,y0,y1):
 # Only connected pure-sky candidates in the original review band. Label
 # conservatively at the edges; this is an aperture, not a land assertion.
 height,width=mask.shape
 pending={(int(x),int(y+y0)) for y,x in np.argwhere(mask[y0:y1])}
 result=[]
 while pending:
  x,y=pending.pop();stack=[(x,y)];n=0;x0=x1=x;ymin=ymax=y;edges=0
  while stack:
   x,y=stack.pop();n+=1;x0=min(x0,x);x1=max(x1,x);ymin=min(ymin,y);ymax=max(ymax,y)
   edges|=(1 if x==0 else 0)|(2 if x==width-1 else 0)
   if y==y0 and y>0 and mask[y-1,x]:edges|=4
   if y==y1-1 and y+1<height and mask[y+1,x]:edges|=8
   for nxy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if nxy in pending:pending.remove(nxy);stack.append(nxy)
  result.append(dict(pixels=n,xyxy=[x0,ymin,x1,ymax],touchesReviewEdge=bool(edges),edgeMask=edges))
 return sorted(result,key=lambda v:(-v['pixels'],v['xyxy']))[:16]

def run(a,browser,url):
 byId=json.loads(a.poses.read_text());out={}
 for name in a.views.split(','):
  page=browser.new_page(viewport={'width':860,'height':580});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  page.goto(url+'/?diagnostics&qa='+quote(json.dumps(byId[name]["pose"])),wait_until='domcontentloaded')
  page.wait_for_function("window.reviewCamera?.frame>21 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland && window.islandAirDiagnostics?.detail?.ready>0 && window.islandAirDiagnostics.detail.loading===0",timeout=150000)
  q=page.evaluate('()=>window.shoreSkyScout()');imgs={}
  for profile in ('base','detail'):
   tables={}
   for k,v in q[profile].items():
    if k=='stats':continue
    file=a.out/f'{name}-{profile}-{k}.png';file.write_bytes(base64.b64decode(v.split(',',1)[1]));tables[k]=np.asarray(Image.open(file).convert('RGBA'),dtype=np.int16)
   imgs[profile]=tables
  assert not errors and not page.evaluate('window.islandAirDiagnostics.layerWarnings'),errors
  alpha=imgs['base']['actual'][:,:,3]
  assert all(np.array_equal(f[:,:,3],alpha) for role in imgs.values() for f in role.values())
  old,new=(np.max(np.abs(imgs[k]['one'][:,:,:3]-imgs[k]['two'][:,:,:3]),axis=2) for k in ('base','detail'))
  change=np.max(np.abs(imgs['detail']['actual'][:,:,:3]-imgs['base']['actual'][:,:,:3]),axis=2)
  y,z=bands[name];remove=old>new
  invented=((old==0)&(new>0)).sum();increased=(new>old+1).sum()
  row=out[name]=dict(bandY=[y,z],oldPartial=int((old[y:z]>0).sum()),newPartial=int((new[y:z]>0).sum()),
   oldPure=int((old[y:z]>=247).sum()),newPure=int((new[y:z]>=247).sum()),newSkyPixels=int(invented),
   increasedByMoreThanOne=int(increased),rgbChanged=int((change>0).sum()),
   rgbOutsideBand=int((change[:y]>0).sum()+(change[z:]>0).sum()),active=q['armed'],visible=q['visible'],
   stats=[q['base']['stats'],q['detail']['stats']],camera=q['camera'],
   residualPureComponents=sky_components(new>=247,y,z))
  if a.owners:row['localDrawCpuBuffers']=q['buffers']
  assert q['camera']['width']==new.shape[1] and q['camera']['height']==new.shape[0]
  assert q['camera']['samples']==4,row
  assert new.shape==old.shape and not invented and not increased,row
  assert row['rgbOutsideBand']==0 and row['oldPure']>=row['newPure'] and q['armed'],row
  if name.endswith('-protected'):
   assert row['rgbChanged']==0 and row['stats'][0]==row['stats'][1],row
  else:
   assert q['visible']==1 and row['oldPure']-row['newPure']>250 and row['stats'][1][1]-row['stats'][0][1]==554,row
  (a.out/'same-frame.json').write_text(json.dumps(out,indent=2)+'\n')
  print(name,row,flush=True);page.close()
fixed.stage=stage;fixed.capture=run;fixed.run(a)
