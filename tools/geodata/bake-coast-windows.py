#!/usr/bin/env python3
"""Read two native-resolution NRCan bare-earth DTM windows, never the full regional GeoTIFF."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import urllib.request

import numpy as np
from osgeo import gdal, osr

COG = 'https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif'
ETAG = 'eb6a8f985dbf26b24d503d1502ce589b-2727'
CAT = 'https://datacube.services.geo.ca/pgstac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m'
OPEN = 'https://open.canada.ca/en/open-government-licence-canada'
SPEC = 'https://download-telecharger.services.geo.ca/pub/elevation/dem_mne/HRDEMmosaic_mosaiqueMNEHR/HRDEM_Mosaic_Product_Specification.pdf'
SIZE = 256
NODATA = -32768
# Fixed native offsets make future bakes insensitive to local PROJ grid changes.
# WGS84 points are approximate station references, not newly surveyed control.
SITES = (
    ('east-point', 'East Point Light Station, Kings County', -61.9718333333, 46.4525277778, 450738, 133572),
    ('west-point', 'West Point Light Station, Prince County', -64.38675, 46.6203055556, 277491, 206809),
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def compressed(data):
    out = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=out, mtime=0, compresslevel=9) as stream:
        stream.write(data)
    return out.getvalue()


def generate(dest):
    gdal.UseExceptions()
    # No directory listing or fallback to downloading the complete 731 GB object.
    head = urllib.request.Request(COG, method='HEAD')
    with urllib.request.urlopen(head, timeout=20) as response:
        if response.headers.get('ETag') != f'"{ETAG}"' or response.headers.get('Accept-Ranges') != 'bytes':
            raise ValueError('The official source changed or does not advertise byte ranges; review before updating.')
    for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif',
                'GDAL_HTTP_CONNECTTIMEOUT':'10','GDAL_HTTP_TIMEOUT':'30','GDAL_HTTP_MAX_RETRY':'1',
                'CPL_VSIL_CURL_CACHE_SIZE':'16777216','GDAL_HTTP_HEADERS':f'If-Match: "{ETAG}"'}.items():
        gdal.SetConfigOption(k,v)
    ds = gdal.Open('/vsicurl/'+COG)
    crs = ds.GetSpatialRef()
    if (crs.GetAuthorityCode(None)!='3979' or ds.GetGeoTransform() != (2000000.,1.,0.,500000.,0.,-1.)
            or ds.GetMetadataItem('AREA_OR_POINT')!='Area' or ds.RasterXSize!=500000 or ds.RasterYSize!=500000):
        raise ValueError('Unexpected source grid, georeferencing or axis order')
    band=ds.GetRasterBand(1)
    if band.DataType!=gdal.GDT_Float32 or band.GetNoDataValue()!=-32767:
        raise ValueError('Unexpected source type or NoData')
    geo=osr.SpatialReference();geo.ImportFromEPSG(4326)
    for sr in (geo,crs):sr.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    project=osr.CoordinateTransformation(geo,crs)
    manifest={
      'schema':1,'purpose':'Offline elevation review only; source coverage is not a shoreline.',
      'source':{'publisher':'Natural Resources Canada, CanElevation','product':'HRDEM Mosaic 1 m DTM',
                'stacItem':CAT,'asset':COG,'etag':ETAG,'specification':SPEC,
                'attribution':'Contains information licensed under the Open Government Licence – Canada.',
                'licence':OPEN,'sourceNoData':-32767},
      'grid':{'horizontalCRS':'EPSG:3979','verticalCRS':'EPSG:6647','verticalDatum':'CGVD2013',
              'pixelRegistration':'PixelIsArea, sample at cell centre','metresPerPixel':[1,-1],
              'encoding':'int16 little-endian, row-major, gzip','heightScaleMetres':.01,'noData':NODATA},
      'windows':[],
    }
    dest.mkdir(parents=True,exist_ok=True)
    for id,name,lon,lat,col,row in SITES:
        x,y,_=project.TransformPoint(lon,lat)
        west,north=2000000+col,500000-row
        # Allow differences across approved coordinate transforms, but catch flipped axes or wrong tiles.
        if abs(x-(west+128.5))>3 or abs(y-(north-128.5))>3:raise ValueError('Anchor outside expected pixel neighborhood')
        a=band.ReadAsArray(col,row,SIZE,SIZE)  # equal buffer dimensions; no warping or overview
        valid=np.isfinite(a)&(a!=band.GetNoDataValue())
        if not valid.any():raise ValueError('No observed data')
        vals=np.rint(a[valid].astype(np.float64)*100)
        if vals.min()<=NODATA or vals.max()>32767:raise ValueError('Signed-centimetre sample exceeds storage range')
        packed=np.full((SIZE,SIZE),NODATA,dtype='<i2');packed[valid]=vals.astype('<i2')
        data=packed.tobytes();gz=compressed(data);file=id+'.cm.i16.gz'
        (dest/file).write_bytes(gz)
        w={
          'id':id,'name':name,'file':file,'cols':SIZE,'rows':SIZE,
          'sourcePixelOffset':[col,row],'upperLeftOuterEdgeM':[west,north],
          'referenceLonLat':[lon,lat],'referenceCell':[128,128],
          'validCells':int(valid.sum()),'noDataCells':int(packed.size-valid.sum()),
          'rangeCm':[int(packed[valid].min()),int(packed[valid].max())],
          'referenceHeightCm':int(packed[128,128]),'bytesDecoded':len(data),
          'sha256Decoded':sha(data),'sha256SourceFloat32LE':sha(a.astype('<f4').tobytes()),
        }
        manifest['windows'].append(w)
        print(f"{id}: {w['validCells']}/{packed.size} valid; {len(gz)} compressed bytes; {w['sha256Decoded']}")
    (dest/'index.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[2]/'data/coastal-elevation')
    generate(p.parse_args().out)
