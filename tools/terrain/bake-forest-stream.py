#!/usr/bin/env python3
"""Reproduce the optional province-wide forestry stream from the official archive."""
import argparse,gzip,hashlib,json,shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
from osgeo import gdal
import numpy as np

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--archive',type=Path,required=True,help='Official zipped EFI2020 Shapefile')
p.add_argument('--out',type=Path,required=True,help='Output stream-v1 directory')
p.add_argument('--native-grid',type=Path,help='Also save the unwarped 20 m EPSG:2954 stand grid for hedge generation')
args=p.parse_args()
expected='b00bf8767b67a8269cb69f7fe0df2540e657357cb1d82bd42477c0cbc20a893c'
with args.archive.open('rb') as src:
 assert hashlib.file_digest(src,'sha256').hexdigest()==expected,'unexpected forestry archive'
gdal.UseExceptions()
gdal.SetCacheMax(448*1024*1024)
def sha(b):return hashlib.sha256(b).hexdigest()
args.out.mkdir(parents=True,exist_ok=True)
rows=[];packs=[];pack=bytearray()
with TemporaryDirectory(prefix='pei-efi-') as tmp:
 t=Path(tmp)
 with ZipFile(args.archive) as z:
  for ext in ['.shp','.dbf','.shx','.cpg','.prj']:
   z.extract('EFI2020'+ext,t)
 native=gdal.Rasterize(str(t/'native.tif'),str(t/'EFI2020.shp'),
   options=gdal.RasterizeOptions(outputBounds=[292120,656440,479000,778700],xRes=20,yRes=20,
      attribute='domht',where='domht >= 2 AND domht <= 50',noData=0,
      outputType=gdal.GDT_Float32,creationOptions=['TILED=YES','COMPRESS=DEFLATE','PREDICTOR=3']))
 assert native.RasterXSize==9344 and native.RasterYSize==6113
 if args.native_grid:
  native=None;args.native_grid.parent.mkdir(parents=True,exist_ok=True)
  shutil.copyfile(t/'native.tif',args.native_grid)
  native=gdal.Open(str(t/'native.tif'))
 atlas=gdal.Warp('',native,format='MEM',srcSRS='EPSG:2954',dstSRS='EPSG:4326',
    outputBounds=[-64.47,45.94,-61.93,47.1],width=10240,height=7040,
    srcNodata=0,dstNodata=0,resampleAlg='near',errorThreshold=0)
 q=np.clip(np.rint(atlas.ReadAsArray()*2),0,100).astype('u1')
 pad=np.pad(q,2)
 def flush():
  if not pack:return
  name='heights-%02d.pack'%len(packs)
  (args.out/name).write_bytes(pack)
  packs.append(dict(file=name,bytes=len(pack),sha256=sha(pack)))
  pack.clear()
 for j in range(22):
  for i in range(32):
   src=q[j*320:(j+1)*320,i*320:(i+1)*320];n=int((src>0).sum())
   if not n:continue
   raw=pad[j*320:(j+1)*320+4,i*320:(i+1)*320+4].tobytes()
   asset=gzip.compress(raw,compresslevel=9,mtime=0)
   if len(pack)+len(asset)>548000:flush()
   rows.append({'id':f'{i}-{j}','offset':len(pack),'bytes':len(asset),'decodedBytes':len(raw),
     'positive':n,'sha256':sha(raw),'pack':len(packs)})
   pack.extend(asset)
 flush()
meta={'source':'EFI2020 7,202,307 native stand cells; Open Government Licence – Prince Edward Island',
 'reference':'20 m source raster warped to WGS84, nearest; heights stored in half-metres',
 'bounds':[-64.47,45.94,-61.93,47.1],'cols':32,'rows':22,'tileInterior':320,'tileBorder':2,
 'bytes':sum(x['bytes'] for x in packs),'tiles':rows,'packs':packs}
out=args.out/'index.json'
out.write_text(json.dumps(meta,separators=(',',':'))+'\n')
print(len(rows),'chunks in',len(packs),'packs,',meta['bytes'],'bytes')
