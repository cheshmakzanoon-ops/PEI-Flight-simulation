"""Project an independently qualified native Dunelands core into a game mask.

This does not discover a shoreline: its input is a verified, already fenced
native one-metre occupancy grid. The shipped mask must remain inside that
input under filtering, with an additional horizontal reserve.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import zlib

import numpy as np
from pyproj import Transformer
from scipy import ndimage as ndi

STEP=.5
UNITS=32
RESERVE=1.75
APRON=5
RUNTIME_THRESHOLD=128
MIN_COMPONENT_M2=125

def digest(data):
    return hashlib.sha256(data).hexdigest()

def convert(path, expected_sha):
    if digest(path.read_bytes())!=expected_sha:
        raise ValueError('Qualified native grid SHA-256 differs from the source receipt.')
    with np.load(path,allow_pickle=False) as pack:
        native=pack['water_allowed']
        left,top=map(int,pack['upper_left_3979'])
        stage_mm=int(pack['water_stage_mm'])
    if native.dtype!=np.bool_ or native.ndim!=2:
        raise ValueError('Expected a Boolean one-metre north-up EPSG:3979 grid.')
    if not (native.any() and all(side<=1500 for side in native.shape) and 1000<stage_mm<2000):
        raise ValueError('Expected an enclosed freshwater body in the qualified local range.')
    if native[0].any() or native[-1].any() or native[:,0].any() or native[:,-1].any():
        raise ValueError('Qualification crosses the observation reserve.')

    # WGS84 tangent atlas constants reproduced from src/sim/geo.ts.
    a=6378137*math.pi/180
    phi=math.radians(46.5)
    e2=.00669437999014
    t=1-e2*math.sin(phi)**2
    sx=a*math.cos(phi)/math.sqrt(t)
    sz=a*(1-e2)/t**1.5
    forward=Transformer.from_crs(3979,4326,always_xy=True)
    inverse=Transformer.from_crs(4326,3979,always_xy=True)
    signed_native=ndi.distance_transform_edt(~native)-ndi.distance_transform_edt(native)
    def field(xx,zz):
        x,y=inverse.transform(xx/sx-63.2,46.5-zz/sz)
        return ndi.map_coordinates(signed_native,[top-y-.5,x-left-.5],order=1,
                                   prefilter=False,mode='constant',cval=50)
    j,i=np.nonzero(native)
    lon,lat=forward.transform(left+i+.5,top-j-.5)
    x,z=(lon+63.2)*sx,(46.5-lat)*sz
    x0,z0=math.floor(x.min()-APRON),math.floor(z.min()-APRON)
    x1,z1=math.ceil(x.max()+APRON),math.ceil(z.max()+APRON)
    width,height=round((x1-x0)/STEP),round((z1-z0)/STEP)
    xx,zz=np.meshgrid(x0+(np.arange(width)+.5)*STEP,z0+(np.arange(height)+.5)*STEP)
    raw_distance=field(xx,zz)
    pixels=np.clip(np.rint((raw_distance+RESERVE)*UNITS),-127,127).astype(np.int16)
    pixels[pixels==0]=1
    index,_=ndi.label(pixels<0,structure=ndi.generate_binary_structure(2,1))
    counts=np.bincount(index.ravel());counts[0]=0
    accept=counts[index]>=round(MIN_COMPONENT_M2/STEP**2)
    pixels[(pixels<0)&~accept]=1
    if not accept.any():
        raise ValueError('No meaningful water core survived filtering.')
    if accept[0].any() or accept[-1].any() or accept[:,0].any() or accept[:,-1].any():
        raise ValueError('A displayed mask crosses its clear border.')
    x,z=xx[accept],zz[accept]
    maximum=-np.inf
    for dx in (-STEP,-STEP/2,0.,STEP/2,STEP):
        for dz in (-STEP,-STEP/2,0.,STEP/2,STEP):
            maximum=max(maximum,float(field(x+dx,z+dz).max()))
    if maximum>=-.60:
        raise ValueError('The filtered display support reaches past the certified native core.')
    data=(pixels+RUNTIME_THRESHOLD).astype(np.uint8).tobytes()
    archived=gzip.compress(data,compresslevel=9,mtime=0)
    meta=dict(width=width,height=height,left=x0,top=z0,step=STEP,units=UNITS,
              waterY=stage_mm/1000,compressedBytes=len(archived),decodedBytes=len(data),
              sha256=digest(data),crc32=f'{zlib.crc32(data):08x}',
              qualifiedSourceSha256=expected_sha,nativeCells=int(native.sum()),
              wetTexels=int(accept.sum()),cellEquivalentSquareMetres=float(accept.sum()*STEP**2),
              nearestSampledOuterSupportSignedM=float(maximum),reserveMetres=RESERVE)
    return archived,meta

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('qualified_npz',type=Path)
    p.add_argument('--input-sha256',required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--meta',type=Path,required=True)
    p.add_argument('--verify',action='store_true')
    a=p.parse_args()
    data,meta=convert(a.qualified_npz,a.input_sha256)
    if a.verify:
        if a.out.read_bytes()!=data or json.loads(a.meta.read_text())!=meta:
            raise ValueError('Tracked packed bytes or metadata mismatch.')
    else:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_bytes(data)
        a.meta.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(meta,indent=2))

if __name__=='__main__':
    main()
