#!/usr/bin/env python3
"""Fit and compile guarded Montague 571 Main LiDAR planes inside the exact atlas plan."""
import argparse,gzip,hashlib,json,math,subprocess
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
p.add_argument('--source',type=Path,required=True,help='Native EPSG:3979 COPC cohort (.npz)')
p.add_argument('--out',type=Path,required=True)
p.add_argument('--verify',action='store_true')
a=p.parse_args()
manifest=json.loads((a.root/'public/world/buildings/index.json').read_text())
t=next(t for t in manifest['tiles'] if t['id']=='q103301')
with (a.root/'public/world/buildings/tiles.pack').open('rb') as f:
    f.seek(t['offset'])
    feature=json.loads(gzip.decompress(f.read(t['bytes'])))['features'][350]
foot=feature['footprint']
data=np.load(a.source)
assert np.array_equal(data['footprint'],foot) and not feature.get('holes')
whole=data['points'];source=data['outline']
assert hashlib.sha256(np.ascontiguousarray(whole,dtype='<f8').tobytes()).hexdigest()=='1fa899ee19c4c87bd663d9ad8b77634e297a5472359c14336306cc6a0b3f9ec1'
source_origin=source[0];axis=source[1]-source[0];axis/=np.linalg.norm(axis)
rot=np.stack((axis,[axis[1],-axis[0]]),axis=1)
poly=(source-source_origin)@rot
X=whole[whole[:,3]==6]
U=(X[:,:2]-source_origin)@rot
def cross(a,b):
    return a[...,0]*b[...,1]-a[...,1]*b[...,0]
# Registry identifies the building, but the roof observations must be at
# least 0.42 m from its actual source plan boundary on structural returns.
guards=[cross(b-a,U-a)/np.linalg.norm(b-a)for a,b in zip(poly,np.roll(poly,-1,axis=0))]
mask=(np.asarray(guards).min(0)>=.42)
source_rows=X[mask]; z=source_rows[:,2]
u,v=U[mask].T
design=np.c_[np.ones(len(u)),u,v]
fit=(np.floor(source_rows[:,0]/1.7)+np.floor(source_rows[:,1]/1.7)*2).astype(int)%5!=0
assert len(z)==970 and fit.sum()==790
# Broad analytic seeds isolate returns from the different supports; their
# slopes and final intersections are fitted with only non-holdout cells.
t0=(u<12.75)&fit
def plane(k):
    A,B=design[k],z[k]
    return least_squares(lambda q:A@q-B,np.linalg.lstsq(A,B,rcond=None)[0],loss='huber',f_scale=.079).x
n=plane((v>2.1)&(v<4.55)&((u<3.82)|(u>9.42))&t0)
s=plane((v>5.09)&((v<6.79)|((u>11.79)&(v>7.35)))&t0)
porch=plane((u<10.55)&(v>7.45)&fit)
east=plane((u>13.37)&(z<16.4)&fit)
cross_sel=(z>design@n+.21)&(v<1.68)&fit
w=plane(cross_sel&(u>1.9)&(u<6.13))
e=plane(cross_sel&(u>6.7)&(u<11.43))
def boundary(t,labels,extent):
    xy,sgn=design[t],np.where(labels[t],1.,-1.)
    options=[]
    for slope in np.linspace(-.12,.12,121):
        c=xy[:,1]-slope*xy[:,2]
        q=np.sort(c);u0=(q[1:]+q[:-1])*.5
        u0=u0[(u0>=extent[0])&(u0<=extent[1])]
        margin=(c[:,None]-u0)*sgn[:,None]
        if not len(u0):continue
        loss=(np.maximum(0.,.018-margin)**2).sum(0)
        j=np.argmin(loss)
        options.append((loss[j],u0[j],slope))
    return min(options)[1:]
pr=boundary((v>7.55)&(u>9.5)&(u<12.7)&fit,
        abs(z-design@porch)>=abs(z-design@s),[10.45,11.7])
annex=boundary((u>11.9)&fit,z<16.6,[12.5,13.5])
def predict(beta,xx):
    N,S,W,E,P,A=(xx@beta.T).T
    top=np.maximum(N,np.minimum(W,E))
    south=np.where(xx[:,1]<pr[0]+pr[1]*xx[:,2],np.maximum(S,P),S)
    return np.where(xx[:,1]>annex[0]+annex[1]*xx[:,2],A,np.minimum(top,south))
beta0=np.array([n,s,w,e,porch,east])
margin=np.broadcast_to([.56,.11,.11],beta0.shape)
result=least_squares(lambda q:predict(q.reshape(6,3),design[fit])-z[fit],
        beta0.ravel(),bounds=((beta0-margin).ravel(),(beta0+margin).ravel()),
        loss='soft_l1',f_scale=.097,max_nfev=700)
beta=result.x.reshape(6,3)
H=predict(beta,design)
def stats(q):
    return {k:round(float(v),6)for k,v in zip(('median','p90','p95','maximum'),np.quantile(q,[.5,.9,.95,1.]))}
assert stats(abs(z[~fit]-H[~fit]))['p90']<.16

# Deterministic convex clipping. The profile is min(primary south,
# max(primary north, min(cross slopes))), with an independent South
# low-pitch surface and an east annex only where there is evidence.
def clean(p):
    r=[]
    for a in p:
        if not r or np.linalg.norm(a-r[-1])>1e-8:r.append(a)
    if len(r)>2 and np.linalg.norm(r[-1]-r[0])<1e-8:r.pop()
    if len(r)<3:return np.empty((0,2))
    R=np.asarray(r)
    return R if abs(np.sum(cross(R,np.roll(R,-1,axis=0))))>1e-9 else np.empty((0,2))
def clip(R,co):
    if len(R)<3:return R
    D=co[0]+R@co[1:]
    out=[]
    for a,b,ah,bh in zip(R,np.roll(R,-1,axis=0),D,np.roll(D,-1)):
        if ah>=0:out.append(a)
        if (ah>=0)!=(bh>=0):out.append(a+(b-a)*ah/(ah-bh))
    return clean(out)
def halves(R,cut):
    return clip(R,cut),clip(R,-cut)
F=np.array([-pr[0],1.,-pr[1]]);J=np.array([-annex[0],1.,-annex[1]])
roof=[]
east_of_porch,west_of_porch=halves(poly,F)
annex_domain,main_domain=halves(east_of_porch,J)
roof.append((5,annex_domain))
def assign(R,porch_live):
    if len(R)<3:return
    for cross_plane,wing in zip((2,3),halves(R,beta[3]-beta[2])):
        for hi,peak in zip((0,cross_plane),halves(wing,beta[0]-beta[cross_plane])):
            for lo,broad in (zip((1,4),halves(peak,beta[1]-beta[4])) if porch_live else [(1,peak)]):
                for role,patch in zip((hi,lo),halves(broad,beta[lo]-beta[hi])):
                    if len(patch)>=3:roof.append((role,patch))
assign(main_domain,False);assign(west_of_porch,True)
assert len(roof)>=10
Y=lambda k,p:beta[k,0]+beta[k,1:]@p
area=lambda R:.5*float(np.sum(cross(R,np.roll(R,-1,axis=0))))
assert math.isclose(sum(area(r)for _,r in roof),area(poly),abs_tol=1e-6)
# Reliable shared edge overlap even at a T-junction, plus exact height
# differences only where survey families intentionally step.
def edge_pairs(R):
    yield from zip(R,np.roll(R,-1,axis=0))
def overlap(a,b,c,d):
    e=b-a;L=np.linalg.norm(e);t=e/L
    if max(abs(cross(t,c-a)),abs(cross(t,d-a)))>2e-7:return
    s,f=sorted(((c-a)@t,(d-a)@t));s=max(0.,s);f=min(L,f)
    if f-s<1e-8:return
    return a+t*s,a+t*f
walls=[[]for _ in poly];steps=[]
for k,R in roof:
    for idx,(a0,b0)in enumerate(edge_pairs(poly)):
        for c,d in edge_pairs(R):
            if (q:=overlap(a0,b0,c,d)) is not None:walls[idx].append((k,*q))
for j,(k,A)in enumerate(roof):
    for h,B in roof[:j]:
        if h==k:continue
        for a0,b0 in edge_pairs(A):
            for c,d in edge_pairs(B):
                if (q:=overlap(a0,b0,c,d)) is None:continue
                ups=np.array([Y(k,p)-Y(h,p)for p in q])
                if abs(ups).max()<1e-6:continue
                assert ups[0]*ups[1]>-1e-5
                steps.append((k,h,*q))
for i,(x,y)in enumerate(edge_pairs(poly)):
    tangent=y-x;sq=tangent@tangent
    walls[i].sort(key=lambda w:(w[1]-x)@tangent)
    q=walls[i]
    assert np.linalg.norm(q[0][1]-x)<1e-6 and np.linalg.norm(q[-1][2]-y)<1e-6
    assert all(np.linalg.norm(a[2]-b[1])<1e-6 for a,b in zip(q,q[1:]))
# Reproject all emitted vertices through the atlas's application mapping.
# Exact source-ring corners use the original coordinate pair directly;
# inserted vertices are projectively distributed on the same quad.
m=6378137*math.pi/180;ecc=1-.00669437999014*math.sin(math.radians(46.5))**2
scale=np.array([m*math.cos(math.radians(46.5))/math.sqrt(ecc),-m*(1-.00669437999014)/ecc**1.5])
l0=np.array([-63.2,46.5]);G=(np.asarray(foot)-l0)*scale
anchor=G.mean(0)
# Layout is a bilinear, corner-exact interpolation around a four-point
# survey quadrilateral, with edge-preserving ruled x/z coordinates.
def bilinear(p):
    a,b,c,d=poly
    M=np.stack([b-a,d-a],axis=1);s,t=np.linalg.solve(M,p-a)
    k=c-b-d+a
    for i in range(5):
        f=a+(b-a)*s+(d-a)*t+k*s*t-p
        ds,dt=np.linalg.solve(np.stack([b-a+k*t,d-a+k*s],axis=1),f)
        s-=ds;t-=dt
    return (G[0]+(G[1]-G[0])*s+(G[3]-G[0])*t+(G[2]-G[1]-G[3]+G[0])*s*t)-anchor
def xyz(k,p):
    x,z=bilinear(p)
    return [round(float(x),8),round(float(z),8),round(float(Y(k,p)),8)]
plan={'tile':t['id'],'ordinal':350,'atlasSha256':manifest['sha256'],'source':foot,'originXZ':anchor.round(11).tolist(),
      'outline':(G-anchor).round(8).tolist(),
      'roofs':[[k,[xyz(k,p)for p in R]]for k,R in roof],
      'walls':[[[xyz(k,a),xyz(k,b)]for k,a,b in q]for q in walls],
      'steps':[[xyz(k,a),xyz(k,b),xyz(h,a),xyz(h,b)]for k,h,a,b in steps]}
a.out.mkdir(parents=True,exist_ok=True)
native_receipt={'atlasTile':t['id'],'ordinal':350,'sourceRecords':len(whole),
    'fitClass6':int(fit.sum()),'heldoutClass6':int((~fit).sum()),
    'spatialBlocksM':1.7,'boundaryInsetM':.42,
    'roofPlanesInNativeBasis':beta.round(9).tolist(),
    'porchNativeLine':list(map(float,pr)),'annexNativeLine':list(map(float,annex)),
    'roofFacets':len(roof),'stepProfiles':len(steps),
    'pinnedSourceCropSha256':hashlib.sha256(whole.astype('<f8').tobytes()).hexdigest(),
    'nativeRoofPlanM2':area(poly),'heldoutFitAbsoluteMetres':stats(abs(z[~fit]-H[~fit]))}
output=a.root/'src/render/montague-macdonald.generated.ts'
code='// Generated by tools/geodata/bake-montague-macdonald.py.\nexport const MONTAGUE_MACDONALD='+json.dumps(plan,separators=(',',':'))+' as const;\n'
if a.verify:assert output.read_text()==code
else:output.write_text(code)
(a.out/'native-validation.json').write_text(json.dumps(native_receipt,indent=2)+'\n')
# Direct EPSG transform of the held-back ray positions, not the interpolation
# used for layout. Submillimetre mapping is verified by actual rays later.
f=''.join(f'{x:.12f} {y:.12f}\n' for x,y in source_rows[~fit,:2])
txt=subprocess.check_output(['gdaltransform','-s_srs','EPSG:3979','-t_srs','EPSG:4326'],input=f,text=True)
ll=np.array([list(map(float,l.split()[:2]))for l in txt.splitlines()])
W=(ll-l0)*scale
np.savetxt(a.out/'macdonald-heldout.csv',np.c_[source_rows[~fit,:2],W,z[~fit],H[~fit]],fmt='%.10f',delimiter=',',
           header='epsg3979_e,epsg3979_n,world_x,world_z,native_y,fitted_y',comments='')
print(json.dumps(native_receipt,indent=2))
