#!/usr/bin/env python3
"""Fit the surveyed shallow roof of the pinned Montague first Town Hall."""
import argparse,gzip,json,math,runpy,hashlib
from pathlib import Path
import numpy as np
from osgeo import osr
osr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--root',type=Path,required=True)
p.add_argument('--source',type=Path,required=True)
p.add_argument('--verify',action='store_true')
opts=p.parse_args();d=opts.source;root=opts.root
F=runpy.run_path(str(root/'tools/geodata/fit-farm-profiles.py'))
manifest=json.loads((root/'public/world/buildings/index.json').read_text())
tile=next(t for t in manifest['tiles'] if t['id']=='q103301')
with (root/'public/world/buildings/tiles.pack').open('rb') as b:
 b.seek(tile['offset'])
 q=json.loads(gzip.decompress(b.read(tile['bytes'])))['features'][232]
assert not q.get('holes')
f=q['footprint']
def native(ll):
 return np.asarray(T.TransformPoints(np.asarray(ll).tolist()))[:,:2]
def toWorld(raw):
 return (np.asarray(F['Tback']().TransformPoints(np.asarray(raw).tolist()))[:,:2]-F['origin'])*F['scale']
T=osr.CoordinateTransformation(F['xyproj'](4326),F['xyproj'](3979))
r=native(f);fixed=(np.asarray(f)-F['origin'])*F['scale'];anchor=fixed.mean(0);ring=fixed-anchor
# Stable pre-fitted spatial validation: a 2m native tile uses the same
# assignment for every return, independently of how dense a flight strip is.
P=np.load(d/'montague-copc-native.npz')['points']
L=P[(P[:,3]==6)]
keep,edge=F['mask_unit'](r,L[:,0],L[:,1])
choice=L[keep&(edge>=.53)]
assert len(choice)==952 and np.array_equal(np.unique(choice[:,5]),[36675.])
blocks=np.floor_divide(choice[:,:2],2.).astype(np.int64)
fold=(blocks[:,0]*13+blocks[:,1]*7+3)%5==0
assert fold.sum()==189
X=np.c_[np.ones(len(choice)),toWorld(choice[:,:2])-anchor]
beta,res=F['gfit'](X[~fold],choice[~fold,2],7)
assert beta is not None and .02<np.linalg.norm(beta[1:])<.09
D=np.load(d/'montague-native-window.npz');DSM,DTM=D['dsm'],D['dtm']
nativeX,nativeY=np.meshgrid(D['X']+np.arange(DSM.shape[1]),D['Y']-np.arange(DSM.shape[0]))
ins,ed=F['mask_unit'](r,nativeX,nativeY)
ok=ins&(ed>=.68)&np.isfinite(DSM)&np.isfinite(DTM)&(DTM>-200)&(DSM-DTM>1.7)&(DSM-DTM<22)
Q=np.c_[nativeX[ok],nativeY[ok],DSM[ok],DTM[ok]];assert len(Q)>90
DX=np.c_[np.ones(len(Q)),toWorld(Q[:,:2])-anchor]
M=json.loads((root/'public/world/terrain.json').read_text())
H=np.frombuffer(gzip.decompress((root/'public/world'/M['file']).read_bytes()),'<i2').reshape(M['height'],M['width'])
b=(np.array([[M['bounds'][0],M['bounds'][3]],[M['bounds'][2],M['bounds'][1]]])-F['origin'])*F['scale']
j,k=(anchor-b[0])/(b[1]-b[0])*[M['width'],M['height']]-.5;i2,j2=math.floor(j),math.floor(k)
u,v=j-i2,k-j2
W=np.array([[1-v],[v]])*np.array([[1-u,u]])
old=float(np.sum(H[j2:j2+2,i2:i2+2]*W)/W.sum()+.05+q['height'])
def err(data):
 u=np.quantile(np.abs(data),[.50,.90,.95,1.])
 return dict(n=len(data),**{k:round(float(v),6)for k,v in zip(('p50','p90','p95','maximum'),u)})
checks={'blockedRawClass6':{'old':err(choice[fold,2]-old),'built':err(choice[fold,2]-X[fold]@beta)},
 'interiorDSMThroughAllClasses':{'old':err(Q[:,2]-old),'built':err(Q[:,2]-DX@beta)}}
assert checks['blockedRawClass6']['built']['p90']<.08 and checks['interiorDSMThroughAllClasses']['built']['p90']<checks['interiorDSMThroughAllClasses']['old']['p90']
area=.5*float(np.sum(ring[:,0]*np.roll(ring,-1,axis=0)[:,1]-ring[:,1]*np.roll(ring,-1,axis=0)[:,0]))
sign=1 if area>0 else -1
w=json.loads((root/'data/odbl/montague-bridgehead/way-witness.json').read_text())
street=np.asarray(w['streetPortion']['points'])
road=(street-F['origin'])*F['scale']-anchor
def streetDistance(v):
 def closest(a,b):
  d=b-a;return a+d*np.clip((v-a)@d/(d@d),0,1)
 near=min([closest(a,b)for a,b in zip(road,road[1:])],key=lambda a:np.linalg.norm(v-a))
 return near-v
count=[]
for i,(a,b) in enumerate(zip(ring,np.roll(ring,-1,axis=0))):
 u=b-a;L=np.linalg.norm(u);n=np.array([u[1],-u[0]])/L*sign
 n0=streetDistance((a+b)*.5)
 count.append((i,float(L),float(n@n0/np.linalg.norm(n0)),float(np.linalg.norm(n0))))
id,frontLength,score,dist=max(count,key=lambda q:q[1]*q[2])
assert id==6 and frontLength>14 and score>.8,(count,id)
data={'tile':tile['id'],'ordinal':232,'atlasSha256':manifest['sha256'],'source':f,
 'originXZ':anchor.round(11).tolist(),'ring':ring.round(7).tolist(),'plane':beta.round(9).tolist(),'winding':sign,'frontEdge':id}
receipt={'source':'NRCan HRDEM mosaic 10_3-mosaic-1m plus original 2020 COPC (related survey)',
 'sourcePointCloud':'pei_2020_427000_679000','sourceTrack':36675,'atlasTile':tile['id'],'ordinal':232,
 'guardRawMetres':.53,'nTrainingClass6':int((~fold).sum()),'nHeldoutClass6':int(fold.sum()),
 'pointCloudCohortSHA256':hashlib.sha256(choice.astype('<f8').tobytes()).hexdigest(),
 'dsmDtmCropSHA256':F['fprint'](DSM,DTM),'dsmDtmCrop':[float(D['X']),float(D['Y']),*DSM.shape],
 'oldFlatRoofY':round(old,6),'outlineSquareMetres':abs(round(area,4)), 'frontWidthMetres':round(frontLength,4),
 'verticalChecks':checks}
outputs=(
 (root/'src/render/montague-hall.generated.ts','// Generated by tools/geodata/bake-montague-hall.py.\nexport const MONTAGUE_HALL='+json.dumps(data,separators=(',',':'))+' as const;\n'),
 (root/'data/montague-hall/native-validation.json',json.dumps(receipt,indent=2)+'\n'))
for name,content in outputs:
 if opts.verify:assert name.read_text()==content,name
 else:name.write_text(content)
np.savetxt(d/'hall-blind-world.csv',np.c_[choice[fold,:2],X[fold,1:]+anchor,choice[fold,2],X[fold]@beta],
 delimiter=',',fmt='%.10f',header='epsg3979_e,epsg3979_n,world_x,world_z,native_y,fitted_y',comments='')
print(json.dumps(receipt,indent=2))
