"""Partition only the original Hangar 4 footprint into fitted roof planes."""
from pathlib import Path
from sys import argv
from osgeo import ogr,osr
import json,numpy as np
from collections import defaultdict
D=Path(argv[1]).resolve()
meta=json.loads((D/'native.json').read_text());fit=json.loads((D/'pilot-fit.json').read_text())
ogr.UseExceptions();osr.UseExceptions()
def s(code):
 a=osr.SpatialReference();a.ImportFromEPSG(code);a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return a
T=osr.CoordinateTransformation(s(4326),s(3979));back=osr.CoordinateTransformation(s(3979),s(4326))
C=np.array(fit['centerNative']);U=np.array(fit['longAxis']);V=np.array(fit['perpendicular'])
r=(np.array(T.TransformPoints(meta['assertedAEBFootprint']))[:,:2]-C)@np.c_[U,V]
def polygon(vertices):
 ring=ogr.Geometry(ogr.wkbLinearRing)
 for x,y in vertices:ring.AddPoint_2D(float(x),float(y))
 ring.CloseRings()
 p=ogr.Geometry(ogr.wkbPolygon);p.AddGeometry(ring);return p
original=polygon(r)
minU,minV=r.min(0);maxU,maxV=r.max(0)
a,h,d,e,q=fit['planeBody']
west,east,rear=(fit[k] for k in ('westBounds','eastBounds','rearBounds'))
planes={'westernLow':fit['otherPlanes']['west'],'easternLow':fit['otherPlanes']['east'],'rearAnnex':fit['otherPlanes']['annex'],
 'mainWest':[a-h*d+q*5,d,q],'mainEast':[a+h*e+q*5,-e,q]}
for i,v in enumerate(fit['hoods']):planes[f'frontHood{i}']=v['rawFit']
def facets(g):
 if not g or g.IsEmpty():return
 if g.GetGeometryName()=='POLYGON':
  if g.GetArea()>1e-7:
   assert g.GetGeometryCount()==1,'Expected no separate enclosed hole in any given roof cell.'
   yield g
 elif g.GetGeometryName()in ('MULTIPOLYGON','GEOMETRYCOLLECTION'):
  for k in range(g.GetGeometryCount()):yield from facets(g.GetGeometryRef(k))
def ab(plane,p):return plane[0]+plane[1]*p[0]+plane[2]*p[1]
def high_halfplane(box,plane):
 s=[]
 for a,b in zip(box,box[1:]+box[:1]):
  ya,yb=ab(plane,a),ab(plane,b)
  if ya>=0:s.append(a)
  if ya*yb<0:s.append(np.array(a)+(np.array(b)-a)*(ya/(ya-yb)))
 return polygon(s) if len(s)>=3 else None
cutsU=sorted({minU-1.,west,h,east,maxU+1.,*(x for v in fit['hoods']for x in v['x'])})
cutsV=sorted({minV-1.,rear,maxV+1.,*(v['northLimit']for v in fit['hoods'])})
zones=[];coverage=defaultdict(float)
def add(kind,mask):
 for G in facets(mask):
  local=np.array(G.GetGeometryRef(0).GetPoints())[:-1,:2]
  assert len(local)>=3 and G.IsValid()
  coverage[kind]+=G.GetArea()
  zones.append((kind,local.tolist()))
for l,rgt in zip(cutsU,cutsU[1:]):
 for t,b in zip(cutsV,cutsV[1:]):
  l,rgt,t,b=map(float,(l,rgt,t,b))
  rect=[(l,t),(rgt,t),(rgt,b),(l,b)];cell=original.Intersection(polygon(rect))
  if not cell or cell.IsEmpty()or cell.GetArea()<1e-7:continue
  x,z=(l+rgt)/2,(t+b)/2
  k='westernLow' if x<west else 'easternLow' if x>east else 'rearAnnex' if z>rear else 'mainWest' if x<h else 'mainEast'
  hood=next((i for i,v in enumerate(fit['hoods'])if v['x'][0]<x<v['x'][1] and z<v['northLimit']),None)
  if hood is None or not k.startswith('main'):add(k,cell);continue
  hv=f'frontHood{hood}'
  limit=np.array(planes[hv])-planes[k]
  half=high_halfplane(rect,limit)
  if half:
   add(hv,cell.Intersection(half));add(k,cell.Difference(half))
  else:add(k,cell)
union=ogr.Geometry(ogr.wkbMultiPolygon)
for _,q in zones:union.AddGeometry(polygon(q))
u=union.UnionCascaded()
missing=original.Difference(u).GetArea();spill=u.Difference(original).GetArea()
over=sum(coverage.values())-u.GetArea()
assert max(missing,spill,abs(over))<.00001,(missing,spill,over)
out={'nativeInputHash':fit['windowSHA'],'AEBSourceFootprint':meta['assertedAEBFootprint'],'roofAreaByPlane':coverage,'planAreaM2':original.GetArea(),
 'variantPlanePolygons':zones,'absoluteRoofPlanes':planes,'missingArea':missing,'spillArea':spill,'overlapArea':over}
(D/'roof-polygon-pilot.json').write_text(json.dumps(out,indent=2)+'\n')
print({k:v for k,v in out.items()if 'variant'not in k},len(zones),'regions')
