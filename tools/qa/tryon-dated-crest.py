#!/usr/bin/env python3
"""Compare the named 2020 public Cape Tryon heights with actual stock ground.

Read one bounded EPSG:3979 chip. Outputs are summaries, never raster files.
Neither high ground nor no-data supplies a present-day coast/material survey.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from osgeo import gdal, osr
from pyproj import Transformer

DTM = 'https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-lidar/PEI-Prince_Edward_Island_2020-1m-dtm.tif'
ETAG = '9e5249deef1137ddcce504d6f4bca1a9-131'
GRID = (2261621., 1., 0., 371370., 0., -1.)
CHIP = (80509, 54659, 516, 448)
CHIP_SHA = 'e25dd8e9ce83d801828c560d71804903069b2071088c11381d35c7d6bcd191c2'
BASE = {
    'terrain': '661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
    'cover': 'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
}


def read_dated_chip():
    gdal.UseExceptions()
    settings = {
        'GDAL_DISABLE_READDIR_ON_OPEN': 'EMPTY_DIR',
        'CPL_VSIL_CURL_ALLOWED_EXTENSIONS': '.tif',
        'GDAL_HTTP_TIMEOUT': '16',
        'GDAL_HTTP_MAX_RETRY': '1',
        'GDAL_HTTP_HEADERS': 'If-Match: "' + ETAG + '"',
    }
    for k, v in settings.items():
        gdal.SetConfigOption(k, v)
    ds = gdal.OpenEx('/vsicurl/' + DTM, gdal.OF_RASTER | gdal.OF_READONLY)
    projected = osr.SpatialReference()
    projected.ImportFromEPSG(3979)
    if ds.GetGeoTransform() != GRID or not ds.GetSpatialRef().IsSame(projected) or ds.RasterCount != 1:
        raise ValueError('Source identity or the native height grid changed')
    band = ds.GetRasterBand(1)
    if band.DataType != gdal.GDT_Float32 or band.GetNoDataValue() != -32767:
        raise ValueError('Wrong native source format')
    out = band.ReadAsArray(*CHIP).astype('<f4')
    if out.shape != (CHIP[3], CHIP[2]) or hashlib.sha256(out.tobytes()).hexdigest() != CHIP_SHA:
        raise ValueError('Unrecognized bounded source chip')
    return out


def smoothstep(low, high, value):
    t = np.clip((value-low)/(high-low), 0, 1)
    return t*t*(3-2*t)


def audit(stock, raw):
    if stock['pins'] != BASE:
        raise ValueError('Baseline cover or height pack changed')
    site = stock['bySite']['cape-tryon']
    a = np.array(site['samples'])
    if a.shape != (47586,10) or not np.isfinite(a).all() or site['owner'] != '12-10' or site['maxRay'] > .0001:
        raise ValueError('Expect the same exact N112 Cape Tryon audit grid and valid rays')
    x,z,y,_physical,coast,land,lon,lat,ix,iz = a.T
    X,Y = Transformer.from_crs(4326,3979,always_xy=True).transform(lon,lat)
    qx,qy = X-(GRID[0]+CHIP[0])-.5,(GRID[3]-CHIP[1])-Y-.5
    u,v = np.floor(qx).astype(int),np.floor(qy).astype(int)
    bounds = (u>=0)&(u+1<raw.shape[1])&(v>=0)&(v+1<raw.shape[0])
    u = np.clip(u,0,raw.shape[1]-2)
    v = np.clip(v,0,raw.shape[0]-2)
    corners = np.array([raw[v+j,u+i] for i,j in [(0,0),(1,0),(0,1),(1,1)]])
    support = bounds & np.all(np.isfinite(corners)&(corners!=-32767),axis=0)
    f,g = qx-u,qy-v
    h = corners[0]*(1-f)*(1-g)+corners[1]*f*(1-g)+corners[2]*(1-f)*g+corners[3]*f*g
    stockBeach = (1-smoothstep(4,25,coast))*(1-smoothstep(4,14,y))*.79
    dry = (land>0)&(coast>=0)&support
    qualified = dry&(corners.min(axis=0)>=16)&(stockBeach>.12)&(ix==12)&(iz==10)
    if not np.any(qualified):
        raise ValueError('No supported stock beach contradiction')
    rounded=lambda rows:[round(float(v),6) for v in rows]
    prof=lambda data:rounded(np.percentile(data[qualified],[0,10,50,90,100]))
    return dict(
        nativeSource='PEI-Prince_Edward_Island_2020-1m, 2020-09-15 nominal project date; CGVD2013',
        chipXYWH=CHIP,chipSHA256=CHIP_SHA,sourceETag=ETAG,stockPins=BASE,
        stockGeometryRayChecks=site['rayChecks'],stockVisualMaxRayM=site['maxRay'],
        sampled=int(len(x)),nativeSupportsAllFour=int(support.sum()),dryOverlap=int(dry.sum()),
        source16mOrHigherButStockWet=int((support&(h>=16)&(coast<0)).sum()),
        sourceHighAndStockBeachWeightOver12Percent=int(qualified.sum()),
        sameButStockBeachWeightOver25Percent=int((qualified&(stockBeach>.25)).sum()),
        boundsXZ=rounded([x[qualified].min(),z[qualified].min(),x[qualified].max(),z[qualified].max()]),
        profilePercentiles=[0,10,50,90,100],stockHeightM=prof(y),nativeHeightM=prof(h),
        nativeMinusStockM=prof(h-y),
        scope='Dated source ground versus current rendered ground and inferred beach blend; not present shoreline or material class.'
    )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--stock',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    a = p.parse_args()
    out = audit(json.loads(a.stock.read_text()),read_dated_chip())
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(out,indent=2)+'\n')


if __name__ == '__main__':
    main()
