#!/usr/bin/env python3
"""Rebuild the shipped PEI land/DTM raster from first-party open data (GDAL 3.10+, NumPy).
Debian/Ubuntu: /usr/bin/python3 tools/geodata/build_terrain.py --out public/world
Only the COG overviews needed for PEI are requested; never fetch the full remote TIFF.
"""
import argparse, gzip, hashlib, json, shutil, subprocess, tempfile, urllib.request
from pathlib import Path
import numpy as np
from osgeo import gdal

BOUNDARY="https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/0/query?where=PRUID%3D%2711%27&outFields=PRUID&returnGeometry=true&outSR=4326&geometryPrecision=5&f=geojson"
COG="https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif"
STAC="https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m"
COG_ETAG='"eb6a8f985dbf26b24d503d1502ce589b-2727"'
VECTOR_SHA="b13b932509ccb4828eba54ed2753e3ad487d10c4ac9dd54f6ff188f0edfc1510"
BOUNDS=[-64.47,45.94,-61.93,47.10]; WIDTH=4096; HEIGHT=2720; WATER=-32768
COMMON=["-te",*map(str,BOUNDS),"-ts",str(WIDTH),str(HEIGHT)]
def write(mask,dtm,out):
    gdal.UseExceptions()
    land=gdal.Open(str(mask)).ReadAsArray().astype(bool)
    elev=gdal.Open(str(dtm)).ReadAsArray()
    valid=np.isfinite(elev)&(elev!=WATER)&land
    if elev.shape!=(HEIGHT,WIDTH) or valid.sum()<.995*land.sum() or not 2400000<land.sum()<2800000:
        raise ValueError("Unexpected coverage or dimensions")
    if elev[valid].min()<-10 or not 130<elev[valid].max()<155:
        raise ValueError("Unexpected PEI terrain relief")
    height=np.full(elev.shape, WATER, dtype="<i2")
    height[land]=0  # Land in the cartographic mask with no LiDAR observation (near shore).
    height[valid]=np.rint(elev[valid]).astype("<i2")
    out.mkdir(parents=True,exist_ok=True); data=height.tobytes()
    (out/"height.bin.gz").write_bytes(gzip.compress(data,compresslevel=9,mtime=0))
    meta={"width":WIDTH,"height":HEIGHT,"bounds":BOUNDS,"crs":"EPSG:4326","rasterRegistration":"pixel-area; bounds are outer pixel edges; row 0 north, column 0 west","verticalDatum":"CGVD2013","unit":"metre","encoding":"Int16LE","water":WATER,"file":"height.bin.gz","compression":"gzip","sha256RefersTo":"uncompressed Int16LE samples","sha256":hashlib.sha256(data).hexdigest(),"landCells":int(land.sum()),"measuredLandCells":int(valid.sum()),"unobservedLandFilledAtSeaLevel":int((land&~valid).sum()),"minimumMeasuredMetres":float(elev[valid].min()),"maximumMeasuredMetres":float(elev[valid].max()),"license":"Open Government Licence – Canada 2.0","licenseUrl":"https://open.canada.ca/en/open-government-licence-canada","attribution":"Contains information licensed under the Open Government Licence – Canada. Terrain: Natural Resources Canada, CanElevation HRDEM Mosaic. Land mask: Statistics Canada, 2021 Census Cartographic Boundary Files; adapted by this project.","sources":[{"agency":"Natural Resources Canada","product":"HRDEM Mosaic 1 m airborne LiDAR bare-earth DTM","stac":STAC,"asset":COG,"etag":COG_ETAG.strip('"'),"resampling":"32 m overview; bilinear warp; rounded to metres; output spacing ~47 m in PEI, not 1 m terrain in-game"},{"agency":"Statistics Canada","product":"2021 Census Cartographic Boundary Files, Province PRUID 11","asset":BOUNDARY,"sha256":VECTOR_SHA,"processing":"Rasterized by cell centres with islands and polygon holes. Features smaller than output pixels may disappear."}]}
    (out/"terrain.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"{meta['landCells']} land cells, {meta['measuredLandCells']} measured; {meta['sha256']}")
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--out",type=Path,default=Path("public/world"));args=p.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        d=Path(temp); co=d/"pei.geojson"; mask=d/"mask.tif"; dtm=d/"dtm.tif"
        with urllib.request.urlopen(BOUNDARY,timeout=65) as r: co.write_bytes(r.read())
        if hashlib.sha256(co.read_bytes()).hexdigest()!=VECTOR_SHA: raise ValueError("Shoreline input changed: review and deliberately update hash before rebuilding")
        with urllib.request.urlopen(urllib.request.Request(COG,method="HEAD"),timeout=45) as r: etag=r.getheader("ETag")
        if etag!=COG_ETAG: raise ValueError("DEM upstream version changed: review and update ETag before rebuilding")
        subprocess.run(["gdal_rasterize","-q","-burn","1","-init","0","-ot","Byte",*COMMON,"-a_srs","EPSG:4326",str(co),str(mask)],check=True)
        subprocess.run(["gdalwarp","--config","GDAL_DISABLE_READDIR_ON_OPEN","EMPTY_DIR","--config","GDAL_HTTP_TIMEOUT","90","--config","GDAL_INGESTED_BYTES_AT_OPEN","131072","--config","GDAL_HTTP_MULTIRANGE","YES","-q","-ovr","4","-r","bilinear","-wm","256","-t_srs","EPSG:4326",*COMMON,"-dstnodata",str(WATER),"-ot","Float32","-co","TILED=YES","-co","COMPRESS=DEFLATE","/vsicurl/"+COG,str(dtm)],check=True)
        write(mask,dtm,args.out)
if __name__=="__main__":main()
