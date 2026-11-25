import argparse,json,hashlib,sys,math,base64,importlib.util
from pathlib import Path
from urllib.parse import quote
D=Path(__file__).resolve().parent;J=lambda f:json.loads(f.read_text());H=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--select',nargs='+',required=True);p.add_argument('--cold-control',action='store_true');p.add_argument('--deps',type=Path,default=None);p.add_argument('--chromium',required=True);a=p.parse_args();a.size='840x540';a.void_probe=False;a.pose_baseline=None
r=J(D/'independent-shadow-gates.json');poses=r['views'];spec=importlib.util.spec_from_file_location('originalQA',a.checkout/'tools/qa/fixed-scenery.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b);stage0=b.stage
def stage(repo,tmp,deps,void):
 stage0(repo,tmp,deps,void);m=tmp/'src/main.ts';s=m.read_text();s=b.once(s,'regionalWind?.update(camera.position,time);','regionalWind?.update(camera.position,12);');anchor='\n  renderer.render(scene,camera);';m.write_text(b.once(s,anchor,anchor+'\n'+(D/'shadow-hook.ts.txt').read_text()))
b.stage=stage
def capture(a,browser,url):
 for name in a.select:
  station=name.split('-')[0];farm={'WCW27':'west-cape','EKW6':'east-point-i','HCS3':'hermanville'}[station];pose=poses[name];errs=[]
  with browser.new_context(viewport={'width':840,'height':540},device_scale_factor=1)as ctx:
   pg=ctx.new_page();pg.set_default_timeout(110000);pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda e:errs.append(e.text)if e.type=='error'else None);pg.on('response',lambda e:errs.append(str(e.status)+' '+e.url)if e.status>=400 and e.url.startswith(url)else None)
   pg.goto(url+'/?diagnostics&stockRegionalWindRotorLight&qa='+quote(json.dumps(pose))+('&stockRegionalWindLight'if a.cold_control else ''),wait_until='domcontentloaded')
   pg.wait_for_function('''v=>{const d=window.islandAirDiagnostics,t=d?.buildingTiles,f=d?.regionalWind?.farms.find(a=>a.farm===v[0]);return t?.wanted>0&&t.ready===t.wanted&&!t.loading&&!t.pending&&!t.failed&&f?.registered&&(v[1]||f.groundLight?.phase==='ready'&&f.groundLight?.activeTiles>0)}''',arg=[farm,a.cold_control or name.endswith('-far')]);diag=b.settle(pg,errs);assert not errs,errs
   R=pg.evaluate('v=>window.qaSealedWindShadow(v)',{'station':station,'farm':farm});assert not errs,errs;frames=R.pop('frames')
   for k,s in frames.items():(a.out/(name+'-'+k+'.png')).write_bytes(base64.b64decode(s.split(',',1)[1]))
   R['registeredCamera']=pose;R['programSource']=H(a.checkout/'src/render/regional-wind-light.ts');R['readyBuildingTiles']=diag['buildingTiles']['ready'];R['frameHashes']={k:H(a.out/(name+'-'+k+'.png'))for k in frames};R['errors']=errs;(a.out/(name+'-live.json')).write_text(json.dumps(R)+'\n');print(name,R['diagnostic'],R['normal'],'active',[(p['fragmentSamplerUnits'],p['fragmentRegisterConservativeUpper'])for p in R['stageBudget']],'raw',len(R['nativeTerrainTriangles']),'restored',R['frameHashes']['on']==R['frameHashes']['restored'],flush=True)
b.capture=capture;b.run(a)
