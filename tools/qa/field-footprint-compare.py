#!/usr/bin/env python3
# Isolated actual terrain GLSL comparison. Requires Mesa EGL/GLES3,
# NumPy and Pillow on Linux. Inputs come from field-footprint-material.mjs.
import ctypes as c
import os
import sys
# Optional higher independent area reference, without a different camera.
SCALE=int(os.environ.get('PEI_AREA_SCALE','2'))
assert SCALE in (2,4)

egl=c.CDLL('libEGL.so.1')
def load(lib,name,res,*args):
    f=getattr(lib,name);f.argtypes=args;f.restype=res;return f
I=c.c_int; U=c.c_uint;P=c.c_void_p
getp=load(egl,'eglGetProcAddress',P,c.c_char_p)
Platform=c.CFUNCTYPE(P,U,P,P)(getp(b'eglGetPlatformDisplayEXT'))
display=Platform(0x31DD,None,None)
major=I();minor=I()
assert load(egl,'eglInitialize',U,P,P,P)(display,c.byref(major),c.byref(minor))
assert major.value>=1
assert load(egl,'eglBindAPI',U,U)(0x30A0)
attr=(I*15)(0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3038)
cfg=P();num=I()
assert load(egl,'eglChooseConfig',U,P,P,P,I,P)(display,attr,c.byref(cfg),1,c.byref(num)) and num.value
ctx=load(egl,'eglCreateContext',P,P,P,P,P)(display,cfg,None,(I*3)(0x3098,3,0x3038))
assert ctx
fb_depth=I()
assert load(egl,'eglGetConfigAttrib',U,P,P,I,P)(display,cfg,0x3025,c.byref(fb_depth)) and fb_depth.value>=24
surface=load(egl,'eglCreatePbufferSurface',P,P,P,P)(display,cfg,(I*5)(0x3057,960*SCALE,0x3056,640*SCALE,0x3038))
assert surface
query=load(egl,'eglQuerySurface',U,P,P,I,P)
for key,want in ((0x3057,960*SCALE),(0x3056,640*SCALE)):
 actual=I()
 assert query(display,surface,key,c.byref(actual)) and actual.value==want
assert load(egl,'eglMakeCurrent',U,P,P,P,P)(display,surface,surface,ctx)
def gl(n,r,*a):return c.CFUNCTYPE(r,*a)(getp(n.encode()))
info=gl('glGetString',c.c_char_p,U)

from pathlib import Path
import hashlib,json,base64
D=json.load(sys.stdin)
fragment=D['shaders']['terrain.frag']
old='float edgeFade=1.-smoothstep(.18,.79,footprint);'
current='float edgeFade=1.-smoothstep(.30,.83,rowFootprint);'
assert fragment.count(current)==1 and old not in fragment
D['shaders']['before.vert']=D['shaders']['terrain.vert']
D['shaders']['before.frag']=fragment.replace(current,old)
shcreate=gl('glCreateShader',U,U);shsource=gl('glShaderSource',None,U,I,P,P)
shcompile=gl('glCompileShader',None,U);shstatus=gl('glGetShaderiv',None,U,U,P)
shlog=gl('glGetShaderInfoLog',None,U,I,P,P)
attach=gl('glAttachShader',None,U,U);create=gl('glCreateProgram',U);link=gl('glLinkProgram',None,U)
prstatus=gl('glGetProgramiv',None,U,U,P);prlog=gl('glGetProgramInfoLog',None,U,I,P,P)
def log(fn,key):
    buf=c.create_string_buffer(16384);fn(key,len(buf),None,buf);return buf.value.decode('utf-8','replace')
def check(name):
    evidence={};prog=create()
    for ext,typ in [('vert',0x8B31),('frag',0x8B30)]:
        src=D['shaders'][name+'.'+ext].encode();s=shcreate(typ)
        ar=(c.c_char_p*1)(src);shsource(s,1,ar,None);shcompile(s);ok=I();shstatus(s,0x8B81,c.byref(ok))
        msg=log(shlog,s)
        assert ok.value,(name,ext,msg)
        attach(prog,s);evidence[ext]={'compiled':True,'log':msg,'sha256':hashlib.sha256(src).hexdigest()}
    link(prog);ok=I();prstatus(prog,0x8B82,c.byref(ok));msg=log(prlog,prog)
    assert ok.value,(name,msg)
    return prog, {'linked':True,'log':msg,'stages':evidence}
proof={'limit':'Actual Three r187 prefixed GLSL linked on Mesa GLES3.2, not Chromium/WebGL full renderer or performance.',
 'engine':info(0x1F01).decode(),'depthBits':fb_depth.value,'programs':{}}
import numpy as np
from PIL import Image
entries={}
for x in ['stock','terrain','mask','before']:
    entries[x],proof['programs'][x]=check(x)

gen=gl('glGenBuffers',None,I,P);bind=gl('glBindBuffer',None,U,U)
upload=gl('glBufferData',None,U,c.c_ssize_t,P,U)
vp=gl('glViewport',None,I,I,I,I);clear=gl('glClear',None,U)
cc=gl('glClearColor',None,c.c_float,c.c_float,c.c_float,c.c_float)
use=gl('glUseProgram',None,U);loc=gl('glGetAttribLocation',I,U,c.c_char_p)
ptr=gl('glVertexAttribPointer',None,U,I,U,c.c_ubyte,I,P)
enable=gl('glEnable',None,U);ena=gl('glEnableVertexAttribArray',None,U);dis=gl('glDisableVertexAttribArray',None,U)
depth=gl('glDepthFunc',None,U);depthmask=gl('glDepthMask',None,c.c_ubyte)
u=gl('glGetUniformLocation',I,U,c.c_char_p);m4=gl('glUniformMatrix4fv',None,I,I,c.c_ubyte,P)
v3=gl('glUniform3f',None,I,c.c_float,c.c_float,c.c_float);uv=gl('glUniform1f',None,I,c.c_float)
darr=gl('glDrawArrays',None,U,I,I);didx=gl('glDrawElements',None,U,I,U,P)
read=gl('glReadPixels',None,I,I,I,I,U,U,P);ge=gl('glGetError',U)
cm=gl('glColorMask',None,c.c_ubyte,c.c_ubyte,c.c_ubyte,c.c_ubyte)
buffers={}
def put(target,blob):
    b=U();gen(1,c.byref(b));bind(target,b.value);upload(target,len(blob),c.c_char_p(blob),0x88E4);return b.value
import gzip
base=Path(__file__).resolve().parents[2]/'public/world'
integer=gl('glUniform1i',None,I,I)
un2=gl('glUniform2f',None,I,c.c_float,c.c_float)
un4=gl('glUniform4f',None,I,*([c.c_float]*4))
v4=gl('glUniform4fv',None,I,I,P)
v23=gl('glUniform2fv',None,I,I,P)
vi=gl('glUniform1iv',None,I,I,P)
act=gl('glActiveTexture',None,U)
tg=gl('glGenTextures',None,I,P)
bt=gl('glBindTexture',None,U,U)
para=gl('glTexParameteri',None,U,U,I)
image2=gl('glTexImage2D',None,U,I,I,I,I,I,U,U,P)
image3=gl('glTexImage3D',None,U,I,I,I,I,I,I,U,U,P)
mip=gl('glGenerateMipmap',None,U)
sub=gl('glTexSubImage3D',None,U,I,I,I,I,I,I,I,U,U,P)
gpx=gl('glPixelStorei',None,U,I)
gpx(0x0CF5,1)
T=0x0DE1;TA=0x8C1A;RGBA=0x1908;RG=0x8227
def texture(t,unit,wrap=False,mipped=False):
 a=U();tg(1,c.byref(a));act(0x84C0+unit);bt(t,a.value)
 for k,v in [(0x2802,0x2901 if wrap else 0x812F),(0x2803,0x2901 if wrap else 0x812F),(0x2800,0x2601),(0x2801,0x2703 if mipped else 0x2601)]:para(t,k,v)
 return a.value
def rawImage(b,unit,flip=True,wrap=False):
 im=Image.open(b).convert('RGBA')
 q=np.ascontiguousarray(np.asarray(im)[::-1]if flip else np.asarray(im))
 a=texture(T,unit,wrap,True);image2(T,0,0x8058,im.width,im.height,0,RGBA,0x1401,q.ctypes.data);mip(T);assert ge()==0
 return a
color=rawImage(base/D['world']['color'],0)
cv=gzip.decompress((base/D['world']['cover']).read_bytes());assert len(cv)==2*D['world']['width']*D['world']['height']
cover=texture(T,1);image2(T,0,0x822B,D['world']['width'],D['world']['height'],0,RG,0x1401,c.c_char_p(cv));assert ge()==0
scan=rawImage(base/D['world']['scan'],2,False,True)
aniso=int(os.environ.get('PEI_ANISO','4'))
assert aniso in (1,4)
if aniso==4:
 amax=c.c_float()
 gl('glGetFloatv',None,U,P)(0x84ff,c.byref(amax))
 assert amax.value>=4
 para(T,0x84fe,4)
 assert ge()==0

mask=texture(TA,3);image3(TA,0,0x822B,260,260,4,0,RG,0x1401,None)
paint=texture(T,4);image2(T,0,0x8058,1,1,0,RGBA,0x1401,c.c_char_p(bytes([0]*4)))
pos={}
bounds=D['world']['bounds'];ldx,ldz=bounds[2]-bounds[0],bounds[3]-bounds[1]
extent=[bounds[0],bounds[1],ldx,ldz]
detail=json.loads((base/'detail/index.json').read_text())
for k,m in D['meshes'].items():
 v={'p':put(0x8892,base64.b64decode(m['positions'])),'u':put(0x8892,base64.b64decode(m['uv'])),
  'i':put(0x8893,base64.b64decode(m['index'])),'tex':0}
 saved=detail['tiles'].get(k)
 if saved:
  with (base/'detail'/detail['packs'][saved['pack']]['file']).open('rb') as fd:
   fd.seek(saved['offset']);b=fd.read(saved['bytes'])
  assert hashlib.sha256(b).hexdigest()==saved['sha256']
  from io import BytesIO
  v['tex']=rawImage(BytesIO(b),5)
 pos[k]=v
vp(0,0,960,640);enable(0x0B71);depth(0x0203);cc(.3,.38,.46,1)
def prep(cam):
 act(0x84C3);bt(TA,mask);areas=[];neighbors=[]
 for i in range(4):
  a=cam['slots'][i]if i<len(cam['slots'])else None
  b=base64.b64decode(D['fields'][a['k']]) if a else bytes(260*260*2)
  assert len(b)==260*260*2
  sub(TA,0,0,0,i,260,260,1,RG,0x1401,c.c_char_p(b))
  areas.extend([a['x'],a['z'],1,1]if a else [0]*4);neighbors.append(a['blends']if a else 0)
 return areas,neighbors
def draw(cam,key,strength,areas,nei,scale=1):
 w,h=960*scale,640*scale;vp(0,0,w,h)
 p=entries[key];clear(0x4100);use(p)
 lu=lambda n:u(p,n.encode())
 for k,value in [('imageMap',0),('coverMap',1),('provinceFurrowScan',2),('fieldShardArray',3),('paintMap',4),('detailMap',5)]:integer(lu(k),value)
 for k,value in [('clock',12),('logDepthBufFC',cam['log']),('toneMappingExposure',1),('fieldShardClock',30),('provinceFieldStrength',strength),('detailClock',30),('detailReady',1)]:uv(lu(k),value)
 v4(lu('fieldShardAreas[0]'),4,(c.c_float*16)(*areas))
 vi(lu('fieldShardNeighbors[0]'),4,(I*4)(*nei))
 un4(lu('extent'),*extent)
 v4(lu('airport[0]'),3,(c.c_float*12)(*([1e6,1e6,1,0]*3)))
 v23(lu('stripSize[0]'),3,(c.c_float*6)(*([1,1]*3)))
 sunlight=np.array(D['world']['shadow']);sunlight/=np.linalg.norm(sunlight)
 v3(lu('sun'),*sunlight);v3(lu('cameraPosition'),*cam['eye'])
 for tag,mat in [('viewMatrix',cam['view']),('projectionMatrix',cam['projection'])]:m4(lu(tag),1,0,(c.c_float*16)(*mat))
 for k in cam['meshes']:
  b=pos[k];d=D['meshes'][k]
  for i in range(8):dis(i)
  for n,f,width in [('position','p',3),('uv','u',2)]:
   i=loc(p,n.encode())
   if i<0:continue
   ena(i);bind(0x8892,b[f]);ptr(i,width,0x1406,0,0,None)
  m4(lu('modelMatrix'),1,0,(c.c_float*16)(*d['model']))
  un4(lu('detailBox'),*d['detailBox'])
  un2(lu('detailSize'),ldx/d['detailBox'][2],ldz/d['detailBox'][3])
  # Literal settled only, retreat to coarse at unauthenticated neighbours.
  i,j=map(int,k.split('-'))
  readies=[1 if f'{i+dx}-{j+dz}' in pos and pos[f'{i+dx}-{j+dz}']['tex'] else 1e8 for dx,dz in [(0,-1),(1,0),(0,1),(-1,0),(-1,-1),(1,-1),(1,1),(-1,1)]]
  un4(lu('detailCardinal'),*readies[:4]);un4(lu('detailDiagonal'),*readies[4:])
  uv(lu('hasDetail'),float(bool(b['tex'])))
  act(0x84C5);bt(T,b['tex'] or color)
  bind(0x8893,b['i']);didx(4,d['indexCount'],0x1405 if d['indexWidth']==4 else 0x1403,None)
 a=np.empty((h,w,4),np.uint8);read(0,0,w,h,RGBA,0x1401,a.ctypes.data);assert ge()==0
 return np.flipud(a).copy()

def err(err,subset):
 x=err[subset].astype(float)
 return {'rmse':round(np.sqrt((x*x).mean()),3),'p95':round(float(np.quantile(np.max(abs(x),axis=1),.95)),3)}
def rgb(x):
 return x[:,:,:3].astype(float)
def half(x):
 return rgb(x).reshape(640,SCALE,960,SCALE,3).mean((1,3))
results={}
for cam in D['captures']:
 a,n=prep(cam)
 control=draw(cam,'stock',0,a,n)
 marker=draw(cam,'mask',1,a,n)
 m=(marker[:,:,0]>250)&(marker[:,:,1]<4)&(marker[:,:,2]>250)
 safe=m.copy()
 for k in (-2,-1,1,2):
  safe &= np.roll(m,k,0)&np.roll(m,k,1)
 safe[:2]=False; safe[-2:]=False; safe[:,:2]=False; safe[:,-2:]=False
 stockProfile=draw(cam,'terrain',0,a,n)
 active=draw(cam,'terrain',1,a,n)
 baseline=draw(cam,'before',1,a,n)
 assert np.array_equal(stockProfile,control)
 assert np.array_equal(control,draw(cam,'terrain',0,a,n))
 assert np.array_equal(active[~m],control[~m]) and np.array_equal(baseline[~m],control[~m])
 assert np.array_equal(active[:,:,3],baseline[:,:,3])
 record={'pixels':int(safe.sum()),'rollbackExact':True,'outsideRgbUnchanged':True,'alphaUnchanged':True}
 if safe.any():
  ref=half(draw(cam,'before',1,a,n,SCALE))-half(draw(cam,'stock',0,a,n,SCALE))
  b=rgb(baseline)-rgb(control)
  v=rgb(active)-rgb(control)
  record.update({'before':err(b-ref,safe),'candidate':err(v-ref,safe),
   'oldEffect':err(b,safe),'newEffect':err(v,safe)})
 results[cam['time']]=record
print(json.dumps({'site':D['id'],'anisotropy':aniso,'areaReferenceScale':SCALE,
 'gles':info(0x1F02).decode(),'renderer':info(0x1F01).decode(),
 'depthBits':fb_depth.value,'atlasSha256':D['world']['colorSha'],'scanSha256':D['world']['scanSha'],'programs':proof['programs'],'stdFrames':results},indent=2))
