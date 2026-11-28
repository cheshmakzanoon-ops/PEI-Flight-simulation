"""Recheck active compact Panmure triangles against the archived signed-mask polygon."""
from hashlib import sha256
from pathlib import Path
from struct import iter_unpack, pack, unpack
from osgeo import ogr

p=Path(__file__).resolve().parent
def raw(name,digest):
    data=(p/name).read_bytes()
    if sha256(data).hexdigest()!=digest:
        raise ValueError('altered '+name)
    return data
dry=ogr.CreateGeometryFromWkb(raw('authorized-dry-domain.wkb',
    '94a7b1eb20cf9317f7c696254b2681c16c1430cdafcfc1d37bf1db5d4c14fffa'))
assert dry.IsValid()
boundary=dry.Boundary()
pos=list(iter_unpack('<3f',raw('packet/active.p.f32le',
    '76c6187887ee51dd7cd7b3494f29c0198ad7ff47852a51f00365342aa3afe74b')))
faces=list(iter_unpack('<3H',raw('packet/replacement.local.i.u16le',
    '379963057394328e65d1822062387dbc7c59cd62eb56bf5470dd0fe9256b0228')))
active=raw('packet/active-triangle-role.u8',
    '2dd776d9476e2d4fde81f0cc8af8402a80a2de1410cfb44df649c051af6be15e')
assert len(faces)==len(active)==452 and len(pos)==229 and sum(active)==214
def f32(x): return unpack('<f',pack('<f',x))[0]
minima=[]
for shader in [False,True]:
    dx,dz=57883.79291766229,41735.934173050286
    world=[(f32(x+f32(dx)),f32(z+f32(dz))) if shader else (x+dx,z+dz) for x,_,z in pos]
    dist=[]
    for face, changed in zip(faces,active):
        if not changed: continue
        ring=ogr.Geometry(ogr.wkbLinearRing)
        for i in (*face,face[0]): ring.AddPoint_2D(*world[i])
        tri=ogr.Geometry(ogr.wkbPolygon);tri.AddGeometry(ring)
        assert dry.Contains(tri)
        dist.append(boundary.Distance(tri))
    minima.append(min(dist))
assert 0.572 < min(minima) < 0.574
print('214 active triangles inside archived mask in both bases:', minima)
