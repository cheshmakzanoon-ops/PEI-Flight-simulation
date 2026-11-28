"""Compare the actual orthographic Three shader against independently integrated native truth."""
from pathlib import Path
from hashlib import sha256
import json,sys
import numpy as np
from PIL import Image

P=Path.cwd()
h=P/'moving-truth-a';g=P/'moving-dense-gpu-a'
out=Path(sys.argv[1]);out.mkdir()
M=json.loads((g/'receipt.json').read_bytes())['frames']
T=json.loads((h/'receipt.json').read_bytes())['rows']
W,H=160,112
src=256
assert len(M)==len(T)==120
def digest(b):return sha256(b).hexdigest()
def raw(path,sha):
    b=path.read_bytes();assert digest(b)==sha
    return np.frombuffer(b,'u1').astype(float)/255.
def projection(c,span,n):
    # Reproject an original 256² native pixel into target area analytically
    # as a constant on its own support. No fitted shifts and a physical unit.
    b=c-span/2
    u=b+np.arange(src+1)*span/src
    hi=np.minimum(u[None,1:],(np.arange(n)+1)[:,None])
    lo=np.maximum(u[None,:-1],(np.arange(n))[:,None])
    return np.maximum(hi-lo,0.)
def integrate(im,pl):
    x=projection(pl['cx'],pl['span'],W)
    y=projection(H-pl['cy'],pl['span'],H)
    return np.stack([y@im[:,:,c]@x.T for c in range(4)],axis=-1)
def plate(im,bright):
    v=im[:,:,:3]+(1-im[:,:,3:])*bright
    return np.where(v<.0031308,12.92*v,1.055*np.maximum(v,0)**(1/2.4)-.055)
def y(a):return a@[.2126,.7152,.0722]*255
bright=np.array([.37,.41,.35])
dusk=np.array([.07,.078,.064])
rows=[];moves={}
pictures=[]
for i,(m,t) in enumerate(zip(M,T,strict=True)):
    pl=t['pose']['placement'];assert m['pl']==pl
    C=raw(g/m['file'],m['sha256']).reshape(H,W,4)
    R=raw(h/f'truth-{i:03d}.rgba',t['sha256']).reshape(src,src,4)
    X=integrate(R,pl)
    a,b=C[:,:,3],X[:,:,3]
    domain=(a>1/255)|(b>1/255)
    assert domain.any()
    d0=plate(X,bright);d1=plate(C,bright)
    l0,l1=y(d0),y(d1)
    darker=y(plate(C,dusk)-plate(X,dusk))
    k=(t['pose']['variant'],pl['span'],pl['sweep'])
    o={'frame':i,'variant':k[0],'span':k[1],'sweep':k[2],
              'az':t['pose']['az'],'elevation':t['pose']['elevation'],
              'mass':float(a.sum()/b.sum()),'errorAlpha':float(np.abs(a-b).sum()/b.sum()),
              'brightP90':float(np.quantile(np.abs(l1-l0)[domain],.9)),
              'darkP90':float(np.quantile(np.abs(darker[domain]),.9))}
    if k in moves:
        lastx,lastc,lastd=moves[k]
        measure=domain|lastd
        o['truthPhaseRMS']=float(np.sqrt(np.mean((l0[measure]-lastx[measure])**2)))
        o['densePhaseRMS']=float(np.sqrt(np.mean((l1[measure]-lastc[measure])**2)))
        o['relativePhaseRMS']=o['densePhaseRMS']/max(.1,o['truthPhaseRMS'])
        o['residualPhaseRMS']=float(np.sqrt(np.mean(((l1-l0)[measure]-(lastc-lastx)[measure])**2)))
    moves[k]=(l0,l1,domain);rows.append(o)
    if pl['i'] in (0,7,14):
        y0,y1,x0,x1=40,70,64,95
        ink=np.hstack((d0[y0:y1,x0:x1],d1[y0:y1,x0:x1]))
        pictures.append(np.rint(255*np.clip(ink,0,1)).astype('u1'))
for span in (20,23):
    c=[r for r in rows if r['span']==span]; d=[r for r in c if 'relativePhaseRMS'in r]
    print(span,'coverage min/max', min(r['mass']for r in c),max(r['mass']for r in c), 'max bright',
    max(r['brightP90']for r in c),'max dark',max(r['darkP90']for r in c),'phase median,max',
    np.median([r['relativePhaseRMS']for r in d]),max(r['relativePhaseRMS']for r in d),'max residual',max(r['residualPhaseRMS']for r in d))
contact=np.vstack([np.hstack(pictures[k:k+3])for k in range(0,len(pictures),3)])
Image.fromarray(contact).save(out/'motion-contact-1x.png')
(out/'report.json').write_text(json.dumps({'scope':'Detached genuine linear-Mesa 4x dense-candidate transport; truth is independently reduced exact actual native geometry. No player blending, world, time/physics, AA adoption or speed proven.',
 'frames':rows,'rawGeometryReceiptSha':digest((h/'receipt.json').read_bytes()),'gpuReceiptSha':digest((g/'receipt.json').read_bytes())},indent=2)+'\n')
