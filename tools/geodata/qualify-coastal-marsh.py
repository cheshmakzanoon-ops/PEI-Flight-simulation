#!/usr/bin/python3
"""Dry, strongly classified marsh source intake. Research only; no runtime art."""
from pathlib import Path
import argparse,gzip,json,math,hashlib,struct
from osgeo import gdal,ogr,osr
from scipy import ndimage
import numpy as np
args=argparse.ArgumentParser(description=__doc__)
args.add_argument('--inventory',type=Path,required=True,help='Directory containing three pinned PEI government subsets')
args.add_argument('--world',type=Path,required=True,help='Verified simulator public/world path')
args.add_argument('--out',type=Path,required=True)
a=args.parse_args()
P=a.inventory;R=a.world;OUT=a.out
OUT.mkdir(parents=True,exist_ok=True)
step=5.
pinned={
 'cascumpec':'109602239137b4b2fae59e37aef3709943226d60dbc22459a6d89927d9914190',
 'tracadie':'4479e8aa046e8e9d8131c17c085013f1c5fa1859d469f571e4a9e64fede67102',
 'morell':'f897238baedd1894e8f5eb8f9b3e72d6cecf2337ec3d73f7996b3a99149e9f84',
}
f=math.pi/180
a=6378137
phi=46.5*f
w=1-.00669437999014*math.sin(phi)**2
sx=a*f*math.cos(phi)/math.sqrt(w)
sz=a*f*(1-.00669437999014)*w**-1.5
def project(lon,lat):return (lon+63.2)*sx,(46.5-lat)*sz
def ll(x,z):return x/sx-63.2,46.5-z/sz
src=osr.SpatialReference();src.ImportFromEPSG(2954);src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
dst=osr.SpatialReference();dst.ImportFromEPSG(4326);dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
trans=osr.CoordinateTransformation(src,dst)
def into_local(geom):
 nm=geom.GetGeometryName()
 if nm=='LINEARRING':
  for i in range(geom.GetPointCount()):
   lon,lat,_=geom.GetPoint(i)
   geom.SetPoint_2D(i,*project(lon,lat))
 else:
  for i in range(geom.GetGeometryCount()):into_local(geom.GetGeometryRef(i))
fence=(R/'woodland/v1/canopy-receiver-fence-24m.bin.gz').read_bytes()
assert hashlib.sha256(fence).hexdigest()=='3afcd194c8919cc97dec69cb696c824491e08221018d92e91d0100deb4609085'
df=gzip.decompress(fence)
fx,fz,fw,fh,cell,_,nr=struct.unpack_from('<iiHHHHI',df,4)
rows=np.frombuffer(df,'<u4',fh+1,24);seg=np.frombuffer(df,'<u2',nr*2,24+4*(fh+1)).reshape(nr,2)
def any_occupied(x,z,gap=5.05):
 x0=math.floor((x-gap-fx)/cell);x1=math.floor((x+gap-fx)/cell)
 z0=math.floor((z-gap-fz)/cell);z1=math.floor((z+gap-fz)/cell)
 if x0<0 or z0<0 or x1>=fw or z1>=fh:return True
 for j in range(z0,z1+1):
  for sa,sb in seg[rows[j]:rows[j+1]]:
   if int(sa)<=x1 and int(sb)>=x0:return True
 return False
def footprint(x,z,r=5.05):
 b=ogr.Geometry(ogr.wkbLinearRing)
 for u,v in ((-1,-1),(1,-1),(1,1),(-1,1),(-1,-1)):b.AddPoint_2D(x+u*r,z+v*r)
 g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(b);return g
cover_wire=(R/'cover.bin.gz').read_bytes()
assert hashlib.sha256(cover_wire).hexdigest()=='46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863'
cov=np.frombuffer(gzip.decompress(cover_wire),np.uint8).reshape((2720,4096,2))
xmin,zmin=project(-64.47,47.1);xmax,zmax=project(-61.93,45.94)
def inspect(n):
 raw=(P/f'{n}-features.json').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=pinned[n]:raise ValueError('Wrong dated source: '+n)
 data=json.loads(raw)
 mem=ogr.GetDriverByName('Memory').CreateDataSource('')
 lyr=mem.CreateLayer('eligible',geom_type=ogr.wkbUnknown)
 approved=[];guarded=[];features=[]
 for f in data['features']:
  h=f['attributes']; gh=f['geometry']
  if h['wet_type']!='SALT OR BRACKISH MARSH' or h['class1'] not in ('SAW','BKW') or h['wet_per1']!=10 or h['wet_per2'] not in (0,None):
   guarded.append(h['fid']);continue
  g=ogr.CreateGeometryFromEsriJson(json.dumps(gh));g.AssignSpatialReference(src)
  assert g.Transform(trans)==0
  into_local(g)
  if not g.IsValid():g=g.MakeValid()
  assert g and not g.IsEmpty()
  f=ogr.Feature(lyr.GetLayerDefn());f.SetGeometry(g);lyr.CreateFeature(f)
  approved.append(dict(fid=h['fid'],tag=h['class1'],derivedArea=g.GetArea()));features.append(g)
 le,ri,top,bottom=lyr.GetExtent()
 x0=math.floor(le/step)*step-step*2;z0=math.floor(top/step)*step-step*2
 ncol=math.ceil((ri-x0)/step)+2;nrow=math.ceil((bottom-z0)/step)+2
 assert ncol*nrow<14000000
 ras=gdal.GetDriverByName('MEM').Create('',ncol,nrow,1,gdal.GDT_Byte)
 ras.SetGeoTransform((x0,step,0,z0,0,step))
 gdal.RasterizeLayer(ras,[1],lyr,burn_values=[1])
 mask=ras.ReadAsArray()>0
 dist=ndimage.distance_transform_edt(mask)*step
 x=x0+(np.arange(ncol)+.5)*step;z=z0+(np.arange(nrow)+.5)*step
 px=(x-xmin)/(xmax-xmin)*4096; pz=(z-zmin)/(zmax-zmin)*2720
 cx=np.floor(px).astype(int);cz=np.floor(pz).astype(int)
 classes=cov[np.ix_(cz,cx,[0])][:,:,0]
 lower=np.floor(px-.5).astype(int);upper=np.floor(pz-.5).astype(int)
 bound=np.minimum.reduce([cov[np.ix_(upper+j,lower+i,[1])][:,:,0] for j in (0,1) for i in (0,1)])
 allowed=np.isin(classes,(30,60,90))
 c=(dist>=10)&allowed
 accepted=[]
 for j,i in zip(*np.nonzero(c&(bound>=149))):
  xx=float(x[i]);zz=float(z[j]);gap=5.05
  if any_occupied(xx,zz,gap):continue
  box=footprint(xx,zz,gap)
  if not any(q.Contains(box) for q in features):continue
  i0=math.floor((xx-gap-xmin)/(xmax-xmin)*4096-.5)
  i1=math.floor((xx+gap-xmin)/(xmax-xmin)*4096-.5)+1
  j0=math.floor((zz-gap-zmin)/(zmax-zmin)*2720-.5)
  j1=math.floor((zz+gap-zmin)/(zmax-zmin)*2720-.5)+1
  if int(cov[j0:j1+1,i0:i1+1,1].min())<149:continue
  ax=math.floor((xx-gap-xmin)/(xmax-xmin)*4096)
  bx=math.floor((xx+gap-xmin)/(xmax-xmin)*4096)
  ay=math.floor((zz-gap-zmin)/(zmax-zmin)*2720)
  by=math.floor((zz+gap-zmin)/(zmax-zmin)*2720)
  if not np.isin(cov[ay:by+1,ax:bx+1,0],(30,60,90)).all():continue
  accepted.append((j,i))
 out=np.zeros((nrow,ncol),dtype=np.uint8)
 for j,i in accepted:out[j,i]=255
 np.savez_compressed(OUT/f'{n}-exact.npz',mask=out,grid=np.asarray([x0,z0,step,ncol,nrow]))
 from collections import Counter
 labels,nn=ndimage.label(out!=0)
 largest=np.bincount(labels.ravel(),minlength=nn+1);largest[0]=0
 best=int(largest.argmax())
 ys,xs=np.where(labels==best) if best else ([],[])
 center=list(ll(float(np.median(x[xs])),float(np.median(z[ys])))) if len(ys) else None
 columns={'wholeFootprint':dict(pointCount=len(accepted),largestHa=float(max(largest)*step**2/1e4),cameraCenter=center)}
 rec=dict(sourceSha=hashlib.sha256(raw).hexdigest(),qualified=approved,heldMixed=guarded,rawRasterHa=mask.sum().item()*step**2/1e4,strict=columns)
 print(n,rec['rawRasterHa'],rec['strict'],flush=True)
 return rec
result={n:inspect(n) for n in ('cascumpec','tracadie','morell')}
(OUT/'dry-footprint-intake.json').write_text(json.dumps(result,indent=2)+'\n')
