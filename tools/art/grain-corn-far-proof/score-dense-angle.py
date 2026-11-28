"""Check bare associated interpolation on the frozen low-angle native sources/holdouts."""
from hashlib import sha256
from pathlib import Path
import json,sys
import numpy as np
from scipy.ndimage import maximum_filter
from PIL import Image
p=Path.cwd()
out=Path(sys.argv[1]); out.mkdir()
s=p/'dense-low-source-a'; h=p/'dense-low-holdout-a'; old=p/'native-bake-b'
L=json.loads(Path(__file__).with_name('dense-low-angle-prelock.json').read_bytes())
S=json.loads((s/'receipt.json').read_bytes())['pages'];H=json.loads((h/'receipt.json').read_bytes())['pages']
assert len(S)==144 and len(H)==10
def load(root,rows,index,n):
    x=next(y for y in rows[index]['outputs'] if y['name'].endswith(f'-{n:03d}.rgba'))
    assert x['name']==f'angle-{index:03d}-{n:03d}.rgba'
    a=(root/x['name']).read_bytes()
    assert len(a)==x['length']==4*n*n and sha256(a).hexdigest()==x['sha']
    return np.frombuffer(a,'u1').reshape(n,n,4)/255
def old_page(i,n):
    a=np.fromfile(old/f'angle-{i:02d}-{n:03d}.rgba',np.uint8).reshape(n,n,4)
    return a/255
def dense(az,el,v,n):
    q=(az%360)/15;i=int(q);u=q-i;k=int(el>=14.5)
    t=np.clip((el-[10,14.5][k])/4.5,0,1)
    out=np.zeros((n,n,4))
    for j,b in [(i,1-u),((i+1)%24,u)]:
       for e,c in [(k,1-t),(k+1,t)]:out+=load(s,S,72*v+24*e+j,n)*b*c
    return out
def old_baselines(az,el,v,n):
    q=((az-19)%360)/90;i=int(q);u=q-i
    def ray(y,e):
       a,b=np.deg2rad([y,e]);return np.array([np.cos(b)*np.sin(a),np.sin(b),np.cos(b)*np.cos(a)])
    g=ray(az,el);assert el<25
    near=max((float(g@ray(y,e)),8*v+j+4*k)for j,y in enumerate([19,109,199,289])for k,e in enumerate([25,64]))[1]
    return (1-u)*old_page(v*8+i,n)+u*old_page(v*8+(i+1)%4,n),old_page(near,n)
def draw(img,bg):
    z=img[:,:,:3]+(1-img[:,:,3:])*bg
    return np.where(z<.0031308,z*12.92,1.055*np.maximum(z,0)**(1/2.4)-.055)
def stats(img,reference):
    a=img[:,:,3]; b=reference[:,:,3];mass=b.sum()
    domain=(a>1/255)|(b>1/255)
    output=[]
    for bg in (np.array([.08,.088,.075]),np.array([.44,.47,.38])):
       d=(draw(img,bg)-draw(reference,bg))@[.2126,.7152,.0722]
       output.append(float(np.quantile(np.abs(d[domain]),.90)*255))
    return {
       'mass':float(a.sum()/mass),'symmetricError':float(np.abs(a-b).sum()/mass),
       'falseIsland':float(a[maximum_filter(b,size=3,mode='constant')<=1/255].sum()/mass),
       'missedCore':float(b[(b>=.35)&(maximum_filter(a,size=3,mode='constant')<.05)].sum()/max(.001,b[b>=.35].sum())),
       'dualLumaP90':output,
    }
rows=[]
for v in (0,1):
 for j,(az,e) in enumerate(L['holdout']):
    for n in (16,32):
       t=load(h,H,v*5+j,n); d=dense(az,e,v,n); x,y=old_baselines(az,e,v,n)
       row={'variant':v,'azimuth':az,'elev':e,'px':n,'dense':stats(d,t),
            'oldLinear':stats(x,t),'oldNearest':stats(y,t)}
       rows.append(row)
       color=np.hstack([draw(t,np.array([.18,.20,.16])),draw(x,np.array([.18,.20,.16])),draw(d,np.array([.18,.20,.16]))])
       Image.fromarray(np.clip(np.rint(color*255),0,255).astype('u1')).save(out/f'{v}-{j}-{n}.png')
for n in (16,32):
    r=[x for x in rows if x['px']==n]
    ref=min(np.mean([x[f]['symmetricError']for x in r]) for f in ('oldNearest','oldLinear'))
    a=[x['dense'] for x in r]; print(n,'mass',min(x['mass'] for x in a),max(x['mass']for x in a),'alpha rel',
    float(np.mean([x['symmetricError']for x in a])/ref),'largest luma',max(max(x['dualLumaP90'])for x in a),
    'largest false/miss',max(x['falseIsland']for x in a),max(x['missedCore']for x in a))
(out/'report.json').write_text(json.dumps({'scope':L['scope'],'program':'No reprojection, raw associated low-angle interpolation','rows':rows},indent=2)+'\n')
