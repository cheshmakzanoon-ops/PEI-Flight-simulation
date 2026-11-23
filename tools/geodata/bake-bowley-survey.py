#!/usr/bin/env python3
"""Reproduce the research-era Bowley open-water core. No GIS or imagery indexed at runtime.

`extract` needs NumPy, laspy with lazrs, and the four local, pinned public COPCs.
`bake` needs NumPy/SciPy/pyproj and the extracted local observations. Reading
a different survey or silently changing the sampled extent is deliberately rejected.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import zlib

import numpy as np

WIN=np.array([[521690.,5143470.],[523010.,5144510.]]) # EPSG:2961
STEP=.5
DATUM_MM=1132 # Robust median of the selected class-9 body; leave March dry elevations unchanged.
MODE_MM=(1066,1200) # Predeclared modal-stage envelope excludes ocean and distinct perched water.
PIN={'421000_710000':'600eb2964f7c58944901000d9e9e3fd80847bdac1d7f1e87e6b8b37d5ef39b75',
     '421000_711000':'697d8d58ac398d7de81949812106d3b18395231f5e1cd419d8499680400cdf4e',
     '422000_710000':'a3bc821fae602eb5a6e877459d3923ad1f89c0df7334223ac1fa41c64a0bc39e',
     '422000_711000':'b47bbe5528afaaf19fbbe21cd6b4fe0c8987783c8050a4956e8b676594f96daa'}
RAW_SHA='d49750025bbbcc5416beefb3569e9aa6521c05f56a9cde40a098e49a17f6f622'
OUTPUT='greenwich/v0/bowley-2020-water.r8.gz'
ROOT=Path(__file__).resolve().parents[2]
def digest(data):
    return hashlib.sha256(data).hexdigest()
def origin():
    return WIN[0].astype(int)
def extract(folder,out):
    from laspy import CopcReader
    from laspy.copc import Bounds
    all_wet,all_ground=[],[]
    ox,oy=origin()
    for key,pin in PIN.items():
        p=folder/('pei_2020_'+key+'.copc.laz')
        with p.open('rb') as r:
            if hashlib.file_digest(r,'sha256').hexdigest()!=pin:
                raise ValueError(f'Native source changed: {p.name}')
        with CopcReader.open(p) as r:
            wkt=r.header.vlrs.get_by_id('LASF_Projection',(2112,))[0].string
            if '2961' not in wkt:
                raise ValueError('Expected original NAD83(CSRS) UTM20 records')
            q=r.query(bounds=Bounds(np.maximum(WIN[0],r.header.mins[:2]),np.minimum(WIN[1],r.header.maxs[:2])))
            c=np.asarray(q.classification);keep=~np.asarray(q.withheld).astype(bool)
            x,y,z=np.asarray(q.x),np.asarray(q.y),np.asarray(q.z)
            def pick(k):
                return np.around(np.c_[x[k]-ox,y[k]-oy,z[k]]*1000).astype(np.int32)
            all_wet.append(pick(keep&(c==9)))
            all_ground.append(pick(keep&(c==2)&(z<4.)))
    np.savez_compressed(out,wet=np.unique(np.concatenate(all_wet),axis=0),
                          ground=np.unique(np.concatenate(all_ground),axis=0))
def bake(source,repo,verify):
    from scipy import ndimage as ndi
    from pyproj import Transformer
    d=np.load(source)
    w=d['wet'];g=d['ground'];ox,oy=origin()
    w=w[(w[:,2]>=MODE_MM[0])&(w[:,2]<=MODE_MM[1])]
    # Dry veto is stage-relative. Assumed shallow ground is never used to
    # extend the build's pond; no separate reed or seasonal model is inferred.
    high=g[(g[:,2]>=1302)&(g[:,2]<3800)]
    rows,cols=np.round((WIN[1]-WIN[0])[::-1]/STEP).astype(int)
    def occupied(q):
        v=np.zeros((rows,cols),bool)
        v[np.clip(rows-1-q[:,1]//500,0,rows-1),np.clip(q[:,0]//500,0,cols-1)]=True
        return v
    def dist(q):
        return ndi.distance_transform_edt(~q)*STEP
    eligible=(dist(occupied(w))<=.75)&(dist(occupied(high))>1.55)
    mask=ndi.binary_opening(eligible,structure=ndi.generate_binary_structure(2,1))
    def dominant(mask,connectivity):
        ids,_=ndi.label(mask,structure=ndi.generate_binary_structure(2,connectivity))
        n=np.bincount(ids.ravel());n[0]=0
        return ids==n.argmax()
    mask=dominant(mask,2)
    native=dist(mask)-dist(~mask)
    # Same WGS84 tangent atlas as src/sim/geo.ts; register a new normal world
    # grid, never pretending WGS84 longitudes have equal scale everywhere.
    a=6378137*math.pi/180;phi=46.5*math.pi/180;e2=.00669437999014;b=1-e2*math.sin(phi)**2
    sx=a*math.cos(phi)/math.sqrt(b);sz=a*(1-e2)/b**1.5
    forward=Transformer.from_crs(2961,4326,always_xy=True)
    inverse=Transformer.from_crs(4326,2961,always_xy=True)
    def world(x,y):
        x,y=forward.transform(x,y)
        return (x+63.2)*sx,(46.5-y)*sz
    def signed(x,z):
        e,n=inverse.transform(x/sx-63.2,46.5-z/sz)
        i=(e-WIN[0,0])/STEP-.5;j=(WIN[1,1]-n)/STEP-.5
        return ndi.map_coordinates(native,[j,i],order=1,prefilter=False,mode='constant',cval=50)
    j,i=np.nonzero(mask);x,z=world(ox+(i+.5)*STEP,WIN[1,1]-(j+.5)*STEP)
    left,top=math.floor(x.min()-5),math.floor(z.min()-5)
    right,bottom=math.ceil(x.max()+5),math.ceil(z.max()+5)
    nx,nz=round((right-left)/STEP),round((bottom-top)/STEP)
    xx,zz=np.meshgrid(left+(np.arange(nx)+.5)*STEP,top+(np.arange(nz)+.5)*STEP)
    pack=np.clip(np.rint((signed(xx,zz)+1.12)*32),-127,127).astype(np.int16)
    pack[pack==0]=1 # Conservative tie direction, no flat exact-zero edges.
    wet=pack<0;keep=dominant(wet,1);pack[wet&~keep]=1
    x,z=xx[keep],zz[keep]
    for a in (-.5,-.25,0.,.25,.5):
        for b in (-.5,-.25,0.,.25,.5):
            if not np.all(signed(x+a,z+b)<-.01):
                raise ValueError('A filtered wet footprint would exceed the qualified native core')
    raw=(pack+128).astype(np.uint8).tobytes()
    if digest(raw)!=RAW_SHA:
        raise ValueError('Refusing to replace a frozen mask: projection, geometry or source disagrees')
    target=repo/'public/world'/OUTPUT
    if verify:
        if digest(gzip.decompress(target.read_bytes()))!=RAW_SHA:
            raise ValueError('The checked-in mask changed')
    else:
        target.parent.mkdir(parents=True,exist_ok=True)
        data=gzip.compress(raw,compresslevel=9,mtime=0)
        target.write_bytes(data)
    print(json.dumps(dict(width=nx,height=nz,left=left,top=top,waterY=DATUM_MM/1000,
       includedTexels=int(keep.sum()),rawSHA256=digest(raw),crc32=f'{zlib.crc32(raw):08x}'),indent=2))
def main():
    p=argparse.ArgumentParser(description=__doc__)
    s=p.add_subparsers(dest='step',required=True)
    e=s.add_parser('extract');e.add_argument('local_copc',type=Path);e.add_argument('observations',type=Path)
    b=s.add_parser('bake');b.add_argument('observations',type=Path);b.add_argument('--repo',type=Path,default=ROOT)
    b.add_argument('--verify',action='store_true',help='Compare against the checked-in bytes without replacing an asset.')
    a=p.parse_args()
    if a.step=='extract':extract(a.local_copc,a.observations)
    else:bake(a.observations,a.repo,a.verify)
if __name__=='__main__':
    main()
