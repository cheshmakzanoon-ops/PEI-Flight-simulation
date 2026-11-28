"""Offscreen EGL ES3 test of the actual exported Three.js packed mesh + raw shaders, never Browser/native flight."""
import math,runpy,sys
from pathlib import Path
import numpy as np
from PIL import Image
base=Path(sys.argv[1])
globals().update(runpy.run_path(str(Path(__file__).with_name('egl_support.py'))))
j=json.loads((base/'studio.json').read_text())
w,h=j['viewport']; FBO=0x8d40; RB=0x8d41
def one(n):
 b=U();gl(n,None,I,C.POINTER(U))(1,C.byref(b));return b
inp={a: (base/k['file']).read_bytes() for b in ('attr','shader') for a,k in j[b].items()}
for b in ('attr','shader'):
 for a,k in j[b].items():assert sha(inp[a])==k['sha']
p=program({a:inp[a].decode() for a in ('vertex','fragment')})
use=gl('glUseProgram',None,U)
ul=gl('glGetUniformLocation',I,U,S)
bind=gl('glBindFramebuffer',None,U,U)
def mulf(b):
 k=one('glGenRenderbuffers')
 gl('glBindRenderbuffer',None,U,U)(RB,k)
 gl('glRenderbufferStorageMultisample',None,U,I,U,I,I)(RB,4,b,w,h)
 actual=I()
 gl('glGetRenderbufferParameteriv',None,U,U,C.POINTER(I))(RB,0x8cab,C.byref(actual))
 assert actual.value==4,('draw-target renderbuffer sample count',actual.value)
 return k
multi=one('glGenFramebuffers');bind(FBO,multi)
for fmt,a in ((0x8058,0x8ce0),(0x81a6,0x8d00)):
 k=mulf(fmt)
 gl('glFramebufferRenderbuffer',None,U,U,U,U)(FBO,a,RB,k)
assert gl('glCheckFramebufferStatus',U,U)(FBO)==0x8cd5
resolved=one('glGenFramebuffers');bind(FBO,resolved)
tex=one('glGenTextures')
gl('glBindTexture',None,U,U)(0x0de1,tex)
gl('glTexStorage2D',None,U,I,U,I,I)(0x0de1,1,0x8058,w,h)
gl('glFramebufferTexture2D',None,U,U,U,U,I)(FBO,0x8ce0,0x0de1,tex,0)
assert gl('glCheckFramebufferStatus',U,U)(FBO)==0x8cd5
vao=one('glGenVertexArrays'); gl('glBindVertexArray',None,U)(vao)
for i,(a,n) in enumerate([('position',3),('normal',3),('finish',1)]):
 raw=inp[a]; assert len(raw)==j['numVerts']*n*4
 k=one('glGenBuffers')
 gl('glBindBuffer',None,U,U)(0x8892,k)
 a=C.create_string_buffer(raw)
 gl('glBufferData',None,U,C.c_size_t,V,U)(0x8892,len(raw),a,0x88e4)
 gl('glEnableVertexAttribArray',None,U)(i)
 gl('glVertexAttribPointer',None,U,I,U,C.c_ubyte,I,V)(i,n,0x1406,0,0,None)
def mat(program,key,v):
 k=ul(program,key.encode());assert k>=0,key
 gl('glUniformMatrix4fv',None,I,I,C.c_ubyte,C.POINTER(F))(k,1,0,(F*16)(*v))
def read():
 bind(0x8ca8,multi);bind(0x8ca9,resolved)
 gl('glBlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,w,h,0,0,w,h,0x4000,0x2600)
 bind(FBO,resolved)
 dst=C.create_string_buffer(w*h*4)
 gl('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,dst);e0('exact readback')
 return np.flip(np.frombuffer(dst.raw,'u1').reshape(h,w,4),axis=0).copy()
# Separate neutral stage floor/sky, with no architecture donor or terrain.
B=program({'vertex':'''#version 300 es
   void main(){vec2 q=vec2((gl_VertexID&1)*4-1,(gl_VertexID>>1)*4-1);gl_Position=vec4(q,0.,1.);}
 ''','fragment':'''#version 300 es
 precision highp float;
 uniform mat4 rayClipWorld;uniform vec2 sz;
 out vec4 c;
 void main(){
   vec4 a=rayClipWorld*vec4(2.*gl_FragCoord.xy/sz-1.,-1.,1.);
   vec4 b=rayClipWorld*vec4(2.*gl_FragCoord.xy/sz-1.,1.,1.);
   vec3 eye=a.xyz/a.w,farq=b.xyz/b.w, d=normalize(farq-eye);
   float t=(.014-eye.y)/min(-.0001,d.y);
   vec2 q=(eye+t*d).xz;
   float ambient=exp(-.76*length(max(abs(q-vec2(-.8,-.94))-vec2(13.8,8.60),vec2(0.))));
   float s=mix(.555,.665,smoothstep(-.65,.2,d.y));
   if(d.y<-.052){s-=.107*ambient*smoothstep(-.052,-.25,d.y);}
   c=vec4(s*.97,s,s*1.005,1.);
 }'''})
blank=one('glGenVertexArrays')
def render(cv,active=True):
 bind(FBO,multi)
 gl('glViewport',None,I,I,I,I)(0,0,w,h)
 gl('glDepthMask',None,C.c_ubyte)(1)
 gl('glClearColor',None,F,F,F,F)(.54,.56,.57,1.)
 gl('glClear',None,U)(0x4100)
 gl('glDisable',None,U)(0x0be2)
 gl('glDisable',None,U)(0x0b71);gl('glDisable',None,U)(0x0b44)
 use(B);gl('glBindVertexArray',None,U)(blank)
 M=np.asarray(cv['projection']).reshape(4,4,order='F')@np.asarray(cv['view']).reshape(4,4,order='F')
 mat(B,'rayClipWorld',np.linalg.inv(M).reshape(16,order='F'))
 gl('glUniform2f',None,I,F,F)(ul(B,b'sz'),w,h)
 gl('glDrawArrays',None,U,I,I)(4,0,3)
 if active:
  use(p);gl('glBindVertexArray',None,U)(vao);gl('glEnable',None,U)(0x0b71);gl('glEnable',None,U)(0x0b44)
  mat(p,'projectionMatrix',cv['projection']);mat(p,'modelViewMatrix',cv['view']);mat(p,'modelMatrix',cv['model'])
  gl('glUniform3f',None,I,F,F,F)(ul(p,b'cameraPosition'),*cv['eye'])
  gl('glDrawArrays',None,U,I,I)(4,0,j['numVerts'])
 return read()
# Preserve actual studio positives, negative floor-only and restore exact.
R={}
for mode,cv in j['cameras'].items():
 no=render(cv,False);yes=render(cv,True);yes2=render(cv,True);ret=render(cv,False)
 assert np.array_equal(no,ret) and np.array_equal(yes,yes2) and np.all(no[:,:,3]==255) and np.all(yes[:,:,3]==255)
 diff=np.max(np.abs(yes[:,:,:3].astype('i2')-no[:,:,:3].astype('i2')),axis=2)
 Y,X=np.where(diff>3);assert len(X)>(2000 if mode=='visibleScale' else 35000)
 fp=base/(mode+'.png')
 assert not fp.exists();Image.fromarray(yes).save(fp)
 R[mode]={'gpuArtPositiveRGBGT3':len(X),'bbox':[int(X.min()),int(Y.min()),int(X.max()),int(Y.max())],'alphaUnchanged':True,
          'studioRestoreExact':True,'noStagingTerrain':True,'activeRGBA':sha(yes.tobytes()),'exactPNGSHA':sha(fp.read_bytes())}
r={'scope':'Isolated native 4x ES3 with same exact raw GLSL and literal generated Three.js mesh, neutral synthetic floor only, no player/camera/physics/source-map comparison.',
 'driver':driver,'views':R,'triangleCount':j['numVerts']//3,'geometryDraws':1,'analyticTextureReads':0}
with (base/'render-receipt.json').open('x') as f:f.write(json.dumps(r,indent=2)+'\n')
print(json.dumps(r,indent=2))
