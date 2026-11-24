"""Untiled three-county preview witnesses for deliberately authored field optics."""
import argparse,gzip,hashlib,json,math,struct
from pathlib import Path
from collections import Counter
from osgeo import gdal,ogr,osr
from matplotlib.path import Path as MP
from scipy.ndimage import binary_erosion, distance_transform_edt
import numpy as np
from PIL import Image
gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--source',type=Path,required=True);cli.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[3]);a=cli.parse_args()
D=a.source.resolve();R=a.root.resolve()
fields=json.loads((D/'supported-fields.json').read_text())['fields']
d=gdal.Open(str(D/'aci_2025_pe_v1.tif'));s=d.GetSpatialRef();gt=d.GetGeoTransform()
def srs(n):
 x=osr.SpatialReference();x.ImportFromEPSG(n);x.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return x
F=osr.CoordinateTransformation(s,srs(4326));B=osr.CoordinateTransformation(srs(4326),s)
q=gdal.Open(str(D/'aci_2025_pe_confidence_v1.tif'));assert q.GetGeoTransform()==gt
native=binary_erosion((d.ReadAsArray()==177)&(q.ReadAsArray()>=80),np.ones((3,3),bool))
rad=math.pi/180;m=6378137*rad;phi=46.5*rad;e=6.69437999014e-3;x=1-e*math.sin(phi)**2
scale=np.array([m*math.cos(phi)/math.sqrt(x),-m*(1-e)/x**1.5]);origin=np.array([-63.2,46.5])
P=lambda ll:(np.asarray(ll)-origin)*scale
L=lambda p:np.asarray(p)/scale+origin
public=R/'public/world';meta=json.loads((public/'cover.json').read_text())
cb=(public/'cover.bin.gz').read_bytes();assert hashlib.sha256(cb).hexdigest()==meta['compressedSha256']
cover=np.frombuffer(gzip.decompress(cb),dtype=np.uint8).reshape(meta['height'],meta['width'],2)
roadBin=gzip.decompress((public/'roads.bin.gz').read_bytes())
rm=json.loads((public/'roads.json').read_text());assert hashlib.sha256(roadBin).hexdigest()==rm['sha256']
buf=memoryview(roadBin);count=struct.unpack_from('>I',buf,6)[0];roads=[];at=10
for i in range(count):
 n,bits=struct.unpack_from('>HB',buf,at);at+=3
 w=np.frombuffer(buf[at:at+n*8],dtype='>u4').astype(float).reshape(n,2)/1e5+[-65,45];at+=n*8
 w=P(w);roads.append((w,w.min(axis=0),w.max(axis=0)))
assert at==len(buf)
packDir=public/'buildings';atlas=json.loads((packDir/'index.json').read_text());pack=(packDir/'tiles.pack').read_bytes()
assert hashlib.sha256(pack).hexdigest()==atlas['sha256']
atlasTiles=[(t,P((t['bounds'][0],t['bounds'][3])),P((t['bounds'][2],t['bounds'][1])))for t in atlas['tiles']]
STEP=4.;N=256
def makePoly(points):
 r=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in points:r.AddPoint_2D(float(x),float(z))
 r.CloseRings();g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(r);return g
def raster(g,box,grid,mask):
 if g.IsEmpty():return
 if g.GetGeometryName()!='POLYGON':
  for i in range(g.GetGeometryCount()):raster(g.GetGeometryRef(i),box,grid,mask)
  return
 x0,x1,z0,z1=g.GetEnvelope()
 lo=np.maximum(0,np.floor((np.array([x0,z0])-box)/STEP).astype(int)-1)
 hi=np.minimum(N,np.ceil((np.array([x1,z1])-box)/STEP).astype(int)+1)
 if np.any(hi<=lo):return
 a,b=lo;c,d=hi
 block=grid[b:d,a:c]
 flat=block.reshape(-1,2)
 inside=MP(np.asarray(g.GetGeometryRef(0).GetPoints())[:,:2]).contains_points(flat)
 for i in range(1,g.GetGeometryCount()):
  inside&=~MP(np.asarray(g.GetGeometryRef(i).GetPoints())[:,:2]).contains_points(flat)
 mask[b:d,a:c]|=inside.reshape(block.shape[:2])
allRgb=[];allInfo=[];countGuard=Counter()
for name,id in [('prince',9931),('queens',15470),('kings',47730)]:
 home=next(p for p in fields if p['id']==id)
 C=P(home['center']);box=(np.ceil(C/STEP)-N/2)*STEP
 far=box+N*STEP
 a,z=np.meshgrid(np.arange(N),np.arange(N));grid=(np.stack((a,z),-1)+.5)*STEP+box
 ll=L(grid.reshape(-1,2));src=np.asarray(B.TransformPoints(ll.tolist()))[:,:2]
 ix,iy=np.floor((src-[gt[0],gt[3]])/[30,-30]).astype(int).T
 assert np.all((0<=ix)&(ix<native.shape[1])&(0<=iy)&(iy<native.shape[0]))
 w,s,e,n=meta['bounds'];u=((ll[:,0]-w)/(e-w)*meta['width']).astype(int);v=((n-ll[:,1])/(n-s)*meta['height']).astype(int)
 dryCrop=((cover[v,u,0]==40)&(cover[v,u,1]>=228)).reshape(N,N)
 land=native[iy,ix].reshape(N,N)&dryCrop
 protected=np.zeros((N,N),bool)
 for road,mi,ma in roads:
  if np.any(ma+26<box)or np.any(mi-26>far):continue
  path=ogr.Geometry(ogr.wkbLineString)
  for x,z in road:path.AddPoint_2D(float(x),float(z))
  raster(path.Buffer(19.5,8),box,grid,protected)
 for t,mi,ma in atlasTiles:
  if np.any(ma+20<box)or np.any(mi-20>far):continue
  raw=pack[t['offset']:t['offset']+t['bytes']];assert hashlib.sha256(raw).hexdigest()==t['sha256']
  f=json.loads(gzip.decompress(raw))['features']
  for p in f:
   outline=P(p['footprint'])
   if np.any(outline.max(axis=0)+17<box)or np.any(outline.min(axis=0)-17>far):continue
   poly=makePoly(outline)
   if not poly.IsValid():poly=poly.MakeValid()
   raster(poly.Buffer(16.5,8),box,grid,protected)
 land&=~protected
 crop=np.zeros((N,N),np.int32);rgb=np.zeros((N,N,4),np.uint8);overlap=np.zeros((N,N),bool)
 for item in fields:
  ring=P(item['outline'])
  if np.any(ring.max(axis=0)<box)or np.any(ring.min(axis=0)>far):continue
  geom=makePoly(ring)
  if not geom.IsValid():continue
  mask=np.zeros((N,N),bool);raster(geom.Buffer(-13,8),box,grid,mask);mask&=land
  if not mask.any():continue
  overlap|=mask&(crop>0)
  crop[mask]=item['id']
  raw=np.asarray(B.TransformPoint(*item['center'])[:2]);angle=item['axisRad']
  v=np.array([math.cos(angle),math.sin(angle)])*30.
  tangent=P(F.TransformPoint(*(raw+v))[:2])-P(F.TransformPoint(*(raw-v))[:2])
  tangent/=np.linalg.norm(tangent)
  rgb[mask,:2]=np.clip(np.floor(np.array([-tangent[1],tangent[0]])*127.0+128.5),1,255).astype(np.uint8)
 crop[overlap]=0
 # Boundary weight grows smoothly over 24 m. Leave a guard for interpolation
 # across a mask nibble or relative difference in objective input map grid.
 for owner in np.unique(crop):
  if owner<=0:continue
  valid=crop==owner;coverField=distance_transform_edt(valid)
  g=np.clip((coverField-1.99)/5.5,0,1);g=g*g*(3-2*g)
  rgb[valid,2]=np.round(g[valid]*255).astype(np.uint8)
  rgb[valid,3]=255
 active=rgb[:,:,2]>0;rgb[~active]=0
 assert np.all(land[active])and not np.any(protected[active])and active.sum()>40
 countGuard['positiveTexels']+=int(active.sum())
 region={'region':name,'witnessId':id,'center':home['center'],'originXZ':box.tolist(),'spanMetres':N*STEP,
         'activeTexels':int(active.sum()),'activeOwners':sorted(set(np.unique(crop[active]).tolist())),
         'activeApproxM2':int(active.sum())*STEP**2}
 allInfo.append(region);allRgb.append(rgb)
 print(region,flush=True)
joined=np.concatenate(allRgb,axis=0)
flat=gzip.compress(joined.tobytes(),compresslevel=9,mtime=0)
(D/'fields-pilot.rgba.gz').write_bytes(flat)
(D/'pilot-meta.json').write_text(json.dumps(dict(side=N,stepM=STEP,regions=allInfo,packedBytes=len(flat),sha256=hashlib.sha256(flat).hexdigest(),gates=dict(countGuard)),indent=2)+'\n')
Image.fromarray(joined).save(D/'alpha-inspect.png')
