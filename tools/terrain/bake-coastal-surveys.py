#!/usr/bin/env python3
"""Turn checked-in NRCan windows into local, fixed topology terrain; no network or shoreline inference.

Run from the repository root with GDAL/OSR (traditional GIS axis order).
"""
import gzip
import hashlib
import json
import math
import struct
import zlib
from pathlib import Path

from osgeo import osr

N = 112
SUB = 16  # ~3.40 m east/west, 3.27 m north/south in this atlas
FEATHER = 16  # metres outside the source window only
root = Path(__file__).resolve().parents[2]
source = root / "data/coastal-elevation"
world = root / "public/world"
atlas = json.loads((world/"terrain.json").read_text())
height_bytes = gzip.decompress((world/atlas["file"]).read_bytes())
if hashlib.sha256(height_bytes).hexdigest() != atlas["sha256"]:
    raise ValueError("Atlas hash mismatch")
# Explicit signed little-endian reads, without building a list for the entire atlas.
h = lambda i: struct.unpack_from("<h", height_bytes, i*2)[0]
ww, hh = atlas["width"], atlas["height"]
west, south, east, north = atlas["bounds"]
rad = math.pi/180
e2 = 6.69437999014e-3
t = 1-e2*math.sin(46.5*rad)**2
mx = 6378137*rad*math.cos(46.5*rad)/math.sqrt(t)
mz = 6378137*(1-e2)*rad/t**1.5
x0, z0 = (west+63.2)*mx, (46.5-north)*mz
dx, dz = (east-west)*mx/(32*N), (north-south)*mz/(22*N)
osr.UseExceptions()
native, geo = osr.SpatialReference(), osr.SpatialReference()
native.ImportFromEPSG(3979)
geo.ImportFromEPSG(4326)
for crs in (native, geo):
    crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
forward, inverse = osr.CoordinateTransformation(native, geo), osr.CoordinateTransformation(geo, native)

def clamp(a, lo, hi):
    return max(lo, min(hi, a))

def base_vertex(i, j):
    u, v = clamp(i/(32*N)*ww-.5, 0, ww-1), clamp(j/(22*N)*hh-.5, 0, hh-1)
    a, b = math.floor(u), math.floor(v)
    m = y = 0.0
    for k, l in ((0,0), (1,0), (0,1), (1,1)):
        val = h(min(b+l,hh-1)*ww+min(a+k,ww-1))
        weight = (u-a if k else 1-u+a)*(v-b if l else 1-v+b)
        if val != -32768:
            y += val*weight
            m += weight
    return max(0, y/m) if m else 0

def existing_triangle(i, j):
    a, b = math.floor(i), math.floor(j)
    u, v = i-a, j-b
    if u+v <= 1:
        return (1-u-v)*base_vertex(a,b)+u*base_vertex(a+1,b)+v*base_vertex(a,b+1)
    return (u+v-1)*base_vertex(a+1,b+1)+(1-u)*base_vertex(a,b+1)+(1-v)*base_vertex(a+1,b)

cfg = json.loads((source/"index.json").read_text())
if cfg["grid"]["horizontalCRS"] != "EPSG:3979" or cfg["grid"]["verticalCRS"] != "EPSG:6647" or atlas["verticalDatum"] != "CGVD2013":
    raise ValueError("A horizontal or vertical basis changed")
specs = []
outdir = world/"coastal/v1"
outdir.mkdir(parents=True, exist_ok=True)
for site in cfg["windows"]:
    raw = gzip.decompress((source/site["file"]).read_bytes())
    if hashlib.sha256(raw).hexdigest() != site["sha256Decoded"]:
        raise ValueError("Native survey hash mismatch")
    cols, rows = site["cols"], site["rows"]
    native_values = struct.unpack(f"<{cols*rows}h", raw)
    if -32768 in native_values:
        raise ValueError("This version requires a complete source window")
    left, top = site["upperLeftOuterEdgeM"]
    # Enclose the rotated footprint plus exterior transition; align to actual near-LOD cells.
    xy = []
    for e, s in [(-FEATHER,-FEATHER),(cols+FEATHER,-FEATHER),(cols+FEATHER,rows+FEATHER),(-FEATHER,rows+FEATHER)]:
        lon, lat, _ = forward.TransformPoint(left+e,top-s)
        xy.append((((lon+63.2)*mx-x0)/dx,((46.5-lat)*mz-z0)/dz))
    i0, j0 = (math.floor(min(q[c] for q in xy)) for c in (0,1))
    i1, j1 = (math.ceil(max(q[c] for q in xy)) for c in (0,1))
    ti,tj = i0//N, j0//N
    assert 0<i0-ti*N<i1-ti*N<N and 0<j0-tj*N<j1-tj*N<N
    nx,nz=(i1-i0)*SUB+1,(j1-j0)*SUB+1
    values = []
    for j in range(nz):
        gz = j0+j/SUB
        lat = 46.5-(z0+gz*dz)/mz
        coords = [(-63.2+(x0+(i0+i/SUB)*dx)/mx,lat) for i in range(nx)]
        for i, (e,n,_) in enumerate(inverse.TransformPoints(coords)):
            u, v = e-left-.5, top-n-.5
            a,b = clamp(u,0,cols-1),clamp(v,0,rows-1)
            fringe=clamp(math.hypot(a-u,b-v)/FEATHER,0,1)
            w = 1-fringe*fringe*(3-2*fringe)
            ia,ib = math.floor(a),math.floor(b)
            u,v=a-ia,b-ib
            measured=sum(native_values[min(rows-1,ib+l)*cols+min(cols-1,ia+k)]
                         *(u if k else 1-u)*(v if l else 1-v)
                         for k,l in ((0,0),(1,0),(0,1),(1,1)))
            base = 100*existing_triangle(i0+i/SUB,gz) if w<1 else 0
            values.append(round(base*(1-w)+measured*w))
    packed = struct.pack(f"<{len(values)}h", *values)
    # Omit optional gzip original name and timestamp. OS byte is specified for reproducibility.
    compressed=bytearray(gzip.compress(packed, compresslevel=9,mtime=0)); compressed[9]=255
    (outdir/f'{site["id"]}.i16.gz').write_bytes(compressed)
    # For shading only: four corner samples define a bilinear transform back
    # to the native pixel-centre coordinates of this small projected rectangle.
    corners=[]
    for gx,gz in [(i0,j0),(i1,j0),(i0,j1),(i1,j1)]:
        lon,lat=-63.2+(x0+gx*dx)/mx,46.5-(z0+gz*dz)/mz
        e,n,_=inverse.TransformPoint(lon,lat)
        corners.append([round(e-left-.5,5),round(top-n-.5,5)])
    specs.append(dict(id=site["id"],tileX=ti,tileZ=tj,firstX=i0-ti*N,firstZ=j0-tj*N,
                      cellsX=i1-i0,cellsZ=j1-j0,sub=SUB,nativeCorners=corners,nativeShape=[cols,rows],crc32=format(zlib.crc32(packed),"08x"),sha256=hashlib.sha256(packed).hexdigest()))
    print(f'{site["id"]}: {nx}x{nz}, {len(compressed)} gzip bytes')
gen = "// Generated by tools/terrain/bake-coastal-surveys.py; offsets count 112-LOD cells, not metres.\n"
gen += "export const COASTAL_SPECS = "+json.dumps(specs, indent=2)+" as const;\n"
(root/"src/sim/coastal-surveys.generated.ts").write_text(gen)
