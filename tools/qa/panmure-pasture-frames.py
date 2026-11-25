#!/usr/bin/env python3
"""Same-frame stock/neutral/actual/role/repeat of the already admitted production optic.
A temporary source copy fixes only the camera/water or, in the ordinary flight case,
only freezes time for the five synchronous draws. No source or material guard is bypassed."""
import argparse,base64,hashlib,importlib.util,json,math
from pathlib import Path
from urllib.parse import quote
import numpy as np
from PIL import Image
fpath=Path(__file__).with_name('fixed-scenery.py')
sp=importlib.util.spec_from_file_location('fixed',fpath);f=importlib.util.module_from_spec(sp);sp.loader.exec_module(f)
orig=f.stage;o=f.once
def stage(repo,root,deps,probe):
 orig(repo,root,deps,False);p=root/'src/main.ts';s=p.read_text()
 s=o(s,"const qa=JSON.parse(new URLSearchParams(location.search).get('qa')!);","const qa=JSON.parse(new URLSearchParams(location.search).get('qa')??'null');")
 s=o(s,'const center=project(qa.lon,qa.lat),baseH=qa.fixedBaseH??terrain.elevation(center.x,center.z);let qaFrame=0;', '''const center=qa?project(qa.lon,qa.lat):{x:0,z:0},baseH=qa?.fixedBaseH??terrain.elevation(center.x,center.z);let qaFrame=0;
    (window as any).pastureCameraY=(y:number)=>{if(qa)qa.fixedEyeY=y;};''')
 s=o(s,'      const norm=Math.hypot(qa.east,qa.south)','      if(qa){const norm=Math.hypot(qa.east,qa.south)')
 s=o(s,'      groundY.copy(aircraft.root.position);','      } groundY.copy(aircraft.root.position);')
 s=o(s,' let pastureOwner:', ''' if(pastureBinding&&panmurePasture){
  const m=pastureBinding.material,stock=m.fragmentShader;
  (window as any).pastureFrames=()=>{
   const actual=m.fragmentShader,g=m.uniforms.panmureGain,initial=g?.value;
   if(!g||actual===stock||!pastureBinding.ready())throw Error('No ordinary ready pasture owner at capture');
   const k='c=mix(c,color,w);';
   if(actual.split(k).length!==2)throw Error('Unqualified radiance-probe location');
   const draw=(frag:string,gain:number)=>{
    if(m.fragmentShader!==frag){m.fragmentShader=frag;m.needsUpdate=true;}
    g.value=gain;renderer.render(scene,camera);
    return {png:renderer.domElement.toDataURL(),calls:renderer.info.render.calls,tris:renderer.info.render.triangles};
   };
   try{
    return {gain:initial,eye:camera.position.toArray(),shots:[draw(stock,0),draw(actual,0),draw(actual,initial),
      draw(actual.replace(k,'c=vec3(.80,.008,.63);'),initial),draw(stock,0)]};
   }finally{m.fragmentShader=actual;m.needsUpdate=true;g.value=initial;}
  };
 }
 let pastureOwner:''')
 p.write_text(s)
f.stage=stage
C=(56304.91317458963,39540.53617316754)
def lock(eye,h,aim,aimY):
 x,z=eye[0]-aim[0],eye[1]-aim[1];return dict(lon=(C[0]+aim[0])/76762.59317717304-63.2,lat=46.5-(C[1]+aim[1])/111161.08375388647,
 dist=math.hypot(x,z),east=x,south=z,fixedEyeY=h,fixedBaseH=aimY,agl=h,h=0)
POSES={'close':lock((21,24),24,(-103,76),9.4),'approach':lock((182,-40),68,(-67,54),11.7),
 'above-field':lock((-140,65),69,(-141,65),9.9),'neighbor-mixed':lock((7,-25),22,(7,-24),9.4),
 'road-fence':lock((-34,-14),17,(-34,-13.5),9.4),'fore-peninsula':lock((-18,8),36,(85,-20),9.4)}
HEIGHTS=[(180,'height180'),(218,'height218'),(254,'height254'),(272,'height272'),(274.99,'height274.99'),(275,'height275'),(275.01,'height275.01'),(352,'high')]
def batch(page,folder,name):
 q=page.evaluate('window.pastureFrames()');raws=[]
 for shot,role in zip(q['shots'],['stock','neutral','candidate','roles','repeat']):
  b=base64.b64decode(shot.pop('png').split(',')[1]);p=folder/(name+'-'+role+'.png');p.write_bytes(b)
  shot['pngSHA']=hashlib.sha256(b).hexdigest();raws.append(np.asarray(Image.open(p).convert('RGB'),dtype=np.int16))
 base,neutral,art,role,repeat=raws
 assert np.array_equal(base,neutral) and np.array_equal(base,repeat),name
 assert len({(s['calls'],s['tris']) for s in q['shots']})==1,name
 movement=art-base;delta=np.abs(movement).max(axis=2);held=(base!=role).any(axis=2);chg=delta>2;changed=(delta>0)
 assert not (changed&~held).sum(),name
 def measure(q):
  a=q/255.;a=np.where(a>.04045,((a+.055)/1.055)**2.4,a/12.92)
  xyz=(a@np.array([[.4124564,.2126729,.0193339],[.3575761,.7151522,.119192],[.1804375,.072175,.9503041]]))/[.95047,1,1.08883]
  a=np.where(xyz>(6/29)**3,xyz**(1/3),xyz/(3*(6/29)**2)+4/29)
  return np.sqrt((500*(a[:,0]-a[:,1]))**2+(200*(a[:,1]-a[:,2]))**2)
 e=delta[chg];bch=measure(base[chg]) if e.size else [];ach=measure(art[chg]) if e.size else []
 m=dict(total=int(delta.size),changed=int(changed.sum()),meaningful=int(chg.sum()),outside=int((changed&~held).sum()),role=int(held.sum()),maxDelta=int(delta.max()),
        medianRGBDelta=np.median(movement[chg],axis=0).tolist() if e.size else [],
        medianChromaBefore=round(float(np.median(bch)),2)if e.size else None,medianChromaAfter=round(float(np.median(ach)),2)if e.size else None)
 # No footprint, colour, or gain change at these authentic local exclusions or safe heights.
 if name in ('neighbor-mixed','road-fence','fore-peninsula','height275','height275.01','high'):assert m['changed']==0,(name,m)
 if name in ('close','approach','above-field','normal-flight'):assert m['meaningful']>25,(name,m)
 if name=='close':assert m['medianChromaAfter']-m['medianChromaBefore']<7,m
 print(name,round(q['gain'],5),m,flush=True)
 return dict(name=name,metrics=m,**q)
def capture(a,browser,base):
 out=a.out;results=[];views=a.views.split(',')
 for name in views:
  page=browser.new_page(viewport={'width':624,'height':420});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  try:
   pose=POSES.get(name,POSES['above-field']);regular=name=='normal-flight'
   query='?diagnostics&departure=panmure-head-coast'+('' if regular else '&qa='+quote(json.dumps(pose)))
   page.goto(base+'/'+query,wait_until='domcontentloaded');page.set_default_timeout(320000)
   page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"');page.get_by_role('button',name='Begin flight').click()
   page.wait_for_function('window.islandAirDiagnostics?.panmurePasture?.gain===1 && window.islandAirDiagnostics?.roads && window.islandAirDiagnostics?.buildings && window.islandAirDiagnostics?.mainland')
   if regular:
    # Ordinary Dispatch camera plus unchanged rigid-body flight. Pick a near gate, not a forced position.
    page.wait_for_function('()=>{const d=window.islandAirDiagnostics;return d.x<56305+45&&d.x>56305-210 && d.altitude>60&&d.altitude<130}',timeout=320000)
   else:
    page.wait_for_function('window.reviewCamera?.frame>24 && window.islandAirDiagnostics.detail.loading===0 && window.islandAirDiagnostics.detail.retrying===0')
   if name=='altitude-sweep':
    for y,key in HEIGHTS:
     page.evaluate('(y)=>window.pastureCameraY(y)',y)
     page.wait_for_function('(h)=>Math.abs(window.reviewCamera.eyeY-h)<1e-5',arg=y)
     results.append(batch(page,out,key))
    assert all(x['gain']>=y['gain'] for x,y in zip(results[-len(HEIGHTS):],results[-len(HEIGHTS)+1:]))
   else:results.append(batch(page,out,name))
   assert not errors and not page.evaluate('window.islandAirDiagnostics.layerWarnings'),(name,errors)
   (out/'frames.json').write_text(json.dumps(results,indent=2)+'\n')
  finally:page.close()
f.capture=capture
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True)
p.add_argument('--views',default='close,approach,above-field,neighbor-mixed,road-fence,fore-peninsula,altitude-sweep,normal-flight');p.set_defaults(void_probe=False)
f.run(p.parse_args())
