"""Fit a bounded fill that can reach fixed dry terrain without a steep artificial shoulder."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi

def design(dtm, stock, accepted, cap):
    if dtm.shape!=stock.shape or stock.shape!=accepted.shape or stock.ndim!=2 or accepted.dtype!=np.bool_:
        raise ValueError('Registered arrays do not have one common grid')
    if not (accepted.any() and np.isfinite(dtm[accepted]).all() and np.isfinite(stock).all()):
        raise ValueError('No finite measured support')
    if accepted[0].any() or accepted[-1].any() or accepted[:,0].any() or accepted[:,-1].any():
        raise ValueError('Candidate hits outer reserve')
    exposed=ndi.binary_dilation(accepted,structure=np.ones((3,3),bool))&~accepted
    edges=np.argwhere(exposed)
    level=stock[exposed]
    wanted=np.argwhere(accepted)
    ceiling=np.empty(len(wanted),dtype=float)
    for j in range(0,len(wanted),192):
        q=wanted[j:j+192]
        r=np.linalg.norm(q[:,None,:]-edges[None,:,:],axis=2)
        ceiling[j:j+len(q)]=np.min(level[None,:]+cap*r,axis=1)
    delta=np.zeros_like(stock,dtype=float)
    delta[accepted]=np.maximum(0,np.minimum(dtm[accepted],ceiling)-stock[accepted])
    # Only take material away when rounding the mathematical shoulder.
    smooth=np.minimum(delta,ndi.gaussian_filter(delta,sigma=1.,mode='constant',truncate=2))
    y=stock+smooth
    wanted_error=abs(dtm-stock)
    fraction=np.divide(smooth,wanted_error,out=np.zeros_like(smooth),where=accepted&(wanted_error>1e-6))
    touched=accepted[:-1,:-1]|accepted[1:,:-1]|accepted[:-1,1:]|accepted[1:,1:]
    def slopes(h):
        dx=np.diff(h,axis=1)
        dz=np.diff(h,axis=0)
        return np.concatenate((np.hypot(dx[:-1],dz[:,:-1])[touched],np.hypot(dx[1:],dz[:,1:])[touched]))
    q=(0,.25,.5,.9,.95,1)
    summary={name:np.quantile(values,q).tolist() for name,values in {
        'stockErrorMetres':wanted_error[accepted], 'candidateErrorMetres':abs(dtm-y)[accepted],
        'stockTriangleGrade':slopes(stock), 'candidateTriangleGrade':slopes(y)}.items()}
    report=dict(nativeCells=int(accepted.sum()),protectedChanges=int(np.count_nonzero(smooth[~accepted])),
        assumedCeiling=cap,raisedAreaSqMAtThreshold={str(n):int((smooth>n).sum())for n in [.05,.15,.3,.45,.6,.9]},**summary)
    return smooth,fraction,report

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('inputs',type=Path);p.add_argument('output',type=Path)
    p.add_argument('--sha256',required=True);p.add_argument('--slope-cap',type=float,default=.115)
    a=p.parse_args()
    if not .065<=a.slope_cap<=.135:p.error('Slope cap is outside the review window.')
    if hashlib.sha256(a.inputs.read_bytes()).hexdigest()!=a.sha256:raise ValueError('Source SHA mismatch.')
    with np.load(a.inputs,allow_pickle=False)as q:
        v,w,stats=design(q['dtm_ground_lifted'],q['stock_n112'],q['allow'],a.slope_cap)
        np.savez_compressed(a.output,relative_delta=v,physical_blend=w,upper_left_3979=q['upper_left_3979'])
    print(json.dumps(stats,indent=2))
if __name__=='__main__':main()
