"""Tie actual submitted hedge instance words to licensed source and project stock quads.
Computes the conservative projected quads; no GPU alpha/occlusion or artist proof.
"""
import numpy as np
import argparse,gzip,json,re,struct
from hashlib import sha256
from pathlib import Path
def sha(b):return sha256(b).hexdigest()
LX=76762.59317717304; LZ=111161.08375388647
def coords(x,z):return (x+63.2)*LX,(46.5-z)*LZ

def ranges(repo,observed):
 base=repo/'public/world/woodland/hedgerows-v1'
 idx=(base/'index.json').read_bytes()
 assert sha(idx)=='601cb33036c694028dc1c04f0107263108d9d786218f69ace58fdb2798f09f2a'
 m=json.loads(idx)
 a,c=coords(m['bounds'][0],m['bounds'][3]);b,d=coords(m['bounds'][2],m['bounds'][1])
 dx,dz=(b-a)/m['cols'],(d-c)/m['rows']
 loaded={};chunklist=[];seen=set()
 for row in observed:
  if row['status']!=206:continue
  R=re.fullmatch(r'bytes=(\d+)-(\d+)',row['range'] or '')
  assert R, row
  low,high=map(int,R.groups());key=(row['leaf'],low,high)
  if key in seen:continue
  seen.add(key)
  num=next(i for i,p in enumerate(m['packs']) if p['file']==row['leaf'])
  pack=m['packs'][num];b=(base/pack['file']).read_bytes()
  assert sha(b)==pack['sha256'] and len(b)==pack['bytes']
  assert row['contentRange']==f'bytes {low}-{high}/{len(b)}'
  assert int(row['length'])==high-low+1
  found=[j for j in m['tiles'] if j['pack']==num and j['offset']==low and j['bytes']==high-low+1]
  assert len(found)==1,(key,found)
  t=found[0];name=t['id'];u,v=map(int,name.split('-'))
  data=gzip.decompress(b[low:high+1])
  assert len(data)==t['count']*6 and sha(data)==t['sha256']
  for x,z,h,sty in struct.iter_unpack('<HHBB',data):
   p=np.float32(a+u*dx+x/8),np.float32(c+v*dz+z/8)
   loaded.setdefault((float(p[0]),float(p[1])),[]).append((name,h/4,sty))
  chunklist.append({'tile':name,'bytes':t['bytes'],'decodedSHA256':t['sha256'],'exactRange':row['contentRange']})
 assert len(chunklist)>0
 return chunklist,loaded

def rnd(x,z,salt=0):
 mask=(1<<32)-1
 n=(((x^salt)*2246822519)^ (z*3266489917)) & mask
 n=((n^(n>>15))*2246822519)&mask
 return (n^(n>>13))/(1<<32)
def rounding(v):
 a=np.float32(v)
 p=float(np.nextafter(a,np.float32(-np.inf),dtype=np.float32))
 n=float(np.nextafter(a,np.float32(np.inf),dtype=np.float32))
 return (p+v)/2,(n+v)/2
def slot_fits(p,s,record):
 _,native_h,style=record
 x,_,z=p;h,w,var,li=s
 if not (0<h<=native_h and 0<w):return False
 u,v=int(np.floor(x*2)),int(np.floor(z*2))
 bv=rnd(u,v,43)
 v0=(0 if bv<.64 else 1) if style==1 else (2 if bv<.16 else 1 if bv<.53 else 0 if bv<.92 else 3)
 if var!=v0 or li!=float(np.float32(.74+.42*rnd(u,v,8))):return False
 ratio=(1.36 if style==1 else .87)+.32*rnd(u,v,6)
 a,b=rounding(h);m,n=rounding(w)
 return max(a*ratio,m)<=min(b*ratio,n) and a<=native_h

def territory(rings,X,Z):
 inside=np.zeros(X.shape,bool)
 margin=np.full(X.shape,np.inf)
 for loop in rings:
  R=[coords(x,z) for x,z in loop];assert R[0]==R[-1]
  for (a,b),(c,d) in zip(R,R[1:]):
   dx,dz=c-a,d-b
   den=dx*dx+dz*dz
   if dz:inside^=((b>Z)!=(d>Z))&(X<a+(Z-b)*dx/dz)
   if den:
    w=np.clip(((X-a)*dx+(Z-b)*dz)/den,0,1)
    margin=np.minimum(margin,np.hypot(X-a-w*dx,Z-b-w*dz))
 return inside,margin
def shelter_quad(S,W,eye):
 ray=eye-(S+[0,W[0]*.5,0]);ray/=np.linalg.norm(ray)
 r=np.array([ray[2]+.00001,0,-ray[0]]);r/=np.linalg.norm(r)
 u=np.cross(ray,r);u/=np.linalg.norm(u)
 a=np.clip((ray[1]-.19)/(.80-.19),0,1);a=a*a*(3-2*a)
 portrait=(1-a)*W[0]*1.04+a*W[1]
 center=S+[0,W[0]*(.47+.18*a),0]
 return np.array([center+x*W[1]*r+y*portrait*u for x,y in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]])
def clip_all(a):
 # All XYZW planes before perspective divide. This is geometry support only.
 for nr in ((1,0,0,1),(-1,0,0,1),(0,1,0,1),(0,-1,0,1),(0,0,1,1),(0,0,-1,1)):
  if len(a)==0:break
  b=[];p=a[-1];d=np.dot(p,nr)
  for q in a:
   e=np.dot(q,nr)
   if (d>=0)!=(e>=0):b.append(p+(q-p)*d/(d-e))
   if e>=0:b.append(q)
   p,d=q,e
  a=b
 return np.asarray(a)
def measure(row,scope,loaded,n):
 p=lambda k:row[k]['name']
 def unpack(k,cols):
  q=(n/p(k)).read_bytes();assert sha(q)==row[k]['sha256']
  return np.frombuffer(q,'<f4').astype(float).reshape(-1,cols)
 P,S=unpack('fullStem',3),unpack('fullShape',4)
 assert len(P)==len(S)==row['hedgeCount']
 verify=[sum(slot_fits(p,s,r) for r in loaded.get((p[0],p[2]),[])) for p,s in zip(P,S)]
 assert min(verify)==max(verify)==1
 sh=row['shadow'];assert sh['instances']==row['instances'] and sh['count']==6
 box=sh['ground'];bf=(n/box['name']).read_bytes()
 assert sha(bf)==box['sha256'] and len(bf)==len(P)*16
 assert np.all(np.isfinite(np.frombuffer(bf,'<f4')))
 inside,margin=territory(scope['ringsLonLat'],P[:,0],P[:,2])
 assert row['elementCount']==6 and row['samples']==4
 V=np.array(row['viewMatrix']).reshape(4,4,order='F');M=np.array(row['projection']).reshape(4,4,order='F')@V
 eye=np.array(row['eye']);_,_,width,height=row['viewport']
 area=[];support=[]
 for k,(p,s) in enumerate(zip(P,S)):
  if not inside[k]:continue
  a=shelter_quad(p,s,eye)
  clipped=clip_all(np.c_[a,np.ones(4)]@M.T)
  if len(clipped)<3 or np.any(clipped[:,3]<=0):continue
  f=(clipped[:,:2]/clipped[:,3:4]+1)*[width/2,height/2]
  x,y=f.T
  ar=abs(np.sum(x*np.roll(y,-1)-y*np.roll(x,-1)))*.5
  if ar>1:
   area.append(float(ar))
   support.append(k)
 ok=np.asarray(support,dtype=int)
 return {'flightDistanceM':row['d'],'actualSubmittedHedges':row['hedgeCount'],'allInstancesLocatedInExactRequestedAtlas':True,
  'primaryDatedPolygon':scope['object'],'actualRootPositionsInPrimary':int(inside.sum()),'quadsWithMoreThanOneProjectedPixel':len(support),
  'conservativeSumOfQuadAreasPxNotUniqueVisiblePixels':sum(area),'rootHedgeHeightsMinMaxM':None if not len(ok) else [float(S[ok,0].min()),float(S[ok,0].max())],
  'exactCentreMarginAllowsFullWidthCrownPlus1m':int((margin[ok]>=S[ok,1]*.5+1).sum())}
def main():
 p=argparse.ArgumentParser(description=__doc__)
 for k in ['run','repo','targets','out']:p.add_argument('--'+k,type=Path,required=True)
 a=p.parse_args()
 r=json.loads((a.run/'receipt.json').read_text())
 assert r['state'].startswith('PASS') and len(r['windows'])==2 and not r['errors'] and not r['outside']
 src=next(s for s in json.loads(a.targets.read_text()) if s['id']==r['site'].split('-')[1])
 chunks,loaded=ranges(a.repo,r['ranges'])
 res=[measure(row,src,loaded,a.run) for row in r['windows']]
 q={'scope':'Actual source-linked CPU/GPU geometry and 4× stock draw; canopy alpha, depth visibility and original art are unsolved.',
    'harnessReceiptSHA256':sha((a.run/'receipt.json').read_bytes()),'nativeShaderFamilyBothMatches':r['windows'][0]['shaderSHA256']==r['windows'][1]['shaderSHA256'],
    'signedReturnedLeaves':chunks,'sites':res}
 with a.out.open('x')as f:f.write(json.dumps(q,indent=2)+'\n')
 print(json.dumps(res,indent=2))
if __name__=='__main__':main()
