"""Review actual r187-expanded TS geometry in Mesa, including unscaled one-sample flight-scale plates."""
from pathlib import Path
import base64,ctypes as C,hashlib,json,sys
import numpy as np
from PIL import Image
from egl_support import gl,I,U,V,e0,program,driver
assert len(sys.argv)==2
D=Path(sys.argv[1]);assert not D.exists()
J=json.load(sys.stdin);W,H=J['spec']['frame'];R=program(J['shader'])
f=C.c_float;byte=C.c_ubyte
F=lambda s,r,*a:gl('gl'+s,r,*a)
def words(v):return (f*len(v))(*v)
def hash(b):return hashlib.sha256(b).hexdigest()
def data(a):
 u=base64.b64decode(a['data'],validate=True);assert len(u)==a['bytes'] and hash(u)==a['sha'];return u
def make(fn):
 k=U();fn(1,C.byref(k));assert k.value;return k.value
mkfb=F('GenFramebuffers',None,I,V);fb=F('BindFramebuffer',None,U,U)
mkrb=F('GenRenderbuffers',None,I,V);rb=F('BindRenderbuffer',None,U,U)
at=F('FramebufferRenderbuffer',None,U,U,U,U)
rs=F('RenderbufferStorage',None,U,U,I,I);rms=F('RenderbufferStorageMultisample',None,U,I,U,I,I)
check=F('CheckFramebufferStatus',U,U);read=F('ReadPixels',None,I,I,I,I,U,U,V)
target={aa:make(mkfb) for aa in (0,4)}
for aa,glf in target.items():
 fb(0x8d40,glf)
 for attachment,fmt in [(0x8ce0,0x8058),(0x8d00,0x81a6)]:
  b=make(mkrb);rb(0x8d41,b)
  if aa:rms(0x8d41,aa,fmt,W,H)
  else:rs(0x8d41,fmt,W,H)
  at(0x8d40,attachment,0x8d41,b)
 assert check(0x8d40)==0x8cd5
 n=I();F('GetIntegerv',None,U,V)(0x80a9,C.byref(n));assert n.value==aa
vp=F('Viewport',None,I,I,I,I);clear=F('Clear',None,U);color=F('ClearColor',None,f,f,f,f)
enable=F('Enable',None,U);disable=F('Disable',None,U)
bind=F('BindBuffer',None,U,U);gen=F('GenBuffers',None,I,V);upload=F('BufferData',None,U,C.c_ssize_t,V,U)
attr=F('GetAttribLocation',I,U,C.c_char_p);loc=F('GetUniformLocation',I,U,C.c_char_p)
vtx=F('VertexAttribPointer',None,U,I,U,byte,I,V);ena=F('EnableVertexAttribArray',None,U)
tr=F('UniformMatrix4fv',None,I,I,byte,V);tr3=F('UniformMatrix3fv',None,I,I,byte,V)
draw=F('DrawElements',None,U,I,U,V);v3=F('Uniform3f',None,I,f,f,f);v1=F('Uniform1f',None,I,f)
blit=F('BlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)
def uv(k):
 v=loc(R,k.encode());assert v>=0,k;return v
def packet(dataPack):
 out={}
 for name,geo in dataPack.items():
  M={}
  for role,g in geo['attrs'].items():
   d=data(g);v=make(gen);bind(0x8892,v);upload(0x8892,len(d),C.c_char_p(d),0x88e4)
   M[role]=(v,g)
  d=data(geo['index']);v=make(gen);bind(0x8893,v);upload(0x8893,len(d),C.c_char_p(d),0x88e4)
  out[name]=(M,v,geo['index']['count'])
 return out
assert set(J['geo'])=={'near','near-single'} and set(J['floors'])=={'near'},'near geometry only'
assert [W,H]==[1200,760],'locked native canvas only'
assert sorted((c['name'],c['kind'],c['samples']) for c in J['views'])==[
 ('leaf-architecture','near',4),('sheath-and-sail','near-single',4)],'two locked near views only'
subject=packet(J['geo']);floors=packet(J['floors'])
enable(0x0b71)
for mode in (0x0b44,0x0be2,0x0bd0,0x809e,0x0c11):disable(mode)
F('UseProgram',None,U)(R);id4=np.eye(4).ravel().tolist()
def submit(data):
 M,e,n=data
 for name,(v,g) in M.items():
  a=attr(R,name.encode());assert a>=0,name
  bind(0x8892,v);ena(a);vtx(a,g['itemSize'],{'Float32Array':0x1406,'Uint8Array':0x1401}[g['type']],g['normalized'],0,None)
 bind(0x8893,e);draw(4,n,0x1403,None)
def capture(c,part='scene',response=1.,phase=0.):
 q=target[c['samples']]
 fb(0x8d40,q);vp(0,0,W,H);color(.534,.584,.617,0.);clear(0x4100)
 p=c['projection'].copy();p[8]-=2*phase/W
 for v,M in [('modelMatrix',id4),('viewMatrix',c['view']),('modelViewMatrix',c['view']),('projectionMatrix',p)]:
  tr(uv(v),1,0,words(M))
 tr3(uv('normalMatrix'),1,0,words(c['normal']))
 v1(uv('toneMappingExposure'),1.);v1(uv('cornFieldResponse'),response);v1(uv('cornStudioGround'),0)
 v3(uv('cameraPosition'),*c['eye']);v3(uv('cornDay'),*J['light'])
 if part!='role':submit(floors['near'])
 if part!='floor':submit(subject[c['kind']])
 e0('draw')
 if c['samples']:
  fb(0x8ca8,q);fb(0x8ca9,target[0]);blit(0,0,W,H,0,0,W,H,0x4000,0x2600)
 fb(0x8ca8,target[0])
 R=np.empty((H,W,4),np.uint8);read(0,0,W,H,0x1908,0x1401,R.ctypes.data);e0('read')
 return R[::-1].copy()
D.mkdir()
rows=[]
for c in J['views']:
 a=capture(c);m=capture(c,'role');g=capture(c,'floor');q=capture(c)
 assert np.array_equal(a,q)
 role=m[:,:,3]>0
 assert not np.any(np.any(a!=g,axis=2)&~role),c['name']
 y,x=np.nonzero(role);assert len(x)>2500,c['name']
 box=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
 img=a.copy();img[:,:,3]=255
 name=c['name'];plate=D/(name+'.webp');Image.fromarray(img).save(plate,lossless=True,method=5)
 meta={'view':{k:v for k,v in c.items() if k not in ('view','projection','normal')},'bbox':box,'rolePixels':len(x),
  'pureRolePixels':int((m[:,:,3]==255).sum()),'plate':plate.name,'plateSha':hash(plate.read_bytes()),
  'rgba':hash(a.tobytes()),'repeatByteExact':True,'outsideRoleRgbaChanges':0}
 rows.append(meta)
 print(name,box,len(x))
(D/'receipt.json').write_text(json.dumps({'scope':J['scope'],'driver':driver,'three':J['three'],'frame':[W,H],
 'groupsPerAsset':0,'drawsPerAsset':1,'fixtureOnlyFloorAddsOneDraw':True,'downloadedTextureCount':0,
 'shaderHashes':J['shaderSha'],'geometry':{k:dict(attributes={n:dict(sha=v['sha'],bytes=v['bytes'])for n,v in g['attrs'].items()},
     indices=dict(count=g['index']['count'],sha=g['index']['sha'],bytes=g['index']['bytes']))for k,g in J['geo'].items()},
 'artBasis':J['basis'],'budget':J['budget'],'cameraLock':J['baseLock'],'interiorLock':J['interiorLock'],'views':rows},indent=2)+'\n')
