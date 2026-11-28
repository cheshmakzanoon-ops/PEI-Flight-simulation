"""Exact r187-expanded subject shaders on a private Mesa GLES software context."""
import ctypes as C,sys,json,hashlib,base64
from pathlib import Path
from egl_support import gl,I,U,V,e0,program,driver
import numpy as np
from PIL import Image
D=Path(sys.argv[1]);assert not D.exists()
J=json.load(sys.stdin);W,H=J['frame']
P=program(J['source'])
f=C.c_float;one=C.c_ubyte
F=lambda name,res,*args:gl('gl'+name,res,*args)
def gen(n):
 a=U();F(n,None,I,V)(1,C.byref(a));assert a.value>0;return a.value
u=F('GetUniformLocation',I,U,C.c_char_p);a=F('GetAttribLocation',I,U,C.c_char_p)
G=F('GetIntegerv',None,U,V)
bind=F('BindFramebuffer',None,U,U);v=F('Viewport',None,I,I,I,I)
clear=F('Clear',None,U);background=F('ClearColor',None,f,f,f,f)
rb=F('BindRenderbuffer',None,U,U);att=F('FramebufferRenderbuffer',None,U,U,U,U)
render=gen('GenFramebuffers');resolve=gen('GenFramebuffers')
for k,ms in [(render,True),(resolve,False)]:
 bind(0x8d40,k)
 for slot,kind in [(0x8ce0,0x8058)]+([(0x8d00,0x81a6)]if ms else []):
  obj=gen('GenRenderbuffers');rb(0x8d41,obj)
  if ms:F('RenderbufferStorageMultisample',None,U,I,U,I,I)(0x8d41,4,kind,W,H)
  else:F('RenderbufferStorage',None,U,U,I,I)(0x8d41,kind,W,H)
  att(0x8d40,slot,0x8d41,obj)
 assert F('CheckFramebufferStatus',U,U)(0x8d40)==0x8cd5
bind(0x8d40,render)
AA=I();G(0x80a9,C.byref(AA));assert AA.value==4
shaderUse=F('UseProgram',None,U)
blit=F('BlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)
read=F('ReadPixels',None,I,I,I,I,U,U,V)
attrib=F('VertexAttribPointer',None,U,I,U,one,I,V)
ena=F('EnableVertexAttribArray',None,U)
bindA=F('BindBuffer',None,U,U)
data=F('BufferData',None,U,C.c_ssize_t,V,U)
M4=F('UniformMatrix4fv',None,I,I,one,V)
v1=F('Uniform1f',None,I,f);v3=F('Uniform3f',None,I,f,f,f)
def words(v): return(f*len(v))(*v)
sha=lambda b:hashlib.sha256(b).hexdigest()
attr={}
for k,q in J['packed'].items():
 attr[k]={}
 for name,x in q['attrs'].items():
  s=base64.b64decode(x['b64'],validate=True);assert len(s)==x['bytes'] and sha(s)==x['sha']
  b=gen('GenBuffers');bindA(0x8892,b);data(0x8892,len(s),C.c_char_p(s),0x88e4)
  l=a(P,name.encode());assert l>=0 and not x['normalized']
  t={'Float32Array':0x1406,'Uint8Array':0x1401}[x['kind']]
  attr[k][name]=(l,x['itemSize'],t,b)
def un(name):
 l=u(P,name.encode());assert l>=0,name;return l
def capture(t,proof):
 bind(0x8d40,render);v(0,0,W,H)
 shade=(.54,.63,.72,1.)if not proof else(0.,0.,0.,1.)
 background(*shade);clear(0x4100)
 for s in [0xB71,0xB44]:F('Enable',None,U)(s)
 for s in [0xBE2,0xBD0,0x809E,0xC11]:F('Disable',None,U)(s)
 F('DepthFunc',None,U)(0x0203);F('FrontFace',None,U)(0x0901);F('CullFace',None,U)(0x0405)
 shaderUse(P)
 for name,m in zip(['modelMatrix','viewMatrix','projectionMatrix'],[np.eye(4).ravel().tolist(),*t['matrix']]):
  M4(un(name),1,0,words(m))
 v1(un('toneMappingExposure'),1.); v1(un('woodProof'),1. if proof else 0.)
 v3(un('cameraPosition'),*t['eye']);v3(un('woodEyeLocal'),*t['eye']);v1(un('useLocalEye'),0.)
 v3(un('woodSunLocal'),*J['lights'])
 for k in ['floor','subject']:
  for l,n,ty,b in attr[k].values():
   bindA(0x8892,b);ena(l);attrib(l,n,ty,0,0,None)
  F('DrawArrays',None,U,I,I)(4,0,J['packed'][k]['vertices'])
 e0('literal original art')
 bind(0x8ca8,render);bind(0x8ca9,resolve)
 blit(0,0,W,H,0,0,W,H,0x4000,0x2600);bind(0x8ca8,resolve)
 x=np.empty((H,W,4),np.uint8);read(0,0,W,H,0x1908,0x1401,x.ctypes.data);e0('actual 1x framebuffer extraction')
 return x[::-1].copy()
D.mkdir()
result=[]
for t in J['views']:
 name=t['id'];p=capture(t,False);m=capture(t,True)
 assert np.array_equal(capture(t,False),p),'nonreproducible portrait'
 assert np.all(p[:,:,3]==255);eyes=m[:,:,0]>0
 Y,X=np.where(eyes);assert len(X)>1000
 b=[int(X.min()),int(Y.min()),int(X.max()+1),int(Y.max()+1)]
 assert b[0]>14 and b[1]>14 and b[2]<W-14 and b[3]<H-14
 init=Image.fromarray(p[:,:,:3]); q=D/(name+'.webp');init.save(q,lossless=True,method=4)
 box=(max(0,b[0]-19),max(0,b[1]-17),min(W,b[2]+19),min(H,b[3]+17))
 q1=D/(name+'-crop.webp');init.crop(box).save(q1,lossless=True,method=4)
 mask=D/(name+'-role.png');Image.fromarray(m[:,:,0]).save(mask,optimize=True)
 result.append({'view':t,'actualModelSilhouettePixels':int(eyes.sum()),'actualBoundsFromRole':b,
  'image':q.name,'imageSHA256':sha(q.read_bytes()),'oneToOneCrop':q1.name,'oneToOneCropSHA256':sha(q1.read_bytes()),
  'markerSHA256':sha(mask.read_bytes()),'exactColorRepeat':True})
record={'scope':J['scope'],'driver':driver,'r187':J['three'],'frame':[W,H],'sampleCount':AA.value,'presentScale':'literal 1:1 native pixel crops',
 'modelTriangles':J['packed']['subject']['vertices']//3,'sceneDraws':2,'modelDraws':1,'artTextureCount':0,
 'shaderSHA':J['sourceSHA'],'planSHA':J['planSHA'],'views':result,
 'actualSubmissionDigests':{k:{a:b['sha']for a,b in t['attrs'].items()}for k,t in J['packed'].items()}}
(D/'receipt.json').write_text(json.dumps(record,indent=2)+'\n')
# Lossless contact sheet: both saved crops at literal resolution, with a 10 px gutter.
left=Image.open(D/'harbour-side-1x-crop.webp').convert('RGB')
right=Image.open(D/'keeper-side-1x-crop.webp').convert('RGB')
height=max(left.height,right.height)
pair=Image.new('RGB',(left.width+10+right.width,height),(33,37,37))
pair.paste(left,(0,(height-left.height)//2))
pair.paste(right,(left.width+10,(height-right.height)//2))
pair.save(D/'wood-islands-two-reciprocal-native-scale.webp',lossless=True,method=4)
print(json.dumps({'triangles':record['modelTriangles'],'views':[[p['image'],p['actualBoundsFromRole'],p['actualModelSilhouettePixels']]for p in result]}))
