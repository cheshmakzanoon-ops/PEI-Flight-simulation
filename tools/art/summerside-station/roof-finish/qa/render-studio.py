"""Resolve true 4x native ES3 plates from emitted Three r187 material programs.
The backdrop is a neutral studio plane, not Summerside gameplay or real terrain.
"""
import math, runpy, sys
from pathlib import Path
import numpy as np
from PIL import Image
D = Path(sys.argv[1]).resolve()
globals().update(runpy.run_path(str(Path(__file__).with_name('egl_support.py'))))
M = json.loads((D/'manifest.json').read_text())
w,h=M['viewport']
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
 return program(dict(vertex=inp(q['vs']).decode(),fragment=inp(q['fs']).decode()))
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
 gl('glRenderbufferStorageMultisample',None,U,I,U,I,I)(RB,4,fmt,w,h)
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
 float t=(-.348-a.y)/min(-.00001,d.y);
 vec3 meet=a+d*t;
 float lit=exp(-.54*length(max(abs(meet.xz-vec2(4.,-2.2))-vec2(20.0,5.3),0.)));
 float lightFog=exp(-.020*t);
 vec3 sky=mix(vec3(.74,.77,.79),vec3(.565,.630,.688),smoothstep(0.,.56,d.y));
 vec3 earth=vec3(.545,.534,.511)-.064*lit;
 earth+=.050*dot(normalize(vec2(.35,.4)),normalize(meet.xz+vec2(.01))) * exp(-.043*length(meet.xz));
 c=vec4(d.y<0.?mix(sky,earth,lightFog):sky,1.);
 float rayDepth=-(view*vec4(meet,1.)).z;
 gl_FragDepth=d.y<0.?clamp(log2(1.+max(0.,rayDepth))*logFC*.5,0.,1.):1.;
 if(marker)c=vec4(0.,0.,0.,1.);
}"""})
blank=one('glGenVertexArrays'); picked=[]
for part in M['exported']:
 hdl={key:glue(part[key]) for key in ('stock','marker')}
 if part['name']=='roof':hdl['active']=glue(M['finish'])
 verts={}
 for a,k in part['attr'].items():
  buf=one('glGenBuffers');raw=inp(k)
  gl('glBindBuffer',None,U,U)(0x8892,buf)
  gl('glBufferData',None,U,C.c_size_t,V,U)(0x8892,len(raw),C.create_string_buffer(raw),0x88e4)
  verts[a]=buf
 ebo=one('glGenBuffers');raw=inp(part['index'])
 qva=one('glGenVertexArrays');bvao(qva)
 gl('glBindBuffer',None,U,U)(0x8893,ebo)
 gl('glBufferData',None,U,C.c_size_t,V,U)(0x8893,len(raw),C.create_string_buffer(raw),0x88e4)
 ks={}
 for key,p in hdl.items():
  v=one('glGenVertexArrays');bvao(v)
  gl('glBindBuffer',None,U,U)(0x8893,ebo)
  for a,buf in verts.items():
   l=al(p,a.encode())
   if l<0:continue
   gl('glBindBuffer',None,U,U)(0x8892,buf);gl('glEnableVertexAttribArray',None,U)(l)
   gl('glVertexAttribPointer',None,U,I,U,U1,I,V)(l,2 if a=='uv' else 3,0x1406,0,0,None)
  ks[key]=(p,v)
 picture=part.get('map')
 if picture:
  assert picture['sRGB']; pic=one('glGenTextures')
  gl('glActiveTexture',None,U)(0x84c0);btex(TEX,pic)
  s=picture['dimensions'];data=inp(picture)
  gl('glTexImage2D',None,U,I,I,I,I,I,U,U,V)(TEX,0,0x8c43,*s,0,0x1908,0x1401,C.create_string_buffer(data))
  for param,val in [(0x2802,0x2901),(0x2803,0x2901),(0x2800,0x2601),(0x2801,0x2703)]:
   gl('glTexParameteri',None,U,U,I)(TEX,param,val)
  gl('glTexParameterf',None,U,U,F)(TEX,0x84fe,picture['anisotropy'])
  gl('glGenerateMipmap',None,U)(TEX)
 else: pic=U(0)
 picked.append((part,ks,pic))
e0('geometry and 4 sampler owners linked')
def rgba():
 bind(0x8ca8,multi);bind(0x8ca9,resolved)
 gl('glBlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,w,h,0,0,w,h,0x4000,0x2600)
 bind(FBO,resolved)
 dst=C.create_string_buffer(w*h*4)
 gl('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,dst)
 e0('GPU resolve')
 return np.flip(np.frombuffer(dst.raw,'u1').reshape(h,w,4),axis=0).copy()
def draw(cv,appearance,gain=0.):
 LOG=2./math.log2(cv.get('far',380.)+1.)
 bind(FBO,multi);viewport(0,0,w,h);depth(1)
 gl('glClearColor',None,F,F,F,F)(.58,.60,.62,1.0);clear(0x4100)
 disable(0x0be2);disable(0x0b44);enable(0x0b71)
 gl('glDepthFunc',None,U)(0x0203)
 use(B);bvao(blank)
 mat(B,'clipWorld',cv['clipToWorld']);mat(B,'view',cv['view'])
 gl('glUniform2f',None,I,F,F)(number('viewport',B),w,h)
 fl(B,'logFC',LOG);intv(B,'marker',int(appearance=='marker'))
 gl('glDrawArrays',None,U,I,I)(4,0,3)
 enable(0x0b44)
 for part,ks,pic in picked:
  mode=appearance if appearance in ks else 'stock'
  p,v=ks[mode];use(p);bvao(v)
  mat(p,'viewMatrix',cv['view']);mat(p,'modelMatrix',M['studioModel'])
  mat(p,'modelViewMatrix',cv['modelView']);mat(p,'normalMatrix',cv['normalView'])
  mat(p,'projectionMatrix',cv['projection'])
  vec(p,'cameraPosition',cv['worldEye']);intv(p,'isOrthographic',0)
  vec(p,'diffuse',part['diffuse']);vec(p,'emissive',part['emissive']);fl(p,'opacity',1.)
  fl(p,'roughness',part['roughness']);fl(p,'metalness',part['metalness'])
  fl(p,'logDepthBufFC',LOG);fl(p,'toneMappingExposure',1.0);fl(p,'railFinishGain',gain)
  if pic.value:
   gl('glActiveTexture',None,U)(0x84c0);btex(TEX,pic)
   intv(p,'map',0);mat(p,'mapTransform',part['map']['transform'])
  vec(p,'ambientLightColor',[0,0,0])
  for k in ('direction','color'):vec(p,'directionalLights[0].'+k,cv['directional'][k])
  for k in ('direction','skyColor','groundColor'):vec(p,'hemisphereLights[0].'+k,cv['hemi'][k])
  gl('glDrawElements',None,U,I,U,V)(4,part['indices'],0x1403,None)
 return rgba()
def output(path,arr):
 with (D/path).open('xb') as f:Image.fromarray(arr).save(f,format='PNG')
 return {'name':path,'sha':sha((D/path).read_bytes())}
results={}
for name,cv in M['cameras'].items():
 old=draw(cv,'stock'); off=draw(cv,'active',0.)
 new=draw(cv,'active',1.); restored=draw(cv,'active',0.)
 role=draw(cv,'marker')[:,:,0]
 assert np.array_equal(old,off) and np.array_equal(old,restored),name
 diff=np.max(np.abs(new[:,:,:3].astype('i2')-old[:,:,:3].astype('i2')),axis=2)
 assert np.array_equal(new[:,:,3],old[:,:,3]) and np.all(old[:,:,3]==255) and not np.any(diff[role==0]),name
 assert set(np.unique(role))<=set([0,64,128,191,255])
 scale=role>0; assert bool(np.any(scale))==(name!='turned-away')
 p={}
 for k,a in [('stock',old),('finish',new),('role',role)]:
  p[k]=output(name+'-'+k+'.png',a)
 y,x=np.where(scale)
 mask=role==255
 luma=(new[:,:,:3].astype('f8')-old[:,:,:3].astype('f8'))@np.array([.2126,.7152,.0722])
 results[name]={'files':p,'sameLinkedNeutralRGBA':sha(off.tobytes()),'restoreRGBA':sha(restored.tobytes()),
  'trueWholeFrameAlphaChanges':0,'changedOutsideRole':0,'touchedRoofPixels':int(mask.sum()),
  'mixedRoofPixels':int((scale & ~mask).sum()),'strongRGBGT3':int((diff>3).sum()),
  'roofBox':None if not len(x) else [int(x.min()),int(y.min()),int(x.max())+1,int(y.max())+1],
  'pureRoofLumaDeltaQ10_Q50_Q90':None if not len(x) else [float(i) for i in np.quantile(luma[mask],[.1,.5,.9])]}
 print(name,results[name]['roofBox'],results[name]['strongRGBGT3'],results[name]['pureRoofLumaDeltaQ10_Q50_Q90'],flush=True)
out={'status':'Detached native EGL, no terrain or flight', 'driver':driver,'rgba8Samples':4,'depthBits':24,
 'layout':M['layout'],'drawsIncludingNeutralFloor':len(picked)+1,'stationTriangles':sum(q[0]['indices']//3 for q in picked),
 'newTriangles':0,'newDraws':0,'additionalTextureFetches':0,'shaderChanges':['one roof material only'],
 'viewPoses':{k:{'eye':v['eye'],'target':v['target'],'FOV':v['fov'],'archivedBaseline':v.get('archivedBaseline')} for k,v in M['cameras'].items()},'views':results}
with (D/'render-receipt.json').open('x') as f:json.dump(out,f,indent=2);f.write('\n')
