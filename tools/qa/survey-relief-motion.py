#!/usr/bin/env python3
"""Drive controlled high/low/reposition observations around the actual terrain manager."""
import argparse,json,os,time
from pathlib import Path
from urllib.parse import quote
import importlib.util
m=importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=importlib.util.module_from_spec(m);m.loader.exec_module(fixed)
base=fixed.stage
def stage(repo,root,deps,void):
 base(repo,root,deps,False)
 p=root/'src/main.ts';s=p.read_text()
 s=fixed.once(s,'  world.prepareAdaptiveTerrain(f.x,f.z,f.y,performance.now());','''
  const controls=(window as any).terrainMotion??{phase:'low'};
  const xy=project(qa.lon,qa.lat),other=project(-61.9655,46.454);
  const use=controls.phase==='far'?other:xy;
  const oldGround=terrain.contactHeight(use.x,use.z,cover.distance(terrain,use.x,use.z)>=0);
  f.x=use.x;f.z=use.z;f.y=oldGround+(controls.phase==='high'?410:36);
  world.prepareAdaptiveTerrain(f.x,f.z,f.y,performance.now());
  const motionTile=(world as any).byId.get('11-11');
  const y=world.groundHeight(xy.x,xy.z);
  (window as any).terrainMotionQA={
    mode:controls.phase,ready:world.adaptiveState?.ready,active:world.adaptiveState?.active??[],refined:world.adaptiveState?.refined,
    y,visual:motionTile?.relief?world.visualGroundHeight(xy.x,xy.z):null,
    frame:((window as any).terrainMotionQA?.frame??0)+1};
  if(controls.phase==='far'){qa.lon=-61.9655;qa.lat=46.454;}
''')
 # fixed-scenery later overrides camera. Deliberately move that same camera
 # to East Point after checking withdrawal at the beginning of the frame.
 s=s.replace("const center=project(qa.lon,qa.lat)", "let center=project(qa.lon,qa.lat)")
 s=s.replace("if(controls.phase==='far'){qa.lon=-61.9655;qa.lat=46.454;}","if(controls.phase==='far')center=other;")
 p.write_text(s)
fixed.stage=stage
def capture(a,browser,url):
 pg=browser.new_page(viewport={'width':740,'height':460})
 errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pose=dict(lon=-63.5320285,lat=46.514586,dist=143,east=.68,south=-.72,h=0,agl=36)
 pg.goto(url+'/?surveyRelief&diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
 steps=[]
 def check(tag,where):
  pg.wait_for_function(where,timeout=120000)
  item=pg.evaluate('window.terrainMotionQA')
  print(tag,item,flush=True);steps.append(dict(phase=tag,**item));return item
 low=check('low',"""()=>{const q=window.terrainMotionQA;return q?.ready>0&&q.active?.length===0&&q.frame>10}""")
 pg.evaluate("window.terrainMotion={phase:'high'}")
 high=check('high',"window.terrainMotionQA?.active?.includes('11-11')")
 pg.evaluate("window.terrainMotion={phase:'descended'}")
 down=check('descended',"window.terrainMotionQA?.mode==='descended'&&window.terrainMotionQA.active?.includes('11-11')")
 pg.evaluate("window.terrainMotion={phase:'far'}")
 far=check('far',"window.terrainMotionQA?.mode==='far'&&!window.terrainMotionQA.active?.includes('11-11')")
 assert abs(high['y']-high['visual'])<.002,high
 assert abs(high['y']-down['y'])<1e-9,(high,down)
 assert abs(far['y']-low['y'])<1e-9,(low,far)
 assert not errors,errors
 (a.out/'report.json').write_text(json.dumps(steps,indent=2)+'\n')
 pg.close()
fixed.capture=capture
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--deps',type=Path);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True);p.set_defaults(void_probe=False)
fixed.run(p.parse_args())
