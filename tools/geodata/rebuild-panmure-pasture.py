#!/usr/bin/env python3
"""Rebuild the single non-geometric 2020 pasture eligibility R8 from attributed data.
Requires Python with GDAL/OGR, NumPy and SciPy. CLUI input: Esri JSON query result
in EPSG:4326 with at minimum fieldid, landuse, cover1-5 and per1-5. DSM and DTM
may be the full NRCan HRDEM 10_3 mosaics, or native-grid 1m georeferenced crops.
Never requests the tower point cloud or republishes survey/imagery.
"""
import argparse,gzip,hashlib,json,struct
from pathlib import Path
import numpy as np
from osgeo import gdal,ogr,osr
from scipy.ndimage import distance_transform_edt,minimum_filter
gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--clui-esri',type=Path,required=True);p.add_argument('--dtm',required=True);p.add_argument('--dsm',required=True)
p.add_argument('--wire-output',type=Path,help='Also write the exact compact gzip payload used in the generated TypeScript module')
p.add_argument('--world',type=Path,default=Path('public/world'));p.add_argument('--output',type=Path,required=True);args=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
center=np.array([56304.91317458963,39540.53617316754]);scale=np.array([76762.59317717304,-111161.08375388647])
def metric(v):return (np.asarray(v)-[-63.2,46.5])*scale-center
def ring(points):
 r=ogr.Geometry(ogr.wkbLinearRing)
 for x,y in points:r.AddPoint_2D(x,y)
 r.CloseRings();p=ogr.Geometry(ogr.wkbPolygon);p.AddGeometry(r);return p
def line(points):
 g=ogr.Geometry(ogr.wkbLineString)
 for x,y in points:g.AddPoint_2D(x,y)
 return g
def record_region(path):
 v=json.loads(path.read_text());rows=[f for f in v['features'] if str(f['attributes']['fieldid'])=='1760020'];assert len(rows)==1
 a=rows[0]['attributes'];assert a['landuse']=='AGR' and [(a['cover'+str(i)],a['per'+str(i)])for i in range(1,6)if a['per'+str(i)]]==[('PAS',10)]
 rings=rows[0]['geometry']['rings'];assert len(rings)==1
 area=ring(metric(rings[0]));assert abs(area.GetArea()-29974.576274797775)<.1
 return area.Buffer(-7.)
area=record_region(args.clui_esri)
road=gzip.decompress((args.world/'roads.bin.gz').read_bytes());assert sha(road)=='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1'
count=struct.unpack_from('>I',road,6)[0];offset=10;assert road[:4]==b'PEIR'
for j in range(count):
 n,flags=struct.unpack_from('>HB',road,offset);offset+=3
 if j in (14242,15345,17152):
  ll=np.frombuffer(road,offset=offset,dtype='>u4',count=2*n).astype('f8').reshape(-1,2)/1e5+[-65.,45.]
  area=area.Difference(line(metric(ll)).Buffer([2.,2.8,3.6,4.8,6.4][flags&7]+10.))
 offset+=8*n
assert offset==len(road)
pack=args.world/'buildings';m=json.loads((pack/'index.json').read_text());assert m['sha256']=='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557'
q=next(x for x in m['tiles']if x['id']=='q1120')
with (pack/m['file']).open('rb') as f:f.seek(q['offset']);wire=f.read(q['bytes'])
assert sha(wire)=='8836784fd9f9ad9d399ad4f6ac6b2290a9b29de120970ec2bac01e35fb6035af'
features=json.loads(gzip.decompress(wire))['features']
for i in (92,99,102,136,162,224,404,475,488):
 area=area.Difference(ring(metric(features[i]['footprint'])).Buffer(12.))
area=area.Intersection(ring([[-270,-83],[-42,-83],[-42,183],[-270,183]]))
# This independent, deliberately restricted rectangle never touches the held tower.
xmin,ymin,xmax,ymax=2434248,316954,2434372,317139
def crs(c):
 a=osr.SpatialReference();a.ImportFromEPSG(c);a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return a
def read_native(path,pin):
 ds=gdal.Open(path);gt=ds.GetGeoTransform();assert gt[1:3]==(1.,0.) and gt[4:]==(0.,-1.)
 assert ds.GetSpatialRef().IsSame(crs(3979))
 a=ds.GetRasterBand(1).ReadAsArray(int(xmin-gt[0]),int(gt[3]-ymax),xmax-xmin,ymax-ymin)
 assert sha(a.astype('<f4').tobytes())==pin
 return a
dtm=read_native(args.dtm,'6cf5c849602f9d27717a27287999dc4f4c9414fde5cee09ad515833e862b647e')
dsm=read_native(args.dsm,'5ef9ee70792a52bab0a4bf73395faec88594d6ef23950536e3dce9fff94ab693')
good=np.isfinite(dtm)&np.isfinite(dsm)&(dtm>=3)&(dtm<18)&(dsm>=dtm-.15)&(dsm<=dtm+.36)
good=minimum_filter(good.astype('u1'),size=3,mode='constant',cval=0)>0
X,Z=np.meshgrid(np.arange(-252.5,-40.,1.),np.arange(-61.5,174.,1.));pts=np.column_stack([X.ravel(),Z.ravel()])
ll=(pts+center)/scale+[-63.2,46.5]
tr=osr.CoordinateTransformation(crs(4326),crs(3979))
native=np.asarray([q[:2]for q in tr.TransformPoints(ll)])
ix=np.floor(native[:,0]-xmin).astype(int);iy=np.floor(ymax-native[:,1]).astype(int)
bx=np.clip(ix,0,xmax-xmin-1);by=np.clip(iy,0,ymax-ymin-1)
def inside(r):
 arr=np.asarray(r.GetPoints())[:,:2];yes=np.zeros(len(pts),bool);x,y=pts.T
 for a,b in zip(arr,np.roll(arr,-1,axis=0)):
  d=b-a
  if abs(d[1])>1e-10:yes^=((a[1]>y)!=(b[1]>y))&(x<a[0]+(y-a[1])*d[0]/d[1])
 return yes
owned=inside(area.GetGeometryRef(0))
for i in range(1,area.GetGeometryCount()):owned&=~inside(area.GetGeometryRef(i))
wc=gzip.decompress((args.world/'cover.bin.gz').read_bytes());assert sha(wc)=='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9'
c=np.frombuffer(wc,'u1').reshape(2720,4096,2)
u=(ll[:,0]+64.47)/( -61.93+64.47)*4096-.5;v=(47.1-ll[:,1])/(47.1-45.94)*2720-.5
i=np.floor(u).astype(int);j=np.floor(v).astype(int);fx=u-i;fy=v-j
coast=(((1-fx)*c[j,i,1]+fx*c[j,i+1,1])*(1-fy)+((1-fx)*c[j+1,i,1]+fx*c[j+1,i+1,1])*fy-128.)*2.
cls=c[np.floor(v+.5).astype(int),np.floor(u+.5).astype(int),0]
m=(owned&(ix==bx)&(iy==by)&good[by,bx]&(coast>=47.)&(coast<=180.)&np.isin(cls,[30,40])).reshape(X.shape)
safety=minimum_filter(m,size=5,mode='constant',cval=0)>0
def smooth(s):s=np.clip(s,0.,1.);return s*s*(3.-2.*s)
weight=smooth((distance_transform_edt(safety)-1.5)/13.5)*smooth((coast.reshape(X.shape)-47.)/33.)*smooth((180.-coast.reshape(X.shape))/16.)
raw=np.round(weight*255).astype('u1').tobytes()
assert len(raw)==50268 and sha(raw)=='787ffcf201dcaddded604c11423361cfa175545f24e44272a117903f74a06b01'
# Normalize mtime, maximum-compression flag and gzip OS byte across Python versions.
wire=gzip.compress(raw,compresslevel=9,mtime=0);wire=wire[:9]+bytes([3])+wire[10:]
assert len(wire)==3361 and sha(wire)=='cbfb3a27ed2e7a860b7c5d481eb8c60c53c2caf1c81f47ae1fdf1ce2002db500'
if args.wire_output:args.wire_output.write_bytes(wire)
args.output.write_bytes(raw);print(f'Verified {len(raw)}-byte mask {sha(raw)}; {len(wire)}-byte gzip {sha(wire)}')
