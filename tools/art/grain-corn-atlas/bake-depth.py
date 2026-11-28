"""Bake the associated first depth moment of an exact colour peer."""
from pathlib import Path
import json
import sys

import numpy as np
from atlas_gpu import digest as hash, driver, level_words, open_capture

if len(sys.argv) != 3:
    raise SystemExit("usage: bake-depth.py NEW_OUTPUT RADIANCE_DIR < depth-packet.json")
D, source = map(Path, sys.argv[1:])
J = json.load(sys.stdin)
W,H = J["frame"]
capture = open_capture(J)
D.mkdir()
rho=[]
for i,c in enumerate(J['cams']):
    a=capture(c)
    assert np.array_equal(a,capture(c))
    rgb=np.fromfile(source/f'angle-{i:02d}-256.rgba',np.uint8).reshape(H,W,4)
    assert np.array_equal(rgb[:,:,3],a[:,:,3])
    assert np.array_equal(rgb[:,:,:2],a[:,:,1:3])
    assert not a[:,:,:3][a[:,:,3]==0].any()
    valid=a[:,:,3]>0
    # Associated native 4x depth distribution moment; store sample-weighted
    # first moment and coverage; never infer a depth where alpha is zero.
    raw=a.astype(np.float64)
    raw[:, :, 0]=np.divide(raw[:,:,0]*255.,raw[:,:,3],out=np.zeros((H,W)),where=valid)
    shown=raw[:,:,0][valid]
    assert shown.min()>2 and shown.max()<253,(i,shown.min(),shown.max())
    # Preserve the shader's associated bytes directly. Do not unassociate
    # then reassociate: the floating round trip can shift exact half ties.
    v=a[:,:,[0,3]].astype(np.float64)
    rows=[]
    source_means=v.mean(axis=(0,1))
    while len(v)>=4:
        w=level_words(v);out=w.tobytes();name=f'depth-{i:02d}-{len(w):03d}.rg'
        assert (w[:,:,0]<=w[:,:,1]).all()
        assert np.max(abs(w.astype(float).mean(axis=(0,1))-source_means))<=.5
        (D/name).write_bytes(out)
        rows.append({'words':name,'extent':len(w),'bytes':len(out),'sha256':hash(out)})
        h=len(v)//2;v=v.reshape(h,2,h,2,2).mean(axis=(1,3))
    rho.append({'page':i,'valid':int(valid.sum()),'coverExact':True,'originalColorPeerExact':True,
      'eyeDepthMMinMax':[7.4+5.2*float(shown.min())/255,7.4+5.2*float(shown.max())/255],'mips':rows})
(D/'receipt.json').write_text(json.dumps({'scope':'Detached native associated depth moments by authored angle. No novel view, visibility-ghost or globe proof.',
  'orthographicNearAndFarM':[.05,40.], 'encodedDepthBeforeNormalizationM':[7.4,12.6],
  'atlasInputReceiptSHA256':hash((source/'receipt.json').read_bytes()),'channels':['associated eye-depth moment R8','coverage U8'],
  'mipRounding':'nearest even of one exact full-resolution block average','depthPages':rho},indent=2)+'\n')
