#!/usr/bin/env python3
"""Held-out source scan and actual installed stock/candidate nested readback."""
from pathlib import Path
import json
import numpy as np
D=Path('.')
N=np.load(D/'dry-2112-native.npz');raw=N['dtm'].astype('f8');p=np.fromfile(D/'dry-2112-world-centres.f64','<f8').reshape(*raw.shape,2)
a=np.fromfile(D/'native-after.f64','<f8').reshape(*raw.shape,4)
b=np.fromfile(D/'dry-2112-stock.f64','<f8').reshape(*raw.shape,5)
q=np.indices(raw.shape);hold=(q[0]%2!=0)|(q[1]%2!=0)
safe=(raw>-100)&(a[...,3]>70)
core=hold&safe&(a[...,2]>=1.-1e-6)
Y=raw+.12; old=b[...,2];new=a[...,0]; oldp=b[...,1];newp=a[...,1]
D0=np.stack([*p.transpose(2,0,1),Y,old,new,oldp,newp],axis=2)
D0[core,:].astype('<f8').tofile(D/'held-centres.f64')
q0=[.50,.90,.95,.99,1.]
def report(m):
 return {'n':int(m.sum()),'stockY':np.quantile(abs(Y-old)[m],q0).tolist(),'renderY':np.quantile(abs(Y-new)[m],q0).tolist(),
    'stockContact':np.quantile(abs(Y-oldp)[m],q0).tolist(),'measuredContact':np.quantile(abs(Y-newp)[m],q0).tolist()}
oldSlope=np.hypot(*np.gradient(old));newSlope=np.hypot(*np.gradient(new));nativeSlope=np.hypot(*np.gradient(Y))
collar=hold&safe&(a[...,2]>.004)&(a[...,2]<.995)
suspect=(collar&(nativeSlope<.12)&(oldSlope<.14))
R={'quantiles':q0,'coreHoldOut':report(core),'falloffHoldOut':report(collar),
   'knownLowSlopeCollarHoldOutTotal':int(suspect.sum()),'knownLowSlopeCollarOver35Pct':int((suspect&(newSlope>.35)).sum()),
   'knownLowSlopeCollarOver55Pct':int((suspect&(newSlope>.55)).sum()), 'knownLowSlopeCollarMaxFiniteDifference':float(newSlope[suspect].max())}
(D/'held-native-height.json').write_text(json.dumps(R,indent=2)+'\n');print(json.dumps(R))
