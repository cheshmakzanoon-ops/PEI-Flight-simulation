#!/usr/bin/env python3
"""Encode quality-gated 2020 PEI stand base-to-live-crown ratios."""
import argparse,gzip,hashlib,json
from pathlib import Path
from zipfile import ZipFile
from osgeo import gdal,ogr
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--archive',type=Path,required=True)
p.add_argument('--shape',type=Path,required=True,
 help='Extracted official EFI2020.shp. All five companion inputs are verified against the pinned archive.')
p.add_argument('--out',type=Path,required=True)
a=p.parse_args()
def sha(b):return hashlib.sha256(b).hexdigest()
with a.archive.open('rb') as f:
 assert hashlib.file_digest(f,'sha256').hexdigest()=='b00bf8767b67a8269cb69f7fe0df2540e657357cb1d82bd42477c0cbc20a893c'
with ZipFile(a.archive) as z:
 for ext in ('.shp','.dbf','.shx','.prj','.cpg'):
  with z.open('EFI2020'+ext) as src,a.shape.with_suffix(ext).open('rb') as fs:
   if hashlib.file_digest(src,'sha256').digest()!=hashlib.file_digest(fs,'sha256').digest():
    raise ValueError('Extracted EFI2020 member differs from the pinned archive: '+ext)
gdal.UseExceptions()
gdal.SetCacheMax(88*1024*1024)
a.out.mkdir(parents=True,exist_ok=True)
# Controlled review verifies use of an exact native donor for both fields.
# Values are encoded before nearest warping. 0 is unknown; no semantic fill.
native=gdal.Rasterize('',str(a.shape),options=gdal.RasterizeOptions(format='MEM',
 outputBounds=[292120,656440,479000,778700],xRes=20,yRes=20,noData=0,
 outputType=gdal.GDT_Byte,attribute='crownByte',SQLDialect='SQLITE',
 SQLStatement='SELECT Geometry, CAST(blc / domht * 128 + 0.5 AS INTEGER) AS crownByte FROM EFI2020'
 ' WHERE domht >= 6 AND domht <= 30 AND topht >= domht * .85 AND blc >= .4 AND blc <= domht * .82'))
assert native.RasterXSize==9344 and native.RasterYSize==6113
assert int(np.count_nonzero(native.ReadAsArray()))==6539120
print('Native source cells with positive crown ratios: 6,539,120',flush=True)
atlas=gdal.Warp('',native,format='MEM',srcSRS='EPSG:2954',dstSRS='EPSG:4326',
 outputBounds=[-64.47,45.94,-61.93,47.1],width=10240,height=7040,
 srcNodata=0,dstNodata=0,resampleAlg='near',errorThreshold=0)
q=atlas.ReadAsArray();pad=np.pad(q,2)
del native,atlas
rows=[];packs=[];pack=bytearray()
def flush():
 if not pack:return
 name='crown-%02d.pack'%len(packs)
 (a.out/name).write_bytes(pack)
 packs.append(dict(file=name,bytes=len(pack),sha256=sha(pack)))
 pack.clear()
for j in range(22):
 for i in range(32):
  src=q[j*320:(j+1)*320,i*320:(i+1)*320];n=int(np.count_nonzero(src))
  if not n:continue
  raw=pad[j*320:(j+1)*320+4,i*320:(i+1)*320+4].tobytes()
  asset=gzip.compress(raw,compresslevel=9,mtime=0)
  if len(pack)+len(asset)>548000:flush()
  rows.append({'id':f'{i}-{j}','offset':len(pack),'bytes':len(asset),'decodedBytes':len(raw),
    'positive':n,'sha256':sha(raw),'pack':len(packs)})
  pack.extend(asset)
flush()
meta={'source':'PEI EFI2020 stand base-to-live-crown / dominant height estimates; Open Government Licence – Prince Edward Island',
 'reference':'20 m native EPSG:2954 nearest to WGS84; byte over 128; zero = unsupported',
 'bounds':[-64.47,45.94,-61.93,47.1],'cols':32,'rows':22,'tileInterior':320,'tileBorder':2,
 'bytes':sum(x['bytes'] for x in packs),'tiles':rows,'packs':packs}
(a.out/'index.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
print(len(rows),'chunks in',len(packs),'packs,',meta['bytes'],'bytes')
