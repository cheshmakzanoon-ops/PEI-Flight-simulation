"""Evaluate simple roofs on held-out native 3m blocks, with no game geometry exported."""
from pathlib import Path
import argparse, gzip, hashlib, json, math
import numpy as np
from osgeo import osr

WIRE = 'e463fe9b6df51d4d8ca540dc3074496fbee609a680a206e7b5ce0f5fbf9ecb8d'
POS = '6c78563cebe351ca66690a205e46219125feed43a6973cfd3115dda396b78779'
FIXTURE = 'dc3d3c1fbd4e41ba00b67e70a7479059238a2b1f1938f178c7224fb5220c0f7b'
INPUTS = ('0823bd2e6792c3cdf0f2493990e5bc8b7fef39ac7486b6e1e2f290069f4a2c93',
          'adf6c6d114d87b75a53d790ee0d00297639f485a01f60d8cd20a953afcd56e94')
LOCK = '464ee5711a30dcd9fd5e4a8f762537c13e2095e4e8306f5877ba8a8b9bcda67e'
STOCK_LOCK = '1a312dff21b546dc6031a0dd24ced7df9653931652f2be864670ddf0c5a0d639'
GRID = (2284018., 1., 0., 338897., 0., -1.)

def sha(b): return hashlib.sha256(b).hexdigest()
def pin(path, digest):
    b = path.read_bytes()
    if sha(b) != digest:
        raise ValueError(f'byte fingerprint changed: {path.name}')
    return b

def mask(ring, x, y):
    inside = np.zeros(x.shape, bool)
    edge = np.full(x.shape, np.inf)
    for (a, b), (c, d) in zip(ring, np.roll(ring, -1, axis=0)):
        dx, dy = c-a, d-b
        if dx == dy == 0: raise ValueError('zero source polygon edge')
        if dy:
            inside ^= ((b > y) != (d > y)) & (x < a+(y-b)*dx/dy)
        u = np.clip(((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy), 0, 1)
        edge = np.minimum(edge, np.hypot(x-a-u*dx, y-b-u*dy))
    return inside, edge

def horizontal_transform():
    sr = []
    for code in [4326, 3979]:
        s = osr.SpatialReference()
        if s.ImportFromEPSG(code): raise ValueError('CRS unavailable')
        s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        sr.append(s)
    return osr.CoordinateTransformation(*sr)

def quant(v):
    return dict(zip(('median','p90','p95','max'), map(float, np.quantile(v,[.5,.90,.95,1]))))

def fit_robust(a, z):
    b = np.linalg.lstsq(a,z,rcond=None)[0]
    for _ in range(6):
        r = np.abs(a @ b-z)
        w = np.sqrt(np.minimum(1., .22/np.maximum(r,1.e-12)))
        b = np.linalg.lstsq(a*w[:,None], z*w, rcond=None)[0]
    return b

def basis(q, axis, d):
    s=q @ axis-d
    return np.c_[np.ones(len(q)),np.minimum(s,0),-np.maximum(s,0)]

def fit_ridges(q,z,t,ring):
    best = None
    for deg in range(0,180,5):
        a = np.array([math.cos(math.radians(deg)),math.sin(math.radians(deg))])
        k=ring@a
        for f in np.linspace(.23,.77,13):
            d=float(k.min()+f*np.ptp(k))
            u=q@a-d
            if min(np.sum((u<-.6)&t),np.sum((u>.6)&t))<12: continue
            v=basis(q,a,d); b=fit_robust(v[t],z[t])
            if min(b[1:]) < .10 or max(b[1:]) > 1.60: continue
            e=np.abs(v[t]@b-z[t])
            score = .70*np.quantile(e,.5)+.30*np.quantile(e,.9)
            if best is None or (score,deg,d)<best[0]:
                best=((score,deg,d),v@b,a,d,b,u)
    return best

def get_rows(root):
    build=root/'public/world/buildings'
    m=json.loads((build/'index.json').read_text())
    p=next(a for a in m['tiles'] if a['id']=='q221232')
    assert (p['offset'],p['bytes'],p['sha256'])==(3765681,13660,WIRE)
    with (build/'tiles.pack').open('rb') as f:
        f.seek(p['offset']); data=f.read(p['bytes'])
    assert sha(data)==WIRE
    rows=json.loads(gzip.decompress(data))['features']
    assert len(rows)==310
    return rows

def stock_at(xy, p, transform, base):
    # The original render owner is unscaled on this exact archived route.
    flat=p[:,[0,2]].astype(float)+np.asarray(base)[[0,2]]
    rad=math.pi/180; phi=46.5*rad; ellip=6.69437999014e-3
    t=1-ellip*math.sin(phi)**2
    slon=6378137*rad*math.cos(phi)/math.sqrt(t)
    slat=6378137*(1-ellip)*rad/t**1.5
    coords=np.c_[-63.2+flat[:,0]/slon,46.5-flat[:,1]/slat]
    render=np.asarray(transform.TransformPoints(coords.tolist()))[:,:2]
    out=np.full(len(xy),np.nan)
    for j in range(0,len(p),3):
        a,b,c=render[j:j+3]
        E=np.stack([b-a,c-a],axis=1)
        if abs(np.linalg.det(E))<1.e-4: continue
        bc=(xy-a) @ np.linalg.inv(E).T
        within=(bc>=-1.e-7).all(axis=1)&(bc.sum(axis=1)<=1+1.e-7)
        v=p[j:j+3,1].astype(float)+base[1]
        ys=v[0]+bc[within]@(v[1:]-v[0])
        if np.any(np.isfinite(out[within]) & (np.abs(out[within]-ys)>1.e-4)):
            raise ValueError('overlapping stock roof facets with inconsistent heights')
        out[within]=ys
    return out

def case(name, roof, r, g, s, x, y, transform, p, pre, stock_lock):
    ring = np.asarray(transform.TransformPoints(r['footprint']))[:, :2]
    limits=(GRID[0],GRID[0]+256,GRID[3]-256,GRID[3])
    reserve=min(ring[:,0].min()-limits[0],limits[1]-ring[:,0].max(),
                ring[:,1].min()-limits[2],limits[3]-ring[:,1].max())
    if reserve < pre['unfilteredFootprintGuardM']: raise ValueError('crop clips protected roof '+name)
    inside,edge=mask(ring,x,y)
    ij=np.where(inside&(edge>=pre['unfilteredFootprintGuardM']))
    assert np.isfinite(g[ij]).all() and np.isfinite(s[ij]).all()
    assert (g[ij]>-32000).all() and (s[ij]>-32000).all()
    xy=np.c_[x[ij],y[ij]]
    center=ring.mean(axis=0)
    q=xy-center; z=s[ij].astype(float)
    gmed=float(np.median(g[ij]))
    pos=p[roof[0]:roof[1]]
    assert len(pos)==roof[1]-roof[0] and len(pos)%3==0
    native_cells=len(z)
    stock=stock_at(xy,pos,transform,stock_lock['stockOwnerWorldOffsetXYZ'])
    have=np.isfinite(stock)
    cov=float(have.mean())
    if cov<stock_lock['minSharedCoverageFraction']:
        raise ValueError(f'not enough exact shared roof support: {name} {cov:g}')
    xy,q,z,stock=xy[have],q[have],z[have],stock[have]
    block=np.floor_divide(xy,pre['blockM']).astype(np.int64)
    group=(block[:,0]*7+block[:,1]*3+1)%pre['folds']
    fitted={'flat':np.zeros(len(z)), 'shed':np.zeros(len(z)), 'ridge':np.full(len(z),np.nan), 'stockRelevelled':np.full(len(z),np.nan)}
    rep=[]
    for f in range(pre['folds']):
        h=group==f; t=~h
        assert h.sum()>=pre['minHeld'] and t.any()
        v=np.c_[np.ones(len(q)),q]
        flat=np.full(h.sum(),np.median(z[t]))
        shed=v[h] @ fit_robust(v[t],z[t])
        fitted['flat'][h]=flat
        fitted['shed'][h]=shed
        level=float(np.median(z[t]-stock[t]))
        fitted['stockRelevelled'][h]=stock[h]+level
        ridge=fit_ridges(q,z,t,ring-center)
        F=dict(fold=f,train=int(t.sum()),held=int(h.sum()),flat=quant(np.abs(flat-z[h])),
               shed=quant(np.abs(shed-z[h])),stockTrainingOffsetM=level,
               stockRelevelled=quant(np.abs(stock[h]+level-z[h])),ridge=None)
        if ridge:
            ((loss,deg,d),rp,axis,d,b,u)=ridge
            fitted['ridge'][h]=rp[h]
            F['ridge']={'degreesNormalFromEPSG3979East':deg,'offsetM':d,'topCGVD2013M':float(b[0]),
              'slopeLR':b[1:].tolist(),'heldSides':[int(np.sum(h&(u<-.6))),int(np.sum(h&(u>.6)))],
              **quant(np.abs(rp[h]-z[h]))}
        rep.append(F)
    scores={k:None if not np.isfinite(v).all() else quant(np.abs(v-z)) for k,v in fitted.items()}
    verdict=[]
    if native_cells<pre['minNativeSamples']: verdict.append('too few native cells')
    if not scores['ridge']: verdict.append('ridge not supported in every training set')
    if scores['ridge']:
        if scores['stockRelevelled']['p90']-scores['ridge']['p90']<stock_lock['minHeldP90BenefitOverNativeStockShapeMetres']:
            verdict.append('insufficient shape benefit versus actual relevelled stock triangles')
        dirs=np.asarray([f['ridge']['degreesNormalFromEPSG3979East'] for f in rep]);d=np.asarray([f['ridge']['offsetM'] for f in rep]);
        wrapped=np.where(np.abs(dirs-dirs[0])>90,dirs+180*np.sign(dirs[0]-dirs),dirs)
        offs=np.where(wrapped!=dirs,-d,d)
        if np.ptp(wrapped)>pre['maxRidgeAzimuthSpreadDegrees']: verdict.append('ridge azimuth unstable')
        if np.ptp(offs)>pre['maxRidgeNormalOffsetSpreadM']: verdict.append('ridge offset unstable')
        if scores['ridge']['p90']>pre['maxPooledP90M'] or scores['ridge']['median']>pre['maxPooledMedianM']:
            verdict.append('pooled held residual')
        if any(f['ridge']['p90']>pre['maxFoldP90M'] or min(f['ridge']['heldSides'])<pre['minEachRidgeSideHeld'] for f in rep):
            verdict.append('fold residual or sparse held side')
        if min(scores[x]['p90'] for x in ['flat','shed'])-scores['ridge']['p90']<pre['minRidgeP90BenefitOverBetterPlanarModelM']:
            verdict.append('small pooled benefit versus planar')
        if sum(f['ridge']['p90']<min(f['flat']['p90'],f['shed']['p90']) for f in rep)<pre['minRidgeFoldBenefitVotes']:
            verdict.append('weak per-fold benefit versus planar')
    return {'roofSpan':roof,'cropReserveM':float(reserve),'nativeCells':native_cells,'sharedCells':len(z),'sharedCoverageFraction':cov,
            'nativeGroundMedianCGVD2013M':gmed,'sourceSurfaceCGVD2013M':quant(z),
            'stockGameYRoofMinMaxM':[float(pos[:,1].min()),float(pos[:,1].max())],
            'unregisteredRawStockToSourceAbsDifferenceM':quant(np.abs(stock-z)),'comparisonOfHeightDatumsNotAnAuthority':True,
            'pointOffsetOriginEPSG3979M':center.tolist(),'scores':scores,'folds':rep,
            'status':'HOLD' if verdict else 'PASS detached ridge screen only','holds':verdict}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    for n in ('stock-pos','root','out'):
        ap.add_argument('--'+n,required=True,type=Path)
    a=ap.parse_args()
    pre=json.loads(pin(Path(__file__).with_name('PRELOCK.json'),LOCK))
    path=Path(__file__).with_name('fixtures')
    source=json.loads(pin(path/'source.json',FIXTURE))
    assert source['grid']==dict(originNWEdgeEPSG3979=[2284018,338897],vertical='CGVD2013',
                                spacingM=1,columns=256,rows=256)
    raw=[]
    for k,tiff in zip(('dtm','dsm'),INPUTS):
        p=source['pair'][k]
        assert p['cropGeoTIFFSHA256']==tiff and p['rawBytes']==256*256*4
        payload=gzip.decompress(pin(path/(k+'.f32le.gz'),p['archiveSHA256']))
        assert sha(payload)==p['rawSHA256'] and len(payload)==p['rawBytes']
        raw.append(np.frombuffer(payload,'<f4').reshape(256,256))
    g,s=raw
    row,col=np.indices(g.shape)
    y,x=GRID[3]-row-.5,GRID[0]+col+.5
    src=get_rows(a.root)
    p=np.frombuffer(pin(a.stock_pos,POS),'<f4').reshape(-1,3)
    assert len(p)==18048
    transform=horizontal_transform()
    stock_lock=json.loads(pin(Path(__file__).with_name('STOCK-COMPARISON.json'),STOCK_LOCK))
    result={k:case(k,v,src[int(k)],g,s,x,y,transform,p,pre,stock_lock) for k,v in pre['q221232'].items()}
    record={'scope':pre['scope'],'prelock':LOCK,'stockComparisonLock':STOCK_LOCK,'p':POS,'wire':WIRE,'sourceTifSHA':INPUTS,'cases':result}
    with a.out.open('x') as out:
        out.write(json.dumps(record,indent=2)+'\n')
    for n,c in result.items():
        print(n,c['nativeCells'],[round(v['p90'],4) if v else None for v in c['scores'].values()],c['status'],c['holds'])

if __name__=='__main__': main()
