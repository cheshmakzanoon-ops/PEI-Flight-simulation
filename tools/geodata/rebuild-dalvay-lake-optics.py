#!/usr/bin/env python3
"""Rebuild the Dalvay visual-only water stencil offline from the two exact public inputs.

Requires GDAL/OGR with PROJ, NumPy, SciPy, and Python 3. No Internet requests.
"""
import argparse,gzip,hashlib,json,math,struct
from pathlib import Path
import numpy as np
from scipy.ndimage import label,distance_transform_edt
from osgeo import ogr,gdal,osr
ogr.UseExceptions()
gdal.UseExceptions()
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--nhn',type=Path,required=True,help='Original 01CC000 NHN water-body shapefile ZIP')
parser.add_argument('--world-cover',type=Path,required=True,help='Original ESA WorldCover N45W066 2021 v200 Map.tif')
parser.add_argument('--out',type=Path,required=True,help='Output local .dlb path')
args=parser.parse_args()
H=lambda x:hashlib.sha256(x.read_bytes() if isinstance(x,Path) else x).hexdigest()
nhn,r=args.nhn.resolve(),args.world_cover.resolve()
if H(nhn)!='f6994a6802535ae854a8cfaf94fb05ef9866f02606839ab3745063f24698d620':
    raise ValueError('Unexpected source hydrography archive revision')
if H(r)!='a9ecfc04b044d75d68f5144af3240fa32792c3dcc77e7b429595935c610a80b0':
    raise ValueError('Unexpected land-cover tile revision')
ds_nhn=ogr.Open('/vsizip/'+str(nhn)+'/NHN_01CC000_3_0_HD_WATERBODY_2.shp')
layer=ds_nhn.GetLayer(0)
feature=layer.GetFeature(234)
if feature.GetField('NID')!='dc8e389aae854b958fc06b02e2b9b011' or feature.GetField('VALDATE')!='1987':
    raise ValueError('Unexpected Dalvay feature identity')
src=layer.GetSpatialRef().Clone()
wgs84=osr.SpatialReference()
wgs84.ImportFromEPSG(4326)
for ref in (src,wgs84):
    ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
g=feature.GetGeometryRef().Clone()
g.Transform(osr.CoordinateTransformation(src,wgs84))
geom=json.loads(g.ExportToJson())
ds=gdal.Open(str(r));band=ds.GetRasterBand(1)
xg,dx,b,yg,c,dy=ds.GetGeoTransform();assert dx>0 and dy<0 and b==c==0
cx,cy=-63.070848,46.412939;u,v=76762.59317717307,111161.08375388649
def local(q):
 if isinstance(q[0],(float,int)):return [(q[0]-cx)*u,(cy-q[1])*v]
 return [local(e)for e in q]
p=ogr.CreateGeometryFromJson(json.dumps({'type':geom['type'],'coordinates':local(geom['coordinates'])})).Buffer(-12)
west,east,north,south=p.GetEnvelope();sx,sz=4*math.floor(west/4)-8,4*math.floor(north/4)-8
w,h=math.ceil((east-sx)/4)+2,math.ceil((south-sz)/4)+2
assert 5<w<260 and 5<h<260
# Read 10m raster window strictly bounded to the declared eroded historic basin plus neighbor pixels.
ox=math.floor((cx+sx/u-xg)/dx)-3
mx=math.ceil((cx+(sx+w*4)/u-xg)/dx)+3
oz=math.floor((cy-sz/v-yg)/dy)-3
mz=math.ceil((cy-(sz+h*4)/v-yg)/dy)+3
raw=band.ReadAsArray(ox,oz,mx-ox,mz-oz);assert raw.size<12000
dot=ogr.Geometry(ogr.wkbPoint)
def valid(a,z):
 a=float(a);z=float(z);dot.SetPoint_2D(0,a,z)
 if not p.Contains(dot):return False
 i=math.floor((cx+a/u-xg)/dx)-ox;j=math.floor((cy-z/v-yg)/dy)-oz
 block=raw[j-1:j+2,i-1:i+2]
 return block.shape==(3,3) and bool(np.all(block==80))
mask=np.zeros((h,w),bool)
for j in range(h):
 for i in range(w):
  a=sx+4*i;z=sz+4*j
  mask[j,i]=all(valid(a+u,z+v)for u,v in ((0,0),(4,0),(0,4),(4,4)))
lab,n=label(mask);cnt=np.bincount(lab.ravel())[1:];i=int(np.argmax(cnt)) if n else -1;mask=lab==i+1 if i>=0 else mask
area=4*4*int(mask.sum())
assert area>=30000,('ineligible contiguous visual core',area)
# Keep an extra complete known-wet safety row between first positive value and
# the outer source boundary, so a bilinear sample cannot escape verified cells.
m=(np.clip((distance_transform_edt(mask)-2.0)/3.5,0,1)*255).round().astype('u1')
assert not m[0].any() and not m[-1].any() and not m[:,0].any() and not m[:,-1].any() and np.all(mask[m>0])
# Geometry is a source fence, not a new body surface. Pack header and validated body separately.
wire0=struct.pack('<4sHHffff',b'DL01',w,h,sx,sz,4.,4.)+m.tobytes()
packed=gzip.compress(wire0,compresslevel=9,mtime=0)
out={'scope':'Water appearance only on unchanged original world geometry, no change to level, shoreline/flight ground/body physics or raw survey elevation. Historical NHN+2021 original mask, never a current shoreline.',
     'originalNHNArchiveSHA256':H(nhn),'headerVersion':'DL01','outlineID':feature.GetField('NID'),'NHNValidityYear':1987,
     'originalESARasterSHA256':H(r),'read10mRasterProvenance':{'originXY':[ox,oz],'sizeXY':[mx-ox,mz-oz],'rawSubwindowSha256':H(raw.tobytes())},
     'gridOriginRelativeToCGNMetres':[sx,sz],'cellM':4,'sizeXY':[w,h],'coreCellCount':int(mask.sum()),'qualifiedAreaM2':area,
     'renderAlphaPositiveCellAreaM2':16*int((m>0).sum()),'fullyAppliedAlphaAreaM2':16*int((m==255).sum()),'packBytes':len(packed),
     'packedSHA256':H(packed),'decodedSHA256':H(wire0),'bodySha256':H(m.tobytes()),
     'originalZOrArtSourceNotUsed':True}
if (w,h,sx,sz)!=(199,135,-548,-296) or area!=131360:
    raise ValueError('Derived grid differs; check source and projection')
if H(wire0)!='104b60f2dfc6d0f299a7fcff0169992f5d9c51a03b7dfbfdb81ad85b871fa139' or H(packed)!='149ee965bc52ca42e75f506a5f688dd9b3f2420264ff427c5c23e7496d190f56':
    raise ValueError('Derived payload differs; check GDAL, PROJ and zlib versions')
if args.out.suffix!='.dlb':raise ValueError('Output needs opaque .dlb extension')
args.out.write_bytes(packed)
print(json.dumps(out,indent=2))
