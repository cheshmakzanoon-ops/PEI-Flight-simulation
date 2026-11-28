"""Produce exact pre-Z principal-body eligibility. Does not read point Z."""
from pathlib import Path
from hashlib import sha256
import gzip, argparse, json, subprocess
import numpy as np
from laspy import CopcReader, DecompressionSelection as Sel
from laspy.copc import Bounds

def digest(b): return sha256(b).hexdigest()
def transform(s,t,xy):
    r=subprocess.run(['gdaltransform','-s_srs',f'EPSG:{s}','-t_srs',f'EPSG:{t}'],
       input=''.join(f'{x:.15f} {y:.15f}\n' for x,y in xy),
       capture_output=True,text=True,timeout=40,check=True)
    nums=np.loadtxt(r.stdout.splitlines(),ndmin=2)
    if nums.shape!=(len(xy),3):raise ValueError('unexpected projected layout')
    return nums[:,:2]

def domain(ring, pts):
    x,y=pts.T; belongs=np.zeros(len(pts),bool); gap=np.full(len(pts),np.inf)
    for (a,b),(c,d) in zip(ring,np.roll(ring,-1,axis=0)):
        dx=c-a;dy=d-b
        if dy: belongs^=((b>y)!=(d>y))&(x<a+(y-b)*dx/dy)
        u=np.clip(((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy),0.,1.)
        gap=np.minimum(gap,np.hypot(x-(a+u*dx),y-(b+u*dy)))
    return belongs,gap

def selected(root, copc, plan):
    atlas=root/'public/world/buildings/'
    off,n,h=plan['signedTile']
    roster=json.loads((atlas/'index.json').read_text())
    p=next(v for v in roster['tiles'] if v['id']=='q221232')
    assert (p['offset'],p['bytes'],p['sha256'])==(off,n,h)
    with (atlas/'tiles.pack').open('rb') as f:
        f.seek(off);packet=f.read(n)
    assert len(packet)==n and digest(packet)==h
    row=json.loads(gzip.decompress(packet))['features'][84]
    A=np.asarray(row['footprint']);assert A.shape==(9,2)
    W=transform(4326,3979,A); C=transform(4326,2961,A)
    assert copc.stat().st_size==69119327
    with copc.open('rb') as handle:
        from hashlib import file_digest
        assert file_digest(handle,'sha256').hexdigest()==plan['nativeCOPC']
    flags=Sel.XY_RETURNS_CHANNEL|Sel.CLASSIFICATION|Sel.FLAGS|Sel.GPS_TIME
    assert not(int(flags)&int(Sel.Z))
    bounds=Bounds(C.min(0)-2.001,C.max(0)+2.001)
    with CopcReader.open(copc,decompression_selection=flags) as f:
        wkt=next(x.string for x in f.header.vlrs if x.__class__.__name__=="WktCoordinateSystemVlr"); assert 'AUTHORITY["EPSG","2961"]' in wkt
        points=f.query(bounds)
    XY=np.c_[np.asarray(points.x),np.asarray(points.y)]
    T=transform(2961,3979,XY)
    P=W[plan['principal']]
    I,ID=domain(W,T); J,JD=domain(P,T)
    inside=I&J&(ID>=plan['minInboardM'])&(JD>=plan['minInboardM'])
    cls=np.asarray(points.classification); first=np.asarray(points.return_number)==1
    ok=(cls==6)&first
    for pat in ('synthetic','key_point','withheld','overlap'): ok&=~np.asarray(getattr(points,pat)).astype(bool)
    gp=np.asarray(points.gps_time)
    idx=np.where(inside&ok&np.isfinite(gp)&(gp!=0))[0]
    raw=np.c_[np.asarray(points.X),np.asarray(points.Y)]
    _,ri,rc=np.unique(raw[idx],axis=0,return_inverse=True,return_counts=True)
    _,gi,gc=np.unique(gp[idx],return_inverse=True,return_counts=True)
    idx=idx[(rc[ri]==1)&(gc[gi]==1)]
    o=W[plan['originRingIndex']];u=W[plan['uDirectionTowardRingIndex']]-o;u/=np.linalg.norm(u)
    v=np.array([u[1],-u[0]])
    assert (W[plan['vDirectionTowardRingIndex']]-o)@v>0
    frame=np.stack((u,v),1)
    uv=(T-o)@frame
    uf=np.floor(uv[idx]/plan['localCellsM']).astype(np.int64)
    _,li,lc=np.unique(uf,axis=0,return_inverse=True,return_counts=True)
    idx=idx[lc[li]>=plan['minEligibleFirstsPerLocalCell']]
    slabs=np.floor(uv[idx,1]/plan['blocksM']).astype(int)
    cohorts=[idx[np.isin(slabs,plan['authorSlabs'])],*[idx[slabs==j] for j in plan['heldSlabs']]]
    return o,u,v,W,cohorts,uv,raw,gp,bounds

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for flag in ('root','copc','out'):p.add_argument('--'+flag,type=Path,required=True)
    a=p.parse_args()
    raw_plan=Path(__file__).with_name('plan.json').read_bytes()
    plan=json.loads(raw_plan)
    o,u,v,W,cohorts,uv,raw,gp,_=selected(a.root,a.copc,plan)
    result=[]
    for k,ii in zip(('author','held1','held3'),cohorts):
        j=ii[np.lexsort((gp[ii],raw[ii,1],raw[ii,0]))]
        a1=np.empty(len(j),dtype=[('x','<i4'),('y','<i4'),('time','<f8')])
        a1['x'],a1['y'],a1['time']=raw[j,0],raw[j,1],gp[j]
        cells=np.floor(uv[j]).astype(int)
        result.append({'cohort':k,'handles':len(j),'cells':len(np.unique(cells,axis=0)),
                       'blocks':len(np.unique(np.floor(uv[j]/3).astype(int),axis=0)),
                       'canonicalRowsSHA256':digest(a1.tobytes())})
    status=[r['handles'] for r in result]
    vout={'status':'independent handles match prereg count' if status==plan['expectedIndependentWitnessCounts'] else 'HOLD support differs',
       'noZAccess':True,'ownerRing3979SHA256':digest(np.asarray(W,'<f8').tobytes()),
       'planSHA256':digest(raw_plan),'origin':list(o),'u':list(u),'v':list(v),'cohorts':result}
    with a.out.open('x') as f:f.write(json.dumps(vout,indent=2)+'\n')
    print(vout)
    if status!=plan['expectedIndependentWitnessCounts']:raise SystemExit(1)
if __name__=='__main__':main()
