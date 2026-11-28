"""Isolated 4x Mesa GLES3 draw of exact Three r187-expanded original sources."""
from pathlib import Path
import base64,ctypes as C,hashlib,json,sys
from PIL import Image
import numpy as np
from egl_support import gl,I,U,V,e0,program,driver
assert len(sys.argv)==2
D=Path(sys.argv[1]);assert not D.exists()
J=json.load(sys.stdin);W,H=J['spec']['frame'];R=program(J['shader'])
f=C.c_float;byte=C.c_ubyte
F=lambda s,r,*a:gl('gl'+s,r,*a)
def words(v):return (f*len(v))(*v)
def sha(b):return hashlib.sha256(b).hexdigest()
def unpack(q):
 d=base64.b64decode(q['data'],validate=True)
 assert len(d)==q['bytes'] and sha(d)==q['sha']
 return d
def make(gen):
 o=U();gen(1,C.byref(o));assert o.value;return o.value
mkfb=F('GenFramebuffers',None,I,V);fb=F('BindFramebuffer',None,U,U)
mkrb=F('GenRenderbuffers',None,I,V);rb=F('BindRenderbuffer',None,U,U)
at=F('FramebufferRenderbuffer',None,U,U,U,U)
rs=F('RenderbufferStorage',None,U,U,I,I);rms=F('RenderbufferStorageMultisample',None,U,I,U,I,I)
check=F('CheckFramebufferStatus',U,U);read=F('ReadPixels',None,I,I,I,I,U,U,V)
f0,f1=make(mkfb),make(mkfb)
for frame,samples in ((f0,4),(f1,0)):
 fb(0x8d40,frame)
 for attachment,fmt in ([(0x8ce0,0x8058),(0x8d00,0x81a6)] if samples else [(0x8ce0,0x8058)]):
  v=make(mkrb);rb(0x8d41,v)
  if samples:rms(0x8d41,samples,fmt,W,H)
  else:rs(0x8d41,fmt,W,H)
  at(0x8d40,attachment,0x8d41,v)
 assert check(0x8d40)==0x8cd5
fb(0x8d40,f0);aa=I();F('GetIntegerv',None,U,V)(0x80a9,C.byref(aa));assert aa.value==4
vp=F('Viewport',None,I,I,I,I);clear=F('Clear',None,U);color=F('ClearColor',None,f,f,f,f)
enable=F('Enable',None,U);disable=F('Disable',None,U)
bind=F('BindBuffer',None,U,U);gen=F('GenBuffers',None,I,V);upload=F('BufferData',None,U,C.c_ssize_t,V,U)
a=F('GetAttribLocation',I,U,C.c_char_p);loc=F('GetUniformLocation',I,U,C.c_char_p)
vtx=F('VertexAttribPointer',None,U,I,U,byte,I,V);ena=F('EnableVertexAttribArray',None,U)
tr=F('UniformMatrix4fv',None,I,I,byte,V);tr3=F('UniformMatrix3fv',None,I,I,byte,V)
draw=F('DrawElements',None,U,I,U,V)
v3=F('Uniform3f',None,I,f,f,f);v1=F('Uniform1f',None,I,f);vi=F('Uniform1i',None,I,I)
blit=F('BlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)
def uv(k):
 v=loc(R,k.encode());assert v>=0,k
 return v
M={}
for name,g in J['attrs'].items():
 d=unpack(g);b=make(gen);bind(0x8892,b);upload(0x8892,len(d),C.c_char_p(d),0x88e4);M[name]=b
index=make(gen);d=unpack(J['index']);assert len(d)==J['index']['count']*2
bind(0x8893,index);upload(0x8893,len(d),C.c_char_p(d),0x88e4)
# Exactly the authored single Texture with literal orientation and no sRGB transfer.
texture=make(F('GenTextures',None,I,V));q=J['tex'];d=unpack(q)
F('ActiveTexture',None,U)(0x84c0)
bindTex=F('BindTexture',None,U,U);bindTex(0x0de1,texture)
param=F('TexParameteri',None,U,U,I)
F('PixelStorei',None,U,I)(0x0cf5,1)
for key,value in ((0x2802,0x2901),(0x2803,0x2901),(0x2801,0x2703),(0x2800,0x2601)):
 param(0x0de1,key,value)
F('TexImage2D',None,U,I,I,I,I,I,U,U,V)(0x0de1,0,0x8058,q['width'],q['height'],0,0x1908,0x1401,C.c_char_p(d))
F('GenerateMipmap',None,U)(0x0de1)
e0('upload indexed model and original procedural grain')
for role in (0x0b71,0x0b44):enable(role)
for role in (0x0be2,0x0bd0,0x809e,0x0c11):disable(role)
F('UseProgram',None,U)(R);vi(uv('bGrain'),0)
id4=np.eye(4).ravel().tolist()
for name,q in J['attrs'].items():
 at=a(R,name.encode());assert at>=0,name
 bind(0x8892,M[name]);ena(at)
 gltype={'Float32Array':0x1406,'Uint8Array':0x1401}[q['type']]
 vtx(at,q['itemSize'],gltype,q['normalized'],0,None)
bind(0x8893,index)
def capture(c,cast=1.):
 fb(0x8d40,f0);vp(0,0,W,H);color(.478,.519,.541,0.);clear(0x4100)
 for k,M in [('modelMatrix',id4),('viewMatrix',c['view']),('modelViewMatrix',c['view']),('projectionMatrix',c['projection'])]:
  tr(uv(k),1,0,words(M))
 tr3(uv('normalMatrix'),1,0,words(c['normal']))
 v1(uv('toneMappingExposure'),1.);v1(uv('bCastWeight'),cast)
 v3(uv('cameraPosition'),*c['eye']);v3(uv('bStudioSun'),*J['key'])
 draw(4,J['index']['count'],0x1403,None);e0('studio draw')
 fb(0x8ca8,f0);fb(0x8ca9,f1);blit(0,0,W,H,0,0,W,H,0x4000,0x2600)
 fb(0x8ca8,f1)
 out=np.empty((H,W,4),np.uint8);read(0,0,W,H,0x1908,0x1401,out.ctypes.data)
 e0('resolve');return out[::-1].copy()
captures=[capture(v) for v in J['views']]
without=[capture(v,0.) for v in J['views']]
rebuilt=[capture(v) for v in J['views'][::-1]][::-1]
assert all(np.array_equal(a,b) for a,b in zip(captures,rebuilt))
D.mkdir()
receipts=[]
for art,none,c in zip(captures,without,J['views']):
 name=c['name'];y,x=np.nonzero(art[:,:,3]);assert len(y)>25,name
 box=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
 if name!='scale-only':assert len(x)>38000 and box[0]>=5 and box[1]>=5 and box[2]<=W-5 and box[3]<=H-5,(name,box,len(x))
 # Background is only a studio clear, no water, ground or additional geometry.
 shown=art.copy();shown[:,:,3]=255
 out=D/(name+'.webp');Image.fromarray(shown).save(out,lossless=True,method=5)
 if name=='scale-only':
  x0,y0,x1,y1=box
  Image.fromarray(shown[max(0,y0-14):min(H,y1+14),max(0,x0-15):min(W,x1+15)]).save(D/'scale-only-1x.png',optimize=True)
 assert np.array_equal(art[:,:,3],none[:,:,3])
 changed=(np.abs(art[:,:,:3].astype(np.int16)-none[:,:,:3].astype(np.int16)).max(2)>2)
 assert not np.any(changed & (art[:,:,3]==0))
 receipts.append({'camera':c,'bbox':box,'castGainRgbOver2':int(changed.sum()),'disabledCastRgba':sha(none.tobytes()),'rolePixels':len(x),'pureRolePixels':int((art[:,:,3]==255).sum()),
  'rgba':sha(art.tobytes()),'plate':out.name,'plateSha':sha(out.read_bytes()),'reciprocalRepeatExact':True})
print([(r['plate'],r['bbox'],r['rolePixels'])for r in receipts])
(D/'receipt.json').write_text(json.dumps({'scope':J['phase'],'driver':driver,'three':J['three'],
 'frame':[W,H],'rasterSamples':aa.value,'geometryDraws':1,'triangles':J['index']['count']//3,
 'attributeBytes':{k:{kk:v[kk]for kk in ('sha','bytes','normalized','type')}for k,v in J['attrs'].items()},
 'indices':{k:J['index'][k]for k in ('count','sha','bytes')},'shaderHashes':J['shaderSha'],'studioKey':J['key'],
 'texture':{**{k:J['tex'][k]for k in ('width','height','sha','bytes')},'format':'RGBA8 linear, repeat, exact mip GL_LINEAR_MIPMAP_LINEAR','mipBytes':87388,'unit':0},
 'viewSha':J['viewSha'],'outsideWorld':True,'frames':receipts},indent=2)+'\n')
