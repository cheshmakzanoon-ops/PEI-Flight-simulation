"""Conservatively reproject actual drawn old/new rooftop, walls and detailing through original locked cameras; fail any normal candidate pixel outside true two-owner union+2px.
Takes original wXYZ triangle packets for q03020/133 and candidate, not cuboids or a region-of-interest.
"""
from pathlib import Path as P
import argparse,json,hashlib,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
p=argparse.ArgumentParser();p.add_argument('--stock',type=P,required=True);p.add_argument('--trial',type=P,required=True);p.add_argument('--out',type=P,required=True);p.add_argument('--old-mesh',type=P,required=True);p.add_argument('--new-mesh',type=P,required=True);p.add_argument('--views',nargs='+');p.add_argument('--same-tick',action='store_true');a=p.parse_args();H=lambda path:hashlib.sha256(path.read_bytes()).hexdigest();J=lambda f:json.loads(f.read_bytes())
def mesh(f):
 lo=J(f)
 if 'triangles' in lo:tri=np.asarray(lo['triangles'],np.float64)
 else:
  g=f.parent/lo['file']; assert H(g)==lo['sha256'];tri=np.frombuffer(g.read_bytes(),dtype='<f8').reshape(-1,3,3)
 assert tri.shape[1:]==(3,3);return tri
A,B=mesh(a.old_mesh),mesh(a.new_mesh);data={};stock=J(a.stock/'results.json');trial={r['name']:r for r in J(a.trial/'results.json')};ms={r['site']:r for r in J(a.stock/'live-geometry.json')};mt={r['site']:r for r in J(a.trial/'live-geometry.json')}; AA=4
def project(tris,vm,proj):
 v=np.c_[tris.reshape(-1,3),np.ones(tris.size//3)]@np.linalg.inv(vm).T@proj.T;assert (v[:,3]>0).all(),'All registered silhouettes are in front of camera; any other view requires true homogeneous clipping.';return (v[:,:2]/v[:,3:]).reshape(-1,3,2)
def mask(q,w,h):
 im=Image.new('L',(w*AA,h*AA),0);draw=ImageDraw.Draw(im)
 for t in q:
  pp=(t*np.array([1,-1])+1)*np.array([w*AA/2,h*AA/2]);draw.polygon([tuple(x)for x in pp],fill=255)
 return np.asarray(im).reshape(h,AA,w,AA).max(axis=(1,3))>0
def summary(x):
 return {'any':int((x>0).sum()),'over2':int((x>2).sum()),'over8':int((x>8).sum()),'peak':int(x.max(initial=0))}
for ss in stock:
 name=ss['name'];site=ss['pose']['site'];
 if a.views and site not in a.views:continue
 tt=trial[name];R=ms[site];Rt=mt[site];assert np.allclose(R['pose'],Rt['pose'],atol=1e-7,rtol=0) and R['proj']==Rt['proj']
 w,h=ss['width'],ss['height'];v=np.array(R['pose']).reshape(4,4).T;pr=np.array(R['proj']).reshape(4,4).T
 pre=a.stock/(name+'.png');old=a.trial/(site+'-stock.png')if a.same_tick else pre;new=a.trial/(site+'-authored.png')if a.same_tick else a.trial/(name+'.png');src=np.asarray(Image.open(old).convert('RGB'),dtype=np.int16);cur=np.asarray(Image.open(new).convert('RGB'),dtype=np.int16);dg=np.abs(cur-src).max(axis=2)
 a0=mask(project(A,v,pr),w,h);b0=mask(project(B,v,pr),w,h);uu=a0|b0;dil=np.asarray(Image.fromarray((uu*255).astype('u1')).filter(ImageFilter.MaxFilter(5)))>0
 exterior=summary(dg[~dil]);data[site]={'stockAndTrialSHA256':[H(old),H(new)],'size':[w,h],'all':summary(dg),'exactOldPinnedVsVariantStock':summary(np.abs(np.asarray(Image.open(pre).convert('RGB'),dtype=np.int16)-src).max(axis=2)),'sameTickArms':a.same_tick,'projectedOriginalOwnerPx':int(a0.sum()),'projectedTrialOwnerPx':int(b0.sum()),'projectedBothPx':int((a0&b0).sum()),'projectedUnionPx':int(uu.sum()),'outsideUnion':summary(dg[~uu]),'outsideTrueUnionWith2PxAA':exterior,'exactChangedWithinOriginalOrNew2Px':exterior['any']==0,'strictProjectedNewOnly':summary(dg[b0&~a0]),'strictProjectedOldOnly':summary(dg[a0&~b0]),'activeInputsResided':[R['activeOldBuildings'],Rt['activeOldBuildings']],'nativeTerrainMatch':R['positionSHA256']==Rt['positionSHA256'] and R['indexSHA256']==Rt['indexSHA256'],'errors':ss['errors']+tt['errors']}
a.out.write_text(json.dumps({'scope':'True old q133 triangles + actual submitted new tower mesh only, full world matrix. A 4× conservative triangle silhouette mask treats any covered subsample as owned; max-filter exterior uses Chebyshev 2 px tolerance. Original and trial optical frames use exactly matched six camera values, resolution, static game sun and frozen water. Foliage/road/ground may occlude the shapes, so an interior difference is not proof of any particular detail; inspect it and independent photographs separately. Ignore no leaked environment; nothing outside two-pixel allowance may change.','inputs':{'oldMeshSHA256':H(a.old_mesh),'oldTriangles':len(A),'trialMeshSHA256':H(a.new_mesh),'trialTriangles':len(B)},'views':data},indent=2)+'\n');print(json.dumps({s:[r['all'],r['outsideTrueUnionWith2PxAA']]for s,r in data.items()}))
