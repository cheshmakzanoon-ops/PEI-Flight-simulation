"""Fixed real Three.js frames, actual terrain array/ray and collider/old matrix evidence; captures only simulation geometry."""
from pathlib import Path as P
import importlib.util,json,argparse,hashlib,base64,gzip
D=P(__file__).resolve().parent;p=argparse.ArgumentParser()
p.add_argument('--checkout',type=P,required=True);p.add_argument('--out',type=P,required=True);p.add_argument('--chromium',required=True);p.add_argument('--select',nargs='+');p.add_argument('--flag',action='append',default=[]);p.add_argument('--pose-baseline',type=P);p.add_argument('--foot',type=P);p.add_argument('--old-owner',type=P,required=True);a=p.parse_args()
lock=D/'independent-cameras.json';data=json.loads(lock.read_bytes())
assert all(t.isalnum() for t in a.flag)
f=importlib.util.spec_from_file_location('PEI',a.checkout/'tools/qa/fixed-scenery.py');m=importlib.util.module_from_spec(f);f.loader.exec_module(m);stage,settle,quote=m.stage,m.settle,m.quote
a.deps=None;a.void_probe=False;a.size=data['size'];names=a.select or ['northwest-visitor','southwest-offshore'];a.views=','.join(s+'-close'for s in names)
m.VIEWS={k:{j:v for j,v in q.items()if j!='name'}for k,q in data['views'].items()};m.quote=lambda x:quote(x)+''.join('&'+x for x in a.flag)
def st(repo,scratch,deps,vd):
 stage(repo,scratch,deps,vd);src=scratch/'src/main.ts';t=src.read_text();anc='  renderer.render(scene,camera);';assert t.count(anc)==1;insertion=' try{renderer=new THREE.WebGLRenderer(';assert t.count(insertion)==1;t=t.replace(insertion,(D/'vbo-capture.ts.txt').read_text()+'\n'+insertion);src.write_text(t.replace(anc,(D/'vbo-readback.ts.txt').read_text()+'\n'+(D/'real-variant.ts.txt').read_text()+'\n'+anc))
def settle2(pg,errors):
 pg.wait_for_function('typeof window.seacowCaseQA==="function"&&window.islandAirDiagnostics?.seacowExterior==="authored"',timeout=75000)
 _=settle(pg,errors);pg.wait_for_function("typeof window.seacowOriginalQA==='function' && (()=>{let b=window.islandAirDiagnostics?.buildingTiles;let d=window.islandAirDiagnostics.detail;return !!d&&d.ready>0&&!d.loading&&!d.retrying&&!d.missing&&b&&b.ready>0&&b.ready===b.wanted&&b.loading===0&&b.pending===0})()",timeout=90000)
 res=pg.evaluate('(f)=>window.seacowOriginalQA(f)',json.loads(a.foot.read_bytes())if a.foot else [])
 for k,typ in [('position','f32le'),('index','u16le')]:
  buf=base64.b64decode(res.pop(k));dest=a.out/('terrain-grid.'+typ);assert not dest.exists() or dest.read_bytes()==buf;dest.write_bytes(buf);res[k+'SHA256']=hashlib.sha256(buf).hexdigest();res[k+'Length']=len(buf)
 v=pg.evaluate('()=>window.seacowCaseQA()')
 from PIL import Image
 import numpy as np
 ims={};snames={};stats={};site=v['site']
 for k,img in v.pop('frames').items():
  x=a.out/(site+'-'+k+'.png');x.write_bytes(base64.b64decode(img.split(',',1)[1]));ims[k]=np.asarray(Image.open(x).convert('RGB'),dtype='i2');snames[k]=hashlib.sha256(x.read_bytes()).hexdigest()
 for k in ('rawAttrs','neighbourAttrs','originalOwnerAttrs'):
  raw=v.pop(k);v[k+'SHA256']={n:hashlib.sha256(base64.b64decode(b)).hexdigest()for n,b in raw.items()}
 refs=json.loads(a.old_owner.read_bytes());assert v['rawAttrsSHA256']==refs['allAttrs'] and v['neighbourAttrsSHA256']==refs['nearbyAttrs'] and v['originalOwnerAttrsSHA256']['position']==refs['sha256']
 for j in ('newXYZ','oldXYZ'):
  b=base64.b64decode(v.pop(j));xyz=np.frombuffer(b,dtype='<f8').reshape(-1,3,3);f=a.out/(j+'.f64le')
  if f.exists():assert f.read_bytes()==b
  else:f.write_bytes(b)
  if j=='oldXYZ':
   # Source local Float32 attributes are byte-pinned above. Browser and offline Node Math projection may place the common matrix origin one game-X double ULP apart.
   delta=xyz-np.asarray(refs['triangles']);assert np.unique(delta.reshape(-1,3),axis=0).shape[0]==1 and np.max(np.abs(delta))<=np.spacing(max(abs(xyz.min()),abs(xyz.max())))
   v['offlineVsNativeTranslationOnlyM']=delta[0,0].tolist()
  ff=a.out/(j+'-geometry.json');ff.write_text(json.dumps({'file':f.name,'sha256':hashlib.sha256(b).hexdigest(),'trianglesCount':len(xyz)},indent=2)+'\n')
 d=np.abs(ims['authored']-ims['stock']).max(2);assert np.array_equal(ims['authored'],ims['restored']) and v['glError']==0
 v['realPNGs']=snames;v['sameTickDifference']={'any':int((d>0).sum()),'over2':int((d>2).sum()),'over8':int((d>8).sum()),'peak':int(d.max())}
 (a.out/(site+'-original-variant.json')).write_text(json.dumps(v,indent=2)+'\n')
 out=a.out/'live-geometry.json';arr=json.loads(out.read_bytes())if out.exists()else[];arr.append(res);out.write_text(json.dumps(arr,indent=2)+'\n')
 g=pg.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})');assert not errors,errors;return g
m.stage=st;m.settle=settle2;m.run(a)
