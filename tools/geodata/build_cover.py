#!/usr/bin/env python3
"""Build PEI's land-class + signed-coast texture. Requires Python/GDAL, SciPy, NumPy.
Use already downloaded official source files. Does not write outside the destination.
Usage: build_cover.py N45W066.tif N45W063.tif statcan.geojson public/world/
"""
import sys, hashlib, gzip, json
from pathlib import Path
import numpy as np
from osgeo import gdal, ogr, osr
from scipy.ndimage import distance_transform_edt
gdal.UseExceptions()
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def build(west,east,shore,out):
    out=Path(out);out.mkdir(exist_ok=True,parents=True);W,S,E,N=-64.47,45.94,-61.93,47.10
    nx,ny=4096,2720
    opt=gdal.WarpOptions(format='MEM',dstSRS="EPSG:4326",outputBounds=(W,S,E,N),width=nx,height=ny,
                        resampleAlg="near",outputType=gdal.GDT_Byte,dstNodata=0)
    cats=gdal.Warp('',[str(west),str(east)],options=opt).ReadAsArray()
    k=2;m=gdal.GetDriverByName('MEM').Create('',nx*k,ny*k,1,gdal.GDT_Byte)
    m.SetGeoTransform((W,(E-W)/(nx*k),0,N,0,-(N-S)/(ny*k)));srs=osr.SpatialReference();srs.ImportFromEPSG(4326);m.SetProjection(srs.ExportToWkt())
    src=ogr.Open(str(shore));gdal.RasterizeLayer(m,[1],src.GetLayer(0),burn_values=[1])
    land=m.ReadAsArray().astype(bool);signed=np.empty((ny,nx),dtype=np.uint8)
    # Distances use physical local cell dimensions. Work in overlapping strips, saturating 254 m from coast.
    dx=(E-W)*76815/(k*nx);dy=(N-S)*111153/(k*ny);halo=20
    for y in range(0,ny,96):
        y2=min(ny,y+96);lo=max(0,y*k-halo);hi=min(ny*k,y2*k+halo)
        p=land[lo:hi];high=np.empty(p.shape,dtype=np.float32)
        if p.all(): high.fill(254)
        elif not p.any(): high.fill(-254)
        else:
            inside=distance_transform_edt(p,sampling=(dy,dx));outside=distance_transform_edt(~p,sampling=(dy,dx))
            high=(inside-outside).astype(np.float32)
            high-=np.sign(high)*min(dx,dy)*.5
        band=high[y*k-lo:y2*k-lo].reshape(y2-y,k,nx,k).mean(axis=(1,3))
        signed[y:y2]=np.rint(np.clip(128.+band/2,1,255)).astype('u1')
    cats[signed<128]=0
    packed=np.stack((cats,signed),axis=-1).astype('u1').tobytes();target=out/'cover.bin.gz';target.write_bytes(gzip.compress(packed,compresslevel=9,mtime=0))
    mm={'width':nx,'height':ny,'bounds':[W,S,E,N],'encoding':'Interleaved Uint8 RG. R = ESA WorldCover class (2021), G = approximate signed coast distance in 2 m units, biased by 128; positive is land. North row first.','treeClass':10,
        'nominalPixelMetres':47,'file':target.name,'compressedSha256':sha(target),'sourceSurveyYear':2021,'woodlandPixels':int(np.count_nonzero(cats==10)),
        'attribution':'© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. Shoreline: Statistics Canada, 2021 Census Cartographic Boundary Files, used under the Open Government Licence – Canada.',
        'worldCoverLicense':'https://creativecommons.org/licenses/by/4.0/','worldCoverCitation':'Zanaga et al. (2022), ESA WorldCover 10 m 2021 v200, https://doi.org/10.5281/zenodo.7254221',
        'sources':[{'url':f'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{t}_Map.tif','sha256':sha(p)} for t,p in [('N45W066',west),('N45W063',east)]],
        'shorelineSourceSha256':sha(shore),'limitations':'Source land cover is 10 m classification. Bundled classes have been resampled to ~47 m. Canopy positions, species mix and field microtextures are synthesized, not a tree survey; tide is not simulated.'}
    (out/'cover.json').write_text(json.dumps(mm,indent=2,ensure_ascii=False)+'\n');print(mm['woodlandPixels'],target.stat().st_size)
if __name__=='__main__':build(*sys.argv[1:])
