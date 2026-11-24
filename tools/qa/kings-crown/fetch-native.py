#!/usr/bin/env python3
"""Read the two bounded original NRCan 2020 HRDEM windows, not a WMS image."""
from pathlib import Path
from osgeo import gdal,osr
import numpy as np
import hashlib,json

gdal.UseExceptions()
for key,val in [('GDAL_DISABLE_READDIR_ON_OPEN','EMPTY_DIR'),('CPL_VSIL_CURL_ALLOWED_EXTENSIONS','.tif'),('GDAL_HTTP_TIMEOUT','15'),('GDAL_HTTP_CONNECTTIMEOUT','9')]:
    gdal.SetConfigOption(key,val)
base='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-'
urls=[base+kind+'.tif' for kind in ('dsm','dtm')]
ix,iy,W,H=135140,37202,350,350
expected='f87f494fb9865c1472493634e0c98c23e14e8390ad7fd629f3fb06ee3d5ae7a6'
ref=osr.SpatialReference();ref.ImportFromEPSG(3979)
ras=[];invalid=[]
for url in urls:
    ds=gdal.Open('/vsicurl/'+url)
    gt=ds.GetGeoTransform()
    assert ds.GetSpatialRef().IsSame(ref) and (gt[1],gt[2],gt[4],gt[5])==(1,0,0,-1)
    assert [gt[0]+ix,gt[3]-iy]==[2396761.0,334168.0]
    b=ds.GetRasterBand(1);ras.append(b.ReadAsArray(ix,iy,W,H));invalid.append(b.GetNoDataValue())
A=np.asarray(ras,'<f4');assert A.shape==(2,H,W) and hashlib.sha256(A.tobytes()).hexdigest()==expected
rec={'source':'PEI-Prince_Edward_Island_2020-1m','dataDate':'2020-09-15T12:00:00Z','urls':urls,
     'projectionEPSG':3979,'sampleSiteLonLat':[-62.78097303602431,46.437590751262626],
     'gameRole':'Source screen only; no shoreline, access, archaeological or current safety claim.',
     'crop':[ix,iy,W,H],'pixelEdges':[2396761.0,334168.0],'datum':'CGVD2013','nodata':invalid,'rawSha256':expected}
np.savez_compressed('dry-2112-native.npz',dsm=A[0],dtm=A[1]);Path('dry-2112-source.json').write_text(json.dumps(rec,indent=2)+'\n')
print(json.dumps(rec))
