#!/usr/bin/env python3
"""Rebuild the mapped Basin Head Cannery frame and four main roof surfaces."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess

import numpy as np


def reproject(rows, source, target):
    text = ''.join(f'{x:.11f} {y:.11f}\n' for x, y in rows)
    response = subprocess.check_output(['gdaltransform','-s_srs',source,'-t_srs',target],
                                       input=text,text=True)
    return np.array([list(map(float,z.split()[:2])) for z in response.splitlines()])


def obtain(root, stamp):
    from laspy import CopcReader
    from laspy.copc import Bounds
    transport = runpy.run_path(str(root/'tools/geodata/sample-montague-hall.py'))['Range']
    transport.read.__globals__.update(URL=stamp['source'], ETAG=stamp['ETag'], COPC_SIZE=stamp['size'])
    stream = transport()
    with CopcReader(stream,close_fd=False,http_num_threads=1) as cloud:
        p=cloud.query(bounds=Bounds(*np.asarray(stamp['bounds'])))
        keep=~np.asarray(p.withheld).astype(bool)
        return np.c_[p.x,p.y,p.z,np.asarray(p.classification),np.asarray(p.intensity),
                     np.asarray(p.point_source_id)][keep]


def main(root,out,cache):
    s=json.loads((root/'data/basin-cannery/lidar-window.json').read_text())
    b=json.loads((root/'data/odbl/basin-head-channel/cannery-way.json').read_text())
    q=np.load(cache)['points'] if cache and cache.exists() else obtain(root,s)
    assert len(q)==s['count'] and hashlib.sha256(q.astype('<f8').tobytes()).hexdigest()==s['digest']
    if cache and not cache.exists():
        cache.parent.mkdir(parents=True,exist_ok=True)
        np.savez_compressed(cache,points=q)
    p=reproject(b['outer'],'EPSG:4326','EPSG:2961')
    A,B=p[1]-p[0],p[-1]-p[0]
    u,v=np.linalg.solve(np.stack([A,B],axis=1),(q[:,:2]-p[0]).T)
    z=q[:,2];D=np.column_stack([np.ones(len(u)),u,v]);native=(q[:,3]==1)|(q[:,3]==6)
    hold=(np.floor(u*14.38)*31+np.floor(v*19.35)*7+1)%5==0
    roof=(u>.03)&(u<.97)&(v>.025)&(v<.975)&(z>4.5)&native
    def fit(select,low,high,vmax,tol,det,trials,rng,rank_median):
        I=np.flatnonzero(select)
        best=None
        for _ in range(trials):
            J=rng.choice(I,3,replace=False);m=D[J]
            if abs(np.linalg.det(m))<det:continue
            x=np.linalg.solve(m,z[J])
            if not low<x[1]<high or abs(x[2])>=vmax:continue
            err=abs(D[I]@x-z[I]);mask=err<tol
            n=int(mask.sum())
            score=(n, -float(np.median(err[mask])) if rank_median and n else 0)
            if best is None or score>best[0]:best=(score,x)
        assert best is not None
        limit=.10 if rank_median else tol
        K=I[abs(D[I]@best[1]-z[I])<limit]
        return np.linalg.lstsq(D[K],z[K],rcond=None)[0].tolist()
    rng=np.random.default_rng(1371)
    left=fit(roof&~hold&(u>.12)&(u<.49),3.4,14,1.8,.09,.0025,4000,rng,True)
    right=fit(roof&~hold&(u>.57)&(u<.91),-14,-3.4,1.8,.09,.0025,4000,rng,True)
    rng=np.random.default_rng(717)
    eave=(v>.04)&(v<.97)&(z>4.48)&(z<6.85)&native
    leftTo=fit(eave&(u>.105)&(u<.28),1.3,8.2,.90,.125,.0025,5500,rng,False)
    rightTo=fit(eave&(u>.86)&(u<.99),-9.1,-1.3,.90,.125,.0025,5500,rng,False)
    frame=reproject([p[0],p[0]+A,p[0]+B,p[0]+A+B],'EPSG:2961','EPSG:4326')
    plan=dict(id='basin-head-cannery',osmWay=b['way'],worldFrameLonLat=frame.tolist(),
       lengthU=np.linalg.norm(A),lengthV=np.linalg.norm(B),west=left,east=right,eave=6.43,
       authoredFloor=1.96,probedEastWalkHeight=1.92,westFlare=leftTo,eastFlare=rightTo,
       westToe=.112,eastToe=.985)
    out.write_text('// Derived plan frame and roof plane fit from the pinned PEI 2020 public survey.\n'
       'export const BASIN_CANNERY='+json.dumps(plan,indent=2)+' as const;\n')
    print(json.dumps(dict(raw=len(q),mainRoofCandidates=int(roof.sum()),positionalHoldout=int((roof&hold).sum())),indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--native-cache',type=Path)
    a=p.parse_args();main(a.root,a.out,a.native_cache)
