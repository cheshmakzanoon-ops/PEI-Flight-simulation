"""Test-only stock draw isolation. Reads no native surveyed heights and outputs no Y values."""
import argparse,base64,importlib.util,json,os
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[4]);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',default=os.environ.get('CHROMIUM','chromium'));p.add_argument('--deps',type=Path);p.add_argument('--views',default='front-close,road-oblique,bay-air');p.set_defaults(void_probe=False)
a=p.parse_args();a.candidate='q12313/47';target,ordinal=a.candidate.split('/');expected=int(ordinal)
fixture={'lon':-62.58837133,'lat':46.41389044,'h':5.12}
views={'front-close':dict(fixture,dist=40.,east=-.37,south=-.93,agl=4.5),'road-oblique':dict(fixture,dist=68.6,east=.76,south=-.65,agl=7.2),'bay-air':dict(fixture,dist=191.,east=-.42,south=-.907,agl=68.0)}

s=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py');f=importlib.util.module_from_spec(s);s.loader.exec_module(f);initial=f.stage

def stage(repo,root,deps,unused):
 initial(repo,root,deps,unused);m=root/'src/main.ts';source=m.read_text();marker='  renderer.render(scene,camera);'
 w=r'''
  (window as any).sullivanOwner=()=>{
    const mesh=(buildings as any)?.meshes.get(TILE) as THREE.Mesh;
    const g=mesh?.geometry,span=mesh?.userData.sullivanQaSpan as [number,number];
    if(!g||!span||g.index||g.groups.length||span[0]%3||span[1]%3)throw Error('Owner draw is not the expected ordinary triangle list');
    const n=g.getAttribute('position').count,flag=g.getAttribute('topFlag');
    const own=Array.from({length:span[1]-span[0]},(_,i)=>i+span[0]);
    const rest=Array.from({length:n},(_,i)=>i).filter(i=>i<span[0]||i>=span[1]);
    const ceiling:number[]=[],body:number[]=[];
    for(let i=span[0];i<span[1];i+=3){
      const z=flag.getX(i);if(flag.getX(i+1)!==z||flag.getX(i+2)!==z)throw Error('mixed primitive topFlag');
      (z===1?ceiling:body).push(i,i+1,i+2);
    }
    if(!ceiling.length||!body.length)throw Error('Missing stock body or roof');
    const make=(ids:number[],color:number)=>{
      const part=new THREE.BufferGeometry();part.setAttribute('position',g.getAttribute('position'));part.setIndex(ids);
      const mat=new THREE.MeshBasicMaterial({color,side:THREE.FrontSide,toneMapped:false});const o=new THREE.Mesh(part,mat);
      o.position.copy(mesh.position);o.visible=false;scene.add(o);return o;
    };
    const only=make(own,0xfb06b9),roof=make(ceiling,0xfa065b),wall=make(body,0x08e9ee);
    const snap=()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};
    try{
      const stock=snap();g.setIndex(rest);const none=snap();only.visible=true;const id=snap();only.visible=false;
      roof.visible=wall.visible=true;const parts=snap();roof.visible=wall.visible=false;g.setIndex(null);const repeat=snap();
      return {stock,none,id,parts,repeat,span,vertexCount:n,roofTriangles:ceiling.length/3,wallTriangles:body.length/3};
    }finally{
      g.setIndex(null);
      for(const o of [only,roof,wall]){scene.remove(o);o.geometry.dispose();o.material.dispose();}
    }
  }
'''.replace('TILE',json.dumps(target))
 m.write_text(f.once(source,marker,marker+w))
 b=root/'src/render/buildings.ts';source=b.read_text()
 v='let beaconStart=-1,beaconEnd=-1,barnStart=-1,barnEnd=-1,actualRustico=false;'
 source=f.once(source,v,'let sullivanStart=-1,sullivanEnd=-1;'+v)
 key='for(let i=0;i<features.length;i++){';source=f.once(source,key,key+
 f"\n    if(tile.id==={json.dumps(target)}&&i==={expected})sullivanStart=P.length/3;if(tile.id==={json.dumps(target)}&&i==={expected+1})sullivanEnd=P.length/3;\n")
 marker='if(measuredDowntownRoofs)mesh.userData.measuredDowntownRoofs=measuredDowntownRoofs;'
 b.write_text(f.once(source,marker,marker+'\n if(sullivanStart>=0&&sullivanEnd>sullivanStart)mesh.userData.sullivanQaSpan=[sullivanStart,sullivanEnd];'))
f.stage=stage

def expand(m):
 b=m.copy();b[1:]|=m[:-1];b[:-1]|=m[1:];b[:,1:]|=m[:,:-1];b[:,:-1]|=m[:,1:];return b

def capture(a,browser,url):
 rec=[]
 for k in a.views.split(','):
  with browser.new_context(viewport={'width':700,'height':465},device_scale_factor=1) as ctx:
   pg=ctx.new_page();pg.set_default_timeout(175000);errors=[]
   pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda msg:errors.append(msg.text)if msg.type=='error'else None)
   q=json.dumps(views[k],separators=(',',':'));pg.goto(url+'/?diagnostics&departure=cyyg&qa='+quote(q),wait_until='domcontentloaded')
   pg.wait_for_function('()=>window.reviewCamera?.frame>=8 && window.islandAirDiagnostics?.buildings && window.sullivanOwner')
   pg.wait_for_function('()=>window.reviewCamera?.frame>=18 && window.islandAirDiagnostics?.detail?.loading===0 && window.islandAirDiagnostics?.buildingTiles?.loading===0')
   r=pg.evaluate('window.sullivanOwner()');p={}
   for mode in ('stock','none','id','parts','repeat'):
    png=a.out/f'{k}-{mode}.png';png.write_bytes(base64.b64decode(r.pop(mode).split(',')[1]));p[mode]=np.asarray(Image.open(png).convert('RGB'))
   support=np.any(p['id']!=p['none'],axis=2);b=np.any(p['stock']!=p['none'],axis=2);cat=np.any(p['parts']!=p['none'],axis=2)
   outside=lambda m,s:int(np.sum(m&~expand(s)))
   assert np.array_equal(p['repeat'],p['stock']) and not errors,(k,errors)
   n0=outside(b,support);n1=outside(cat,support);assert n0==0 and n1==0,(k,n0,n1)
   # Count pure primary IDs only; edge pixels can be blends from MSAA and are intentionally excluded.
   R,G,B=np.moveaxis(p['parts'],-1,0);roof=cat&(R>230)&(G<20)&(B>60)&(B<120);wall=cat&(R<20)&(G>210)&(B>210)
   result={'name':k,'candidate':a.candidate,'fixture':views[k],'stockOwnerPixels':int(b.sum()),'idSupportPixels':int(support.sum()),'strictPixelsOutOfId':int(np.sum(b&~support)),'outsideOnePixelId':n0,'categoryOutsideOnePixelId':n1,'roofIdCorePixels':int(roof.sum()),'wallIdCorePixels':int(wall.sum()),'stockRestoredIdentical':True,**r}
   assert b.sum()>100,(k,result)
   rec.append(result);(a.out/'owner.json').write_text(json.dumps(rec,indent=2)+'\n');print(result,flush=True)
f.capture=capture
f.run(a)
