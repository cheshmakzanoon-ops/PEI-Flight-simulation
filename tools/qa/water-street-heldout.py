#!/usr/bin/env python3
"""Prepare exact native EPSG:3979 blind roof cell centres for the Three.js gate."""
from pathlib import Path
import argparse
import gzip
import json
import runpy

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('output',type=Path)
a=p.parse_args()
root=Path(__file__).resolve().parents[2]
f=runpy.run_path(str(root/'tools/geodata/fit-farm-profiles.py'))
c=f['Tback']()
rows=json.loads(gzip.decompress((root/'data/water-street/native-blind-cells.json.gz').read_bytes()))
pack=[]
for i,coords in rows:
    world=[]
    for x,y,h in coords:
        p,q,*_=c.TransformPoint(x+.5,y+.5)
        cx,cz=([p,q]-f['origin'])*f['scale']
        world.append([cx,cz,h])
    pack.append([i,world])
a.output.write_text(json.dumps(pack,separators=(',',':'))+'\n')
