#!/usr/bin/env python3
"""Fit the scoped Basin Head wharf stations and verify the checked-in recipe."""
import argparse
import hashlib
import json
import runpy
import subprocess
from pathlib import Path

import numpy as np

ROOT=Path(__file__).resolve().parents[2]
RECEIPT=json.loads((ROOT/'data/basin-wharf/lidar-window.json').read_text())
WAY=json.loads((ROOT/'data/odbl/basin-head-channel/wharf-way.json').read_text())
# The OSM way gives orientation, not the east edge: on 2020 high-to-low
# transects the actual shelf extends outside the older generalized line.
# Columns are station, conservative dry-side extent, measured east lip.
CUT=np.asarray([[1.5,.70,8.90],[8.3,.38,8.95],[12.6,.65,8.80],[17.25,1.28,8.63],
 [21.2,1.24,8.45],[27.5,1.23,8.42],[33.0,1.28,8.35],[39.0,1.31,8.30],
 [41.5,1.28,8.22],[43.0,1.27,7.48],[44.6,1.26,7.15],[47.0,1.21,7.12],
 [48.6,1.23,7.11]])

def crs(a,src,dst):
    pair=''.join(f'{x:.10f} {y:.10f}\n' for x,y in a)
    lines=subprocess.check_output(['gdaltransform','-s_srs',src,'-t_srs',dst],input=pair,text=True)
    return np.asarray([[float(v) for v in line.split()[:2]] for line in lines.splitlines()])

def reacquire():
    from laspy import CopcReader
    from laspy.copc import Bounds
    stream=runpy.run_path(str(ROOT/'tools/geodata/sample-montague-hall.py'))['Range']
    stream.read.__globals__.update(URL=RECEIPT['source'],ETAG=RECEIPT['ETag'],COPC_SIZE=RECEIPT['size'])
    with CopcReader(stream(),close_fd=False,http_num_threads=1) as source:
        p=source.query(bounds=Bounds(*map(np.asarray,RECEIPT['bounds'])))
        accept=~np.asarray(p.withheld).astype(bool)
        return np.c_[p.x,p.y,p.z,np.asarray(p.classification),np.asarray(p.intensity),np.asarray(p.point_source_id)][accept]

def toe_frame():
    p=crs([node[1:] for node in WAY['way']['nodes']],'EPSG:4326','EPSG:2961')
    o=p[0]
    axis=p[5]-o;axis/=np.linalg.norm(axis)
    lateral=np.array([axis[1],-axis[0]])
    points=crs([o,o+axis*50,o+lateral*10],'EPSG:2961','EPSG:4326')
    rad=np.pi/180; e2=.00669437999014; phi=46.5*rad
    f=1-e2*np.sin(phi)**2
    m_lon=6378137*rad*np.cos(phi)/np.sqrt(f)
    m_lat=6378137*rad*(1-e2)/f**1.5
    points=np.c_[(points[:,0]+63.2)*m_lon,(46.5-points[:,1])*m_lat]
    native=np.linalg.inv(np.column_stack(((points[1]-points[0])/50,(points[2]-points[0])/10)))
    # A local affine, not a scale change to the simulator projection.
    info={'anchor':points[0].tolist(),'toNative':native.tolist(),'profile':CUT[:,[0,2]].tolist()}
    return ('// Registered to the same 2020 native wharf cross-sections.\n'
            +'export const BASIN_WHARF_TOE='
            +json.dumps(info,indent=2)+' as const;\n')

def stable_trace(q):
    assert q.shape==(RECEIPT['count'],6) and np.isfinite(q).all()
    assert hashlib.sha256(q.astype('<f8').tobytes()).hexdigest()==RECEIPT['digest']
    p=crs([node[1:] for node in WAY['way']['nodes']],'EPSG:4326','EPSG:2961')
    o=p[0]
    axis=p[5]-o;axis/=np.linalg.norm(axis)
    lateral=np.array([axis[1],-axis[0]])
    s,t=(q[:,:2]-o)@axis,(q[:,:2]-o)@lateral
    z=q[:,2]
    lo,hi=np.interp(s,CUT[:,0],CUT[:,1]),np.interp(s,CUT[:,0],CUT[:,2])
    sel=(s>=CUT[0,0])&(s<=CUT[-1,0])&(t>lo+.25)&(t<hi-.25)&(q[:,3]==2)&(z>=1.8)&(z<=2.12)
    hold=(np.floor(s/.85)+np.floor(t/.5)).astype(int)%5==4
    lines=[]
    trainCounts=[]
    height=[]
    edgeS=[]
    for k,left,right in CUT:
        # Different flight lines sample lip and toe unevenly. Check the
        # selected section against the continuous low-side rise/drop in a
        # short support band and leave all uncertain subsurface work out.
        high=(abs(s-k)<1.)&(t>right-.7)&(t<right+.3)&(z>=1.79)&(z<=2.14)&np.isin(q[:,3],[1,2])
        low=(abs(s-k)<1.9)&(t>=right-.16)&(t<right+2.7)&(z<.55)&np.isin(q[:,3],[1,2,9])
        assert int(high.sum())>=3,(k,'high shelf',int(high.sum()))
        assert low.any() or k<4.,(k,'no low samples adjacent')
        edgeS.append([float(k),int(high.sum()),int(low.sum())])
        ix=sel&~hold&(abs(s-k)<3)&(t>left+.1)&(t<right-.1)
        assert ix.sum()>60,(k,int(ix.sum()))
        level=round(float(np.median(z[ix])),3);height.append(level);trainCounts.append(int(ix.sum()))
        a,b1=crs([o+k*axis+left*lateral,o+k*axis+right*lateral],'EPSG:2961','EPSG:4326')
        lines.append(f'  [{k:g}, {level:g}, [{a[0]:.11f}, {a[1]:.11f}], [{b1[0]:.11f}, {b1[1]:.11f}]],\n')
    idx=sel&hold
    error=abs(np.interp(s[idx],CUT[:,0],height)-z[idx])
    assert len(error)==383 and np.quantile(error,.90)<.037
    report={'trainingReturnsPerStation':trainCounts,'blockedReturns':int(idx.sum()),
            'sourceP50AbsM':float(np.quantile(error,.5)),'sourceP90AbsM':float(np.quantile(error,.90)),
            'stationBoundsM':[float(CUT[0,0]),float(CUT[-1,0])],'edgeStationHighAndAdjacentLowCounts':edgeS}
    held=np.c_[crs(q[idx,:2],'EPSG:2961','EPSG:4326'),z[idx]].tolist()
    source='// Surveyed 2020 outer wharf interval. Source and model limits: data/basin-wharf/.\n'
    return source+'export const BASIN_WHARF_SECTIONS = [\n'+''.join(lines)+'] as const;\n',report,held

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-npz',type=Path,help='Use a cached exact points crop instead of a bounded HTTPS request')
    p.add_argument('--out',type=Path,required=True)
    a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    q=np.load(a.source_npz)['points'] if a.source_npz else reacquire()
    if not a.source_npz:np.savez_compressed(a.out/'wharf-copc.npz',points=q)
    ts,report,held=stable_trace(q)
    (a.out/'basin-wharf.generated.ts').write_text(ts)
    (a.out/'fit-gate.json').write_text(json.dumps(report,indent=2)+'\n')
    (a.out/'heldout.json').write_text(json.dumps(held)+'\n')
    (a.out/'basin-wharf-toe.generated.ts').write_text(toe_frame())

if __name__=='__main__':
    main()
