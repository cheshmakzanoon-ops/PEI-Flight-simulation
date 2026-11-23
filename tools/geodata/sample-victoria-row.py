#!/usr/bin/env python3
"""Reacquire the bonded public 1 m NRCan DSM/DTM and optionally verify the ODbL subset."""
import argparse,gzip,hashlib,json,math,runpy
from pathlib import Path
import numpy as np
from osgeo import ogr
ogr.UseExceptions()

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--root',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--pbf',type=Path,help='Optional pinned Geofabrik archive for an exact scoped 15-way audit.')
a=p.parse_args();r=a.root;o=a.out
o.mkdir(parents=True,exist_ok=True)
w=json.loads((r/'data/odbl/victoria-row/building-part-witness.json').read_text())
if a.pbf:
    assert hashlib.sha256(a.pbf.read_bytes()).hexdigest()==w['upstreamSha256']
    ds=ogr.Open(str(a.pbf))
    b=ds.GetLayerByName('multipolygons')
    b.SetSpatialFilterRect(-63.1273,46.23315,-63.1253,46.23470)
    required={q['id']:q['rings'] for q in w['partWays']}
    observed={}
    def canon(q):
        # Logical ring equality, regardless of order/winding of an OGR build.
        return {frozenset(frozenset((tuple(a),tuple(b))) for a,b in zip(r,r[1:]+r[:1])) for r in q}
    for f in b:
        k=f.GetField('osm_way_id') or f.GetField('osm_id')
        if k not in required:continue
        g=f.GetGeometryRef()
        rings=[[list(p[:2]) for p in q.GetGeometryRef(0).GetPoints()[:-1]] for q in g]
        assert canon(rings)==canon(required[k]),k
        observed[k]=rings
    assert set(observed)==set(required),(set(required)-set(observed))
    ds=ogr.Open(str(a.pbf))
    rail=ds.GetLayerByName('lines')
    rail.SetSpatialFilterRect(-63.1273,46.23315,-63.1253,46.23470)
    check=[list(p[:2]) for f in rail if f.GetField('osm_id')==w['streetPortion']['id']
           for p in f.GetGeometryRef().GetPoints()]
    expect=w['streetPortion']['points']
    k=check.index(expect[0]);j=check.index(expect[-1])
    ordered=check[min(k,j):max(k,j)+1]
    assert ordered==expect or ordered[::-1]==expect,'Pinned segment is not a consecutive part of the source.'
    print('Verified exact 15 public way rings and one exact consecutive road portion.')
Q=runpy.run_path(str(r/'tools/qa/roof-fit-pilot.py'))
F=runpy.run_path(str(r/'tools/geodata/fit-farm-profiles.py'))
index=json.loads((r/'public/world/buildings/index.json').read_text())
tt=next(t for t in index['tiles'] if t['id']=='q12000111')
ordinal=3
with (r/'public/world/buildings/tiles.pack').open('rb') as f:
    f.seek(tt['offset'])
    feat=json.loads(gzip.decompress(f.read(tt['bytes'])))['features'][ordinal]
A,B,gt,T=Q['open_models']()
N=np.asarray(T.TransformPoints(feat['footprint']))[:,:2]
xmin,xmax,ymin,ymax=min(N[:,0]),max(N[:,0]),min(N[:,1]),max(N[:,1])
i,j=math.floor(xmin-gt[0])-5,math.floor(gt[3]-ymax)-5
u,v=math.ceil(xmax-gt[0])+5,math.ceil(gt[3]-ymin)+5
z,g=A.ReadAsArray(i,j,u-i,v-j),B.ReadAsArray(i,j,u-i,v-j)
x0,y0=gt[0]+i+.5,gt[3]-j-.5
np.savez_compressed(o/'victoria-native-window.npz',dsm=z,dtm=g,X=x0,Y=y0)
receipt=dict(asset='NRCan HRDEM Mosaic item 10_3-mosaic-1m',begin=[x0,y0],shape=list(z.shape),
             productionAtlas=f"{tt['id']}/{ordinal}",sample_sha=F['fprint'](z,g))
(o/'native-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
