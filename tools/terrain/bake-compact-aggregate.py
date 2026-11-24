#!/usr/bin/python3
"""Make a periodic authored 2m compact mineral optical swatch. No input images."""
import numpy as np
from scipy.ndimage import gaussian_filter
from pathlib import Path
import argparse,gzip,hashlib,json
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--out',type=Path,required=True)
ap.add_argument('--receipt',type=Path)
args=ap.parse_args()
N=320; TILE=2.; CELL=TILE/N
rng=np.random.default_rng(72904119)
smooth=lambda a: np.clip(a,0,1)**2*(3-2*np.clip(a,0,1))
def noise(sigma):
    q=gaussian_filter(rng.normal(size=(N,N)),sigma,mode='wrap')
    return q/(q.std()+1e-8)
# Dusty fines behind mineral fragments. Isolevel dust patches change local
# embedment, not total silhouette or the location of a real road stone.
matrix=np.clip(noise(9.8)*.42+noise(3.4)*.13,-1,1)
density=np.clip(noise(14.7)*.86+noise(5.2)*.14,-2,2)
base_height=(.00030*noise(1.23)+.00026*noise(3.9)+.00019*noise(14.7))
height=base_height.copy()
tonal=.028*noise(.65)+.016*noise(2.9)+.021*matrix
fine_mat=.79+.04*np.clip(noise(2.6),-2,2)
ao=np.zeros_like(height)
core=np.zeros_like(height)
diameters=[]
# Optics-only pieces. Most are 8–25mm and merged into the finer matrix,
# rather than decorated white lead pebbles or exposed blocks.
for idx in range(10400):
    cx,cy=rng.uniform(0,N,2);cellx,celly=int(cx),int(cy)
    f=float(density[celly,cellx])
    if rng.random() > max(.36,min(.97,.80+.115*f)):continue
    dmm= 7.4+(rng.beta(2.0,3.2)*25.1)
    if idx<1250:dmm=15.+(rng.beta(2.1,3.0)*23.)
    dmm=min(36,dmm)
    d=dmm*.001;diameters.append(dmm)
    theta=rng.uniform(0,6.283185);aspect=rng.uniform(.69,1.29)
    radius=d*.50/CELL;size=int(np.ceil(radius*max(aspect,1/aspect)+1.8))
    gx=np.arange(cellx-size,cellx+size+1);gy=np.arange(celly-size,celly+size+1)
    xx,yy=np.meshgrid(gx-cx+.5,gy-cy+.5)
    c,s=np.cos(theta),np.sin(theta)
    u=(c*xx+s*yy)/(radius*aspect);v=(c*yy-s*xx)*aspect/radius
    k=int(rng.integers(4,9));phase=rng.uniform(0,6.283185)
    dirs=(np.arange(k)+rng.uniform(-.23,.23,k))*6.283185/k+phase
    offset=rng.uniform(.75,1.06,k)
    limit=np.max((np.cos(dirs)[:,None,None]*u+np.sin(dirs)[:,None,None]*v)/offset[:,None,None],axis=0)
    rounded=np.hypot(u,v)*.91
    # Mixing actual polygon supports and rounded shoulders differentiates
    # crushed/rounded stones without directionally baked lighting.
    m=rng.uniform(.18,.65)
    metric=m*rounded+(1-m)*limit
    coverage=smooth((1.065-metric)*max(2.1,radius*1.45))
    shelf=smooth((1.047-metric)*rng.uniform(1.65,2.8))
    bias=rng.uniform(-.13,.13,2)
    dap=rng.uniform(.0012,.0044)*(.86+.10*np.clip(f,-1.,1.))
    ceiling=dap*np.maximum(0.,shelf*(.81+u*bias[0]+v*bias[1]))
    vy=gy%N;vx=gx%N;slot=np.ix_(vy,vx)
    exposed=ceiling > (height[slot]-base_height[slot]+.00012)
    alpha=coverage*exposed
    height[slot]=np.maximum(height[slot],base_height[slot]+ceiling)
    tone=rng.normal(.064,.077)
    # Detuned few gray/mineral fragments remain low-contrast, not black ink.
    tone=np.clip(tone,-.093,.23)+.023*np.sin(u*2.1-v)
    tonal[slot]=tonal[slot]*(1-alpha)+tone*alpha
    fine_mat[slot]=fine_mat[slot]*(1-alpha)+rng.uniform(.39,.79)*alpha
    ao[slot]=np.maximum(ao[slot],np.clip(smooth((1.27-metric)*4)-shelf,0,1)*np.clip(dap/.0042,0,1))
    core[slot]=np.maximum(core[slot],alpha)
tonal-=.051*ao
tonal-=tonal.mean()
h=gaussian_filter(height,.55,mode='wrap')
# -gradient, because the target is the actual tangent perturbation of a
# positive-up surface. R luma, signed X/Z slope centered on 128, A dry rough.
dx=-(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))/(2*CELL)
dz=-(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))/(2*CELL)
r=np.uint8(np.clip(np.rint(128+tonal*234),0,255));g=np.uint8(np.clip(128+np.rint(dx*153)*2,2,254))
b=np.uint8(np.clip(128+np.rint(dz*153)*2,2,254));a=np.uint8(np.clip(np.rint(fine_mat*18)*14,0,252))
raw=np.stack([r,g,b,a],axis=2).tobytes();packed=gzip.compress(raw,9,mtime=0)
args.out.parent.mkdir(parents=True,exist_ok=True)
args.out.write_bytes(packed)
hsh=lambda a:hashlib.sha256(a).hexdigest()
metrics=dict(width=N,height=N,tileMetres=TILE,metresPerTexel=CELL,sourceImages=0,
    rawBytes=len(raw),rawSHA256=hsh(raw),compressedBytes=len(packed),compressedSHA256=hsh(packed),
    chipCount=len(diameters),chipDiameterMilliMetreQuantiles=np.quantile(diameters,[0,.5,.9,1]).tolist(),
    exposedStrongCoreFraction=float(np.mean(core>.50)),liftPeakMetres=float((height-base_height).max()),
    lumaCodes=np.quantile(r,[0,.05,.5,.95,1]).tolist(),endingMapSlopeP99=float(np.quantile(np.hypot(dx,dz),.99)))
if args.receipt: args.receipt.write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps(metrics,indent=2))
