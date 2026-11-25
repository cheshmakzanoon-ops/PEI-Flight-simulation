#!/usr/bin/env python3
"""Disposable comparison to the frozen released complete-circle renderer. Never changes the checkout."""
import argparse,base64,copy,hashlib,importlib.util,json,math,subprocess,sys,tempfile,time
from pathlib import Path
from urllib.parse import quote
D=Path(__file__).resolve().parent; plan=json.loads((D/'independent-registered-cull.json').read_text());H=lambda x:hashlib.sha256(x).hexdigest()
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--original',type=Path,required=True,help='git checkout containing signed original object');p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium');p.add_argument('--deps',type=Path);p.add_argument('--select',nargs='+',default=['Prince','Queens','Kings']);p.add_argument('--sample',choices=['primary','extended','motion','grazing','town','high','standard','no-msaa','rollback','combo','near-plane','v2-parity','precise-agl'],default='primary');p.add_argument('--stage-only',type=Path);p.add_argument('--resume',action='store_true')
a=p.parse_args();a.deps=(a.deps or a.checkout/'node_modules').resolve();a.pose_baseline=None;a.size='920x580';a.void_probe=False
q=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py');b=importlib.util.module_from_spec(q);q.loader.exec_module(b);base=b.stage
def stage(repo,tmp,deps,void):
 base(repo,tmp,deps,void)
 f='src/render/woodland-volume.ts';old=subprocess.check_output(['git','-C',str(a.original),'show',plan['base']+':'+f]);assert H(old)==plan['originalHashes'][f],H(old)
 (tmp/'src/render/woodland-independent-base.ts').write_bytes(old)
 for f in ('src/render/woodland-volume-geometry.ts','src/render/woodland-volume.generated.ts','src/render/grounded-tree-shadow.ts'):
  assert H((repo/f).read_bytes())==plan['originalHashes'][f],f
 m=tmp/'src/main.ts';s=m.read_text();s=b.once(s,'const startPoint=projectSite(SITES[0].lon,SITES[0].lat),warmForest=',"""const qp=JSON.parse(new URLSearchParams(location.search).get('qa')!);
 const wc=projectSite(qp.lon,qp.lat),wn=Math.hypot(qp.east,qp.south);
 const startPoint={x:wc.x+qp.dist*qp.east/wn,z:wc.z+qp.dist*qp.south/wn},warmForest=""")
 s=b.once(s,'const norm=Math.hypot(qa.east,qa.south),ex=center.x+qa.dist*qa.east/norm,ez=center.z+qa.dist*qa.south/norm;',"""const adj=(window as any).qaWoodAdjust??{},norm=Math.hypot(qa.east,qa.south),dist=qa.dist+(adj.walk??0);
      const ex=adj.pos?.[0]??center.x+dist*qa.east/norm,ez=adj.pos?.[2]??center.z+dist*qa.south/norm;""")
 s=b.once(s,'f.y=qa.fixedEyeY??terrain.elevation(ex,ez)+qa.agl;','f.y=adj.pos?.[1]??(adj.worldAGL!==undefined?world.groundHeight(ex,ez)+adj.worldAGL:adj.agl!==undefined?terrain.elevation(ex,ez)+adj.agl:qa.fixedEyeY??terrain.elevation(ex,ez)+qa.agl);')
 s=b.once(s,'camera.updateMatrixWorld();aircraft.root.visible=false;',"""if(adj.yaw)camera.rotateOnWorldAxis(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(adj.yaw));if(adj.pitch)camera.rotateX(THREE.MathUtils.degToRad(adj.pitch));if(adj.roll)camera.rotateZ(THREE.MathUtils.degToRad(adj.roll));camera.updateMatrixWorld();aircraft.root.visible=false;""")
 needle='\n  renderer.render(scene,camera);';s=b.once(s,needle,needle+'\n'+(D/'view-proof.ts.txt').read_text()+"""
  (window as any).qaFrozenWoodSources=()=>({bark:(vegetation as any).volume?.barkGain.value,crown:(vegetation as any).volume?.crownCount});
  (window as any).qaNearTrunk=()=>{const o=(vegetation as any).qaOriginalWood;if(!o)return;let k=Infinity,pose;const raw=(vegetation as any).stems.array;
   for(let i=0;i<o.mask.array.length;i++)if(o.mask.array[i]&&i<k){const j=i*3;if(Math.hypot(raw[j]-camera.position.x,raw[j+2]-camera.position.z)<37){k=i;pose=[raw[j]+.025,raw[j+1]+1.8,raw[j+2]+.02];}}return pose;};""")
 if a.sample=='no-msaa':s=b.once(s,'antialias:true','antialias:false')
 m.write_text(s)
 v=tmp/'src/render/vegetation.ts';s=v.read_text();s="import {WoodlandVolume as OriginalVolume} from './woodland-independent-base.ts';\n"+s
 s=b.once(s,"this.volume=layer;this.geom.setAttribute('branchActive',layer.mask);","""const d=(this as any).qaOriginalWood=new OriginalVolume(new THREE.Scene(),maxTrees,(layer as any).crownLift);
  if(world&&scene)(this as any).qaOriginalShade=d.makeGroundedShadows(new THREE.Scene(),world,(this.shade.material as any).uniforms.canopy.value,maxTrees);
  this.volume=layer;this.geom.setAttribute('branchActive',layer.mask);""")
 s=b.once(s,'const v=this.volume;if(!v)return;\n  v.update(','''const v=this.volume;if(!v)return;
  const original=(this as any).qaOriginalWood;original.update(this.stems.array,this.shapes.array,this.hedgeStart,x,z,agl,this.forestRevision);
  (this as any).qaOriginalShade?.update(this.stems.array,this.shapes.array,original.mask.array,this.hedgeStart,original.rosterVersion);
  v.update(''')
 v.write_text(s)
b.stage=stage
if a.stage_only:
 a.stage_only.mkdir(exist_ok=True,parents=True);stage(a.checkout,a.stage_only,a.deps,False);print(a.stage_only);sys.exit()
def state(pg,err,volume=True,bark=False):
 pg.wait_for_function("""([need,bark])=>{const d=window.islandAirDiagnostics,t=d?.buildingTiles;return window.qaTreeCull&&d?.roads&&d?.mainland&&d?.buildings&&t?.wanted>0&&t.ready===t.wanted&&!t.loading&&!t.pending&&!t.failed&&window.reviewCamera?.frame>12&&(!need||d.woodlandVolume>0)&&(!bark||d.woodlandBark==='ready'&&window.qaFrozenWoodSources?.().bark===1)}""",arg=[volume,bark])
 diag=b.settle(pg,err);assert not err,err;return diag
def one(pg,site,name,adj,initial=False,iso=False,vis=False,stable=False,positive=False,conservative=False,use_png=False,fault=None):
 f=a.out/(site+'-'+a.sample+'-'+name+'.json')
 if a.resume and f.exists():
  old=json.loads(f.read_text());assert old['candidateRuntimeSHA']==H((a.checkout/'src/render/woodland-volume.ts').read_bytes())and old['adjustment']==adj and old['site']==site and old['sample']==a.sample and old['case']==name,'Old retained output has different source or case';return old
 instant=a.sample=='motion' and name.startswith(('yaw','pitch','roll','portrait','landscape')); baseAdj={} if instant else adj
 pg.evaluate('q=>{window.qaWoodAdjust=q;return new Promise(f=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(f))));}',baseAdj)
 R=pg.evaluate('p=>window.qaTreeCull(p)',dict(visibility=vis,isolated=iso,attributes=stable,png=use_png,fault=fault,instant=adj if instant else None))
 R.update({'site':site,'sample':a.sample,'case':name,'adjustment':adj,'instantSameRenderMatrix':instant,'faultInActualDraw':fault,'inputPose':POSES.get(site),'originalCommit':plan['base'],'candidateRuntimeSHA':H((a.checkout/'src/render/woodland-volume.ts').read_bytes())})
 for k,r in R['reads'].items():
  if r.get('png'):(a.out/(site+'-'+a.sample+'-'+name+'-'+k+'.png')).write_bytes(base64.b64decode(r.pop('png').split(',',1)[1]))
 assert R['glError']==0,R['glError'];f.write_text(json.dumps(R,separators=(',',':'),allow_nan=False)+'\n')
 assert not R['pair']['matched']['any'] and not R['pair']['restored']['any'],(f,R['pair'])
 if iso and R['submittedMode']:assert not R['visibility']['isolated']['any'],(f,R['visibility'])
 if vis and positive:assert R['visibility']['fullSceneTree' if iso else 'over2']['over2']>100 if iso else R['visibility']['over2']>100,(f,R['visibility'])
 assert R['sourceMaskEquals'] and R['sourceCountsEqual'] and R['liftCountsEqual'] and R['shadeBuffersEqual'],(f,'whole roster/shade')
 assert not R['bound']['unproved'] and R['bound']['ordered'],(f,R['bound'])
 assert R['reads']['candidate']['draws']<=R['reads']['reference']['draws'],(f,'new draws')
 if stable and R['submittedMode']:assert R['steady']['volumeUploads']==0,(f,R['steady'])
 if positive and not conservative:assert R['bound']['nzOmitted']>0 and R['reads']['candidate']['volumeTris']<R['reads']['reference']['volumeTris'],(f,R['bound'])
 print(f.name,'original/drawn/sourceCount',R['reads']['reference']['volumeTris'],R['reads']['candidate']['volumeTris'],R['sourceVisible'],'realOffscreen',R['bound']['nzOmitted'],'RGB',R['pair'],'shadeExact',R['shadeBuffersEqual'],flush=True);return R
POSES={}
def capture(a,browser,url):
 for site in a.select:
  pose=copy.copy(plan['grazing' if a.sample=='grazing' else 'sites'][site]);flags={'standard':'','grazing':'woodlandCrownBase&woodlandBark','combo':'woodlandView','rollback':'woodland3D&stockWoodlandVolumeCull','town':'woodland3D'}.get(a.sample,'woodland3D')
  if a.sample=='high':pose.update(dict(agl=152,dist=62,h=8))
  if a.sample=='town':
   t=next(x for x in plan['urbanControls'] if x['county']==site); heading=math.radians(t['heading']);delta=120
   # Real departure eye with regular yaw aimed forward over town, not an arbitrarily distant high-oblique countryside.
   lon,lat=t['lon'],t['lat'];e=-math.sin(heading);s=math.cos(heading);phi=math.radians(46.5);e2=6.69437999014e-3;fn=1-e2*math.sin(phi)**2;mx=6378137*(math.pi/180)*math.cos(phi)/math.sqrt(fn);mz=6378137*(1-e2)*(math.pi/180)/fn**1.5;pose=dict(lon=lon+(delta*-e)/mx,lat=lat+(delta*s)/mz,dist=delta,east=e,south=s,agl=t['agl'],h=t['agl']*1.25)
  POSES[site]=pose;err=[]
  with browser.new_context(viewport={'width':920,'height':580},device_scale_factor=1)as ctx:
   pg=ctx.new_page();pg.set_default_timeout(120000);pg.on('pageerror',lambda e:err.append(str(e)));pg.on('console',lambda e:err.append(e.text)if e.type=='error'else None);pg.on('response',lambda e:err.append(str(e.status)+' '+e.url)if e.status>=400 and e.url.startswith(url)else None)
   pg.goto(url+'/?diagnostics&'+flags+'&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   diag=state(pg,err,a.sample not in ['no-msaa','standard','high','town'],a.sample in ['grazing','combo']);print(site,a.sample,'mounted',diag.get('woodlandVolume'),diag.get('woodlandGroundedShadows'),diag.get('woodlandBark'),flush=True)
   zero=a.sample in ['no-msaa','standard','high'];quick=a.sample in ['standard','no-msaa','high','town','rollback'];move=a.sample in ['motion','near-plane'];main=a.sample=='primary'
   if a.sample=='v2-parity':
    rows=[]
    for nm,fx in [('normal',None),('sceneOverride','override'),('foreignFragment','fragment'),('restored',None)]:
     r=one(pg,site,nm,{},vis=fx is None,iso=fx is None,positive=fx is None,fault=fx);rows.append(r)
     if fx:assert r['liveState']['active'] is False and r['reads']['candidate']['volumeTris']==r['reads']['reference']['volumeTris']>0,(nm,r['liveState'])
    assert rows[0]['reads']['candidate']['sha256']==rows[-1]['reads']['candidate']['sha256'];assert not err,err;continue
   if quick:
    r=one(pg,site,'zero-or-legacy',{},vis=False);assert not zero or r['reads']['candidate']['volumeTris']==0;assert a.sample!='rollback' or r['reads']['candidate']['volumeTris']==r['reads']['reference']['volumeTris'];continue
   L=[]
   if a.sample in ['primary','grazing','combo','extended']:
    L=[('yaw'+str(y),dict(yaw=y))for y in (plan['primary']['sameEyeYawOffsetsDeg'] if a.sample in ['primary','extended'] else [0,90])]
   if a.sample=='precise-agl':L=[('engineAGL'+str(j),dict(worldAGL=i))for j,i in enumerate(plan['motion']['altitudeAGL'])]
   if a.sample=='near-plane':
    pos=pg.evaluate('window.qaNearTrunk()');assert pos
    L=[('near'+str(y),dict(pos=pos,yaw=y))for y in [0,90,180,270]]
   if a.sample=='motion':
    M=plan['motion'];L=[('yaw'+str(y),dict(yaw=y))for y in M['yawDeg']]+[('roll'+str(j),dict(roll=r))for j,r in enumerate(M['rollDeg'])]+[('pitch'+str(j),dict(pitch=t))for j,t in enumerate(M['pitchDeltaDeg'])]+[('walk'+str(j),dict(walk=i))for j,i in enumerate(M['outwardStepsM'])]+[('alt'+str(j),dict(agl=i))for j,i in enumerate(M['altitudeAGL'])]
    L+=[('portrait',{}),('landscape',{})]
   for n,(k,v)in enumerate(L):
    if k in ['portrait','landscape']:w,h=plan['motion'][k];pg.set_viewport_size({'width':w,'height':h})
    positive=(main or a.sample=='extended') and n==0
    r=one(pg,site,k,v,iso=(n==0 and not move),vis=(n==0 and not move),stable=(site=='Queens'and n==0 and main),positive=positive,use_png=positive)
    if a.sample=='precise-agl':
     assert abs(r['actualEyeAGL']-v['worldAGL'])<1e-8
     if v['worldAGL']>=112:assert r['sourceVisible']==0 and r['reads']['candidate']['volumeTris']==0
   assert not err,err
b.capture=capture;b.run(a)
