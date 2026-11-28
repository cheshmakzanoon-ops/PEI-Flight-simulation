"""Actual four-sample Mesa GLES3 raster of the expanded r187 shader, source unchanged."""
from pathlib import Path
from io import BytesIO
import base64,ctypes as ct,hashlib,json,sys
from PIL import Image
import numpy as np
from egl_support import gl,I,U,V,e0,program
assert len(sys.argv)==2
D=Path(sys.argv[1]);assert not D.exists()
J=json.load(sys.stdin);W,H=J['recipe']['frame'];R=program(J['shading']['sources'])
f=ct.c_float;one=ct.c_ubyte
Fx=lambda s,r,*a:gl('gl'+s,r,*a)
mkfb=Fx('GenFramebuffers',None,I,V);fb=Fx('BindFramebuffer',None,U,U)
mkrb=Fx('GenRenderbuffers',None,I,V);rb=Fx('BindRenderbuffer',None,U,U)
at=Fx('FramebufferRenderbuffer',None,U,U,U,U)
rs=Fx('RenderbufferStorage',None,U,U,I,I);rms=Fx('RenderbufferStorageMultisample',None,U,I,U,I,I)
check=Fx('CheckFramebufferStatus',U,U);read=Fx('ReadPixels',None,I,I,I,I,U,U,V)
F0,F1=U(),U()
for F,samples in ((F0,4),(F1,0)):
 mkfb(1,ct.byref(F));fb(0x8d40,F.value)
 for attachment,fmt in ([(0x8ce0,0x8058),(0x8d00,0x81a6)] if samples else [(0x8ce0,0x8058)]):
  v=U();mkrb(1,ct.byref(v));rb(0x8d41,v.value)
  if samples:rms(0x8d41,samples,fmt,W,H)
  else:rs(0x8d41,fmt,W,H)
  at(0x8d40,attachment,0x8d41,v.value)
 assert check(0x8d40)==0x8cd5
fb(0x8d40,F0.value);Q=I()
Fx('GetIntegerv',None,U,V)(0x80a9,ct.byref(Q));assert Q.value==4
vp=Fx('Viewport',None,I,I,I,I);clear=Fx('Clear',None,U);color=Fx('ClearColor',None,f,f,f,f)
e=Fx('Enable',None,U);n=Fx('Disable',None,U)
bind=Fx('BindBuffer',None,U,U);gen=Fx('GenBuffers',None,I,V);upload=Fx('BufferData',None,U,ct.c_ssize_t,V,U)
a=Fx('GetAttribLocation',I,U,ct.c_char_p);l=Fx('GetUniformLocation',I,U,ct.c_char_p)
vtx=Fx('VertexAttribPointer',None,U,I,U,one,I,V);ena=Fx('EnableVertexAttribArray',None,U)
tr=Fx('UniformMatrix4fv',None,I,I,one,V);draw=Fx('DrawArrays',None,U,I,I)
v3=Fx('Uniform3f',None,I,f,f,f);v1=Fx('Uniform1f',None,I,f)
blit=Fx('BlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)
def uv(k):return l(R,k.encode())
def hash(b):return hashlib.sha256(b).hexdigest()
def words(v):return (f*len(v))(*v)
E={}
for part,g in J['packed'].items():
 E[part]={}
 for key,b in g['attrs'].items():
  d=base64.b64decode(b,validate=True);assert hash(d)==g['sha256'][key]
  q=U();gen(1,ct.byref(q));bind(0x8892,q.value);upload(0x8892,len(d),ct.c_char_p(d),0x88e4)
  E[part][key]=q.value
def capture(c,body_only=False):
 fb(0x8d40,F0.value);vp(0,0,W,H)
 color(.478,.551,.595,0. if body_only else 1.)
 for role in [0x0B71,0x0B44]:e(role)
 for role in [0x0BE2,0x0BD0,0x809E,0x0C11]:n(role)
 clear(0x4100);Fx('UseProgram',None,U)(R)
 identity=np.eye(4).ravel().tolist()
 for k,M in [('modelMatrix',identity),('viewMatrix',c['view']),('projectionMatrix',c['pp'])]:
  tr(uv(k),1,0,words(M))
 v1(uv('toneMappingExposure'),1.)
 v3(uv('cameraPosition'),*c['eye']);v3(uv('churchSun'),*J['shading']['sun'])
 for part in (('subject',) if body_only else ('floor','subject')):
  for k,d in [('position',3),('normal',3),('uv',2),('churchRole',1)]:
   j=a(R,k.encode());assert j>=0;bind(0x8892,E[part][k]);ena(j);vtx(j,d,0x1406,0,0,None)
  draw(4,0,J['packed'][part]['count'])
 e0('studio draw')
 fb(0x8ca8,F0.value);fb(0x8ca9,F1.value)
 blit(0,0,W,H,0,0,W,H,0x4000,0x2600)
 fb(0x8ca8,F1.value)
 out=np.empty((H,W,4),np.uint8);read(0,0,W,H,0x1908,0x1401,out.ctypes.data);e0('resolve')
 return out[::-1].copy()
D.mkdir()
receipts=[]
for v in J['views']:
 first=capture(v); subject=capture(v,True); repeat=capture(v)
 assert np.array_equal(first,repeat)
 name=v['name'];fn=D/(name+'.webp')
 Image.fromarray(first).save(fn,lossless=True,method=4)
 y,x=np.nonzero(subject[:,:,3]);assert len(y)>500
 extent=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
 if name=='scale-only':
  assert 50<=extent[3]-extent[1]<=85,extent
  l0,t0,r0,b0=extent
  Image.fromarray(first[max(0,t0-13):b0+13,max(0,l0-17):r0+17]).save(D/'scale-only-1x.png',optimize=True)
 else:
  pic=Image.fromarray(first).convert('RGB');pic.thumbnail((660,403));pic.save(D/(name+'-review.jpg'),quality=91)
 receipts.append({'camera':v,'image':fn.name,'SHA256':hash(fn.read_bytes()),'subjectNativeBBox':extent,
   'subjectPixelCount':len(y),'immediateOpaqueRerenderExact':True})
 (D/'progress.json').write_text(json.dumps({'count':len(receipts)}))
print(json.dumps({'triangles':J['packed']['subject']['count']//3,'resolution':[W,H],
 'coverage':[(v['image'],v['subjectNativeBBox'],v['subjectPixelCount'])for v in receipts]}))
(D/'receipt.json').write_text(json.dumps({'scope':J['proof'],'three':J['rev'],'screen':[W,H],
 'coverageSamples':Q.value,'noAssetTextures':True,
 'triangles':J['packed']['subject']['count']//3,'artDraws':1,'extraStudioGroundDraws':1,
 'poseSourceSha':J['viewPrelockSha'],'roles':J['sections'],'attributes':J['packed']['subject']['sha256'],
 'shader':{k:v for k,v in J['shading'].items() if k!='sources'},'views':receipts},indent=2)+'\n')
