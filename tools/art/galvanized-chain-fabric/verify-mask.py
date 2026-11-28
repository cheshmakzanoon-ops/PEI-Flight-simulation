#!/usr/bin/env python3
"""Standalone literal alpha-mask trial, optional (EGL/GLES 3 with 4× sample support)."""
import os, ctypes as C, hashlib as H, json
from pathlib import Path
os.environ.setdefault('EGL_PLATFORM','surfaceless')
W,T=272,144
V=C.c_void_p; U=C.c_uint; I=C.c_int; F=C.c_float; S=C.c_char_p
P=C.POINTER(I)
e=C.CDLL('libEGL.so.1')
def egl(n,r,*a):
 p=getattr(e,n);p.restype=r;p.argtypes=a;return p
def ints(*v):return (I*len(v))(*v)
d=egl('eglGetDisplay',V,V)(None)
major,minor=I(),I();assert egl('eglInitialize',I,V,P,P)(d,C.byref(major),C.byref(minor))
assert egl('eglBindAPI',I,I)(0x30a0)
config=V();n=I()
assert egl('eglChooseConfig',I,V,P,C.POINTER(V),I,P)(d,ints(
 0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,
 0x3032,1,0x3031,4,0x3038),C.byref(config),1,C.byref(n)) and n.value
ctx=egl('eglCreateContext',V,V,V,V,P)(d,config,None,ints(0x3098,3,0x3038));assert ctx
surf=egl('eglCreatePbufferSurface',V,V,V,P)(d,config,ints(0x3057,W,0x3056,T,0x3038));assert surf
assert egl('eglMakeCurrent',I,V,V,V,V)(d,surf,surf,ctx)
get=egl('eglGetProcAddress',V,S)
def gl(name,result,*args):
 p=get(name.encode());assert p,name;return C.CFUNCTYPE(result,*args)(p)
def sha(u):return H.sha256(u).hexdigest()
def e0(where):
 err=gl('glGetError',U)();assert err==0,(where,hex(err))
check=gl('glGetIntegerv',None,U,P)
vals=[]
for v in (0x80a9,0x0d55,0x0d56):
 k=I();check(v,C.byref(k));vals.append(k.value)
assert vals==[4,8,24],vals
driver=gl('glGetString',S,U)(0x1f02).decode()
def program(value):
 p=gl('glCreateProgram',U)()
 for role,num in [('vertex',0x8b31),('fragment',0x8b30)]:
  sh=gl('glCreateShader',U,U)(num);s=value[role].encode()
  gl('glShaderSource',None,U,I,C.POINTER(S),P)(sh,1,C.byref(S(s)),C.byref(I(len(s))))
  gl('glCompileShader',None,U)(sh)
  ok=I();gl('glGetShaderiv',None,U,U,P)(sh,0x8b81,C.byref(ok))
  if not ok.value:
   v=C.create_string_buffer(3500);gl('glGetShaderInfoLog',None,U,I,P,V)(sh,3500,None,v)
   assert False,(role,v.value.decode())
  gl('glAttachShader',None,U,U)(p,sh)
  gl('glDeleteShader',None,U)(sh)
 gl('glLinkProgram',None,U)(p)
 ok=I();gl('glGetProgramiv',None,U,U,P)(p,0x8b82,C.byref(ok))
 if not ok.value:
  v=C.create_string_buffer(3500);gl('glGetProgramInfoLog',None,U,I,P,V)(p,3500,None,v)
  assert False,v.value.decode()
 return p


def native_shader():
 # Adapt only the ES3 varying qualifier; the periodic mask is literal from
 # the production material source of the detached art asset.
 literal=Path(__file__).with_name('fabric.ts').read_text().split('const stripeGLSL=`',1)[1].split('`;',1)[0]
 return {
  'vertex':'#version 300 es\nprecision highp float;\nuniform vec2 extent;\nuniform vec2 angle;\nuniform vec2 shift;\nout vec2 fenceMetres;\nvoid main(){\n const vec2 p[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));\n vec2 xy=(p[gl_VertexID]+1.)*.5*extent;\n fenceMetres=vec2(xy.x+xy.y*angle.x,xy.y+xy.x*angle.y)+shift;\n gl_Position=vec4(p[gl_VertexID],0.,1.);\n}',
  'fragment':'#version 300 es\nprecision highp float;out vec4 outRGB;\n'+literal.replace('varying vec2','in vec2')+'\nvoid main(){float a=fenceCover();a=smoothstep(.025,.025+max(.00006,fwidth(a)),a);if(a==0.)discard;outRGB=vec4(.84,.84,.84,a);}'
 }

source=json.dumps(native_shader(),separators=(',',':')).encode();p=program(json.loads(source));gl('glUseProgram',None,U)(p)
s=gl('glGetUniformLocation',I,U,S)
f=gl('glUniform1f',None,I,F);f(s(p,b'fencePitch'),.051);f(s(p,b'fenceDuty'),.0027*2**.5/.051)
two=gl('glUniform2f',None,I,F,F);w,h=272,144
def one(name):
 q=U();gl(name,None,I,C.POINTER(U))(1,C.byref(q));return q
FBO=0x8d40;RB=0x8d41
bind=gl('glBindFramebuffer',None,U,U)
multi,target=one('glGenFramebuffers'),one('glGenFramebuffers')
bind(FBO,multi)
rb=one('glGenRenderbuffers')
gl('glBindRenderbuffer',None,U,U)(RB,rb)
gl('glRenderbufferStorageMultisample',None,U,I,U,I,I)(RB,4,0x8058,w,h)
gl('glFramebufferRenderbuffer',None,U,U,U,U)(FBO,0x8ce0,RB,rb)
assert gl('glCheckFramebufferStatus',U,U)(FBO)==0x8cd5
bind(FBO,target)
rt=one('glGenTextures')
gl('glBindTexture',None,U,U)(0x0de1,rt)
gl('glTexStorage2D',None,U,I,U,I,I)(0x0de1,1,0x8058,w,h)
gl('glFramebufferTexture2D',None,U,U,U,U,I)(FBO,0x8ce0,0x0de1,rt,0)
assert gl('glCheckFramebufferStatus',U,U)(FBO)==0x8cd5
gl('glBindVertexArray',None,U)(one('glGenVertexArrays'))
e0('setup exact mask')
gl('glViewport',None,I,I,I,I)(0,0,w,h)
gl('glEnable',None,U)(0x809e) # ALPHA_TO_COVERAGE, true 4x sample buffer
gl('glEnable',None,U)(0x0be2) # GL_BLEND
gl('glBlendFuncSeparate',None,U,U,U,U)(1,0,0,1) # replace RGB only; preserve destination alpha
rows={}
for n,ext,angle,shift in [
 ('near',(1.04,.62),(0,0),(0,0)),
 ('subpixel',(1.04,.62),(0,0),(.0017,.0008)),
 ('oblique',(1.61,.53),(.32,.16),(0,0)),
 ('far',(28.0,12.0),(0,0),(0,0)),
]:
 bind(FBO,multi)
 two(s(p,b'extent'),*ext);two(s(p,b'angle'),*angle);two(s(p,b'shift'),*shift)
 gl('glClearColor',None,F,F,F,F)(.15,.26,.29,.52)
 gl('glClear',None,U)(0x4000);gl('glDrawArrays',None,U,I,I)(4,0,3)
 e0('draw exact derivative fabric output')
 bind(0x8ca8,multi);bind(0x8ca9,target)
 gl('glBlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,w,h,0,0,w,h,0x4000,0x2600)
 bind(FBO,target)
 b=C.create_string_buffer(w*h*4);gl('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,b)
 e0('exact derivative fabric output')
 v=b.raw[0::4];assert set(b.raw[3::4])=={133},'the wire must not overwrite destination alpha'
 rows[n]={'pixels':sum(x>45 for x in v),'sha':sha(b.raw),'bins':sorted(set(v)),'alpha':133}
assert rows['near']['pixels']>2000 and rows['oblique']['pixels']>1800
assert len(rows['near']['bins'])>=4 and rows['far']['pixels']==0
assert .89<=rows['subpixel']['pixels']/rows['near']['pixels']<=1.11
print(json.dumps({'scope':'Isolated ES3 literal chain mask in true 4x EGL. Not full Three PBR or a real site.','driver':driver,
 'nativeShaderJSONSHA':sha(source),'cases':rows},indent=2))
