#!/usr/bin/env python3
"""Convert the existing original canopy art to bounded true-3D sprig/wood inputs."""
import argparse,base64,json,math,random,struct
from pathlib import Path
from collections import defaultdict
from build_canopy import tree
SCENES=[(267,False),(902,False),(351,True),(444,True)]
def build(out):
 models=[]
 for seed,needle in SCENES:
  wood,fol=tree(seed,needle);r=random.Random(seed*717+8)
  voxels=defaultdict(list)
  # Keep a stable silhouette support sample per populated 3D cell, with
  # unsupported sparse foliage receiving no fabricated material.
  for p,size,c in fol:
   cell=tuple(math.floor(v/.052) for v in p)
   voxels[cell].append((p,size,c))
  lumps=[]
  for k,members in sorted(voxels.items()):
   if len(members)<4:continue
   avg=tuple(sum(z[0][i] for z in members)/len(members) for i in range(3))
   keep=r.choices([0,1],weights=[.06,.94])[0]
   size=max(.029,min(.061,(.026+math.log1p(len(members))*.0068)))
   palette=(.95+r.random()*.28)*(.80 if needle else 1.)
   if keep:lumps.append((avg,size,palette,r.random()*math.tau,r.random()*1.38+.20))
  if len(lumps)>755:
   sel=set(r.sample(range(len(lumps)),755))
   lumps=[c for j,c in enumerate(lumps) if j in sel]
  # Broad upright trunks, selected primary supports only; tiny card stems
  # are carried by the sprig shader and do not consume extra geometry.
  sticks=[(a,b,q) for i,(a,b,q) in enumerate(wood)
          if q>=.012 or (i%4==0 and math.dist(a,b)>.090)]
  as_bytes=b''.join(struct.pack('<7h',*(round(t*16000) for t in (*a,*b,q))) for a,b,q in sticks)
  bytes2=b''.join(struct.pack('<7h',*(round(t*4000) for t in (*p,size,palette,yaw,pitch))) for p,size,palette,yaw,pitch in lumps)
  models.append(dict(needle=needle,woodCount=len(sticks),sprigCount=len(lumps),wood=base64.b64encode(as_bytes).decode(),sprigs=base64.b64encode(bytes2).decode()))
 out.write_text('// Generated from tools/art/build_canopy.py; original modeled sprigs, not individual tree surveys.\n'
   +'export const WOODLAND_VOLUMES='+json.dumps(models,separators=(',',':'))+' as const;\n')
 print([(q['woodCount'],q['sprigCount']) for q in models],out.stat().st_size)
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('out',type=Path);build(p.parse_args().out)
