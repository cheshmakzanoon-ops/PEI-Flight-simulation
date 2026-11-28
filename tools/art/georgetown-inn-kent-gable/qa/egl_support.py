import os, ctypes as C, hashlib as H, json
from pathlib import Path
os.environ.setdefault('EGL_PLATFORM','surfaceless')
W,T=1080,700
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
