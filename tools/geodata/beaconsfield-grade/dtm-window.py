"""Native 1m *bare-earth* CanElevation. One fixed local read, no resampling and no DSM/roof data."""
from pathlib import Path
import argparse, hashlib, json, math, urllib.request, numpy as np
from osgeo import gdal,osr
gdal.UseExceptions();osr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__);p.add_argument('stock',type=Path);p.add_argument('out',type=Path);p.add_argument('--acquire',action='store_true');a=p.parse_args()
m=json.loads((a.stock/'stock-world.json').read_text());f=m['frame'];ox,oz=f['originXZ'];origin=f['geoOrigin'];sx,sz=f['scales']
def crs(e):
 q=osr.SpatialReference();q.ImportFromEPSG(e);q.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return q
tr=osr.CoordinateTransformation(crs(4326),crs(3979));defxy=lambda x,z:tr.TransformPoint(origin['lon']+x/sx,origin['lat']+z/sz)[:2]
corn=np.array([defxy(ox+x,oz+z) for x in [-46,46] for z in [-48,48]])
w,s=np.floor(corn.min(0)-3).astype(int);e,n=np.ceil(corn.max(0)+3).astype(int); cols=int(e-w);rows=int(n-s);assert 75<rows<152 and 75<cols<152
url='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif';etag='eb6a8f985dbf26b24d503d1502ce589b-2727';a.out.mkdir(parents=True,exist_ok=True)
aoi={'url':url,'etag':etag,'horizontalEPSG':3979,'verticalDatum':'CGVD2013','officialPublicCatalogue':'https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m','sourceGeotransform':[2000000,1,0,500000,0,-1],'sourceDimensions':[500000,500000],'originWestNorth':[int(w),int(n)],'dimensionsColsRows':[cols,rows],'windowColRow':[int(w)-2000000,500000-int(n)],'use':'One native-resolution DTM crop in a verified public museum precinct, no native elevations or downloads elsewhere.'}
pin='5c9104c2a6efc6e248fe398c207e236879ed151752aa06055fad91a3c2f70384'
assert aoi['originWestNorth']==[2383994,300571] and aoi['windowColRow']==[383994,199429] and aoi['dimensionsColsRows']==[136,137]
if a.acquire:
 from urllib.request import Request,urlopen
 with urlopen(Request(url,method='HEAD'),timeout=25) as r:
  if r.headers['ETag']!='"'+etag+'"' or r.headers.get('Accept-Ranges')!='bytes':raise ValueError('Source is not the registered mosaic')
 for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif','GDAL_HTTP_MAX_RETRY':'1','GDAL_HTTP_TIMEOUT':'30','GDAL_INGESTED_BYTES_AT_OPEN':'8192','VSI_CACHE':'FALSE'}.items():gdal.SetConfigOption(k,v)
 ds=gdal.Open('/vsicurl/'+url); assert list(ds.GetGeoTransform())==aoi['sourceGeotransform'] and [ds.RasterXSize,ds.RasterYSize]==aoi['sourceDimensions'] and ds.GetSpatialRef().GetAuthorityCode('PROJCS')=='3979'
 band=ds.GetRasterBand(1);assert band.DataType==gdal.GDT_Float32; col,row=aoi['windowColRow']; ar=band.ReadAsArray(col,row,cols,rows);assert ar.shape==(rows,cols) and np.isfinite(ar).all() and (ar!=band.GetNoDataValue()).all();raw=ar.astype('<f4').tobytes();assert hashlib.sha256(raw).hexdigest()==pin;(a.out/'native-dtm.f32').write_bytes(raw);print('native bytes',len(raw))
raw=(a.out/'native-dtm.f32').read_bytes()
assert len(raw)==cols*rows*4 and hashlib.sha256(raw).hexdigest()==pin
aoi['sourceFloat32LESHA256']=pin
(a.out/'dtm-source.json').write_text(json.dumps(aoi,indent=2)+'\n');print(aoi)
