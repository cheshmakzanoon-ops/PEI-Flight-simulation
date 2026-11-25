"""Use real release geography and true WebGL rotor depth; only a temporary environment receives the QA taps."""
import argparse,json,hashlib,sys,base64,importlib.util,gzip
from pathlib import Path
from urllib.parse import quote
D=Path(__file__).resolve().parent;J=lambda p:json.loads(p.read_text());H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--select',nargs='+',required=True);p.add_argument('--deps',type=Path);p.add_argument('--chromium',required=True);a=p.parse_args();a.size='840x540';a.void_probe=False;a.pose_baseline=None
if a.deps is None:a.deps=a.checkout/'node_modules'
r=J(D/'independent-moving-shadow-gates.json');poses=r['actualViews'];spec=importlib.util.spec_from_file_location('ordinaryRaw',a.checkout/'tools/qa/fixed-scenery.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b);stage0=b.stage
def stage(repo,tmp,deps,void):
 stage0(repo,tmp,deps,void);m=tmp/'src/main.ts';s=m.read_text();s=b.once(s,'regionalWind?.update(camera.position,time);','regionalWind?.update(camera.position,(window as any).qaRotorClock??.173);');anchor='\n  renderer.render(scene,camera);';m.write_text(b.once(s,anchor,anchor+'\n'+(D/'live-depth-hook.ts.txt').read_text()))
b.stage=stage
def capture(a,browser,url):
 for name in a.select:
  station=name.split('-')[0];farm={'WCW27':'west-cape','EKW6':'east-point-i','HCS3':'hermanville'}[station];pose=poses[name];errs=[];far=name.endswith('warm-far')
  with browser.new_context(viewport={'width':840,'height':540},device_scale_factor=1)as ctx:
   pg=ctx.new_page();pg.set_default_timeout(110000);pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda e:errs.append(e.text)if e.type=='error'else None);pg.on('response',lambda e:errs.append(str(e.status)+' '+e.url)if e.status>=400 and e.url.startswith(url)else None)
   pg.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
   pg.wait_for_function("""v=>{const d=window.islandAirDiagnostics,t=d?.buildingTiles,f=d?.regionalWind?.farms.find(a=>a.farm===v[0]);return t?.wanted>0&&t.ready===t.wanted&&!t.loading&&!t.pending&&!t.failed&&f?.registered&&(v[1]||f.groundLight?.moving?.phase==='ready'&&f.groundLight?.moving?.casters>0||f.groundLight?.moving?.phase==='ready'&&f.groundLight?.moving?.activeTiles>0||f.groundLight?.moving?.phase==='ready'&&f.groundLight?.moving?.submittedTriangles>0)}""",arg=[farm,far])
   diag=b.settle(pg,errs);assert not errs,errs;print('actual mounted',name,diag['regionalWind']['farms'],flush=True)
   times=r['fixedTimeSec'];selected=[1]if far else [1,3] if name.endswith('cross')else list(range(len(times)))
   for j in selected:
    key=name+'-'+str(j);want=far or j in [1,3];old=a.out/(key+'-live.json')
    if old.exists():print('reuse own complete identical invocation',key,flush=True);continue
    R=pg.evaluate('v=>window.qaMovingRotor(v)',{'site':station,'farm':farm,'time':times[j],'depth':not far and not name.endswith('cross'),'frames':want,'buffers':not far and j==0,'terrain':not far and j==1,'wantFar':far});assert not errs,errs
    dep=R.pop('liveDepth',None);rawhash=None
    if dep:
     raw=gzip.decompress(base64.b64decode(dep));fp=a.out/(key+'-u16le.bin');fp.write_bytes(raw);rawhash=H(fp)
    if R.get('actualReadSource'):
     for tag in ['actualReadSource','actualReadDepthSubmit']:
      for k in ['positionBytes','indexBytes']:
       val=R[tag].pop(k,None)
       if val:
        xx=base64.b64decode(val);fn=a.out/(key+'-'+tag+'-'+k+'.bin');fn.write_bytes(xx);R[tag][k+'SHA256']=H(fn)
    frames=R.pop('frames',{}) or {};R['frameHashes']={}
    for k,s in frames.items():
     f=a.out/(key+'-'+k+'.png');f.write_bytes(base64.b64decode(s.split(',',1)[1]));R['frameHashes'][k]=H(f)
    R.update({'sourceSHA256':{k:H(a.checkout/'src/render'/k) for k in ['regional-wind.ts','regional-wind-rotor-field.ts','regional-wind-rotor.ts','regional-wind-light.ts']},'view':pose,'sampleIndex':j,'requestedClock':times[j],'rawDepthU16LE':rawhash,'geoTilesReady':diag['buildingTiles']['ready'],'errors':errs})
    old.write_text(json.dumps(R)+'\n');print(key,'id',R.get('slot'), 'clock',R.get('clock'), 'sampled',rawhash[:8] if rawhash else None,'matchedPhase',R.get('actualReadSource',{}).get('phase')==R.get('actualReadDepthSubmit',{}).get('phase'),'frame',list(R['frameHashes']),flush=True)
b.capture=capture;b.run(a)
