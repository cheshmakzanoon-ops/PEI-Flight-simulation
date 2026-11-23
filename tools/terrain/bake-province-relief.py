#!/usr/bin/python3
"""Read a pinned 16 m COG overview for the complete PEI atlas without fetching the native file."""
import argparse,gzip,hashlib,json,math
from pathlib import Path
from urllib.request import Request,urlopen
import numpy as np
from osgeo import gdal
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif',
    'GDAL_HTTP_TIMEOUT':'45','GDAL_HTTP_MAX_RETRY':'2','GDAL_HTTP_MULTIRANGE':'YES',
    'CPL_VSIL_CURL_CHUNK_SIZE':'65536','CPL_VSIL_CURL_CACHE_SIZE':'33554432'}.items():gdal.SetConfigOption(k,v)
gdal.SetCacheMax(128*1024*1024)
COLS,ROWS,N=32,22,384
SOURCE='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif'
ETAG='eb6a8f985dbf26b24d503d1502ce589b-2727'
NODATA=-32767
def hash(v):return hashlib.sha256(v).hexdigest()

def verified_range():
    req=Request(SOURCE,headers={'Range':'bytes=0-15'})
    with urlopen(req,timeout=30) as res:
        assert res.status==206 and res.headers['Content-Range']=='bytes 0-15/731762494131',res.headers
        assert res.headers['ETag'].strip('"')==ETAG
        assert len(res.read(17))==16
def bake(world,out):
    m=json.loads((world/'terrain.json').read_text());w,s,e,n=m['bounds']
    raw=gzip.decompress((world/m['file']).read_bytes());assert hash(raw)==m['sha256']
    t=np.frombuffer(raw,'<i2').reshape(m['height'],m['width'])
    out.mkdir(parents=True,exist_ok=True)
    gpath=out/'overview-window.tif'
    nx,nz=COLS*N,ROWS*N
    dx=(e-w)/nx;dz=(n-s)/nz
    if not gpath.exists():
        verified_range()
        src=gdal.Open('/vsicurl/'+SOURCE)
        assert src.GetRasterBand(1).GetOverview(3).XSize==31250
        print('Reading only the intersecting 16 m blocks of the pinned official COG',flush=True)
        ds=gdal.Warp(str(gpath),src,format='GTiff',dstSRS='EPSG:4326',
          outputBounds=[w-dx/2,s-dz/2,e+dx/2,n+dz/2],width=nx+1,height=nz+1,
          srcNodata=NODATA,dstNodata=NODATA,resampleAlg='bilinear',errorThreshold=0,overviewLevel=3,
          outputType=gdal.GDT_Float32,creationOptions=['TILED=YES','COMPRESS=DEFLATE','PREDICTOR=3'])
        ds=None
    ds=gdal.Open(str(gpath))
    assert (ds.RasterXSize,ds.RasterYSize)==(nx+1,nz+1)
    plans=[]; packs=[];pack=bytearray();missing=0;land=0
    def flush():
        if not pack:return
        file='relief-%02d.pack'%len(packs);(out/file).write_bytes(pack)
        packs.append(dict(file=file,bytes=len(pack),sha256=hash(pack)));pack.clear()
    for j in range(ROWS):
        for i in range(COLS):
            j0=math.floor(j*t.shape[0]/ROWS);j1=math.ceil((j+1)*t.shape[0]/ROWS)
            i0=math.floor(i*t.shape[1]/COLS);i1=math.ceil((i+1)*t.shape[1]/COLS)
            if not np.any(t[j0:j1,i0:i1]!=-32768):continue
            val=ds.ReadAsArray(i*N,j*N,N+1,N+1)
            q=np.where(val<=NODATA+.1,-32768,np.clip(np.rint(val*10),-32767,32767)).astype('<i2')
            # Unique land-support estimate for internal positions only (the frames overlap only along node edges).
            vx=(i*N+np.arange(N))*t.shape[1]/nx
            vz=(j*N+np.arange(N))*t.shape[0]/nz
            prev=t[vz.astype(int)[:,None],vx.astype(int)[None,:]]!=-32768
            nold=int(np.count_nonzero(prev));land+=nold
            fail=int(np.count_nonzero((q[:-1,:-1]==-32768)&prev));missing+=fail
            rem=np.diff(q,axis=1,prepend=np.zeros((N+1,1),dtype=np.int16)).astype('<i2')
            decoded=rem.tobytes();z=gzip.compress(decoded,compresslevel=7,mtime=0)
            if len(pack)+len(z)>550000:flush()
            plans.append(dict(id=f'{i}-{j}',pack=len(packs),offset=len(pack),bytes=len(z),decodedBytes=len(decoded),
                              sha256=hash(decoded),heightSha256=hash(q.tobytes()),landNodesInBaseline=nold,missingSourceNodes=fail))
            pack+=z
        print('row',j,'tiles',len(plans),'bytes so far',sum(p['bytes'] for p in packs)+len(pack),flush=True)
    flush()
    origin=math.radians(46.5);a=6378137.;e2=6.69437999014e-3;k=1-e2*math.sin(origin)**2
    spacing=[dx*a*math.pi/180*math.cos(origin)/math.sqrt(k),dz*a*(1-e2)*math.pi/180/k**1.5]
    result=dict(version=1,encoding='north-first int16 row-delta, cumulative modulo 65536, decimetres; -32768 NoData',bounds=m['bounds'],
       cols=COLS,rows=ROWS,intervals=N,originalTerrainSHA256=m['sha256'],source=SOURCE,sourceETag=ETAG,nativeOverviewMetres=16,
       projectedSpacingMetres=spacing,landNodesInBaseline=land,missingSourceNodes=missing,
       bytes=sum(p['bytes']for p in packs),packs=packs,tiles=plans)
    (out/'index.json').write_text(json.dumps(result,indent=2)+'\n')
    print('TOTAL',len(plans),len(packs),result['bytes'],land,missing,flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--world',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
    a=p.parse_args();bake(a.world,a.out)
