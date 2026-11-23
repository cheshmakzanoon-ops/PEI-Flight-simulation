#!/usr/bin/env python3
"""Bake original rock material support from the pinned native-cell cohort.

This is a material mask, not a height field or coastline update. Build offline
using Python, numpy and GDAL/OSR; no network, images or raw COPC needed.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import zlib

import numpy as np
from osgeo import osr

ROOT=Path(__file__).resolve().parents[2]
WORLD=ROOT/'public/world'
EVIDENCE=ROOT/'data/coastal-bench/east-point-source.json'
survey=json.loads(EVIDENCE.read_text())
m=json.loads((WORLD/'terrain.json').read_text());west,south,east,north=m['bounds']
c=json.loads((WORLD/'cover.json').read_text());cw,ch=c['width'],c['height']
cover_gz=(WORLD/c['file']).read_bytes()
if hashlib.sha256(cover_gz).hexdigest()!=c['compressedSha256']:raise ValueError('Shoreline atlas checksum mismatch')
cover=np.frombuffer(gzip.decompress(cover_gz),np.uint8).reshape(ch,cw,2)[:,:,1]
native=ROOT/'data/coastal-elevation'
w=next(q for q in json.loads((native/'index.json').read_text())['windows'] if q['id']=='east-point')
raw=gzip.decompress((native/w['file']).read_bytes())
if hashlib.sha256(raw).hexdigest()!=w['sha256Decoded']:raise ValueError('DTM checksum mismatch')
dem=np.frombuffer(raw,'<i2').reshape(w['rows'],w['cols'])*.01
x0,y0=w['upperLeftOuterEdgeM']
factor=.25
rad=math.pi/180;lat0=46.5
ell=1-6.69437999014e-3*math.sin(lat0*rad)**2
mx=6378137*rad*math.cos(lat0*rad)/math.sqrt(ell)
mz=6378137*(1-6.69437999014e-3)*rad/ell**1.5
osr.UseExceptions()
def crs(epsg):
    s=osr.SpatialReference();s.ImportFromEPSG(epsg);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
native_xy,lonlat,terrain_xy=(crs(k) for k in (2961,4326,3979))
def xf(origin,destination,x,y):
    p=osr.CoordinateTransformation(origin,destination).TransformPoints(np.stack([x,y],axis=1).tolist())
    return np.array(p)[:,:2].T
def lookup(grid,x,y):
    x=np.clip(x,0,grid.shape[1]-1);y=np.clip(y,0,grid.shape[0]-1)
    i,j=x.astype(int),y.astype(int);r,s=x-i,y-j
    k=np.minimum(i+1,grid.shape[1]-1);l=np.minimum(j+1,grid.shape[0]-1)
    return (1-s)*((1-r)*grid[j,i]+r*grid[j,k])+s*((1-r)*grid[l,i]+r*grid[l,k])
def shore(lon,lat):
    return 2*(lookup(cover,(lon-west)/(east-west)*cw-.5,(north-lat)/(north-south)*ch-.5)-128)
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0.,1.)
    return t*t*(3-2*t)
def digest(data):
    return hashlib.sha256(data).hexdigest()
cells=np.asarray(survey['cells']);e,n=np.asarray(survey['originM'])[:,None]+cells[:,:2].T
lon,lat=xf(native_xy,lonlat,e+.5,n+.5);x,y=xf(native_xy,terrain_xy,e+.5,n+.5)
u,v=x-x0-.5,y0-y-.5
inside=(u>=0)&(v>=0)&(u<dem.shape[1]-1)&(v<dem.shape[0]-1)
reference=lookup(dem,u,v)
support=(cells[:,2]>=2)&(cells[:,3]>=0)&(cells[:,3]<=3)&(cells[:,4]==0)&inside
support&=(reference>=-.10)&(reference<=3)&(np.abs(reference-cells[:,3])<=.6)&(shore(lon,lat)>0)
points=set(zip(e[support].astype(int),n[support].astype(int)))
if not points:raise ValueError('No jointly supported land')
# The small surveyed bench is one connected landform. Do not paint disconnected candidates.
clusters=[]
while points:
    q=points.pop();part={q};stack=[q]
    while stack:
        i,j=stack.pop()
        for b in ((i-1,j),(i+1,j),(i,j-1),(i,j+1)):
            if b in points:points.remove(b);part.add(b);stack.append(b)
    clusters.append(part)
bench=max(clusters,key=lambda p:(len(p),min(p)))
i0,j0=map(int,np.min(np.array(list(bench)),axis=0)-3)
i1,j1=map(int,np.max(np.array(list(bench)),axis=0)+4)
mask=np.zeros((j1-j0,i1-i0),np.bool_)
for i,j in bench:mask[j-j0,i-i0]=True
corners=np.array([[i0,j0],[i0,j1],[i1,j0],[i1,j1]])
lon,lat=xf(native_xy,lonlat,corners[:,0],corners[:,1])
world_e=(lon+63.2)*mx;world_z=(lat0-lat)*mz
left,top=(math.floor(np.min(p)/factor)*factor for p in (world_e,world_z))
width,depth=(math.ceil((np.max(p)-low)/factor) for p,low in ((world_e,left),(world_z,top)))
z,x=np.indices((depth,width));xx=left+(x.ravel()+.5)*factor;zz=top+(z.ravel()+.5)*factor
lon=-63.2+xx/mx;lat=lat0-zz/mz
E,N=xf(lonlat,native_xy,lon,lat)
i,j=np.floor(E-i0).astype(int),np.floor(N-j0).astype(int)
safe=np.where((i>=1)&(j>=1)&(i<mask.shape[1]-1)&(j<mask.shape[0]-1))[0]
pixels=np.zeros(width*depth,dtype=np.uint8)
# The four axis-aligned extremes (plus midpoints) bound the full tent
# footprint even where painting approaches the game's shore contour.
cover_ok=shore(lon[safe],lat[safe])>.18
for k in (-1,0,1):
    for l in (-1,0,1):
        cover_ok&=shore(lon[safe]+k*factor/mx,lat[safe]-l*factor/mz)>.02
ins=safe[mask[j[safe],i[safe]] & cover_ok]
u=E[ins]-i0;v=N[ins]-j0;i=i[ins];j=j[ins]
rockDist=np.full(len(i),3.)
# Distance to the nearest absent 1 m support square. Insetting by more than a
# texel's bilinear diagonal prevents filtering any positive mask into an
# unsupported square, not just at the audited pixel centres.
for y in (-1,0,1):
    for x in (-1,0,1):
        dx=np.maximum.reduce([i+x-u,u-i-x-1,np.zeros(len(i))])
        dy=np.maximum.reduce([j+y-v,v-j-y-1,np.zeros(len(i))])
        rockDist=np.minimum(rockDist,np.where(mask[j+y,i+x],3.,np.hypot(dx,dy)))
clip=survey['queryBoundsM']
cropWeight=smooth(.45,2.4,np.minimum.reduce([E[ins]-clip[0],clip[2]-E[ins],N[ins]-clip[1],clip[3]-N[ins]]))
pixels[ins]=np.round(255*smooth(.39,.99,rockDist)*cropWeight).astype(np.uint8)
data=pixels.tobytes()
blob=bytearray(gzip.compress(data,mtime=0,compresslevel=9));blob[9]=255
path=WORLD/'coastal/v3/east-point-bench.r8.gz';path.parent.mkdir(exist_ok=True,parents=True);path.write_bytes(blob)
result=dict(id='east-tidal-bench-v1',asset='coastal/v3/east-point-bench.r8.gz',width=width,height=depth,
            boundsXZ=[left,top,left+width*factor,top+depth*factor],texelMetres=factor,decodedBytes=len(data),
            compressedBytes=len(blob),activeTexels=int(np.count_nonzero(pixels)),groundCells=len(bench),
            crc32=f'{zlib.crc32(data):08x}',sha256=digest(data),evidenceSHA256=digest(EVIDENCE.read_bytes()),
            pinnedDTMSha256=w['sha256Decoded'],pinnedCoverSha256=c['compressedSha256'])
(ROOT/'src/render/east-bench.generated.ts').write_text('// Generated by tools/terrain/bake-east-bench.py.\nexport const EAST_BENCH = '
    +json.dumps(result,indent=2)+' as const;\n')
print(json.dumps(result,indent=2))
