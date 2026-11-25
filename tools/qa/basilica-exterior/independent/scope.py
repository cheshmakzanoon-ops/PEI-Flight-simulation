#!/usr/bin/env python3
"""Replays complete opaque and actual lowest-base projection against every installed neighboring footprint and infrastructure. No new survey heights or photographs."""
from pathlib import Path as P
import argparse,json,hashlib,math,gzip,collections
import numpy as np
from osgeo import ogr
p=argparse.ArgumentParser();p.add_argument('--stock',type=P,required=True);p.add_argument('--candidate',type=P);p.add_argument('--output',required=True);p.add_argument('--repo',type=P,required=True);p.add_argument('--fences',type=P,required=True);a=p.parse_args()
# Fixed local projection is identical to src/sim/geo.ts, not a survey registration.
D=a.repo/'public/world/buildings';j=lambda f:json.loads(f.read_bytes());sha=lambda b:hashlib.sha256(b).hexdigest()
x0,z0=-63.125295,46.233718;rad=math.pi/180;phi=46.5*rad;t=1-6.69437999014e-3*math.sin(phi)**2;kx=6378137*rad*math.cos(phi)/math.sqrt(t);kz=6378137*(1-6.69437999014e-3)*rad/t**1.5
o=np.array([(x0+63.2)*kx,(46.5-z0)*kz])
def ll(points):arr=np.asarray(points);return np.stack([(arr[:,0]-x0)*kx,(z0-arr[:,1])*kz],axis=1)
def poly(points,holes=()):
 g=ogr.Geometry(ogr.wkbPolygon)
 for pts in [points,*holes]:
  ring=ogr.Geometry(ogr.wkbLinearRing)
  for x,y in pts:ring.AddPoint_2D(float(x),float(y))
  ring.CloseRings();g.AddGeometry(ring)
 return g
def unions(geoms):
 gs=ogr.Geometry(ogr.wkbMultiPolygon)
 for g in geoms:
  if g.GetGeometryName()=='POLYGON' and not g.IsEmpty():gs.AddGeometry(g)
  elif g.GetGeometryName() in ('MULTIPOLYGON','GEOMETRYCOLLECTION'):
   for n in range(g.GetGeometryCount()):
    h=g.GetGeometryRef(n)
    if h.GetGeometryName()=='POLYGON' and not h.IsEmpty():gs.AddGeometry(h)
 return gs.UnionCascaded()
def area(g):
 if g.GetGeometryName() in ['MULTIPOLYGON','POLYGON']:return g.GetArea()
 if g.GetGeometryName()=='GEOMETRYCOLLECTION':return sum(area(g.GetGeometryRef(i)) for i in range(g.GetGeometryCount()))
 return 0.0
def forms(path,turn=False):
 meta=j(path/'geometry.json'); b=(path/meta['file']).read_bytes();assert sha(b)==meta['dataSHA256']; tr=np.frombuffer(b,dtype='<f8').reshape(-1,3,3)
 assert np.max(abs(np.array(meta['actualGroupOrigin'][::2])-o))<1e-8 and len(tr)==meta['triangleCount']
 basecap=float(tr[:,:,1].min());floor=abs(tr[:,:,1]-basecap).max(axis=1)<.00001
 xz=(tr[:,:,[0,2]]-o)*(1 if not turn else -1)
 ax=xz[:,1]-xz[:,0];bx=xz[:,2]-xz[:,0];mask=abs(ax[:,0]*bx[:,1]-ax[:,1]*bx[:,0])>1e-9
 return {'opaque':unions(poly(t) for t in xz[mask]),'floor':unions(poly(t) for t in xz[mask&floor])},{'triSHA256':sha(b),'triangleCount':len(tr),'trueGroundFaceCount':int((mask&floor).sum()),'lowestStructuralBaseRelativeGameY':float(basecap-meta['actualGroupOrigin'][1]),'opaqueMaterialBatches':len(meta['batches']),'gameBase':meta['actualGroupOrigin'][1],'highestRelative':float(tr[:,:,1].max()-meta['actualGroupOrigin'][1])}
atlas=j(D/'index.json');dat=(D/atlas['file']).read_bytes();assert sha(dat)==atlas['sha256'];group=collections.defaultdict(dict)
for rec in atlas['tiles']:
 b=rec['bounds'];radius=.0015
 if b[0]>x0+radius or b[1]>z0+radius or b[2]<x0-radius or b[3]<z0-radius:continue
 block=dat[rec['offset']:rec['offset']+rec['bytes']];assert sha(block)==rec['sha256']
 for k,feature in enumerate(json.loads(gzip.decompress(block))['features']):
  ring=feature.get('footprint') or []
  if len(ring)<3:continue
  x,z=np.asarray(ring).mean(axis=0)
  if max(abs(x-x0),abs(z-z0))>radius:continue
  target=abs(x-x0)<.00012 and abs(z-z0)<.00010
  group['installedReplaced' if target else 'installedRetained'][rec['id']+'/'+str(k)]=poly(ll(ring))
assert len(group['installedRetained'])==48 and list(group['installedReplaced'])==['q12000111/49']
fg=j(a.fences);assert np.allclose(fg['reference'],o)
for n,(v,w) in enumerate(fg['roads']):
 g=ogr.Geometry(ogr.wkbLineString)
 for x,z in v:g.AddPoint_2D(x,z)
 group['fullRoadPlus35cm'][str(n)]=g.Buffer(w+.35,32)
for n,q in enumerate(fg['sidewalk']):group['fullSidewalkQuads'][str(n)]=poly(q)
for n,q in enumerate(fg['parking']):group['fullParkingPolygons'][str(n)]=poly(q[0],q[1:])
orig,_=forms(a.stock)
def screen(path,turn=False):
 forms1,m= forms(path,turn)
 for typ,g in forms1.items():
  d={}
  for grp,items in group.items():
   vals=[]
   for k,h in items.items():
    ar=area(g.Intersection(h));old=area(orig[typ].Intersection(h));dist=g.Distance(h);vals.append({'id':k,'overlap':round(ar,5),'stockOverlap':round(old,5),'extra':round(ar-old,5),'distance':round(dist,5)})
   d[grp]={'evaluated':len(vals),'nearest':sorted(vals,key=lambda v:v['distance'])[:3],'overlaps':sorted((v for v in vals if max(v['overlap'],v['stockOverlap'])>.001),key=lambda v:v['id'])}
  m[typ]={'area':round(area(g),6),'oldArea':round(area(orig[typ]),6),'newOutsideOld':round(area(g.Difference(orig[typ])),6),'oldRemoved':round(area(orig[typ].Difference(g)),6),'regions':d}
 return m
jout={'scope':'Actual old/new Three opaque draw XZ projection and actual lowest horizontal structural base triangles (an exterior wall/plinth seat, not a claim of a solid interior floor); source triangles relative to the same fixed origin. Complete registered area. No new native Z, photos, ground mesh edits or vertical wall collision implied by horizontal projection alone. Road disks end-capped conservatively.','stock':screen(a.stock),'knownFailedRigid180':screen(a.stock,True)}
if a.candidate:jout['candidate']=screen(a.candidate)
P(a.output).write_text(json.dumps(jout,indent=2)+'\n')
for label in jout.keys()-{'scope'}:
 ob=jout[label];print(label,ob['triangleCount'],ob['trueGroundFaceCount'],[(t,ob[t]['regions']['installedRetained']['nearest'][0],ob[t]['regions']['fullRoadPlus35cm']['nearest'][0]['distance']) for t in ['opaque','floor']])
