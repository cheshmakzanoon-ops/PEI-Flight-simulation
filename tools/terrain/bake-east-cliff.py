#!/usr/bin/env python3
"""Generate the optional deterministic, loss-aware East Point native cliff insert.

Only the pinned NRCan heights select cells; neither an atlas cover mask nor
shoreline location defines the refinement. Run with Python/GDAL from the repo.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
import runpy
import struct
import zlib
from osgeo import osr

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'data/coastal-elevation'
WORLD=ROOT/'public/world'
spec=json.loads((ROOT/'src/sim/coastal-surveys.generated.ts').read_text().split(' = ',1)[1].split(' as const',1)[0])[0]
assert spec['id']=='east-point'
window=json.loads((SOURCE/'index.json').read_text())['windows'][0]
assert window['id']==spec['id']
native=gzip.decompress((SOURCE/window['file']).read_bytes())
assert hashlib.sha256(native).hexdigest()==window['sha256Decoded']
nc,nr=window['cols'],window['rows']
measured=struct.unpack(f'<{nc*nr}h',native)
assert -32768 not in measured
base=gzip.decompress((WORLD/'coastal/v1/east-point.i16.gz').read_bytes())
assert hashlib.sha256(base).hexdigest()==spec['sha256']
sub=spec['sub'];nx,nz=spec['cellsX']*sub+1,spec['cellsZ']*sub+1
coarse=struct.unpack(f'<{nx*nz}h',base)
west,south,east,north=json.loads((WORLD/'terrain.json').read_text())['bounds']
tile_i=spec['tileX']*112+spec['firstX'];tile_j=spec['tileZ']*112+spec['firstZ']
left,top=window['upperLeftOuterEdgeM']
SPLIT=4
TRIGGER_CM=75
osr.UseExceptions()
src,dst=osr.SpatialReference(),osr.SpatialReference()
src.ImportFromEPSG(3979);dst.ImportFromEPSG(4326)
for crs in (src,dst):crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_geo,to_native=osr.CoordinateTransformation(src,dst),osr.CoordinateTransformation(dst,src)

def facet(u,v,nw,ne,sw,se):
    return nw+(ne-nw)*u+(sw-nw)*v if u+v<=1 else se+(sw-se)*(1-u)+(ne-se)*(1-v)

def parent(i,j):
    x,z=min(nx-2,math.floor(i)),min(nz-2,math.floor(j));k=z*nx+x
    return facet(i-x,j-z,coarse[k],coarse[k+1],coarse[k+nx],coarse[k+nx+1])

def native_height(e,n):
    u,v=max(0,min(nc-1,e-left-.5)),max(0,min(nr-1,top-n-.5))
    i,j=min(nc-2,math.floor(u)),min(nr-2,math.floor(v));u-=i;v-=j;k=j*nc+i
    return (1-v)*((1-u)*measured[k]+u*measured[k+1])+v*((1-u)*measured[k+nc]+u*measured[k+nc+1])

coords=[(left+c+.5,top-r-.5) for r in range(nr) for c in range(nc)]
core=set()
for index,(lon,lat,_) in enumerate(to_geo.TransformPoints(coords)):
    x=((lon-west)/(east-west)*32*112-tile_i)*sub
    z=((north-lat)/(north-south)*22*112-tile_j)*sub
    if abs(measured[index]-parent(x,z))>TRIGGER_CM:core.add((math.floor(x),math.floor(z)))
halo={(x+i,z+j) for x,z in core for i in (-1,0,1) for j in (-1,0,1)}
if not all(0<x<nx-2 and 0<z<nz-2 for x,z in halo):
    raise ValueError('The optional insert may not reach the inherited survey boundary')
# The exact distance (in high-grid Chebyshev cells) from any promoted square.
gap={}
for x,z in core:
    for dz in range(-SPLIT,2*SPLIT+1):
        for dx in range(-SPLIT,2*SPLIT+1):
            d=max(0,-dx,-dz,dx-SPLIT,dz-SPLIT)
            if d>=SPLIT:continue
            k=(x*SPLIT+dx,z*SPLIT+dz);gap[k]=min(d,gap.get(k,SPLIT))
# One evaluation per fine vertex; duplicate shared edges in the compact gzip
# records so no indexing table is needed to decode one cell.
keys=sorted(gap,key=lambda p:(p[1],p[0]))
coords=[(west+(east-west)*(tile_i+x/(SPLIT*sub))/(32*112),
         north-(north-south)*(tile_j+z/(SPLIT*sub))/(22*112)) for x,z in keys]
delta={}
for k,(e,n,_) in zip(keys,to_native.TransformPoints(coords),strict=True):
    x,z=k;f=1-gap[k]/SPLIT;weight=f*f*(3-2*f)
    # Height samples remain signed, including valid offshore points. Do not
    # extrapolate the farthest native observations outside their cell centres.
    u,v=e-left-.5,top-n-.5
    if min(u,v,nc-1-u,nr-1-v)<0:
        fringe=min(1,math.hypot(u-max(0,min(nc-1,u)),v-max(0,min(nr-1,v)))/16)
        atlas_weight=fringe*fringe*(3-2*fringe)
    else:atlas_weight=0
    old=parent(x/SPLIT,z/SPLIT)
    # Near-window collar stays on the original signed relief where survey ends.
    # Only the native fit inside the sparse grid changes.
    h=native_height(e,n)
    delta[k]=round((h-old)*weight*(1-atlas_weight))
plan=runpy.run_path(str(ROOT/'tools/terrain/bake-coastal-lod.py'))['plan']
fine_x,fine_z=SPLIT*(nx-1)+1,SPLIT*(nz-1)+1
# Outside the active cells, this complete quarter-grid samples the exact old
# NE–SW faces. It is only an offline reference, never distributed or rendered.
high=[parent(x/SPLIT,z/SPLIT)+delta.get((x,z),0) for z in range(fine_z) for x in range(fine_x)]
lod,bits,triangles=plan(high,fine_x,fine_z,block=SPLIT*sub,boundary_step=SPLIT)
data=bytearray(struct.pack('<4sHHHH',b'EPC1',len(halo),bits,triangles,SPLIT))
for x,z in sorted(halo,key=lambda p:(p[1],p[0])):
    samples=[delta.get((x*SPLIT+i,z*SPLIT+j),0) for j in range(SPLIT+1) for i in range(SPLIT+1)]
    data+=struct.pack('<H25h',z*(nx-1)+x,*samples)
data+=lod
blob=bytearray(gzip.compress(data,compresslevel=9,mtime=0));blob[9]=255
path=WORLD/'coastal/v2/east-point-cliff.i16.gz';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(blob)
metadata=dict(id='east-cliff-v1',baseSha256=spec['sha256'],crc32=f'{zlib.crc32(data):08x}',sha256=hashlib.sha256(data).hexdigest(),
              decodedBytes=len(data),compressedBytes=len(blob),coreCells=len(core),cells=len(halo),lodBits=bits,lodTriangles=triangles)
(ROOT/'src/sim/east-cliff.generated.ts').write_text('// Generated by tools/terrain/bake-east-cliff.py.\nexport const EAST_CLIFF = '
    +json.dumps(metadata,indent=2)+' as const;\n')
print(json.dumps(metadata,indent=2))
