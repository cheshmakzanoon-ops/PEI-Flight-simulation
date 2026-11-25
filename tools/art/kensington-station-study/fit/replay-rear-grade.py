from pathlib import Path
from hashlib import sha256
import numpy as np
import subprocess, sys, json, runpy, tempfile
from laspy import CopcReader
from laspy.copc import Bounds
ROOT=Path(__file__).resolve().parents[4]
P=Path(__file__).resolve().with_name('rear-grade-protocol.json')
want='c990dcc23a900653208f52c483346503145c92118f2f45c09267cf32008a6c46'
assert sha256(P.read_bytes()).hexdigest()==want
d=json.loads(P.read_bytes()); expected=d['copc']; frame=d['frame']; blocks=d['blocks']
lib=runpy.run_path(str(ROOT/'tools/qa/roof-copc-coherence.py'))
wire=lib['OfficialRange'](expected['url'],expected)
project=lib['transform']
offset=np.asarray(frame['originProjected']);b=np.asarray(frame['uprightAxesInEN'])
with CopcReader(wire,close_fd=False,http_num_threads=1) as c:
    wkt=c.header.vlrs.get_by_id('LASF_Projection',(2112,))[0].string.strip(chr(0))
    native=project(np.array([[u,v] for q in blocks for u in q['u'] for v in q['v']])@b+offset,frame['crs'],wkt)
    xyz=c.query(Bounds(native.min(0)-.3,native.max(0)+.3))
    assert len(xyz)<=expected['capCandidatePoints'] and wire.wire<=expected['closedWindowBytesLimit']
    e,n,h=np.asarray(xyz.x),np.asarray(xyz.y),np.asarray(xyz.z)
    loc=(project(np.column_stack((e,n)),wkt,frame['crs'])-offset)@b.T
    cls=np.asarray(xyz.classification); ids=np.asarray(xyz.point_source_id).astype(int)
    t=np.asarray(xyz.gps_time,dtype=np.float64);pulse=t.view(np.uint64)
    good=(cls==2)&np.isfinite(t)&(t>0)&~np.asarray(xyz.withheld,dtype=bool)&~np.asarray(xyz.synthetic,dtype=bool)&~np.asarray(xyz.overlap,dtype=bool)
    counts={};selected=[];owners={};duplicate=0
    for q in blocks:
        k=q['label']
        inside=np.all((loc>=np.array([q['u'][0],q['v'][0]]))&(loc<np.array([q['u'][1],q['v'][1]])),axis=1)
        counts[k]={'allClasses':{str(i):int(np.sum(inside&(cls==i))) for i in np.unique(cls[inside])},
           'usableClass2Returns':int(np.sum(inside&good)),'role':q['role']}
        for i in np.flatnonzero(inside&good):
            key=(int(ids[i]),int(pulse[i]))
            if key in owners:
               assert owners[key]==k,'pulse across fresh boundaries'
               duplicate+=1;continue
            owners[key]=k;selected.append((k,i))
    result={'prelock':want,'bodyWireBytes':wire.wire,'rangeRequests':wire.requests,'sourceETag':wire.etag,
        'queryDecodedPoints':len(xyz),'pointFrameWktHash':sha256(wkt.encode()).hexdigest(),
        'oldPulseDisjointVerified':False,'deduplicatedSameBlockReturns':duplicate,'blocks':counts}
    if selected:
        idx=np.array([i for _,i in selected])
        lonlat=project(np.column_stack((e[idx],n[idx])),wkt,'EPSG:4326').tolist()
        with tempfile.TemporaryDirectory(prefix='pei-kensington-grade-') as temp:
            runner=Path(temp)/'world.mjs'
            stage=Path(__file__).resolve().with_name('rear-grade-world.mjs')
            subprocess.run([str(ROOT/'node_modules/.bin/esbuild'),str(stage),'--bundle','--platform=node',
              '--format=esm','--define:import.meta.env={}','--outfile='+str(runner)],
              cwd=ROOT,capture_output=True,check=True)
            p=subprocess.run(['node',str(runner),str(ROOT)],input=json.dumps(lonlat),capture_output=True,text=True,check=True)
        comparison=json.loads(p.stdout);assert len(comparison)==len(idx)
        by={}
        for o,(k,i) in zip(comparison,selected):
            assert o['cover']>0
            by.setdefault(k,[]).append(np.array([h[i],h[i],h[i]])-o['y'])
        for k,row in counts.items():row['uniquePulses']=len(by.get(k,[]))
        if all(v['uniquePulses']>=12 for v in counts.values()):
            fit_r=[n for k,v in counts.items() if v['role']=='fit' for n in by[k]]
            common=float(np.median(np.array(fit_r)[:,0]))
            result['fitCommonCGVD2013MinusCurrentGameN112M']=common
            for k,row in counts.items():
              centered=np.array(by[k])-common
              row.update(residualMedianM=np.median(centered,axis=0).tolist(),
                    p90AbsoluteM=np.percentile(abs(centered),90,axis=0).tolist())
        else:result['hold']='Insufficient unique class-2 support for these prelocked blocks; no offset or mounting.'
print(json.dumps(result,indent=2))
