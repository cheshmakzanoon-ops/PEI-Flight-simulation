#!/usr/bin/env python3
"""Rasterize exact static Souris roof+wall shell into compact shadow and AO channels."""
import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path
import zlib

import numpy as np
from scipy import ndimage as nd

root=Path(__file__).resolve().parents[2]
shell=json.loads(subprocess.check_output(['node','--experimental-strip-types','tools/geodata/souris-light-shell.ts'],cwd=root))
tris=np.array(shell['group'],dtype=np.float64)
if tris.shape!=(296,3,3):raise ValueError('Review the new shell before baking lighting')
light=np.array([-.60,.74,-.31],dtype=np.float64) # the simulator's fixed daytime sun
xy=light[[0,2]]/light[1]
datum=20.
cell=.46
projected=tris[:,:,[0,2]]-(tris[:,:,1][:,:,None]-datum)*xy
foot=np.array(shell['boundary'][0])
target=np.vstack((projected.reshape(-1,2),foot))
pad=18.
origin=np.floor((target.min(axis=0)-pad)/cell)*cell
n=np.ceil((target.max(axis=0)+pad-origin)/cell).astype(np.int32)
width,height=map(int,n)
if width>512 or height>512 or width<8 or height<8:raise ValueError('Out-of-budget contact texture')
X,Z=np.meshgrid(origin[0]+(np.arange(width)+.5)*cell,origin[1]+(np.arange(height)+.5)*cell)
q=np.stack([X,Z],axis=-1)
red=np.zeros((height,width),dtype=np.float64)
for p,z in zip(projected,tris[:,:,1],strict=True):
    a,b,c=p
    v,w=b-a,c-a
    det=v[0]*w[1]-v[1]*w[0]
    if abs(det)<1e-8:continue
    low=np.maximum(0,np.floor((p.min(axis=0)-origin)/cell-.5).astype(int))
    high=np.minimum(n,np.ceil((p.max(axis=0)-origin)/cell+.5).astype(int))
    cols,rows=slice(low[0],high[0]),slice(low[1],high[1])
    delta=q[rows,cols]-a
    u=(delta[:,:,0]*w[1]-delta[:,:,1]*w[0])/det
    v1=(delta[:,:,1]*v[0]-delta[:,:,0]*v[1])/det
    hit=(u>=-1e-9)&(v1>=-1e-9)&(u+v1<=1+1e-9)
    y=z[0]+u*(z[1]-z[0])+v1*(z[2]-z[0])
    red[rows,cols]=np.maximum(red[rows,cols],np.where(hit,y,0.))
if red.max()>63.5:raise ValueError('No room to encode sun depth')
maxrange=13.
def edge_distance(rings,locations):
    out=np.full(locations.shape[:-1],np.inf)
    for points in rings:
        f=np.asarray(points)
        for a,b in zip(f,np.roll(f,-1,axis=0),strict=True):
            v=b-a
            if np.dot(v,v)<1e-10:continue
            W=locations-a
            u=np.clip((W@v)/np.dot(v,v),0,1)
            out=np.minimum(out,np.linalg.norm(W-u[:,:,None]*v,axis=2))
    return out
d=edge_distance(shell['boundary'],q)
# Narrow full contact with a quiet wider periphery, not a blurred black outline.
v=np.clip((maxrange-d)/4.,0,1)
taper=v*v*(3-2*v)
ao=(.72*np.exp(-d/1.60)+.28*np.exp(-d/5.6))*taper
shadow=np.where(red>0,np.rint(red*4)+1,0).astype(np.uint8)
green=np.rint(255*ao).astype(np.uint8)
if shadow.max()!=192 or not np.any(shadow) or not np.any(green):raise ValueError('Unexpected roof shadow range')
groundSupport=28.
D=root/'data/roof-tiers';meta=json.loads((D/'souris-ground-strip.json').read_text())
groundBlob=(D/meta['file']).read_bytes();groundBytes=gzip.decompress(groundBlob)
digest=lambda data:hashlib.sha256(data).hexdigest()
if digest(groundBytes)!=meta['sha256'] or digest(groundBlob)!=meta['compressedSha256']:
    raise ValueError('Signed ground return census is not the reviewed strip')
ground=meta['grid'];gw,gh=ground['width'],ground['height']
stats=np.frombuffer(groundBytes,'<u2').reshape(gh,gw,2)
a=stats[:,:,0];count=stats[:,:,1];legal=(count>=ground['sourceMinimumReturns'])
GX,GZ=np.meshgrid(ground['leftTopXZ'][0]+.5+np.arange(gw),ground['leftTopXZ'][1]+.5+np.arange(gh))
gq=np.stack([GX,GZ],axis=-1)
dd=edge_distance(shell['boundary'],gq)
inside=np.zeros(GX.shape,dtype=bool)
for s,t in zip(foot,np.roll(foot,-1,axis=0),strict=True):
    if abs(t[1]-s[1])<1e-9:continue
    inside^=((s[1]>GZ)!=(t[1]>GZ))&(GX<(GZ-s[1])*(t[0]-s[0])/(t[1]-s[1])+s[0])
legal&=~inside
dist,near=nd.distance_transform_edt(~legal,return_indices=True)
filled=nd.median_filter(a[tuple(near)],size=3)
smoothed=np.where(legal,.32*a+.68*filled,0.)
weights=np.where(legal,np.clip(count/6.,0,1),0.)
def smooth(a):return nd.gaussian_filter(a.astype(float),.78,truncate=2.6,mode='constant')
evidence=smooth(weights)
stable=smooth(smoothed*weights)/np.maximum(evidence,1e-8)
nearby=nd.convolve(legal.astype(int),np.ones((3,3),'i1'),mode='constant')
allowed=legal|((dist<=math.sqrt(2.)+1e-6)&(nearby>=5))
# A bounded presentation fill behind raw one-metre confidence holes, only
# when five independent neighbours directly support it and never under the roof.
taperV=np.clip((groundSupport-dd)/7.,0,1)
confidenceScalar=np.where(inside|~allowed,0.,np.clip(evidence/.63,0,1)*taperV*taperV*(3.-2.*taperV))
confidence=np.rint(confidenceScalar*31.).astype('u1')*np.uint8(8)
confidence[confidenceScalar>=.997]=255
qNorm=np.clip((stable-1500.)/4100.,0.,1.)
normalized=np.minimum(confidence,np.rint(qNorm*confidence/2.)*2.).astype('u1')
sun=np.stack([shadow,green],axis=-1).tobytes()
groundBody=np.stack([normalized,confidence],axis=-1).tobytes()
raw=sun+groundBody
zipd=bytearray(gzip.compress(raw,compresslevel=9,mtime=0));zipd[9]=255
path='lighting/v1/souris-daylight-fields.gz'
dst=root/'public/world'/path;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(zipd)
digest=lambda data:hashlib.sha256(data).hexdigest()
plan=dict(id='souris-daylight-contact-v2',asset=path,width=width,height=height,
    leftTopXZ=origin.tolist(),edgeBoundsXZ=[*origin.tolist(),*(origin+n*cell).tolist()],
    cellMetres=cell,shadowDatumY=datum,sunDirection=light.tolist(),shadowYZRatio=xy.tolist(),aoSupportMetres=maxrange,
    encoding='Concatenated RG fields: sun R=0 or 1+round(max sun height × 4), sun G=perimeter AO; native ground R=relative return premultiplied by G=survey support',
    shadowBytes=len(sun),groundBytes=len(groundBody),groundSize=[gw,gh],groundLeftTopXZ=ground['leftTopXZ'],
    relativeGroundSupportMetres=groundSupport,groundSourceSha256=meta['sha256'],groundTexels=int((confidence>0).sum()),
    groundDirectTexels=int(np.sum((confidence>0)&legal)),groundInterpolatedTexels=int(np.sum((confidence>0)&~legal)),
    maxGroundInterpolationM=round(float(np.max(dist[(confidence>0)&~legal])),5),
    sha256=digest(raw),crc32=f'{zlib.crc32(raw):08x}',decodedBytes=len(raw),compressedSha256=digest(zipd),
    bytes=len(zipd),terrainSha256=shell['terrain'],evidenceSha256=shell['survey'],shellSha256=shell['shellSha256'],triangleCount=len(tris),
    depthTexels=int(np.sum(shadow>0)),aoTexels=int(np.sum(green>0)))
(root/'src/render/souris-light.generated.ts').write_text('// Generated by tools/geodata/bake-souris-light.py.\nexport const SOURIS_LIGHT = '+json.dumps(plan,indent=2)+' as const;\n')
print(json.dumps(plan,indent=2))
