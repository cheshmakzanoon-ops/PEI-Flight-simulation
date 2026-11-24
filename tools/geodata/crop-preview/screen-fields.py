"""Scoped AAFC field identification, ignoring sub-resolution and uncertain borders."""
import argparse,json,math
from pathlib import Path
from collections import Counter
from osgeo import gdal,ogr,osr
from matplotlib.path import Path as MplPath
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path(__file__).parent)
a=p.parse_args();D=a.source
gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
gd=gdal.Open(str(D/'aci_2025_pe_v1.tif'))
qd=gdal.Open(str(D/'aci_2025_pe_confidence_v1.tif'))
v=gdal.OpenEx(str(D/'pe-fields-2023.gpkg'),gdal.OF_VECTOR)
layer=v.GetLayer(0)
shape=layer.GetSpatialRef();aafc=gd.GetSpatialRef()
def epsg(n):
 s=osr.SpatialReference();s.ImportFromEPSG(n);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
toAafc=osr.CoordinateTransformation(shape,aafc);toLon=osr.CoordinateTransformation(aafc,epsg(4326))
gt=gd.GetGeoTransform()
assert gd.GetGeoTransform()==qd.GetGeoTransform() and aafc.IsSame(qd.GetSpatialRef())
assert gt[1:3]==(30,0) and gt[4:]==(0,-30)
C=gd.ReadAsArray();Q=qd.ReadAsArray();rows,cols=C.shape
potatoes=(C==177)&(Q>=80);other=(C>=133)&(C<=199)&(Q>=80)
status=Counter();keep=[]
mpl=lambda g:MplPath(np.asarray(g.GetPoints())[:,:2])
exampleFields=[]
layer.SetAttributeFilter('area_ha >= 1.75 AND area_ha <= 170')
for f in layer:
 status['scanned']+=1
 raw=f.GetGeometryRef()
 if not raw or raw.GetGeometryCount()!=1:
  status['complex']+=1;continue
 geometry=raw.GetGeometryRef(0).Clone();geometry.Transform(toAafc)
 if not geometry.IsValid()or geometry.GetGeometryCount()!=1:
  status['invalidOrHoled']+=1;continue
 erosion=geometry.Buffer(-21.3,8)
 if erosion.IsEmpty():
  status['tooNarrow']+=1;continue
 regions=[erosion] if erosion.GetGeometryName()=='POLYGON' else [erosion.GetGeometryRef(i)for i in range(erosion.GetGeometryCount())]
 top=[]
 for py in regions:
  x0,x1,y0,y1=py.GetEnvelope()
  lx=max(0,int((x0-gt[0])/30)-1);ux=min(cols,int((x1-gt[0])/30)+2)
  ly=max(0,int((gt[3]-y1)/30)-1);uy=min(rows,int((gt[3]-y0)/30)+2)
  if lx>=ux or ly>=uy:continue
  yy,xx=np.mgrid[ly:uy,lx:ux];X,Y=gt[0]+30*(xx+.5),gt[3]-30*(yy+.5)
  match=mpl(py.GetGeometryRef(0)).contains_points(np.c_[X.ravel(),Y.ravel()]).reshape(xx.shape)
  for i in range(1,py.GetGeometryCount()):
   match&=~mpl(py.GetGeometryRef(i)).contains_points(np.c_[X.ravel(),Y.ravel()]).reshape(xx.shape)
  top.extend(zip(yy[match].tolist(),xx[match].tolist()))
 if len(top)<9:
  status['insufficientInterior']+=1;continue
 yy,xx=np.asarray(top).T
 frac=float(potatoes[yy,xx].mean())
 otherScore=float((other[yy,xx]&~potatoes[yy,xx]).mean())
 if frac<.92 or otherScore>.035:
  status['mixedOrNotPotato']+=1;continue
 ring=np.array(geometry.GetGeometryRef(0).GetPoints())[:-1,:2]
 centroid=np.array(geometry.Centroid().GetPoint()[:2]);w=np.roll(ring,-1,axis=0)-ring
 d=np.linalg.norm(w,axis=1);u=w/np.maximum(d,.000001)[:,None]
 axis=np.einsum('i,ij,ik->jk',d*d,u,u);eig,V=np.linalg.eigh(axis)
 if eig[-1]<2.1*max(1,eig[0]):
  status['ambiguousAxis']+=1;continue
 axis=V[:,-1]*np.sign(V[0,-1]);ang=math.atan2(axis[1],axis[0])
 ll=np.array(toLon.TransformPoints(ring.tolist()))[:,:2]
 cc=list(toLon.TransformPoint(*centroid)[:2])
 keep.append({'id':f.GetFID(),'areaM2':round(geometry.GetArea(),1),'center':cc,'outline':ll.round(7).tolist(),'interiorCells':len(top),
              'cropScore':round(frac,4),'confidenceP10':float(np.quantile(Q[yy[potatoes[yy,xx]],xx[potatoes[yy,xx]]],.10)),
              'axisRatio':round(float(eig[-1]/max(1,eig[0])),2),'axisRad':ang})
 status['retained']+=1
keep.sort(key=lambda q:q['id'])
result={'status':dict(status),'totalSourceFields':51343,'totalPatchedFootprintAreaM2BeforeVisualSafetyBuffers':sum(p['areaM2'] for p in keep),'fields':keep}
(D/'supported-fields.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(result['status'],result['totalPatchedFootprintAreaM2BeforeVisualSafetyBuffers'])
print(json.dumps(sorted(keep,key=lambda p:p['areaM2'],reverse=True)[:12],separators=(',',':'))[:1200])
