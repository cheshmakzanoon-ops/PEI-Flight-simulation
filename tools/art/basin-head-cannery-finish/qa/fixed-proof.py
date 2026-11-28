"""Resolve true 4x native ES3 plates from emitted Three r187 material programs.
The backdrop is a neutral studio plane, not Basin Head gameplay or real terrain.
"""
import math, runpy, sys, os, random
from pathlib import Path
import numpy as np
from PIL import Image
D = Path(sys.argv[1]).resolve()
MODE='exact-dfg-replica' + ('-nodither' if '--nodither' in sys.argv else '')
OUT=Path(sys.argv[2]).resolve();OUT.mkdir()
LUT=Path(sys.argv[3]).resolve()
globals().update(runpy.run_path(str(Path(__file__).with_name('egl_support.py'))))
M = json.loads((D/'manifest.json').read_text())
w,h=M['viewport']
constant='constant' in MODE
replica='replica' in MODE
nonmetal='paintconstant' in MODE
dither='nodither' not in MODE
noresolve='read-d24' in MODE
if MODE=='stock-reverse':REVERSE=True
else:REVERSE=False
U1 = C.c_ubyte
FBO=0x8d40; RB=0x8d41; TEX=0x0de1
viewport=gl('glViewport',None,I,I,I,I)
seti=gl('glUniform1i',None,I,I);setf=gl('glUniform1f',None,I,F)
setv=gl('glUniform3f',None,I,F,F,F)
setm3=gl('glUniformMatrix3fv',None,I,I,U1,C.POINTER(F));setm4=gl('glUniformMatrix4fv',None,I,I,U1,C.POINTER(F))
ul=gl('glGetUniformLocation',I,U,S);al=gl('glGetAttribLocation',I,U,S)
bind=gl('glBindFramebuffer',None,U,U);use=gl('glUseProgram',None,U)
bvao=gl('glBindVertexArray',None,U);btex=gl('glBindTexture',None,U,U)
depth=gl('glDepthMask',None,U1); clear=gl('glClear',None,U)
enable=gl('glEnable',None,U);disable=gl('glDisable',None,U)
def one(s):
 q=U();gl(s,None,I,C.POINTER(U))(1,C.byref(q));return q
def inp(d):
 v=(D/d['name']).read_bytes()
 assert len(v)==d['bytes'] and sha(v)==d['sha'],d['name'];return v
def glue(q):
 vertex=inp(q['vs']).decode()
 frag=inp(q['fs']).decode()
 if constant and 'stock' in q['fs']['name']:
  i=frag.rindex('}')
  frag=frag[:i]+'\ngl_FragColor=vec4(.588,.302,.113,1.);\n'+frag[i:]
 return program(dict(vertex=vertex,fragment=frag))
def number(s,p):return ul(p,s.encode())
def fl(p,s,v):setf(number(s,p),v)
def intv(p,s,v):seti(number(s,p),v)
def vec(p,s,v):setv(number(s,p),*v)
def mat(p,s,v):
 if len(v)==16:setm4(number(s,p),1,0,(F*16)(*v))
 else:
  assert len(v)==9
  setm3(number(s,p),1,0,(F*9)(*v))

multi=one('glGenFramebuffers');bind(FBO,multi)
for fmt,attachment in ((0x8058,0x8ce0),(0x81a6,0x8d00)):
 k=one('glGenRenderbuffers')
 gl('glBindRenderbuffer',None,U,U)(RB,k)
 if noresolve:gl('glRenderbufferStorage',None,U,U,I,I)(RB,fmt,w,h)
 else:gl('glRenderbufferStorageMultisample',None,U,I,U,I,I)(RB,4,fmt,w,h)
 gl('glFramebufferRenderbuffer',None,U,U,U,U)(FBO,attachment,RB,k)
assert gl('glCheckFramebufferStatus',U,U)(FBO)==0x8cd5
resolved=one('glGenFramebuffers');bind(FBO,resolved)
tex=one('glGenTextures');btex(TEX,tex)
gl('glTexStorage2D',None,U,I,U,I,I)(TEX,1,0x8058,w,h)
gl('glFramebufferTexture2D',None,U,U,U,U,I)(FBO,0x8ce0,TEX,tex,0)
assert gl('glCheckFramebufferStatus',U,U)(FBO)==0x8cd5

B=program({'vertex':"""#version 300 es
void main(){vec2 a=vec2((gl_VertexID&1)*4-1,(gl_VertexID>>1)*4-1); gl_Position=vec4(a,0.,1.);}
""",'fragment':"""#version 300 es
precision highp float;
uniform mat4 clipWorld,view;
uniform vec2 viewport;
uniform float logFC;
uniform bool marker;
out vec4 c;
void main(){
 vec2 nd=2.*gl_FragCoord.xy/viewport-1.;
 vec4 p=clipWorld*vec4(nd,-1.,1.),q=clipWorld*vec4(nd,1.,1.);
 vec3 a=p.xyz/p.w, b=q.xyz/q.w, d=normalize(b-a);
 float t=(-.020-a.y)/min(-.00001,d.y);
 vec3 meet=a+d*t;
 float lit=exp(-.54*length(max(abs(meet.xz-vec2(.5,-.7))-vec2(4.5,7.9),0.)));
 float lightFog=exp(-.020*t);
 vec3 sky=mix(vec3(.71,.76,.78),vec3(.54,.625,.682),smoothstep(0.,.56,d.y));
 vec3 earth=vec3(.455,.495,.505)-.045*lit;
 earth+=.050*dot(normalize(vec2(.35,.4)),normalize(meet.xz+vec2(.01))) * exp(-.043*length(meet.xz));
 c=vec4(d.y<0.?mix(sky,earth,lightFog):sky,1.);
 float rayDepth=-(view*vec4(meet,1.)).z;
 gl_FragDepth=d.y<0.?clamp(log2(1.+max(0.,rayDepth))*logFC*.5,0.,1.):1.;
 if(marker)c=vec4(0.,0.,0.,1.);
}"""})
unit=5
dfg=None
if 'exact-dfg' in MODE:
 meta=json.loads((LUT/'r187-dfg.json').read_text())
 words=(LUT/'r187-dfg.rg16f').read_bytes()
 assert len(words)==1024 and sha(words)==meta['sha256']=='b41ba8e2bd29fa007dfbf034d4d58b853f378062183847846b1f6d228f2c7e79'
 assert (meta['width'],meta['height'])==(16,16) and meta['wrap']=='CLAMP_TO_EDGE' and meta['filter']=='LINEAR' and not meta['mips'] and not meta['flipY']
 dfg=one('glGenTextures')
 gl('glActiveTexture',None,U)(0x84c0+unit);btex(TEX,dfg)
 gl('glPixelStorei',None,U,I)(0x0cf5,1)
 gl('glTexImage2D',None,U,I,I,I,I,I,U,U,V)(TEX,0,0x822f,16,16,0,0x8227,0x140b,C.create_string_buffer(words))
 for target,value in [(0x2800,0x2601),(0x2801,0x2601),(0x2802,0x812f),(0x2803,0x812f)]:
  gl('glTexParameteri',None,U,U,I)(TEX,target,value)
  d=I();gl('glGetTexParameteriv',None,U,U,P)(TEX,target,C.byref(d));assert d.value==value
 gl('glActiveTexture',None,U)(0x84c0);btex(TEX,0)
 e0('actual Three r187 DFG bound to independent unit')
blank=one('glGenVertexArrays'); picked=[]
for part in M['parts']:
 hdl={key:glue(part[key]) for key in ('stock','marker')}
 if 'active' in part:hdl['active']=glue(part['active'])
 verts={}
 for a,k in part['attr'].items():
  buf=one('glGenBuffers');raw=inp(k)
  gl('glBindBuffer',None,U,U)(0x8892,buf)
  gl('glBufferData',None,U,C.c_size_t,V,U)(0x8892,len(raw),C.create_string_buffer(raw),0x88e4)
  verts[a]=buf
 ks={}
 for key,p in hdl.items():
  v=one('glGenVertexArrays');bvao(v)
  for a,buf in verts.items():
   l=al(p,a.encode())
   if l<0:continue
   gl('glBindBuffer',None,U,U)(0x8892,buf);gl('glEnableVertexAttribArray',None,U)(l)
   gl('glVertexAttribPointer',None,U,I,U,U1,I,V)(l,2 if a=='uv' else 3,0x1406,0,0,None)
  ks[key]=(p,v)
 picked.append((part,ks))
e0('geometry, indexed by draw arrays, and material roles linked')
def rgba():
 if noresolve:bind(FBO,multi)
 else:
  bind(0x8ca8,multi);bind(0x8ca9,resolved)
  if replica:
   gl('glReadBuffer',None,U)(0x8ce0)
   gl('glDrawBuffers',None,I,C.POINTER(U))(1,(U*1)(0x8ce0))
  gl('glBlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,w,h,0,0,w,h,0x4000,0x2600)
  bind(FBO,resolved)
 dst=C.create_string_buffer(w*h*4)
 gl('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,dst)
 e0('GPU resolve')
 return np.flip(np.frombuffer(dst.raw,'u1').reshape(h,w,4),axis=0).copy()
def draw(cv,appearance,gain=0.):
 LOG=2./math.log2(cv.get('far',380.)+1.)
 bind(FBO,multi);viewport(0,0,w,h);depth(1)
 if not dither:disable(0x0bd0)
 if replica:
  gl('glDrawBuffers',None,I,C.POINTER(U))(1,(U*1)(0x8ce0))
  gl('glReadBuffer',None,U)(0x8ce0)
  gl('glColorMask',None,U1,U1,U1,U1)(1,1,1,1)
  gl('glDisable',None,U)(0x0c11) # SCISSOR
  gl('glDisable',None,U)(0x809e) # SAMPLE_ALPHA_TO_COVERAGE
  gl('glDisable',None,U)(0x80a0) # SAMPLE_COVERAGE
  gl('glClearDepthf',None,F)(1.)
  gl('glDepthRangef',None,F,F)(0.,1.)
  gl('glBindBuffer',None,U,U)(0x88eb,0) # PIXEL_PACK_BUFFER
  gl('glPixelStorei',None,U,I)(0x0d05,1)
 if 'always' in MODE:
  gl('glDepthFunc',None,U)(0x0207)
 sv=I();gl('glGetIntegerv',None,U,P)(0x80a9,C.byref(sv));assert sv.value==4
 gl('glClearColor',None,F,F,F,F)(.58,.60,.62,1.0);clear(0x4100)
 disable(0x0be2);disable(0x0b44);enable(0x0b71)
 gl('glDepthFunc',None,U)(0x0203)
 use(B);bvao(blank)
 mat(B,'clipWorld',cv['clipToWorld']);mat(B,'view',cv['view'])
 gl('glUniform2f',None,I,F,F)(number('viewport',B),w,h)
 fl(B,'logFC',LOG);intv(B,'marker',int(appearance=='marker'))
 if 'no-floor' not in MODE:gl('glDrawArrays',None,U,I,I)(4,0,3)
 if 'always' in MODE:gl('glDepthFunc',None,U)(0x0207)
 if 'no-depth' in MODE:disable(0x0b71)
 disable(0x0b44)
 for part,ks in (list(reversed(picked)) if REVERSE else picked):
  mode=appearance if appearance in ks else 'stock'
  p,v=ks[mode];use(p);bvao(v)
  if dfg is not None:
   gl('glActiveTexture',None,U)(0x84c0+unit)
   bound=I();gl('glGetIntegerv',None,U,P)(0x8069,C.byref(bound))
   assert bound.value==dfg.value and dfg.value!=tex.value
   loc=number('dfgLUT',p)
   if mode!='marker':assert loc>=0,(part['name'],mode)
   seti(loc,unit)
   if loc>=0:
    on=I();gl('glGetUniformiv',None,U,I,P)(p,loc,C.byref(on));assert on.value==unit
  mat(p,'viewMatrix',cv['view']);mat(p,'modelMatrix',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])
  mat(p,'modelViewMatrix',cv['view']);mat(p,'normalMatrix',cv['normalView'])
  mat(p,'projectionMatrix',cv['projection'])
  vec(p,'cameraPosition',cv['eye']);intv(p,'isOrthographic',0)
  vec(p,'diffuse',part['diffuse']);vec(p,'emissive',part['emissive']);fl(p,'opacity',1.)
  fl(p,'roughness',part['roughness']);fl(p,'metalness',part['metalness'])
  fl(p,'logDepthBufFC',LOG);fl(p,'toneMappingExposure',1.0);fl(p,'canneryWoodGain',gain)
  vec(p,'ambientLightColor',[0,0,0])
  for k in ('direction','color'):vec(p,'directionalLights[0].'+k,cv['directional'][k])
  for k in ('direction','skyColor','groundColor'):vec(p,'hemisphereLights[0].'+k,cv['hemi'][k])
  gl('glDrawArrays',None,U,I,I)(4,0,part['verts'])
  if replica:e0('submitted '+part['name']+' '+mode)
 return rgba()

def sourceState():
 d={}
 for part,ks in picked:
  d[part['name']]={}
  for mode,(p,vao) in ks.items():
   n=I();gl('glGetProgramiv',None,U,U,P)(p,0x8b86,C.byref(n))
   link=I();gl('glGetProgramiv',None,U,U,P)(p,0x8b82,C.byref(link));assert link.value
   rows=[]
   for i in range(n.value):
    name=C.create_string_buffer(256);ln,c=I(),I();z=U()
    gl('glGetActiveUniform',None,U,U,I,P,P,C.POINTER(U),V)(p,i,256,C.byref(ln),C.byref(c),C.byref(z),name)
    rows.append([name.value.decode(),c.value,hex(z.value)])
   d[part['name']][mode]=rows
 return d

def diff(a,b):
 d=np.abs(a.astype('i2')-b.astype('i2'))
 xy=np.where(np.any(d,axis=2))
 return {'changed':len(xy[0]),'alpha':int(np.count_nonzero(d[:,:,3])),'max':int(d.max()),
  'first':None if not len(xy[0]) else {'xy':[int(xy[1][0]),int(xy[0][0])], 'from':a[xy[0][0],xy[1][0],:].tolist(),'to':b[xy[0][0],xy[1][0],:].tolist()}}


def save(name,a):
 p=OUT/name
 with p.open('xb') as f:Image.fromarray(a).save(f,format='PNG')
 return {'file':p.name,'PNG':sha(p.read_bytes()),'RGBA':sha(a.tobytes())}
proof={}
r=random.Random(130878)
seq='AAZBABZBBA'+''.join(r.choices('AZB',k=14))+'ABZBAMM'
pick={'A':('stock',0.),'Z':('active',0.),'B':('active',1.),'M':('marker',0.)}
for name,cv in M['cameras'].items():
 fs={}; order=[]
 for i,t in enumerate(seq):
  x=draw(cv,*pick[t])
  hsh=sha(x.tobytes())
  stored=fs.setdefault('A' if t=='Z' else t,x)
  assert np.array_equal(x,stored),(name,'immediate/cold sequence',i,t,diff(stored,x))
  order.append([t,hsh])
 a,b,mask=fs['A'],fs['B'],fs['M'][:,:,:3]
 level=np.max(mask,axis=2)
 exactRole=level>0
 delta=np.abs(a[:,:,:3].astype('i2')-b[:,:,:3].astype('i2')).max(2)
 assert not np.any(delta[~exactRole]),(name,'outside',int(np.count_nonzero(delta[~exactRole])))
 assert np.all(a[:,:,3]==255) and np.array_equal(a[:,:,3],b[:,:,3]),name
 assert set(np.unique(level))<=set([0,64,128,191,255])
 xs={'wall':0,'doors':1,'apron':2}
 positive=name!='turned-away'
 inside={r:int((mask[:,:,j]==255).sum()) for r,j in xs.items()}
 strength={r:int(((mask[:,:,j]==255)&(delta>3)).sum()) for r,j in xs.items()}
 if positive:assert all(v>200 for v in strength.values()),strength
 else:assert not np.any(delta) and not np.any(exactRole)
 data={t:save(name+'-'+t+'.png',m) for t,m in {'stock':a,'finish':b,'roles':mask}.items()}
 row={'pose':cv,'seq':seq,'order':order,'strongRGBGT3':int((delta>3).sum()),'exactRoleUnion':int(exactRole.sum()),
      'fullRole':inside,'strongByFullRole':strength,'alphaDiff':0,'outsideDiff':0,'coldStockExact':True,
      'gainZeroExact':True,'firstUnpatchedRollbackExact':True,'firstGainZeroRollbackExact':True,'files':data}
 proof[name]=row
 print(name, row['strongRGBGT3'], row['outsideDiff'], strength,flush=True)

with (OUT/'receipt.json').open('x') as f:
 json.dump({'result':'detached PASS, not in-game','driver':gl('glGetString',S,U)(0x1f01).decode(),'version':driver,
   'WebGLEquivalentProgram':True,'texture':{'unit':unit,'renderTargetTextureID':int(tex.value),'lookupTextureID':int(dfg.value),**meta},
   'viewport':M['viewport'],'raster':'4x RGBA8/D24, exact DFG RG16F, NN resolve','dither':dither,
   'sealedMeshTriangles':M['geo']['triangles'],'additionalDraws':0,'sourceInputsManifestSHA':sha((D/'manifest.json').read_bytes()),
   'samplers':{part['name']:{m:[v for v in items if v[2]=='0x8b5e'] for m,items in modes.items()} for part,modes in [(p,sourceState()[p['name']]) for p,ks in picked]},
   'views':proof},f,indent=2)
 f.write('\n')
