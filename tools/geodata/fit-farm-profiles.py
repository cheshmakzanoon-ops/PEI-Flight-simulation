#!/usr/bin/env python3
"""Fit only locally supported plane/roof profiles in native survey windows."""
from collections import Counter,defaultdict
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from scipy.spatial import ConvexHull
from osgeo import osr
import numpy as np
import gzip,math,json,hashlib,argparse,sys
osr.UseExceptions()
def xyproj(code):
    s=osr.SpatialReference();s.ImportFromEPSG(code);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
def Tback():
    return osr.CoordinateTransformation(xyproj(3979),xyproj(4326))
m=6378137*math.pi/180;f=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=np.array([m*math.cos(math.radians(46.5))/math.sqrt(f),-m*(1-.00669437999014)/f**1.5]);origin=np.array([-63.2,46.5])
def mask_unit(r,x,y):
    inside=np.zeros(x.shape,dtype=bool);margin=np.full(x.shape,np.inf)
    for a,b in zip(r,np.roll(r,-1,axis=0)):
        dx,dy=b-a
        if dx==dy==0:continue
        if dy!=0:inside ^= ((a[1]>y)!=(b[1]>y)) & (x<(y-a[1])*dx/dy+a[0])
        u=np.clip(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy),0,1)
        margin=np.minimum(margin,np.hypot(x-a[0]-u*dx,y-a[1]-u*dy))
    return inside,margin
def fprint(s,g):
    h=hashlib.sha256()
    for a in (s,g):h.update(np.ascontiguousarray(a,dtype='<f4').tobytes())
    return h.hexdigest()
def gfit(X,y,iterations=0):
    try:
        c=np.linalg.lstsq(X,y,rcond=None)[0]
        err=np.abs(X@c-y)
        for _ in range(iterations):
            w=np.sqrt(np.minimum(1,.20/np.maximum(err,1e-4)))
            c=np.linalg.lstsq(X*w[:,None],y*w,rcond=None)[0]
            err=np.abs(X@c-y)
        return c,err
    except np.linalg.LinAlgError:
        return None,np.full(len(y),1e10)
def sample_old(local,r,c):
    h,lo=c['h'],max(c['h']*.55,c['lo'])
    if len(r)!=4 or h-lo<=.65:return np.full(len(local),h)
    if np.linalg.norm(r[0]-r[1])>np.linalg.norm(r[1]-r[2]):r=np.roll(r,-1,axis=0)
    a,b,c,d=r;ab=(a+b)/2;cd=(c+d)/2
    out=np.full(len(local),np.nan)
    for t,he in (((a,ab,cd),(lo,h,h)),((a,cd,d),(lo,h,lo)),((b,c,cd),(lo,lo,h)),((b,cd,ab),(lo,h,h))):
        o,dd,bb=t;uv=(local-o)@np.linalg.inv(np.stack([dd-o,bb-o])).copy()
        at=(uv[:,0]>=-1e-5)&(uv[:,1]>=-1e-5)&(uv.sum(axis=1)<=1+1e-5)
        out[at]=he[0]*(1-uv[at].sum(axis=1))+uv[at]@np.array(he[1:])
    return out
def rank(h):
    return (.7*np.quantile(h,.5)+.3*np.quantile(h,.9))
def cap(v,lo,hi):
    return v>=lo and v<=hi
def fit(args):
    filename,records=args
    D=np.load(filename)
    trans=Tback()
    outputs=[]
    for c in records:
        k=c['tile']+'_'+str(c['i'])
        if not k+'_origin' in D:continue
        s,g,o=(D[k+'_'+i] for i in ('surface','ground','origin'))
        rr=np.asarray(c['survey'])
        yy,xx=np.indices(s.shape);xx,yy=o[0]+xx,o[1]-yy
        inside,margin=mask_unit(rr,xx,yy)
        # Reject ordinary raster blend on the roof edge and discontinuities/NoData or treetops in the interior.
        guard=1.20 if c['width']<=10 else 1.55
        sample=inside & (margin>=guard)
        raster=sample & np.isfinite(s)&np.isfinite(g)&(g>-200)&(s>-200)&(s-g>1.3)&(s-g<30)
        if raster.sum()<65 or raster.sum()<sample.sum()*.965:
            outputs.append((k,'few-valid-cells'));continue
        # Fit in exactly the game's coordinates, not in Lambert. Training never sees the blind 3m blocks.
        ss=s[raster].astype(float)
        sv=np.c_[xx[raster],yy[raster]]
        uv=np.array(trans.TransformPoints(sv.tolist()))[:,:2]
        xy=(uv-origin)*scale-c['world']
        ring=(np.asarray(c['fp'])-origin)*scale-c['world']
        block=np.floor_divide(sv,3).astype(int)
        hold=(block[:,0]*13+block[:,1]*7+3)%5==0
        if min(hold.sum(),(~hold).sum())<13:
            outputs.append((k,'holdout-small'));continue
        fold=~hold
        gun=np.asarray(c['xy'])
        u,v=gun[0]-o[0],o[1]-gun[1];iu,iv=math.floor(u),math.floor(v);a,b=u-iu,v-iv
        ground=float(np.einsum('j,i,ji',np.array([1-b,b]),np.array([1-a,a]),g[iv:iv+2,iu:iu+2]))
        Y=ss-ground
        if not -200<ground<180:outputs.append((k,'base-datum'));continue
        old=sample_old(xy,ring,c)
        null=np.abs(old[hold]-Y[hold])
        if not np.isfinite(null).all():outputs.append((k,'old-triangular-coverage'));continue
        ref=float(np.quantile(null,.90));ref50=float(np.quantile(null,.50))
        short=[]
        const=np.ones((len(Y),1));train=Y[fold]
        flat=np.median(train);flatR=np.abs(train-flat)
        short.append((rank(flatR),0,np.array([0.,1.]),[],np.array([flat]),const))
        X=np.c_[np.ones(len(Y)),xy]
        coeff,err=gfit(X[fold],train,2)
        if coeff is None:outputs.append((k,'ill-conditioned'));continue
        slope=np.linalg.norm(coeff[1:])
        if .035<slope<.55:short.append((rank(err)+.030,1,coeff[1:]/slope,[],np.array([coeff[0],slope]),np.c_[np.ones(len(Y)),xy@(coeff[1:]/slope)]))
        t0=math.atan2(c['axis'][0],-c['axis'][1])
        try:
            hh=ConvexHull(ring)
            hullRatio=hh.volume/c['area']
        except Exception:outputs.append((k,'irregular plan'));continue
        if hullRatio>1.017:
            # First roof-shell pass is inboard joinery for safe near-convex plans only.
            outputs.append((k,'irregular plan'));continue
        for delta in [-8,-4,-2,0,2,4,8]:
            t=t0+math.radians(delta)
            n=np.array([math.cos(t),math.sin(t)])
            s=xy@n
            R=ring@n
            lo,hi=R.min(),R.max();span=hi-lo
            O=np.ones(len(s))
            possible=[]
            for frac in [.34,.39,.43,.465,.50,.535,.57,.61,.66]:
                r=lo+span*frac;dx=s-r
                if min((dx[fold]<-1).sum(),(dx[fold]>1).sum())<14:continue
                M=np.column_stack([O,s,np.maximum(0,dx)])
                coef,er=gfit(M[fold],train)
                if coef is None:continue
                if cap(coef[1],.08,1.52) and cap(-coef[1]-coef[2],.08,1.52):
                    possible.append((rank(er)+.043,2,n,[r],coef,M))
            if not possible:continue
            short.extend(sorted(possible,key=lambda x:x[0])[:2])
            # Both shoulders must be resolved in the training data, not extrapolated on a small low roof.
            for best in sorted(possible,key=lambda x:x[0])[:1]:
                if span<10.1 or best[0]<.113 or c['h']-c['lo']<2.6:continue
                for dr in [-.021,0.,.021]:
                    ridge=best[3][0]+dr*span
                    for shoulder in [.48,.57,.66,.75]:
                        tl=ridge-(ridge-lo)*shoulder;tr=ridge+(hi-ridge)*shoulder
                        if min((s[fold]<tl).sum(),(s[fold]>tr).sum())<9:continue
                        M=np.column_stack([O,s,np.maximum(0,s-tl),np.maximum(0,s-ridge),np.maximum(0,s-tr)])
                        a,e=gfit(M[fold],train)
                        if a is None:continue
                        slopes=np.cumsum(a[1:])
                        if (cap(slopes[0],.52,3.0) and cap(slopes[1],.078,.95)
                            and cap(-slopes[2],.078,.95) and cap(-slopes[3],.52,3.0)
                            and slopes[0]-slopes[1]>.27 and slopes[2]-slopes[3]>.27):
                            short.append((rank(e)+.108,3,n,[tl,ridge,tr],a,M))
        if not short:outputs.append((k,'no candidates'));continue
        maybe=[]
        candidates=sorted(short,key=lambda x:x[0])
        for _,kind,n,breaks,a,M in candidates[:8]:
            a,er=gfit(M[fold],train,3)
            if a is None:continue
            sl=np.cumsum(a[1:])
            if ((kind==2 and not(.076<=sl[0]<=1.54 and .076<=-sl[1]<=1.54))
                or (kind==3 and not(.48<=sl[0]<=3.1 and .074<=sl[1]<=.96 and .074<=-sl[2]<=.96 and .48<=-sl[3]<=3.1 and sl[0]-sl[1]>.25 and sl[2]-sl[3]>.25))):
                continue
            maybe.append((rank(er)+[.0,.030,.043,.108][kind],kind,n,breaks,a,M))
        if not maybe:outputs.append((k,'refit unstable'));continue
        score,kind,n,breaks,a,M=min(maybe,key=lambda x:x[0])
        residual=abs(M@a-Y)
        med,q95,q90=np.quantile(residual[hold],[.5,.95,.90])
        raw=np.quantile(residual,[.50,.90,.95,.99])
        if q90>.49 or med>.21 or q95>.75 or raw[3]>1.05:
            outputs.append((k,'holdout-error'));continue
        if ref-q90<.22 and not (q90<.22 and c['area']>=180):
            outputs.append((k,'geometry not better'));continue
        d=ring@n;lo,hi=d.min(),d.max()
        # Compare observed plane/ridge against original atlas top and data around rim.
        h_at=lambda v: a[0]+(a[1] if kind else 0)*v+sum(w*max(0,v-r) for w,r in zip(a[2:],breaks))
        knots=[float(lo-.01),*map(float,breaks),float(hi+.01)]
        y=[float(h_at(v)) for v in knots]
        if min(y)<1.90 or c['h']+1.1<max(y) or max(y)<c['h']-2.7 or min(y)<c['lo']-3.3:
            outputs.append((k,'unsupported rim'));continue
        # Flat support issues: profile-nudge roof cap thickness inside the observed shell, never increase elevation.
        if kind==3 and len(breaks)!=3:raise AssertionError('not gambrel')
        fitName=['flat','shed','gable','gambrel'][kind]
        outputs.append((k,{**c,'kind':fitName,'p90':round(float(q90),4),'p95':round(float(q95),4),'p50':round(float(med),4),
                           'priorP90':round(ref,4),'priorP50':round(ref50,4),
                           'fullP99':round(float(raw[3]),4),'nHold':int(hold.sum()),'n':len(Y),
                           'datum':round(ground,5),'span':round(float(hi-lo),5),'axisWorld':n.round(7).tolist(),
                           'windowSHA':fprint(D[k+'_surface'],D[k+'_ground']),'curve':np.c_[knots,y].round(5).tolist()}))
    return outputs
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scratch',type=Path,required=True)
    parser.add_argument('--jobs',type=int,default=4)
    args=parser.parse_args()
    if not 1<=args.jobs<=6:parser.error('Use one to six workers')
    p=args.scratch
    candidates=json.loads((p/'sample-plan.json').read_text())
    by={c['tile']+'_'+str(c['i']):c for c in candidates}
    T=osr.CoordinateTransformation(xyproj(4326),xyproj(3979))
    for c in candidates:
        r=np.array(T.TransformPoints(c['fp']))[:,:2]
        c.update(survey=r.tolist(),xy=r.mean(axis=0).tolist())
    groups=[]
    for f in sorted((p/'windows').glob('*.npz')):
        with np.load(f) as r:records=[by[k[:-7]] for k in r.files if k.endswith('_origin') and k[:-7] in by]
        if records:groups.append((f,records))
    flattened=[(c['tile'],c['i']) for _,records in groups for c in records]
    if len(flattened)!=len(by) or len(set(flattened))!=len(by):raise ValueError('Incomplete sample plan')
    print('Fitting',sum(len(g)for _,g in groups),'over',len(groups),'groups',flush=True)
    with ProcessPoolExecutor(max_workers=args.jobs) as exe:
        q=[i for r in exe.map(fit,groups)for i in r]
    passes=[r for _,r in q if isinstance(r,dict)]
    print('Formats',Counter(r['kind'] for r in passes), 'Counties',Counter(r['county'] for r in passes), 'Rejected',Counter(r for _,r in q if isinstance(r,str)),flush=True)
    (p/'shapes.json').write_text(json.dumps(passes,separators=(',',':'))+'\n')
    old=np.array([r['priorP90'] for r in passes]);now=np.array([r['p90'] for r in passes])
    print('P90 Building-level med',np.median(old),np.median(now),'P90',np.quantile(old,.9),np.quantile(now,.9),flush=True)
if __name__=='__main__':main()
