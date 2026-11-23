#!/usr/bin/env python3
"""Bake small independent EFI stand-height windows from pinned PEI open data."""
import argparse,binascii,gzip,hashlib,json
from pathlib import Path
from osgeo import gdal,ogr,osr
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'data/forest-envelope/efi2020-pilot.json.gz'
ASSET=ROOT/'public/world/woodland/v1/efi-dominant-heights.r8.gz'
MODULE=ROOT/'src/sim/forest-heights.generated.ts'
WINDOWS={
 'prince':[-64.278,46.632,-64.270,46.637],
 'queens':[-63.424,46.481,-63.416,46.486],
 'kings':[-62.034,46.438,-62.026,46.443],
}
N=64
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--pin-dir',type=Path,help='local parsed EFI2020 REST response files (name-pilot.json)')
a=p.parse_args()
def sha(data):return hashlib.sha256(data).hexdigest()
def zipped(data):return gzip.compress(data,compresslevel=9,mtime=0)
if a.pin_dir:
 pinned={}
 for name,bounds in WINDOWS.items():
  path=a.pin_dir/(name+'-pilot.json')
  raw=path.read_bytes()
  j=json.loads(raw)
  assert not j.get('exceededTransferLimit') and j['spatialReference']['wkid']==4326
  f=[]
  for row in j['features']:
   h=row['attributes']['domht']
   if h is None or not 2<=h<=50:continue
   rings=row['geometry']['rings']
   assert len(rings)==1 and len(rings[0])==5 and rings[0][0]==rings[0][-1]
   f.append([round(h,2),[[round(x,8),round(y,8)] for x,y in rings[0]]])
  pinned[name]={'bounds':bounds,'inputSha256':sha(raw),'dominantMetresAndRing':f}
 data={'source':'PEI Enhanced Forest Inventory 2020, official EFI2020 layer 0','id':'8a7638bdc09648358e0b6fd14be6117a',
       'crs':'EPSG:4326','windows':pinned}
 SOURCE.write_bytes(zipped((json.dumps(data,separators=(',',':'))+'\n').encode()))

data=json.loads(gzip.decompress(SOURCE.read_bytes()))
pack=bytearray();plans=[]
gdal.UseExceptions();ogr.UseExceptions()
srs=osr.SpatialReference();srs.ImportFromEPSG(4326)
for name,row in data['windows'].items():
 left,south,right,north=row['bounds']
 raster=gdal.GetDriverByName('MEM').Create('mem',N,N,1,gdal.GDT_Byte)
 raster.SetGeoTransform((left,(right-left)/N,0,north,0,(south-north)/N))
 raster.SetProjection(srs.ExportToWkt())
 mem=ogr.GetDriverByName('Memory').CreateDataSource('features')
 layer=mem.CreateLayer(name,srs,ogr.wkbPolygon)
 layer.CreateField(ogr.FieldDefn('q',ogr.OFTInteger))
 for h,coords in row['dominantMetresAndRing']:
  ring=ogr.Geometry(ogr.wkbLinearRing)
  for x,y in coords:ring.AddPoint_2D(x,y)
  poly=ogr.Geometry(ogr.wkbPolygon);poly.AddGeometry(ring)
  feature=ogr.Feature(layer.GetLayerDefn());feature.SetField('q',round(h*2));feature.SetGeometry(poly)
  layer.CreateFeature(feature)
 gdal.RasterizeLayer(raster,[1],layer,options=['ATTRIBUTE=q'])
 cells=raster.ReadAsArray()
 plans.append(dict(id=name,bounds=row['bounds'],offset=len(pack),sourceCells=len(row['dominantMetresAndRing']),
                  supported=int((cells>0).sum())))
 pack.extend(cells.tobytes(order='C'))
 print(name,'source polygons',plans[-1]['sourceCells'],'runtime positive texels',plans[-1]['supported'])
ASSET.write_bytes(zipped(bytes(pack)))
config={'asset':'world/woodland/v1/'+ASSET.name,'width':N,'height':N,
 'decodedBytes':len(pack),'sha256':sha(pack),'crc32':f'{binascii.crc32(pack):08x}',
 'sourceSha256':sha(SOURCE.read_bytes()),'windows':plans}
MODULE.write_text('// Generated from EFI2020 pilot records. Run tools/terrain/bake-forest-heights.py.\nexport const FOREST_HEIGHTS = '+json.dumps(config,indent=2)+' as const;\n')
