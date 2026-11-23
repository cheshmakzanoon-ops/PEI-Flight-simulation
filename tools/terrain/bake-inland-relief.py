#!/usr/bin/python3
"""Bake aligned inland ground samples from small HRDEM COG windows."""
import argparse,gzip,hashlib,json,math,zlib
from pathlib import Path
from urllib.request import Request,urlopen
from osgeo import gdal
import numpy as np
gdal.UseExceptions()
gdal.SetConfigOption('GDAL_DISABLE_READDIR_ON_OPEN','EMPTY_DIR')
gdal.SetConfigOption('CPL_VSIL_CURL_ALLOWED_EXTENSIONS','.tif')
gdal.SetConfigOption('GDAL_HTTP_MULTIRANGE','YES')
gdal.SetConfigOption('GDAL_HTTP_TIMEOUT','50')
URL='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif'
ETAG='eb6a8f985dbf26b24d503d1502ce589b-2727'
SITES={'walls-road':(-63.62936,46.33953),'warburton-road':(-63.42687,46.372505),
       'new-harmony-road':(-62.21987,46.390265)}
R=math.pi/180;ECE=.00669437999014;P=46.5*R;C=1-ECE*math.sin(P)**2
MX=6378137*R*math.cos(P)/math.sqrt(C);MZ=6378137*(1-ECE)*R/C**1.5
COLS=32;ROWS=22;LOD=112;SUB=7;N=20
def interp(a,x,y,omit=False):
    i=np.minimum(a.shape[1]-2,np.floor(x).astype(int));j=np.minimum(a.shape[0]-2,np.floor(y).astype(int))
    u=x-i;v=y-j;vals=[a[j,i],a[j,i+1],a[j+1,i],a[j+1,i+1]]
    if omit:
        w=[(1-u)*(1-v),u*(1-v),(1-u)*v,u*v]
        good=[b>-32768 for b in vals];den=sum(a*b for a,b in zip(good,w))
        return np.maximum(0,np.divide(sum(z*g*k for z,g,k in zip(vals,good,w)),den,where=den>0,out=np.zeros_like(den)))
    return (1-v)*((1-u)*vals[0]+u*vals[1])+v*((1-u)*vals[2]+u*vals[3])
def sha(v):return hashlib.sha256(v).hexdigest()
def make(out,root,generated=None):
    t=json.loads((root/'terrain.json').read_text());c=json.loads((root/'cover.json').read_text())
    base=gzip.decompress((root/t['file']).read_bytes());assert sha(base)==t['sha256']
    cover=(root/c['file']).read_bytes();assert sha(cover)==c['compressedSha256']
    base=np.frombuffer(base,'<i2').reshape(t['height'],t['width'])
    land=np.frombuffer(gzip.decompress(cover),'uint8').reshape(c['height'],c['width'],2)[:,:,1]
    l,b,r,q=t['bounds']
    w=(r-l)/COLS;d=(q-b)/ROWS;a=w/LOD;e=d/LOD
    stepX=a/SUB;stepZ=e/SUB
    out.mkdir(parents=True,exist_ok=True)
    with urlopen(Request(URL,headers={'Range':'bytes=0-15'}),timeout=30) as res:
        assert res.status==206 and res.headers['ETag'].strip('"')==ETAG
        assert len(res.read(17))==16
    ds=gdal.Open('/vsicurl/'+URL)
    sites=[];metadata={}
    used=set()
    for site,(lon,lat) in SITES.items():
        i=math.floor((lon-l)/w);j=math.floor((q-lat)/d)
        u0=min(LOD-N-3,max(3,round((lon-l-i*w)/a)-N//2))
        v0=min(LOD-N-3,max(3,round((q-lat-j*d)/e)-N//2))
        assert (i,j) not in used;used.add((i,j))
        x=l+i*w+u0*a;z=q-j*d-v0*e
        n=N*SUB+1
        outputBounds=[x-stepX/2,z-(n-.5)*stepZ,x+(n-.5)*stepX,z+stepZ/2]
        native=gdal.Warp('',ds,format='MEM',dstSRS='EPSG:4326',outputBounds=outputBounds,
         width=n,height=n,srcNodata=-32767,dstNodata=-32767,resampleAlg='bilinear',
         errorThreshold=0,overviewLevel=2,outputType=gdal.GDT_Float32).ReadAsArray().astype(np.float64)
        cx=x+np.arange(N+1)*a;cz=z-np.arange(N+1)*e
        old=interp(base,np.clip((cx-l)/(r-l)*base.shape[1]-.5,0,base.shape[1]-1)[None,:],
            np.clip((q-cz)/(q-b)*base.shape[0]-.5,0,base.shape[0]-1)[:,None],omit=True)
        k=np.arange(n)/SUB;ii=np.minimum(N-1,k.astype(int));s=(k-ii)[None,:];v=(k-ii)[:,None]
        ya=old[ii[:,None],ii[None,:]];yb=old[ii[:,None],(ii+1)[None,:]]
        yc=old[(ii+1)[:,None],ii[None,:]];yd=old[(ii+1)[:,None],(ii+1)[None,:]]
        old=np.where(s+v<=1,ya+(yb-ya)*s+(yc-ya)*v,yd+(yc-yd)*(1-s)+(yb-yd)*(1-v))
        xy=x+np.arange(n)*stepX;zz=z-np.arange(n)*stepZ
        shore=(interp(land,(xy-l)/(r-l)*land.shape[1]*np.ones((1,n))-.5,
             (q-zz)[:,None]/(q-b)*land.shape[0]-.5)-128.)*2.
        inside=np.minimum(clamp_dist(n)[:,None],clamp_dist(n)[None,:])
        taper=np.clip(inside/(2*SUB),0.,1.)*np.clip((shore-52)/66,0,1)
        taper=taper*taper*(3-2*taper)
        taper[native<-30000]=0
        values=old+(native-old)*taper
        raw=np.round(values*100).astype('<i2').tobytes();zipped=gzip.compress(raw,compresslevel=9,mtime=0)
        (out/(site+'.i16.gz')).write_bytes(zipped)
        s=dict(id=site,tileX=i,tileZ=j,firstX=u0,firstZ=v0,cellsX=N,cellsZ=N,sub=SUB,
            decodedBytes=len(raw),bytes=len(zipped),crc32=f'{zlib.crc32(raw):08x}',kind='inland',sha256=sha(raw),compressedSha256=sha(zipped))
        sites.append(s)
        core=np.abs(values-old)[taper>=.99]
        metadata[site]=dict(center=[lon,lat],spacingM=[stepX*MX,stepZ*MZ],supportFullyMeasured=int(core.size),
            minimumCoreShoreSeparationM=float(shore[taper>=.99].min()),verticalDifferenceP50P95Max=np.quantile(core,[.5,.95,1]).tolist(),
            sourceNodesSHA256=sha(native.astype('<f4').tobytes()),wgsSourceBounds=outputBounds,**s)
    out.joinpath('index.json').write_text(json.dumps(dict(terrain=m(t),cover=c['compressedSha256'],
       source=URL,sourceETag=ETAG,attribution='Open Government Licence – Canada',sites=metadata),indent=2)+'\n')
    if generated:
        keys='id tileX tileZ firstX firstZ cellsX cellsZ sub sha256 compressedSha256 decodedBytes crc32 kind'.split()
        line=[{k:site[k] for k in keys}for site in sites]
        generated.write_text('// Generated from verified native HRDEM survey samples.\n'+
          'export const INLAND_TERRAIN_SHA='+repr(t['sha256'])+';\n'+
          'export const INLAND_COVER_SHA='+repr(c['compressedSha256'])+';\n'+
          'export const INLAND_SPECS='+json.dumps(line,separators=(',',':'))+' as const;\n')
    print(json.dumps(sites,indent=2))
def clamp_dist(n):
    p=np.arange(n);return np.minimum(p,p[::-1])
def m(t):return t['sha256']
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',required=True,type=Path);p.add_argument('--world',required=True,type=Path);p.add_argument('--generated',type=Path)
    a=p.parse_args();make(a.out,a.world,a.generated)
