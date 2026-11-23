#!/usr/bin/env python3
"""Verify fade/keep/reposition with the real Roads runtime in Chromium."""
import argparse,importlib.util,json
from pathlib import Path
from urllib.parse import quote
q=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(q);q.loader.exec_module(fixed)
original=fixed.stage
def stage(r,p,d,v):
 original(r,p,d,False)
 m=p/'src/main.ts';s=m.read_text()
 s=fixed.once(s,'const center=project(qa.lon,qa.lat)','let center=project(qa.lon,qa.lat)')
 s=fixed.once(s,'const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;', '''
  const next=(window as any).seatMotionWanted??{agl:210,dx:0,dz:0};
  qa.agl=next.agl;center=project(qa.lon,qa.lat);center.x+=next.dx;center.z+=next.dz;
  const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;
 ''')
 s=fixed.once(s,'\n  renderer.render(scene,camera);','''
  renderer.render(scene,camera);
  if(roads){
   const inf=(roads as any),ours=inf.seatState;
   (window as any).seatQA={...ours,agl:qa.agl,dx:next.dx,dz:next.dz,frame:qaFrame,
      first:inf.visible.get('-10,2')?.geometry?.uuid??null,
      inView:[...inf.visible].filter(([key,m]:any)=>String(m.userData.inlandMode).includes('|seat:')).map(([key,m]:any)=>[key,m.geometry.uuid]),
      position:[camera.position.x,camera.position.z]};
   (window as any).seatForTest=()=>world.visualGroundEpoch;
  }
 ''')
 m.write_text(s)
fixed.stage=stage
def capture(a,browser,url):
 pg=browser.new_page(viewport={'width':720,'height':450});errors=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 pose=dict(lon=-63.7921925396,lat=46.391678548,east=-.9831342,south=-.1828858,dist=29,h=0,agl=210)
 pg.goto(url+'/?diagnostics&seatedRoads&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
 def enter(name,agl,x,z,expect):
  pg.evaluate('v=>window.seatMotionWanted=v',dict(agl=agl,dx=x,dz=z))
  pg.wait_for_function('()=>{const q=window.seatQA;return q&&('+str(agl)+'===q.agl)&&('+str(x)+'===q.dx)&&('+str(z)+'===q.dz)&&('+expect+');}',timeout=120000)
  v=pg.evaluate('window.seatQA')
  print(name,v,flush=True)
  return v
 high=enter('high',210,0,0,'q.gain===0&&q.ready===0')
 warm=enter('preloaded',198,0,0,'q.gain===0&&q.ready>=1&&!q.pending')
 partly=enter('partial',153,0,0,'q.gain>.49&&q.gain<.51')
 fully=enter('ground',42,0,0,'q.gain>.999&&q.ready>=1')
 later=enter('move',42,490,-90,'q.gain>.999&&q.ready>=1')
 leave=enter('climb',220,490,-90,'q.gain===0&&q.ready===0')
 w,f,l=[dict(v['inView']) for v in (warm,fully,later)]
 assert set(w)&set(f)&set(l) and all(w[k]==f[k]==l[k] for k in set(w)&set(f)&set(l)),(warm,fully,later)
 assert not errors,errors
 # IDs are useful for equality in this run but not needed in the durable receipt.
 def receipt(v):return {k:(len(x) if k=='inView' else x) for k,x in v.items() if k!='first'}
 (a.out/'report.json').write_text(json.dumps({k:receipt(v) for k,v in zip(('high','preload','partial','ground','move','climb'),(high,warm,partly,fully,later,leave))},indent=2)+'\n')
 pg.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
