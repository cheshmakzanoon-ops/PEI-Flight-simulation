#!/usr/bin/python3
"""Rank province relief tiles by measured elevation corrections with authoritative coast protection."""
import argparse,gzip,hashlib,json,math
from pathlib import Path
import numpy as np
from osgeo import gdal
from scipy.ndimage import minimum_filter
gdal.UseExceptions()
def atlas(source,fx,fz,missing=False):
    h,w=source.shape
    fx=np.clip(fx*w-.5,0,w-1);fz=np.clip(fz*h-.5,0,h-1)
    i=np.floor(fx).astype(int);j=np.floor(fz).astype(int)
    x,z=fx-i,fz-j;j1=np.minimum(j+1,h-1);i1=np.minimum(i+1,w-1)
    vals=(source[j,i],source[j,i1],source[j1,i],source[j1,i1])
    weights=((1-x)*(1-z),x*(1-z),(1-x)*z,x*z)
    if not missing:return sum(v*k for v,k in zip(vals,weights))
    denom=sum((v!=-32768)*k for v,k in zip(vals,weights))
    numer=sum(np.where(v!=-32768,v*k,0.) for v,k in zip(vals,weights))
    return np.maximum(0,np.divide(numer,denom,out=np.zeros_like(numer),where=denom!=0))
def facets(a,x,z):
    nz,nx=np.array(a.shape)-1
    x=np.clip(x*nx,0,nx);z=np.clip(z*nz,0,nz)
    i=np.minimum(nx-1,np.floor(x).astype(int));j=np.minimum(nz-1,np.floor(z).astype(int))
    u,v=x-i,z-j
    nw,ne,sw,se=a[j,i],a[j,i+1],a[j+1,i],a[j+1,i+1]
    return np.where(u+v<=1,nw+(ne-nw)*u+(sw-nw)*v,se+(sw-se)*(1-u)+(ne-se)*(1-v))
def read(world,name):
    m=json.loads((world/(name+'.json')).read_text());p=(world/m['file']).read_bytes()
    assert m.get('compressedSha256',hashlib.sha256(p).hexdigest())==hashlib.sha256(p).hexdigest()
    p=gzip.decompress(p)
    assert m.get('sha256',hashlib.sha256(p).hexdigest())==hashlib.sha256(p).hexdigest()
    d=(m['height'],m['width'])
    return m,np.frombuffer(p,'<i2').reshape(d) if name=='terrain' else np.frombuffer(p,'u1').reshape(*d,2)
def summarize(y):
    return [round(float(a),4) for a in [*np.quantile(y,[0,.01,.5,.9,.99,1.])]]
def study(world,path,out):
    tm,t=read(world,'terrain');cm,c=read(world,'cover');assert tm['bounds']==cm['bounds']
    plan=json.loads((path/'index.json').read_text())
    ds=gdal.Open(str(path/'overview-window.tif'))
    r,h,n=plan['rows'],plan['cols'],plan['intervals']
    co=2*(c[:,:,1].astype(float)-128)
    meta=[]
    nearX,nearZ=np.meshgrid(np.linspace(0,1,113),np.linspace(0,1,113))
    ctrlX,ctrlZ=np.meshgrid(np.arange(n+1)/n,np.arange(n+1)/n)
    # Count a survey node only when every 16 m immediate neighbor is measured.
    # This does not change the authoritative Cover even where LiDAR sees the floor.
    totals={'inland':0,'valid':0,'corrected1m':0,'corrected2m':0,'corrected5m':0,'built':0}
    for item in plan['tiles']:
        i,j=map(int,item['id'].split('-'))
        native=ds.ReadAsArray(i*n,j*n,n+1,n+1)
        old=facets(atlas(t,(i+nearX)/h,(j+nearZ)/r,True),ctrlX,ctrlZ)
        distance=atlas(co,(i+ctrlX)/h,(j+ctrlZ)/r)
        inland=distance>=132
        # No terrain contact promotion in dense areas until road/building route sync.
        # Counts use half-open tile widths/heights to avoid shared vertices.
        ok=inland&(minimum_filter(native,size=3)>-32766)
        mask=ok[:-1,:-1]
        yy=np.clip(((j+ctrlZ[:-1,:-1])/r*c.shape[0]).astype(int),0,c.shape[0]-1)
        xx=np.clip(((i+ctrlX[:-1,:-1])/h*c.shape[1]).astype(int),0,c.shape[1]-1)
        cls=c[yy,xx,0]
        d=(native-old)[:-1,:-1][mask];valid=int(mask.sum())
        if not valid:continue
        w,s,e,north=tm['bounds']
        records=dict(tile=item['id'],center=[round(w+(i+.5)/h*(e-w),5),round(north-(j+.5)/r*(north-s),5)],
          inland=int(inland[:-1,:-1].sum()),valid=valid,
          corrected1m=int((np.abs(d)>=1).sum()),corrected2m=int((np.abs(d)>=2).sum()),corrected5m=int((np.abs(d)>=5).sum()),
          built=int((mask&(cls==50)).sum()),signedMetres=summarize(d),absoluteMetres=summarize(np.abs(d)))
        for k in totals:totals[k]+=records[k]
        meta.append(records)
    out.write_text(json.dumps(dict(q=[0,.01,.5,.9,.99,1],source='16 m source overview, not independent ground survey',
        baseline='actual untampered 112x112 terrain facets (before site inserts)',
        inland='legacy signed Cover >=132m, every immediate survey neighbor exists, no overlap duplicated',
        tiles=sorted(meta,key=lambda x:-x['corrected2m']),totals=totals),indent=2)+'\n')
    print(json.dumps(totals))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('world',type=Path);p.add_argument('atlas',type=Path);p.add_argument('out',type=Path)
    a=p.parse_args();study(a.world,a.atlas,a.out)
