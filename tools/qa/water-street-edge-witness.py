#!/usr/bin/env python3
"""Independent projected roof edge coverage and vertical step witness."""
from pathlib import Path
import json,math,argparse
import numpy as np
from osgeo import ogr
q=argparse.ArgumentParser();q.add_argument('plan',type=Path);a=q.parse_args()
z=json.loads(a.plan.read_text().split('const WATER_STREET_PLAN=')[1].split(' as const;')[0])
def pos(p):
 g=ogr.Geometry(ogr.wkbPoint);g.AddPoint_2D(*p);return g
def line(a,b):
 g=ogr.Geometry(ogr.wkbLineString);g.AddPoint_2D(*a);g.AddPoint_2D(*b);return g
def pairs(r):
 for a,b in zip(r,r[1:]+r[:1]):yield np.asarray(a),np.asarray(b)
def height(p,k):return k[0]+p@k[1:]
failures=0
for q in z['shells']:
 missing=[];sampled=0;entries=[]
 for roof in q['roofs']:
  lines=[]
  for poly in roof['p']:
   for r in poly:
    for a,b in pairs(r):
     lines.append((a,b,line(a,b)))
  entries.append((roof['y'],lines))
 step=[(line(a,b),u,v)for a,b,u,v in q['steps']]
 for k,(pl,edges) in enumerate(entries):
  for j in range(k):
   qo,ed=entries[j]
   for a,b,g in edges:
    n=max(1,math.ceil(np.linalg.norm(a-b)/.23))
    for t in (.5+np.arange(n))/n:
     p=a+(b-a)*t;pt=pos(p)
     if not any(f.Distance(pt)<.00007 for c,d,f in ed):continue
     gap=abs(height(p,pl)-height(p,qo))
     if gap<.055:continue
     sampled+=1
     if not any(g.Distance(pt)<.00008 for g,u,v in step):missing.append((p.tolist(),round(float(gap),4)))
 failures+=len(missing)
 print(q['i'],len(step),sampled,len(missing),max((v for p,v in missing),default=0),missing[:3])
if failures:raise SystemExit('Unclosed roof edges')
