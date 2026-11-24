#!/usr/bin/env python3
"""Stock woodland canopy occupancy in two official 2020 public-woodlot stand windows."""
import argparse,base64,hashlib,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
from PIL import Image,ImageDraw
import numpy as np

src=importlib.util.spec_from_file_location('fixed_scenery',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(src);src.loader.exec_module(fixed)
PIN='46a00e994e75a342523d284f30b36f4b7a7457b968f0335ec183d5ef46d9c5b7'
SPECS={'0490312':(55,14),'0560971':(85,18)}

base=fixed.stage
def stage(repo,root,deps,void):
 base(repo,root,deps,void)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=', '''const qc=JSON.parse(new URLSearchParams(location.search).get('qa')!);
 const startPoint=projectSite(qc.lon,qc.lat),warmForest=''')
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  (window as any).captureWoodlandOccupancy=()=>{
   const ortho=new THREE.OrthographicCamera(-qa.width/2,qa.width/2,qa.height/2,-qa.height/2,.5,2000);
   ortho.position.set(center.x,baseH+450,center.z);
   ortho.up.set(0,0,-1);ortho.lookAt(center.x,baseH,center.z);ortho.updateMatrixWorld();
   const snap=(at=ortho)=>{renderer.render(scene,at);return renderer.domElement.toDataURL('image/png');};
   const v=vegetation as any,crown=v.crown,oldCount=v.geom.instanceCount;
   const added=miscoucheArt?.mesh,shown=!!added?.visible;
   const old=scene.background,children=scene.children.map(g=>[g,g.visible] as const);
   const oblique=snap(camera);if(added)added.visible=false;
   const obliqueStock=snap(camera);
   const allStock=snap();
   if(added)added.visible=shown;
   const all=snap();
   v.geom.instanceCount=v.hedgeStart;
   for(const [g] of children)g.visible=g===crown||(g===added&&shown);
   scene.background=new THREE.Color(0);const canopy=snap();
   if(added)added.visible=false;const canopyStock=snap();
   const a=v.stems.array,b=v.shapes.array,n=v.hedgeStart,stems=[];
   for(let i=0;i<n;i++){
    const x=a[i*3],z=a[i*3+2];
    if(Math.abs(x-center.x)<qa.width*.5+14&&Math.abs(z-center.z)<qa.height*.5+14)stems.push([x,z,b[i*4],b[i*4+1],b[i*4+2]]);
   }
   v.geom.instanceCount=oldCount;scene.background=old;for(const [g,visible] of children)g.visible=visible;
   return {all,allStock,canopy,canopyStock,oblique,obliqueStock,stems,cx:center.x,cz:center.z,total:miscoucheArt?.total??0,shown};
  };''')
 p.write_text(s)
fixed.stage=stage
def capture(a,browser,url):
 raw=a.stands.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:
  raise ValueError('Unexpected CLUI geometry bytes; verify source revision before interpreting a delta')
 src=json.loads(raw); out=[]
 if len(src['features'])!=2 or {f['properties']['fieldid'] for f in src['features']}!=SPECS.keys():
  raise ValueError('Unexpected stand selection')

 A=6378137; e2=6.69437999014e-3; rad=math.pi/180; phi=46.5*rad; t=1-e2*math.sin(phi)**2; c=A*rad*math.cos(phi)/math.sqrt(t); v=A*(1-e2)*rad/t**1.5
 for f in src['features']:
  code=f['properties']['fieldid'];assert f['geometry']['type']=='Polygon'
  assert (f['properties']['crown'],f['properties']['height'])==SPECS[code]
  outer,*holes=f['geometry']['coordinates']
  w,s,e,n=min(x[0] for x in outer),min(x[1] for x in outer),max(x[0] for x in outer),max(x[1] for x in outer); x,y=(w+e)/2,(s+n)/2
  width,height=math.ceil((e-w)*c+26),math.ceil((n-s)*v+26)
  view=dict(lon=x,lat=y,dist=350,east=-.63,south=.78,agl=127,h=14,width=width,height=height)
  size=(width,height)
  cxt=browser.new_context(viewport={'width':size[0],'height':size[1]},device_scale_factor=1)
  try:
   pg=cxt.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
   flag='' if a.standard_coverage else '&miscoucheCanopyStudy'
   pg.goto(url+'/?diagnostics'+flag+'&qa='+quote(json.dumps(view)),wait_until='domcontentloaded')
   if a.standard_coverage:
    pg.wait_for_function("window.islandAirDiagnostics?.mode==='dispatch'")
    pg.get_by_role('button',name='Begin flight').click()
   d=fixed.settle(pg,errors)
   assert d['woodlandStream']['activeReady'],d['woodlandStream']
   if code=='0560971':pg.wait_for_function('window.islandAirDiagnostics?.miscoucheFillGain>.9999')
   p=pg.evaluate('window.captureWoodlandOccupancy()')
   for k in ('all','allStock','canopy','canopyStock','oblique','obliqueStock'):(a.out/f'{code}-{k}.png').write_bytes(base64.b64decode(p.pop(k).split(',',1)[1]))

   # Calibrate to the app's exact project() constants rather than GIS degrees areas.
   def to_px(lon,lat):return ((lon-x)*c+width*.5,(y-lat)*v+height*.5)
   screen=Image.new('1',size);draw=ImageDraw.Draw(screen)
   draw.polygon([to_px(*xy[:2]) for xy in outer],fill=1)
   for ring in holes:draw.polygon([to_px(*xy[:2]) for xy in ring],fill=0)
   m=np.array(screen,dtype=bool);screen.save(a.out/f'{code}-mask.png')
   im=np.asarray(Image.open(a.out/f'{code}-canopy.png'))[:,:,:3]
   occ=im.max(axis=2)>2
   p['canopy']=dict(total=int(m.sum()),present=int((occ&m).sum()),share=round(float(occ[m].mean()),5))
   p['source']=f['properties']; p['bounds']=[w,s,e,n]; p['screenshotSize']=size
   p['forestRostersInFrameAndApron']=len(p['stems'])
   p['fixtureManifestSha256']=PIN
   out.append(p)
   print(code,p['canopy'],p['forestRostersInFrameAndApron'],flush=True)
  finally:cxt.close()
 (a.out/'occupancy.json').write_text(json.dumps(out,indent=2)+'\n')
fixed.capture=capture
parser=argparse.ArgumentParser()
parser.add_argument('--checkout',type=Path,required=True)
parser.add_argument('--stands',type=Path,required=True)
parser.add_argument('--deps',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--chromium',required=True)
parser.add_argument('--standard-coverage',action='store_true')
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
