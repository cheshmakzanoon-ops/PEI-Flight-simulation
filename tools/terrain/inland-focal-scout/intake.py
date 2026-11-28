#!/usr/bin/python3
"""Probe three fixed comparison anchors, without reading complete source tiles or resampling."""
import argparse,gzip,hashlib,json,math
from pathlib import Path
from urllib.request import Request,urlopen
import numpy as np
from osgeo import gdal,osr
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif',
    'GDAL_HTTP_TIMEOUT':'35','GDAL_HTTP_MAX_RETRY':'1','GDAL_HTTP_MULTIRANGE':'YES',
    'CPL_VSIL_CURL_CHUNK_SIZE':'65536','CPL_VSIL_CURL_CACHE_SIZE':'16777216'}.items():gdal.SetConfigOption(k,v)
gdal.SetCacheMax(16*1024*1024)
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('screen',type=Path)
cli.add_argument('output',type=Path)
a=cli.parse_args()
p=a.output
sha=lambda b:hashlib.sha256(b).hexdigest()
src='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif'
etag='eb6a8f985dbf26b24d503d1502ce589b-2727'
h4096='2ae33670d39a6d4903392f3eeae142748ee647d2f6f9be0be1eaf0a3cc62c9e5'
known=('miscouche-woodlot-pass','hunter-river-trail','kings-meadow-low')
screen=a.screen.read_bytes()
assert sha(screen)=='9c658578713f1e8041bbb81356098d393a14c76f30f93aa125e399fc550f32c0'
rows={q['route']:q for q in json.loads(screen)['screen']}
p.mkdir(parents=True,exist_ok=False)
roi=320
probe=Request(src,headers={'Range':'bytes=0-4095','If-Match':'"'+etag+'"'})
with urlopen(probe,timeout=35) as f:
 assert f.status==206 and f.headers['Content-Range']=='bytes 0-4095/731762494131'
 assert f.headers['ETag'].strip('"')==etag
 assert sha(f.read(4097))==h4096
gdal.SetConfigOption('GDAL_HTTP_HEADERS', 'If-Match: "'+etag+'"')
d=gdal.Open('/vsicurl/'+src,gdal.GA_ReadOnly)
grid=d.GetGeoTransform(); assert grid==(2000000.,1.,0.,500000.,0.,-1.),grid
meta=d.GetSpatialRef()
assert meta.GetAuthorityCode('PROJCS')=='3979'
# This edition embeds only the horizontal CRS. Vertical reference comes from
# the independently linked Natural Resources Canada product documentation.
assert not meta.IsCompound() and meta.GetAuthorityCode('VERT_CS') is None
bd=d.GetRasterBand(1); assert bd.DataType==gdal.GDT_Float32 and bd.GetNoDataValue()==-32767
s,t=osr.SpatialReference(),osr.SpatialReference()
for v,n in ((s,4326),(t,3979)):v.ImportFromEPSG(n);v.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
xy=osr.CoordinateTransformation(s,t)
db=[]
for route in known:
 a=rows[route]; assert a['candidateCentresWithin250M']==0 and a['landSamplesOnCourse']==19
 lon,lat=a['scoutAnchor']['wgs84'];cx,cy,_=xy.TransformPoint(lon,lat)
 col=math.floor(cx-grid[0])-roi//2;row=math.floor(grid[3]-cy)-roi//2
 assert col>=0 and row>=0 and col+roi<=d.RasterXSize and row+roi<=d.RasterYSize
 vals=bd.ReadAsArray(col,row,roi,roi,buf_xsize=roi,buf_ysize=roi)
 assert vals.dtype==np.float32 and vals.shape==(roi,roi)
 assert np.isfinite(vals).all() and (vals>-30000).all()
 cm=np.rint(vals.astype('float64')*100)
 assert np.max(abs(cm))<=32767
 raw=cm.astype('<i2').tobytes(); gz=gzip.compress(raw,compresslevel=9,mtime=0)
 err=float(np.max(abs(vals-cm*.01)))
 assert err<=.005001
 file=route+'.cm.i16.gz';(p/file).write_bytes(gz)
 stats={'route':route,'reportedAnchor':a['scoutAnchor'],'sourcePixelOffset':[col,row],
  'geoTransform':[grid[0]+col,1,0,grid[3]-row,0,-1],
  'elevationMetres':[float(vals.min()),float(vals.max())],'quantizedMaximumErrorM':err,
  'exactNativeFloat32LESha256':sha(vals.astype('<f4').tobytes()),'publishedInt16Sha256':sha(raw),
  'file':file,'compressedSHA256':sha(gz),'validSamples':int(vals.size)}
 db.append(stats);print(json.dumps(stats),flush=True)
summary={'scope':'Three 320 by 320 m exploratory bare-earth windows in exact source registration. Not a world install, foundation, current condition or calibration check.',
 'source':{'publisher':'Natural Resources Canada', 'asset':src,'etag':etag,'header4096SHA256':h4096,
   'licence':'https://open.canada.ca/en/open-government-licence-canada',
   'verticalReferenceDocumentation':'https://download-telecharger.services.geo.ca/pub/elevation/dem_mne/HRDEMmosaic_mosaiqueMNEHR/HRDEM_Mosaic_Product_Specification.pdf'},
 'embeddedVerticalCRS':None,
 'registration':'EPSG:3979 horizontal and EPSG:6647 vertical (CGVD2013), EPSG:4326 lon/lat for scout anchors only; PixelIsArea',
 'width':roi,'height':roi,'encoding':'Row-major signed centimetre Int16 LE, gzip','windows':db}
(p/'intake.json').write_text(json.dumps(summary,indent=2)+'\n')
