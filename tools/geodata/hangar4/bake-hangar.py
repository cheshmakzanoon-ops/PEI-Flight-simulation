"""Bake watertight roof/seat seams in the original AEB plan (no imagery)."""
from pathlib import Path
from sys import argv
from osgeo import osr
import json,math,numpy as np
from collections import defaultdict,Counter
D=Path(argv[1]).resolve()
A=json.loads((D/'native.json').read_text());F=json.loads((D/'pilot-fit.json').read_text());Q=json.loads((D/'roof-polygon-pilot.json').read_text())
osr.UseExceptions()
def spec(i):
 s=osr.SpatialReference();s.ImportFromEPSG(i);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
T=osr.CoordinateTransformation(spec(3979),spec(4326))
g=math.pi/180;m=6378137*g;k=1-.00669437999014*math.sin(46.5*g)**2
pScale=np.array([m*math.cos(46.5*g)/math.sqrt(k),-m*(1-.00669437999014)/k**1.5])
lon0=np.array([-63.2,46.5]);cen=np.array(F['centerNative']);U,V=np.array(F['longAxis']),np.array(F['perpendicular'])
anchor=(np.array(T.TransformPoint(*cen)[:2])-lon0)*pScale
cache={}
def xy(q):
 token=tuple(q)
 if token not in cache:
  e=cen+U*q[0]+V*q[1]
  p=(np.array(T.TransformPoint(*e)[:2])-lon0)*pScale
  cache[token]=np.round(p-anchor,4).tolist()
 return cache[token]
def key(P):return tuple(round(float(i),7)for i in P)
planes=Q['absoluteRoofPlanes'];top=[];surfaces=[]
def at(name,p):
 a,b,c=planes[name];return a+b*p[0]+c*p[1]
for role,region in Q['variantPlanePolygons']:
 pr=[key(p)for p in region]
 surfaces.append((role,pr))
 for v in pr:top.append(v)
allV=sorted(set(top));edges=defaultdict(list);per=Counter();expanded=defaultdict(list)
for index,(role,ring) in enumerate(surfaces):
 for p,q in zip(ring,ring[1:]+ring[:1]):
  o=np.array(p);d=np.array(q)-o;l2=d@d
  if l2<1e-11:continue
  split=[(0,p),(1,q)]
  for z in allV:
   if z==p or z==q:continue
   a=np.array(z)-o;v=(a@d)/l2
   if v>1e-7 and v<1-1e-7 and np.linalg.norm(a-v*d)<2e-6:split.append((v,z))
  seq=sorted(split)
  expanded[index].extend(v for _,v in seq[:-1])
  for (_,a),(_,b) in zip(seq,seq[1:]):
   if np.linalg.norm(np.array(a)-b)<1e-5:continue
   edge=tuple(sorted((a,b)));edges[edge].append((index,role))
levels=[]
border=[]
frontV=min(q[1]for q in allV)
for (a,b),owners in sorted(edges.items()):
 assert len(owners) in (1,2),(a,b,owners)
 if len(owners)==1:
  role=owners[0][1]
  z=((a[1]+b[1])*.5)
  bands='publicFront' if z<=frontV+.20 else 'appendage' if role in ('westernLow','easternLow','rearAnnex') else 'standardSkin'
  border.append(dict(a=xy(a),b=xy(b),roof=[round(at(role,a),4),round(at(role,b),4)],skin=bands))
  per['outside']+=1
 else:
  k1=owners[0][1];k2=owners[1][1]
  va=at(k1,a)-at(k2,a);vb=at(k1,b)-at(k2,b)
  if max(abs(va),abs(vb))<.013:continue
  p=[a,b]
  if va*vb<0:
   x=va/(va-vb);p.insert(1,key(np.array(a)+(np.array(b)-a)*x))
  for aa,bb in zip(p,p[1:]):
   if np.linalg.norm(np.array(aa)-bb)<1e-4:continue
   up,down=(k1,k2)if (at(k1,aa)+at(k1,bb)>=at(k2,aa)+at(k2,bb))else(k2,k1)
   y1=[round(at(up,aa),4),round(at(up,bb),4)];y0=[round(at(down,aa),4),round(at(down,bb),4)]
   assert min(y1[i]-y0[i]for i in range(2))>-.002
   if max(y1[i]-y0[i]for i in range(2))>.013:
    levels.append(dict(a=xy(aa),b=xy(bb),roof=y1,low=y0,skin='tealHood' if up.startswith('frontHood')else 'standardSkin'))
    per['interiorRiser']+=1
result={'atlasSha':A['atlasSha'],'tile':'q032022','row':0,'footprint':A['assertedAEBFootprint'],'anchor':anchor.tolist(),
 'forms':[dict(role=role,ring=[[*xy(p),round(at(role,p),4)]for p in expanded[i]])for i,(role,ring) in enumerate(surfaces)],
 'border':border,'risers':levels}
(D/'hangar-baked.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(len(result['forms']),len(edges),per,'native merged roof and wall spans',len(cache),'vertices')
