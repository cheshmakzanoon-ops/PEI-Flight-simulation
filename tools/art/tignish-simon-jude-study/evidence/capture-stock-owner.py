#!/usr/bin/env python3
"""Render existing scene/ordered owner only. No native inputs or numerical height exports."""
from urllib.parse import quote
from pathlib import Path
import argparse,base64,importlib.util,json,time,os
import numpy as np
# Four-connected one-pixel dilation, including the original ID mask.
def binary_dilation(a):
 b=a.copy();b[1:]|=a[:-1];b[:-1]|=a[1:];b[:,1:]|=a[:,:-1];b[:,:-1]|=a[:,1:]
 return b
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[4]);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',default=os.environ.get('CHROMIUM','chromium'));p.add_argument('--deps',type=Path);p.add_argument('--views',default='east-street,south-oblique,west-air');p.set_defaults(void_probe=False);a=p.parse_args()
s=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py');f=importlib.util.module_from_spec(s);s.loader.exec_module(f); stage0=f.stage
I={'lon':-64.03574247368421,'lat':46.95384910526316,'h':22.}
views={
 'east-street':dict(I,dist=72,east=70.,south=15.,agl=7.4),
 'south-oblique':dict(I,dist=93.,east=-28.,south=86.,agl=6.5),
 'west-air':dict(I,dist=272,east=-257.,south=-79.,agl=84.),
}

def stage(repo,root,deps,void):
 stage0(repo,root,deps,void);m=root/'src/main.ts';source=m.read_text();marker='  renderer.render(scene,camera);'
 insert='''
  (window as any).tignishStock=()=>{
    const mesh=(buildings as any)?.meshes.get('q221232') as THREE.Mesh;
    const g=mesh?.geometry,span=mesh?.userData.tignishQaSpan as [number,number];
    if(!g||!span||g.index||g.groups.length)throw Error('Stock owner is not the expected ordinary draw');
    const n=g.getAttribute('position').count;
    const own=Array.from({length:span[1]-span[0]},(_,i)=>i+span[0]);
    const rest=Array.from({length:n},(_,i)=>i).filter(i=>i<span[0]||i>=span[1]);
    const c=new THREE.BufferGeometry();c.setAttribute('position',g.getAttribute('position'));c.setIndex(own);
    const mat=new THREE.MeshBasicMaterial({color:0xff19c6,side:THREE.DoubleSide});
    const only=new THREE.Mesh(c,mat);only.position.copy(mesh.position);only.visible=false;scene.add(only);
    const snap=()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};
    try{
      const stock=snap();g.setIndex(rest);const none=snap();only.visible=true;const id=snap();only.visible=false;
      g.setIndex(null);const repeat=snap();return {stock,none,id,repeat,span,vertexCount:n};
    }finally{g.setIndex(null);scene.remove(only);c.deleteAttribute('position');c.dispose();mat.dispose();}
  };
'''
 m.write_text(f.once(source,marker,marker+insert)); b=root/'src/render/buildings.ts';source=b.read_text()
 v='let beaconStart=-1,beaconEnd=-1,barnStart=-1,barnEnd=-1,actualRustico=false;'
 source=f.once(source,v,'let tignishStart=-1,tignishEnd=-1;'+v)
 key='for(let i=0;i<features.length;i++){';source=f.once(source,key,key+
 "\n    if(tile.id==='q221232'&&i===98)tignishStart=P.length/3;if(tile.id==='q221232'&&i===99)tignishEnd=P.length/3;\n")
 key='if(measuredDowntownRoofs)mesh.userData.measuredDowntownRoofs=measuredDowntownRoofs;'
 b.write_text(f.once(source,key,key+'\n if(tignishEnd>tignishStart&&tignishStart>=0)mesh.userData.tignishQaSpan=[tignishStart,tignishEnd];'))
f.stage=stage

def capture(a,browser,url):
 rec=[]
 for name in a.views.split(','):
  with browser.new_context(viewport={'width':700,'height':465},device_scale_factor=1) as c:
   p=c.new_page();p.set_default_timeout(180000);errors=[]
   p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
   q=json.dumps(views[name],separators=(',',':'));p.goto(url+'/?diagnostics&qa='+quote(q),wait_until='domcontentloaded')
   p.wait_for_function('()=>window.reviewCamera?.frame>=8 && window.islandAirDiagnostics?.buildings && window.tignishStock')
   p.wait_for_function('()=>window.reviewCamera?.frame>=18 && window.islandAirDiagnostics?.detail?.loading===0 && window.islandAirDiagnostics?.buildingTiles?.loading===0')
   r=p.evaluate('window.tignishStock()');res={}
   for mode in ('stock','none','id','repeat'):
    raw=r.pop(mode);path=a.out/f'{name}-{mode}.png';path.write_bytes(base64.b64decode(raw.split(',')[1]));res[mode]=np.asarray(Image.open(path).convert('RGB')).copy()
   assert not errors and np.array_equal(res['stock'],res['repeat']), (name,errors)
   rgb=np.any(res['stock']!=res['none'],axis=2);support=np.any(res['id']!=res['none'],axis=2)
   exactOutside=int((rgb & ~support).sum()); outsideOne=int((rgb & ~binary_dilation(support)).sum())
   assert np.sum(rgb)>100 and outsideOne==0, (name, exactOutside,outsideOne)
   delta={'name':name,'cameraFixture':views[name],'aaEdgeNotExactlyID':exactOutside,'outsideOnePixelID':outsideOne,'ownerSupportPixelCount':int(np.sum(support)),'stockOwnerPixelCount':int(np.sum(rgb)),**r}
   print(delta,flush=True);rec.append(delta);(a.out/'ownership.json').write_text(json.dumps(rec,indent=2)+'\n')
f.capture=capture
f.run(a)
