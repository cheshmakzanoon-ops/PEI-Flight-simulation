"""Independent county accounting of every decoded, non-halo FCR centre, not an acreage estimate."""
import argparse, gzip, hashlib, json, struct
from collections import Counter,defaultdict
from functools import lru_cache
from pathlib import Path
from osgeo import gdal,ogr
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
for x in ('county','pack','owners','world','out'):p.add_argument('--'+x,type=Path,required=True)
a=p.parse_args()
h=lambda b:hashlib.sha256(b).hexdigest()
countyHash=h(a.county.read_bytes())
assert countyHash=='379ad51821bb356a3855c3eb9c9ac3b47e01eee4df744f7a14873195b090de88','Use the pinned PEI county_zones snapshot; review a changed boundary rather than guessing its identity.'
gdal.UseExceptions();ogr.UseExceptions()
db=gdal.OpenEx(str(a.county),gdal.OF_VECTOR);layer=db.GetLayer(0)
names=['PRINCE','QUEENS','KINGS'];polygons={s:[]for s in names}
for f in layer:
 name=f['KEYWORD'].strip()
 if name in polygons:polygons[name].append(f.GetGeometryRef().Clone())
assert [len(polygons[n])for n in names]==[1,2,2]
# Count outlines by their source screening centroid, independently of the
# area's assignment. A field can straddle a county boundary.
owners=json.loads(a.owners.read_text());centroid=Counter()
for f in owners:
 if not f['finalPositiveAfterConflicts']:continue
 point=ogr.Geometry(ogr.wkbPoint);point.AddPoint_2D(*f['centroidWGS'])
 county=[n for n in names if any(q.Contains(point) for q in polygons[n])]
 assert len(county)==1,(county,f['id']);centroid[county[0]]+=1
geo=json.loads(a.world.read_text())['projection'];lon,lat=geo['origin'];sx,sz=geo['scale']
meta=json.loads((a.pack/'source.json').read_text());wire=(a.pack/'index.fcr.gz').read_bytes();ix=gzip.decompress(wire)
assert h(ix)==meta['rawHash']and h(wire)==meta['packedHash']
_,_,npacks,nr,_=struct.unpack_from('<4s4H',ix);byZone=defaultdict(list)
for i in range(nr):
 x,z,pk,rs,off,n,wh,rh=struct.unpack_from('<hhHHII32s32s',ix,12+npacks*36+80*i)
 byZone[x//8,z//8].append((x,z,pk,off,n,wh,rh))
@lru_cache(maxsize=8)
def load(pk):
 q=meta['packs'][pk];b=(a.pack/q['file']).read_bytes();assert h(b)==q['sha256'];return b
counts=np.zeros(5,dtype='int64');examples={};boundaryGaps=[]
gdal.UseExceptions()
for (zx,zz),shards in sorted(byZone.items()):
 # Pixel centres are precisely +2m, and game positive Z is south.
 ds=gdal.GetDriverByName('MEM').Create('',2048,2048,1,gdal.GDT_Byte);x0=zx*8192;z0=zz*8192
 ds.SetGeoTransform((lon+x0/sx,4/sx,0,lat+z0/sz,0,4/sz))
 ds.SetProjection(layer.GetSpatialRef().ExportToWkt())
 for i,name in enumerate(names,1):
  layer.SetAttributeFilter("KEYWORD='"+name+"'");gdal.RasterizeLayer(ds,[1],layer,burn_values=[i])
 countyRaster=ds.ReadAsArray();ds=None
 for x,z,pk,off,n,wh,rh in shards:
  b=load(pk)[off:off+n];assert hashlib.sha256(b).digest()==wh;r=gzip.decompress(b);assert hashlib.sha256(r).digest()==rh
  alpha=np.frombuffer(r,np.uint8).reshape(260,260,2)[2:-2,2:-2,1]
  i=(x-zx*8)*256;j=(z-zz*8)*256;ids=countyRaster[j:j+256,i:i+256]
  w=np.bincount(ids[alpha>0],minlength=len(counts));counts+=w
  # Administrative polygons are generalized. Resolve raster ambiguities at
  # the actual point; truly outside all five named geometries stays unassigned.
  for iz,ix0 in zip(*np.where((ids==0)&(alpha>0))):
   X=x*1024+int(ix0)*4+2;Z=z*1024+int(iz)*4+2;ll=(lon+X/sx,lat+Z/sz)
   pt=ogr.Geometry(ogr.wkbPoint);pt.AddPoint_2D(*ll)
   exact=[i for i,name in enumerate(names,1) if any(q.Intersects(pt)for q in polygons[name])]
   assert len(exact)<=1
   if exact:counts[0]-=1;counts[exact[0]]+=1
   else:boundaryGaps.append({'x':X,'z':Z,'lon':ll[0],'lat':ll[1]})
  for n0,name in enumerate(names,1):
   if name not in examples:
    ys,xs=np.where((ids==n0)&(alpha==255))
    if len(ys)>30:
     k=len(ys)//2;X=x*1024+int(xs[k])*4+2;Z=z*1024+int(ys[k])*4+2
     examples[name]={'x':X,'z':Z,'lon':lon+X/sx,'lat':lat+Z/sz,'weight':255}
print('counts / tallies / examples',counts.tolist(),centroid,examples,flush=True)
assert counts[0]==len(boundaryGaps) and not counts[4] and counts.sum()==meta['samples'] and len(examples)==3
r={'checked':'Assignment of each nonzero FCR interior sample centre, no halos. Outlines independently assigned by source centroid, not inferred from the sample majority.',
 'source':'Government of Prince Edward Island, county_zones/FeatureServer/0; EPSG:4326, named PRINCE, QUEENS, KINGS boundaries.',
 'countyGeojsonSha256':countyHash,'indexRawSha256':meta['rawHash'],'positiveCentres':int(counts.sum()),'unassignedCentres':int(counts[0]),'unassignedAreaM2':int(counts[0])*16,'outsideEveryNamedPolygonAtExactPoint':boundaryGaps,
 'outlinesContributing':sum(centroid.values()),'counties':{n.title():{'centres':int(counts[i]),'areaKm2':round(int(counts[i])*16e-6,6),'outlinesByCentroid':centroid[n],'oneFullStrengthSample':examples[n]}for i,n in enumerate(names,1)}}
a.out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
