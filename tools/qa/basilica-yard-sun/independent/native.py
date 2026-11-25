import argparse,base64,gzip,hashlib,io,importlib.util,json
from pathlib import Path as P
import numpy as np
from PIL import Image
D=P(__file__).resolve().parent;R=D
p=argparse.ArgumentParser();p.add_argument('--checkout',type=P,required=True);p.add_argument('--out',type=P,required=True);p.add_argument('--chromium',required=True);p.add_argument('--pose',default='shadow-road-and-court');p.add_argument('--no-depth',action='store_true');p.add_argument('--baseline',type=P);a=p.parse_args()
lock=R/('shadow-open-curb-supplement231.json' if a.pose=='shadow-low-open-control' else 'shadow-camera-prelock231.json');q=json.loads(lock.read_bytes());pose=q['views'][a.pose];H=lambda x:hashlib.sha256(x.read_bytes()).hexdigest()
f=importlib.util.spec_from_file_location('PEI',a.checkout/'tools/qa/fixed-scenery.py');m=importlib.util.module_from_spec(f);f.loader.exec_module(m);stage,settle,quote=m.stage,m.settle,m.quote
m.VIEWS={a.pose:{k:pose[k]for k in ('lon','lat','east','south','h')}|{'nearDist':pose['dist'],'nearAgl':pose['agl']}}
a.size='x'.join(map(str,q['drawingBuffer']));a.views=a.pose+'-close';a.deps=None;a.void_probe=False;a.pose_baseline=a.baseline
m.quote=lambda x:quote(x)+'&basilicaExteriorStudy&basilicaYardSun'
def st(repo,scratch,deps,void):
 stage(repo,scratch,deps,void);fp=scratch/'src/main.ts';s=fp.read_text();an='  renderer.render(scene,camera);';assert s.count(an)==1;fp.write_text(s.replace(an,(D/'live-cast-readback.ts.txt').read_text()+'\n'+an))
def read(pg,errs):
 g=settle(pg,errs);pg.wait_for_function('window.islandAirDiagnostics?.basilicaSun?.yard===true&&typeof window.qaActualBasilicaR==="function"&&(()=>{const b=window.islandAirDiagnostics?.buildingTiles;return !!b&&b.ready>0&&b.ready===b.wanted&&b.loading===0&&b.pending===0})()',timeout=65000);ret=pg.evaluate('(q)=>window.qaActualBasilicaR(q)',{'depth':not a.no_depth});assert not errs,errs
 a.out.mkdir(parents=True,exist_ok=True)
 axes=ret.pop('nativePavement')
 (a.out/'native-pavement-receivers.json').write_text(json.dumps({'scope':'Exact actual submitted road/walk world-space positions from the fixed optional baseline-compatible source, not nominal GIS footprints.','capture':axes},separators=(',',':'))+'\n')
 dep=ret.pop('depthGzBase64',None)
 if dep:
  d=a.out/'real-mounted.u16le';raw=gzip.decompress(base64.b64decode(dep));assert len(raw)==2*1024**2;d.write_bytes(raw);ret['rawDepthSha256']=H(d)
 imgs={};ret['frameSHA256']={}
 for lab,val in ret.pop('frames').items():
  png=a.out/(lab+'.png');b=base64.b64decode(val.split(',',1)[1]);png.write_bytes(b);ret['frameSHA256'][lab]=H(png);imgs[lab]=np.array(Image.open(io.BytesIO(b)).convert('RGB'),dtype=np.int16)
 stats={}
 for lab,im in imgs.items():
  delta=im-imgs['off'];md=np.abs(delta).max(2);stats[lab]={'any':int((md>0).sum()),'over2':int((md>2).sum()),'over8':int((md>8).sum()),'peak':int(md.max()),'brightAny':int((delta.max(2)>0).sum()),'bright2':int((delta.max(2)>2).sum())}
 ret.update({'fullyResidentOriginalBuildings':pg.evaluate('window.islandAirDiagnostics.buildingTiles'),'pair':stats,'nativeGLErrors':errs,'registeredView':a.pose,'cameraLockSHA256':H(lock),'strictFrozenCheckout':{f:H(a.checkout/'src/render'/f)for f in ('basilica-cast-source.ts','basilica-cast-glsl.ts','basilica-local-sun.ts','basilica-cast-material.ts')},'cameraOriginalMatched':a.pose_baseline is not None})
 op=a.out/'live-original-receivers.json';op.write_text(json.dumps(ret,indent=2)+'\n');print(a.pose,'realDepth',ret.get('rawDepthSha256'),stats,'samplers',[(k,v['physical'],v['exactDepth']) for k,v in ret['physicalSamplerRoster'].items()],'gl',errs,flush=True);return g
m.stage=st;m.settle=read;m.run(a)
