#!/usr/bin/env python3
"""Independent 4x native ES3 two-view A/B of the emitted standard program and exact source geometry and generated maps."""
import argparse,ctypes as C,json,math,os
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
os.environ.setdefault('LIBGL_ALWAYS_SOFTWARE','true')
import egl_support as e
g,U,I,F,V,S,P=e.gl,e.U,e.I,e.F,e.V,e.S,e.P
FBO,RB,TEX,ABUF=0x8d40,0x8d41,0xde1,0x8892
def one(k):
 n=U();g('glGen'+k,None,I,C.POINTER(U))(1,C.byref(n));return n.value
def integer(k):
 x=I();g('glGetIntegerv',None,U,P)(k,C.byref(x));return x.value
def name(p,k):
 return g('glGetUniformLocation',I,U,S)(p,k.encode())
def f(p,k,x):g('glUniform1f',None,I,F)(name(p,k),x)
def b(p,k,x):g('glUniform1i',None,I,I)(name(p,k),int(x))
def v(p,k,x):g(f'glUniform{len(x)}f',None,I,*([F]*len(x)))(name(p,k),*x)
def m(p,k,x):
 n=int(math.sqrt(len(x)));g(f'glUniformMatrix{n}fv',None,I,I,C.c_ubyte,V)(name(p,k),1,0,(F*len(x))(*x))
def flag(i,on):
 g('glEnable' if on else 'glDisable',None,U)(i)
def target(w,h):
 draw,read=one('Framebuffers'),one('Framebuffers')
 bind=g('glBindFramebuffer',None,U,U)
 bind(FBO,draw)
 for at,fmt in [(0x8ce0,0x8058),(0x8d00,0x81a6)]:
  t=one('Renderbuffers')
  g('glBindRenderbuffer',None,U,U)(RB,t)
  g('glRenderbufferStorageMultisample',None,U,I,U,I,I)(RB,4,fmt,w,h)
  g('glFramebufferRenderbuffer',None,U,U,U,U)(FBO,at,RB,t)
 ck=g('glCheckFramebufferStatus',U,U)
 assert ck(FBO)==0x8cd5
 assert [integer(v) for v in [0x80a9,0x0d55,0x0d56]]==[4,8,24]
 bind(FBO,read);output=one('Textures')
 g('glBindTexture',None,U,U)(TEX,output)
 g('glTexStorage2D',None,U,I,U,I,I)(TEX,1,0x8058,w,h)
 g('glFramebufferTexture2D',None,U,U,U,U,I)(FBO,0x8ce0,TEX,output,0)
 assert ck(FBO)==0x8cd5;e.e0('RGBA8/D24 render and resolve')
 g('glBindTexture',None,U,U)(TEX,0)
 return draw,read,output
def use(p):g('glUseProgram',None,U)(p)
def vao(p):g('glBindVertexArray',None,U)(p)
def load_bytes(fixture,d):
 x=(fixture/d['file']).read_bytes()
 assert len(x)==d['bytes'] and e.sha(x)==d['sha'],d['file']
 return x
def upload_dfg(folder,q,unit):
 lut=load_bytes(folder,q)
 assert len(lut)==1024 and e.sha(lut)=='b41ba8e2bd29fa007dfbf034d4d58b853f378062183847846b1f6d228f2c7e79'
 t=one('Textures');g('glActiveTexture',None,U)(0x84c0+unit);g('glBindTexture',None,U,U)(TEX,t)
 g('glPixelStorei',None,U,I)(0xcf5,1)
 g('glTexImage2D',None,U,I,I,I,I,I,U,U,V)(TEX,0,0x822f,16,16,0,0x8227,0x140b,C.create_string_buffer(lut))
 for p,vv in [(0x2800,0x2601),(0x2801,0x2601),(0x2802,0x812f),(0x2803,0x812f)]:
  g('glTexParameteri',None,U,U,I)(TEX,p,vv)
  rv=I();g('glGetTexParameteriv',None,U,U,P)(TEX,p,C.byref(rv));assert rv.value==vv
 g('glActiveTexture',None,U)(0x84c0);e.e0('exact r187 DFG unit distinct from resolve')
 return t
BG=e.program({'vertex':'''#version 300 es
void main(){vec2 a=vec2((gl_VertexID&1)*4-1,(gl_VertexID>>1)*4-1);gl_Position=vec4(a,0.,1.);}''',
 'fragment':'''#version 300 es
precision highp float;
uniform mat4 clipWorld,view;
uniform vec2 viewport;
uniform float floorY,logFC;
uniform bool marker,benchSeat;
uniform vec2 feetX,feetZ;
out vec4 c;
void main(){
 vec2 ndc=2.*gl_FragCoord.xy/viewport-1.;
 vec4 qa=clipWorld*vec4(ndc,-1.,1.),qb=clipWorld*vec4(ndc,1.,1.);
 vec3 a=qa.xyz/qa.w,b=qb.xyz/qb.w,u=normalize(b-a);
 float t=(floorY-a.y)/min(-1e-5,u.y);
 vec3 at=a+t*u;
 float mist=exp(-.028*t);
 vec3 sky=mix(vec3(.74,.77,.794),vec3(.61,.664,.718),smoothstep(-.10,.78,u.y));
 // The common studio floor and an optional analytic receiver under our
 // exact four footprint intervals are authored stage lighting, not scenery.
 float grain=.018*sin(.92*at.x+.40*sin(2.*at.z))*sin(1.34*at.z)
   +.012*sin(4.2*at.x-2.8*at.z)*sin(3.1*at.z-.11*at.x);
 vec3 ground=vec3(.538,.509,.469)*(1.+grain);
 float pen=0.;
 if (benchSeat && u.y<0.) {
  for(int i=0;i<2;i++)for(int j=0;j<2;j++){
   vec2 p=(at.xz-vec2(feetX[i],feetZ[j]))/vec2(.092,.106);
   float a=max(0.,1.-dot(p,p));pen+=a*a*.22;
  }
 }
 c=vec4(u.y<0.?mix(sky,ground,mist)*(1.-pen):sky,1.);
 if(marker)c=vec4(0.,0.,float(pen>0.),1.);
 float depth=-(view*vec4(at,1.)).z;
 gl_FragDepth=u.y<0.?clamp(log2(1.+max(0.,depth))*logFC*.5,0.,1.):1.;
}'''})
ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
MAPS={'map':0,'normalMap':1,'roughnessMap':2}
def upload_surface(folder,q):
 size=q['size']; assert size==[256,256] and q['anisotropy']==6
 pixels=load_bytes(folder,q['data']);assert len(pixels)==256*256*4
 t=one('Textures');g('glActiveTexture',None,U)(0x84c0)
 g('glBindTexture',None,U,U)(TEX,t);g('glPixelStorei',None,U,I)(0xcf5,1)
 g('glTexImage2D',None,U,I,I,I,I,I,U,U,V)(TEX,0,0x8c43 if q['srgb'] else 0x8058,*size,0,0x1908,0x1401,C.create_string_buffer(pixels))
 for p,vv in [(0x2800,0x2601),(0x2801,0x2703),(0x2802,0x2901),(0x2803,0x2901)]:
  g('glTexParameteri',None,U,U,I)(TEX,p,vv)
 limit=F();g('glGetFloatv',None,U,C.POINTER(F))(0x84ff,C.byref(limit));assert limit.value>=6
 g('glTexParameterf',None,U,U,F)(TEX,0x84fe,6)
 actual=F();g('glGetTexParameterfv',None,U,U,C.POINTER(F))(TEX,0x84fe,C.byref(actual));assert actual.value==6
 g('glGenerateMipmap',None,U)(TEX);e.e0('source-generated texture, actual sRGB/linear/mipmap/anisotropy')
 return t

def run(folder,out):
 manifest=json.loads((folder/'manifest.json').read_text())
 assert manifest['three']=='187'
 w,h=manifest['view'];assert [w,h]==[840,580]
 logFC=2/math.log2(1+manifest['far'])
 drawFBO,readFBO,resolve=target(w,h);unit=5
 lut=upload_dfg(folder,manifest['dfg'],unit);assert lut!=resolve
 blank=one('VertexArrays');linked={};parts=[];textures={}
 for a in manifest['parts']:
  buffers={}
  for k,p in a['attr'].items():
   words=load_bytes(folder,p);c=2 if k=='uv' else 3
   assert len(words)==a['tris']*3*c*4,k
   t=one('Buffers');g('glBindBuffer',None,U,U)(ABUF,t)
   g('glBufferData',None,U,C.c_size_t,V,U)(ABUF,len(words),C.create_string_buffer(words),0x88e4)
   buffers[k]=(t,c)
  assert set(buffers)=={'position','normal','uv','color'}
  modes={}
  for mode in ['normal','marker','protected']:
   d=a[mode];k=(d['vertex']['sha'],d['fragment']['sha'])
   if k not in linked:linked[k]=e.program({j:load_bytes(folder,d[j]).decode() for j in ['vertex','fragment']})
   p=linked[k];vbo=one('VertexArrays');vao(vbo)
   for loc,(buf,count) in buffers.items():
    l=g('glGetAttribLocation',I,U,S)(p,loc.encode())
    if l<0:continue
    g('glBindBuffer',None,U,U)(ABUF,buf)
    g('glEnableVertexAttribArray',None,U)(l)
    g('glVertexAttribPointer',None,U,I,U,C.c_ubyte,I,V)(l,count,0x1406,0,0,None)
   modes[mode]=(p,vbo)
  maps={}
  for role,d in a['maps'].items():
   k=(d['data']['sha'],d['srgb'])
   if k not in textures:textures[k]=upload_surface(folder,d)
   maps[role]=(textures[k],d['transform'])
  parts.append((a,modes,maps))
 def bind_sampler(p,k,u,t):
  loc=name(p,k);assert loc>=0,k
  g('glActiveTexture',None,U)(0x84c0+u);g('glBindTexture',None,U,U)(TEX,t)
  assert integer(0x8069)==t and t!=resolve
  g('glUniform1i',None,I,I)(loc,u)
  actual=I();g('glGetUniformiv',None,U,I,P)(p,loc,C.byref(actual));assert actual.value==u
 bind=g('glBindFramebuffer',None,U,U)
 def draw(view,look):
  bare=look in ('A','P');test=look in ('M','P')
  mode='marker' if look=='M' else 'protected' if look=='P' else 'normal'
  bind(FBO,drawFBO)
  g('glViewport',None,I,I,I,I)(0,0,w,h)
  for x in [0xbe2,0x0c11,0x0bd0,0x809e,0x80a0]:flag(x,False)
  flag(0xb71,True);flag(0xb44,False)
  g('glDepthMask',None,C.c_ubyte)(1);g('glDepthFunc',None,U)(0x0203)
  g('glClearColor',None,F,F,F,F)(0,0,0,1);g('glClear',None,U)(0x4000|0x100)
  use(BG);vao(blank);m(BG,'clipWorld',view['clipWorld']);m(BG,'view',view['view']);v(BG,'viewport',[w,h])
  f(BG,'floorY',manifest['floorY']-.00002);f(BG,'logFC',logFC);b(BG,'marker',test)
  b(BG,'benchSeat',look in ('B','M'));v(BG,'feetX',manifest['shadowX']);v(BG,'feetZ',manifest['shadowZ'])
  g('glDrawArrays',None,U,I,I)(4,0,3)
  flag(0xb44,True)
  for a,modes,maps in parts:
   if bare and a['added']:continue
   p,vbo=modes[mode];use(p);vao(vbo)
   if not test:
    bind_sampler(p,'dfgLUT',unit,lut)
    for role,(t,tx) in maps.items():
     bind_sampler(p,role,MAPS[role],t);m(p,role+'Transform',tx)
   for k,x in [('projectionMatrix',view['projection']),('viewMatrix',view['view']),('modelMatrix',ID),
               ('modelViewMatrix',view['view']),('normalMatrix',view['normalView'])]:m(p,k,x)
   v(p,'cameraPosition',view['eye']);v(p,'ambientLightColor',[0,0,0]);b(p,'isOrthographic',0)
   for k,x in a['material'].items():
    if isinstance(x,list):v(p,k,x)
    else:f(p,k,x)
   for k,x in [('opacity',1),('toneMappingExposure',1.03),('logDepthBufFC',logFC)]:f(p,k,x)
   for k,x in view['sun'].items():v(p,'directionalLights[0].'+k,x)
   for k,x in view['hemi'].items():v(p,'hemisphereLights[0].'+k,x)
   g('glDrawArrays',None,U,I,I)(4,0,a['tris']*3)
  e.e0('studio lit pass')
  bind(0x8ca8,drawFBO);bind(0x8ca9,readFBO)
  g('glBlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,w,h,0,0,w,h,0x4000,0x2600)
  bind(FBO,readFBO);a=np.zeros((h,w,4),np.uint8)
  g('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,a.ctypes.data)
  e.e0('native RGBA');return a[::-1].copy()
 evidence={}
 for label,view in manifest['cameras'].items():
  raws={};hash=[]
  for k in 'AABMAPBMBP':
   x=draw(view,k);assert np.array_equal(x,raws.setdefault(k,x)),(label,k)
   hash.append([k,e.sha(x.tobytes())])
  A,B,M,peer=[raws[k] for k in 'ABMP']
  area=np.max(M[:,:,:3],axis=2)>0
  floorOnly=(M[:,:,2]>191)&(M[:,:,0]==0)&(M[:,:,1]==0)
  protected=peer[:,:,2]>0
  rgb=np.max(np.abs(A[:,:,:3].astype(np.int16)-B[:,:,:3]),axis=2)
  strong=(rgb>3);counts=[int((strong&(M[:,:,i]>229)).sum()) for i in [0,1]]
  stat={'scope':int(area.sum()),'stockEntryGlazingRailPixels':int(protected.sum()),'strongRGBgt3':int(strong.sum()),
   'strongFullEndsBoards':counts,'floorOnlyStrong':int((strong&floorOnly).sum()),
   'alpha':int((A[:,:,3]!=B[:,:,3]).sum()),'exterior':int((rgb[~area]>0).sum()),
   'protectedChanged':int((rgb[protected]>0).sum())}
  print(label,stat,flush=True)
  assert stat['strongRGBgt3']>=3500 and min(counts)>=250 and stat['stockEntryGlazingRailPixels']>=15000
  assert not stat['alpha'] and not stat['exterior'] and not stat['protectedChanged'],stat
  plate=Image.new('RGB',(w*2,h+35),(26,30,35));d=ImageDraw.Draw(plate)
  d.text((16,10),'ORIGINAL STOREFRONT STUDY',fill=(231,232,228))
  d.text((w+16,10),'RIGHT-DISPLAY BENCH / AUGUST 2018 REFERENCE',fill=(231,232,228))
  for i,k in enumerate(['A','B']):plate.paste(Image.fromarray(raws[k]).convert('RGB'),(i*w,35))
  path=out/(label+'-matched.webp');plate.save(path,lossless=True,method=5)
  Image.fromarray(B).convert('RGB').save(out/(label+'-right.webp'),lossless=True,method=5)
  role=Image.fromarray(M).convert('RGB');role.save(out/(label+'-role.png'),optimize=True)
  evidence[label]={**stat,'camera':view,'exactRepeatAndRestorationSequence':hash,'matchedWebpSHA256':e.sha(path.read_bytes())}
 receipt={'scope':'Detached studio; no native world, map, survey or placement. Compared stock authored storefront in same neutral lighting, not the original web viewer environment.',
  'shape':[w,h],'samples':4,'rgba':8,'depth':24,'glDriver':e.driver,'renderer':g('glGetString',S,U)(0x1f01).decode(),
  'dfg':{'samplerUnit':unit,'texture':lut,'differentResolveTexture':resolve,'format':'16x16 RG16F/RG/HALF_FLOAT','bytes':manifest['dfg']},
  'sourceTextureFormat':'Original generated maps / RGBA8 linear or SRGB8_ALPHA8 / repeat, mipmapped, anisotropy 6', 'uniqueUploadedMapTextures':len(textures),
  'studioFloorOnly':'Four bounded analytic near-foot occlusion lobes at exact illustrative footprint centres, no scene asset',
  'assets':{'originalTriangles':5540,'addedTriangles':404,'originalDraws':10,'addedDraws':2,'addedTextureCount':0},
  'opticalGates':{'minStrongPerView':3500,'minStrongPerBenchRole':250,'minNonvacuousProtected':15000},
  'views':evidence}
 with (out/'receipt.json').open('x') as fh:json.dump(receipt,fh,indent=2);fh.write('\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--fixture',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
 a=p.parse_args();a.out.mkdir(exist_ok=False);run(a.fixture,a.out)
