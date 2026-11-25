#!/usr/bin/env python3
"""Independent, read-only census of the complete PEI farmland archive.

Give --sources the four pinned AAFC/prefilter files from the official rebuild.
Pass --archive an extracted, immutable world/fields-province/v2 directory and
--world the repository public/world directory. The grid is checked directly
against original vector and raster features rather than the builder's exported
qualifier output. This tool intentionally checks neither GPU timing nor terrain
draws; the player and full-support infrastructure checks are separate.
Dependencies: GDAL/OGR, numpy, scipy, matplotlib. No network access.
"""
import argparse, collections, gzip, hashlib, json, math, struct
from functools import lru_cache
from pathlib import Path
import numpy as np
from matplotlib.path import Path as Poly
from osgeo import gdal, ogr, osr
from scipy.ndimage import minimum_filter

def sha(b):return hashlib.sha256(b).hexdigest()
ORIG=np.array([-63.2,46.5])
A=6378137*math.pi/180;E=6.69437999014e-3;s=1-E*math.sin(math.radians(46.5))**2
PER=np.array([A*math.cos(math.radians(46.5))/math.sqrt(s),-A*(1-E)/s**1.5])
class FCR:
 def __init__(self,p):
  self.p=Path(p);self.index=gzip.decompress((self.p/'index.fcr.gz').read_bytes());b=self.index
  magic,v,npk,nce,flags=struct.unpack_from('<4s4H',b);assert (magic,v,flags)==(b'FCR1',1,0) and len(b)==12+npk*36+nce*80
  self.pack=[];self.items={}
  for i in range(npk):
   sz,pin=struct.unpack_from('<I32s',b,12+36*i);wire=(self.p/f'crop-{i:02}.pack').read_bytes();assert len(wire)==sz and hashlib.sha256(wire).digest()==pin;self.pack.append(wire)
  for i in range(nce):
   x,z,ip,_,o,n,h,hr=struct.unpack_from('<hhHHII32s32s',b,12+npk*36+80*i);self.items[x,z]=(ip,o,n,h,hr)
 @lru_cache(16)
 def mask(self,x,z):
  t=self.items.get((x,z))
  if t is None:return
  ip,o,n,h,hr=t;w=self.pack[ip][o:o+n];assert hashlib.sha256(w).digest()==h
  b=gzip.decompress(w);assert len(b)==135200 and hashlib.sha256(b).digest()==hr
  return np.frombuffer(b,np.uint8).reshape(260,260,2)[2:-2,2:-2,1]

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--archive',type=Path,required=True)
p.add_argument('--world',type=Path,required=True)
p.add_argument('--sources',dest='src',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--expect-index-sha256',required=True,help='SHA-256 of the decoded FCR1 directory')
p.add_argument('--allow-failures',action='store_true',help='Return success after reporting a failing historical comparison')
a=p.parse_args()
d=FCR(a.archive)
assert sha(d.index)==a.expect_index_sha256,'Archive directory mismatch'
PIN={
 'pe-fields-2023.gpkg':'29008797e85fd50d8a7ca8b0a796161ce49b0af4a0a2761ff70bb651cff85602',
 'aci_2025_pe_v1.tif':'d8538b2d567490fa66b9864cb5bb66cff45b6c8cadc654ceb191f49d04d5bd79',
 'aci_2025_pe_confidence_v1.tif':'9a44fffc81e511526dfae1f94d417c38f173ff7e38ba8767f887bcab31bb1258',
 'supported-fields.json':'200edddf56e9a6ada5c890c6ac952e967eaf57fe507dd0e8aa59982047e72e83',
}
for name,digest in PIN.items():
 assert sha((a.src/name).read_bytes())==digest,f'Unexpected official source: {name}'
F=[v['id'] for v in json.loads((a.src/'supported-fields.json').read_text())['fields']]
assert len(set(F))==len(F)==2880
ogr.UseExceptions();gdal.UseExceptions();native=gdal.OpenEx(str(a.src/'pe-fields-2023.gpkg'),gdal.OF_VECTOR);layer=native.GetLayer(0)
def ax(s):s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
wgs=osr.SpatialReference();wgs.ImportFromEPSG(4326);wgs=ax(wgs)
togeo=osr.CoordinateTransformation(ax(layer.GetSpatialRef()),wgs)
ra=gdal.Open(str(a.src/'aci_2025_pe_v1.tif'));rq=gdal.Open(str(a.src/'aci_2025_pe_confidence_v1.tif'));assert ra.GetGeoTransform()==rq.GetGeoTransform()
toRaster=osr.CoordinateTransformation(wgs,ax(ra.GetSpatialRef()));gx,gs,_,gy,_,gdy=ra.GetGeoTransform();assert [gs,gdy]==[30,-30];cldata=ra.ReadAsArray();qual=rq.ReadAsArray();valid=minimum_filter(((cldata==177)&(qual>=80)&(qual<=100)).astype(np.uint8),size=3,mode='constant')
cvmeta=json.loads((a.world/'cover.json').read_text());import gzip
cbytes=gzip.decompress((a.world/'cover.bin.gz').read_bytes());assert sha(cbytes)=='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';cover=np.frombuffer(cbytes,'u1').reshape(2720,4096,2);lw,ls,le,ln=cvmeta['bounds'];org=(np.array([lw,ln])-ORIG)*PER;step=np.array([le-lw,ls-ln])*PER/[4096,2720]
def pts(poly):
 if poly.GetGeometryName()=='POLYGON':return [Poly(np.asarray(poly.GetGeometryRef(0).GetPoints())[:,:2])]
 return [o for i in range(poly.GetGeometryCount()) for o in pts(poly.GetGeometryRef(i))]
def trueGeom(fid,r=6.25):
 feat=layer.GetFeature(fid);q=feat.GetGeometryRef().Clone();q.Transform(togeo)
 assert q.GetGeometryCount()==1;poly=q.GetGeometryRef(0);assert poly.GetGeometryName()=='POLYGON' and poly.GetGeometryCount()==1
 coords=(np.asarray(poly.GetGeometryRef(0).GetPoints())[:,:2]-ORIG)*PER
 ring=ogr.Geometry(ogr.wkbLinearRing)
 for x,z in coords:ring.AddPoint_2D(float(x),float(z))
 rr=ogr.Geometry(ogr.wkbPolygon);rr.AddGeometry(ring);buf=rr.Buffer(-r,12);return rr,buf
def raster(p):
 ll=p/PER+ORIG;xy=np.asarray(toRaster.TransformPoints(ll.tolist()))[:,:2];i=np.floor((xy[:,0]-gx)/gs).astype(int);j=np.floor((xy[:,1]-gy)/gdy).astype(int)
 return valid[j,i],cldata[j,i],qual[j,i]
bins=collections.defaultdict(list);shapeN=0
for fid in F:
 g,geom=trueGeom(fid);rings=pts(geom)
 for ring in rings:
  lo=ring.vertices.min(axis=0);hi=ring.vertices.max(axis=0)
  for x in range(math.floor(lo[0]/1024),math.floor(hi[0]/1024)+1):
   for z in range(math.floor(lo[1]/1024),math.floor(hi[1]/1024)+1):bins[x,z].append((lo,hi,ring))
 shapeN+=1
n=0;outOfShape=0;unconfirmed=0;unsafeClass=0;unsafeG=0;minG=256;counties=collections.Counter()
for (x,z) in d.items:
 m=d.mask(x,z);row,col=np.nonzero(m);pt=np.column_stack([x*1024+(col+.5)*4,z*1024+(row+.5)*4]);n+=len(pt)
 if not len(pt):continue
 covered=np.zeros(len(pt),'?')
 for lo,hi,ring in bins.get((x,z),[]):
  ix=np.flatnonzero((pt[:,0]>=lo[0])&(pt[:,0]<=hi[0])&(pt[:,1]>=lo[1])&(pt[:,1]<=hi[1])&(~covered))
  if len(ix):covered[ix]|=ring.contains_points(pt[ix])
 outOfShape+=int((~covered).sum());vv,_,_=raster(pt);unconfirmed+=int((vv==0).sum())
 # All cover cells intersecting the closed 8x8 support and all bilinear G source vertices required by the game shader.
 good=np.ones(len(pt),'?');coast=np.full(len(pt),255)
 for dx in [-4.,4.]:
  for dz in [-4.,4.]:
   q=(pt+[dx,dz]-org)/step;uv=np.floor(q).astype(int);good&=cover[uv[:,1],uv[:,0],0]==40
   pix=np.floor(q-.5).astype(int)
   for i in (0,1):
    for j in (0,1):coast=np.minimum(coast,cover[pix[:,1]+j,pix[:,0]+i,1])
 unsafeClass+=int((~good).sum());unsafeG+=int((coast<228).sum());minG=min(minG,int(coast.min()))
r={'method':'Direct official native 2023 GPKG geometric rings from source FIDs, approach by 6.25m inward metric erosion (larger than 4sqrt2 full box); direct 2025 ACI and confidence GeoTIFF 3x3 moat for every actual positive 4m sample center. Validated every FCR pack and every compressed and expanded shard by its source SHA-256. Actual Cover.sample and every physical bilinear signed-distance neighbor for the full closed RGB8 four-metre tent, not the original worker filter.','index':sha(d.index),'directOfficialCandidates':shapeN,'verifiedPacks':len(d.pack),'verifiedShards':len(d.items),'samples':n,'officialFieldEroded6p25mMisses':outOfShape,'nativeAAFCClass177Plus3x3ConfidenceFailures':unconfirmed,'closedTentsOverNoncrop':unsafeClass,'closedTentsWithBilinearSignedVertexBelowG228':unsafeG,'minActualSignedCoastVertex':minG,'sourceInputSHA256':{p.name:sha(p.read_bytes()) for p in [a.src/'pe-fields-2023.gpkg',a.src/'aci_2025_pe_v1.tif',a.src/'aci_2025_pe_confidence_v1.tif']}}
out=a.out;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2),flush=True)
if not a.allow_failures and any((outOfShape,unconfirmed,unsafeClass,unsafeG)):raise SystemExit(1)
