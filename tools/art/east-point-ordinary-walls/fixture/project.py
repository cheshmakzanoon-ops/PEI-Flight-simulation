#!/usr/bin/env python3
"""Independent PNG and frozen F32 face projection gate, not the browser scorer."""
import argparse, hashlib, json, math
from pathlib import Path
import numpy as np
from PIL import Image

PHASES={'near200':(199.5,206.),'near235':(234.5,241.),'exit290':(289.5,296.)}
PASSES=('stock','old-neutral','old-black','old-white','old-peer-black','old-peer-white',
 'active','new-neutral','new-black','new-white','new-peer-black','new-peer-white','restore')
W,H=1200,760
PLANE=[np.array(v) for v in [(1,0,0,1),(-1,0,0,1),(0,1,0,1),(0,-1,0,1),(0,0,1,1),(0,0,-1,1)]]
def sha(b):return hashlib.sha256(b).hexdigest()
def close(a,b):return np.array_equal(a,b)
def f32(a):return np.asarray(a,dtype=np.float32).astype(np.float64)
def clip(poly,plane):
 if len(poly)==0:return poly
 p=poly@plane;out=[]
 for k in range(len(poly)):
  A,B=poly[k-1],poly[k];u,v=p[k-1],p[k]
  if (u<0)!=(v<0):out.append(A+(B-A)*(u/(u-v)))
  if v>=0:out.append(B)
 return np.array(out)
def projected_mask(verts,modelview,projection,reserve=.60):
 # Independent use of exact captured GL F32 uniforms, typed relative
 # geometry and all six clip planes. Around the half-square include a
 # further .10 native px; broad conservative enclosure, not GPU coverage.
 T=(f32(projection).reshape(4,4,order='F')@f32(modelview).reshape(4,4,order='F')).T
 poly=np.c_[f32(verts),np.ones(len(verts))].reshape(-1,3,4)@T
 out=np.zeros((H,W),bool)
 for Ps in poly:
  for p in PLANE:
   Ps=clip(Ps,p)
   if len(Ps)<3:break
  if len(Ps)<3 or np.min(Ps[:,3])<=0:continue
  L=Ps[:,:2]/Ps[:,3:4]
  L=np.c_[W*.5*(1+L[:,0]),H*.5*(1-L[:,1])]
  C=np.mean(L,axis=0);J=np.roll(L,-1,axis=0)
  x,y=np.maximum(0,(np.floor(L.min(axis=0)-1)).astype(int))
  X,Y=np.minimum([W,H],(np.ceil(L.max(axis=0)+1)).astype(int))
  if x>=X or y>=Y:continue
  gx,gy=np.meshgrid(np.arange(x,X)+.5,np.arange(y,Y)+.5)
  positive=np.ones(gx.shape,bool)
  for (a,b),(A,B) in zip(L,J):
   dx=B-b;dy=a-A
   side=1 if dx*(C[0]-a)+dy*(C[1]-b)>=0 else -1
   if abs(dx)+abs(dy)>1e-9:positive&=side*(dx*(gx-a)+dy*(gy-b))>=-reserve*(abs(dx)+abs(dy))
  out[y:Y,x:X]|=positive
 return out
def load(root,phase,row):
 png={}
 assert set(PASSES)==set(row['pngSha'])==set(row['passes']),(phase,'missing actual pass')
 for k in PASSES:
  p=root/f'{phase}-{k}.png';o=p.read_bytes();assert sha(o)==row['pngSha'][k],p
  a=np.array(Image.open(p));assert a.shape==(H,W,4) and a.dtype==np.uint8,p
  png[k]=a
  scripts=row['passes'][k]['compiledSHA256'];assert len(scripts)==4
  assert all(sha((root/f'{h}.glsl').read_bytes())==h for h in scripts)
 return png
def compare(p):
 def mp(camera):
  return p[camera+'-white'][:,:,:3].astype(np.int16)-p[camera+'-black'][:,:,:3].astype(np.int16)
 a,b,p0,p1=(mp(n) for n in ('old','new','old-peer','new-peer'))
 aMax,bMax,p0Max,p1Max=(np.max(n,axis=2) for n in (a,b,p0,p1))
 aMin,bMin,p0Min,p1Min=(np.min(n,axis=2) for n in (a,b,p0,p1))
 invalid=(aMin<0)|(bMin<0)|(p0Min<0)|(p1Min<0)|(aMax-aMin>1)|(bMax-bMin>1)|(p0Max-p0Min>1)|(p1Max-p1Min>1)
 D=np.max(np.abs(p['stock'][:,:,:3].astype(np.int16)-p['active'][:,:,:3]),axis=2)
 alpha=np.any(np.stack([m[:,:,3]!=p['stock'][:,:,3] for m in p.values()]),axis=0)
 size=lambda t:int(np.count_nonzero(t))
 old,new=aMax>0,bMax>0
 return {'alpha':size(alpha),'exterior':size((D>0)&~old&~new),'changed':size(D>0),'strong':size(D>2),'max':int(D.max()),
  'oldMark':size(old),'newMark':size(new),'oldPure':size(aMin==255),'newPure':size(bMin==255),
  'oldPeers':size(p0Max>0),'newPeers':size(p1Max>0),'peerDrift':size(np.any(p0!=p1,axis=2)),
  'purePeerChanged':size((D>0)&((p0Min==255)|(p1Min==255))), 'invalidMarker':size(invalid)},old,new,D>0
def main(args):
 root=Path(args.native);runtime=json.loads((root/'route-receipt.json').read_text())
 assert runtime['case']=='compare' and runtime['results']['driver'].startswith('PASS')
 assert runtime['results']['begin']['qa']['begin']['taken'] and runtime['results']['controls']['run']['mode']=='paused'
 fp=Path(args.frozen_facets);raw=fp.read_bytes()
 assert sha(raw)==args.facets_sha256
 geo=json.loads(raw)
 old=np.asarray(geo['actors'][1])-np.asarray(geo['E']);new=np.asarray(geo['actors'][2])-np.asarray(geo['E'])
 assert old.shape==(3276,3) and new.shape==(402,3)
 assert sha(f32(new).astype('<f4').tobytes())=='60cee6da32267507e80c81457d8f3bbd8cfa432213076105f8858d9ff64a6b23'
 receipt={'method':'Independent literal PNG scorer and clipped pixel-square conservative projection of authenticated original F32 face lists using actual bound same-frame matrices. No color/lit or device scope beyond this fixture.',
  'qualifiedForRelease':False,'source':{'sha':sha(raw),'index':runtime['source']['index'],'wire':runtime['source']['wire']},'rows':{}}
 for phase,(lo,hi) in PHASES.items():
  row=json.loads((root/f'{phase}-receipt.json').read_text());assert not row.get('error') and row['phase']==phase
  ds=row['details'];assert ds['size']==[W,H] and ds['sampleContext']==4 and ds['alphaBits']==8 and ds['depthBits']==24
  assert lo<=row['travel']<=hi and abs(row['crossError'])<=.25
  imgs=load(root,phase,row);stats,maskOld,maskNew,changed=compare(imgs)
  assert stats==row['checks'],(phase,'independent score disagreement',stats,row['checks'])
  assert close(imgs['stock'],imgs['old-neutral']) and close(imgs['stock'],imgs['restore'])
  assert close(imgs['active'],imgs['new-neutral'])
  assert not any(stats[k] for k in ('alpha','exterior','peerDrift','purePeerChanged','invalidMarker')) and stats['oldPeers']>=300
  stock,act,ret=[row['passes'][k] for k in ('stock','active','restore')]
  assert stock['verts']==[8727,48] and act['verts']==[5853,48] and ret['verts']==stock['verts']
  assert stock['vboComparedBytes']==[349080,1728] and act['vboComparedBytes']==[234120,1728]
  assert ret['vboComparedBytes']==stock['vboComparedBytes'] and stock['stats']==ret['stats'] and stock['stats'][1]-act['stats'][1]==958
  assert stock['terrainNative']==act['terrainNative']==ret['terrainNative']
  assert all(stock['terrainNative'][k]>0 for k in ('indices','position','element'))
  assert stock['compiledSHA256']==act['compiledSHA256']==ret['compiledSHA256']
  assert close(stock['modelView'],act['modelView']) and close(stock['model'],act['model'])
  a=projected_mask(old,stock['modelView'],ds['projection']);b=projected_mask(new,act['modelView'],ds['projection'])
  metric={'oldProjected':int(np.count_nonzero(a)),'newProjected':int(np.count_nonzero(b)),
   'oldMarkerOutside':int(np.count_nonzero(maskOld&~a)),'newMarkerOutside':int(np.count_nonzero(maskNew&~b)),
   'changedOutsideBoth':int(np.count_nonzero(changed&~(a|b)))}
  assert not any(metric[k] for k in ('oldMarkerOutside','newMarkerOutside','changedOutsideBoth')),(phase,metric)
  if phase=='exit290':
   assert not stats['oldMark'] and not stats['newMark'] and not stats['changed'] and close(imgs['stock'],imgs['active'])
  else:assert stats['oldPure']>=700 and stats['newPure']>=700 and stats['strong']>=500
  receipt['rows'][phase]={'travel':row['travel'],'native':stats,'projection':metric,'genuineExit':phase=='exit290'}
 outfile=Path(args.output);assert not outfile.exists()
 outfile.write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--native',required=True);p.add_argument('--frozen-facets',required=True);p.add_argument('--facets-sha256',required=True)
 p.add_argument('--output',required=True);main(p.parse_args())
