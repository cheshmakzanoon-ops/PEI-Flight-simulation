#!/usr/bin/env python3
"""Independent 4x native ES3 two-view A/B of the emitted standard program and exact source geometry."""
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
uniform bool marker;
out vec4 c;
void main(){
 vec2 ndc=2.*gl_FragCoord.xy/viewport-1.;
 vec4 qa=clipWorld*vec4(ndc,-1.,1.),qb=clipWorld*vec4(ndc,1.,1.);
 vec3 a=qa.xyz/qa.w,b=qb.xyz/qb.w,u=normalize(b-a);
 float t=(floorY-a.y)/min(-1e-5,u.y);
 vec3 at=a+t*u;
 float mist=exp(-.028*t);
 vec3 sky=mix(vec3(.74,.77,.794),vec3(.61,.664,.718),smoothstep(-.10,.78,u.y));
 vec3 ground=vec3(.59,.607,.608);
 c=vec4(u.y<0.?mix(sky,ground,mist):sky,1.);
 if(marker)c=vec4(0.,0.,0.,1.);
 float depth=-(view*vec4(at,1.)).z;
 gl_FragDepth=u.y<0.?clamp(log2(1.+max(0.,depth))*logFC*.5,0.,1.):1.;
}'''})
ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
def run(folder,out):
 manifest=json.loads((folder/'manifest.json').read_text())
 assert manifest['three']=='187'
 w,h=manifest['view'];logFC=2/math.log2(1+manifest['far'])
 drawFBO,readFBO,resolve=target(w,h); unit=5
 lut=upload_dfg(folder,manifest['dfg'],unit); assert lut!=resolve
 blank=one('VertexArrays')
 linked={};parts=[]
 for a in manifest['parts']:
  buffers={}
  for k,p in a['attr'].items():
   words=load_bytes(folder,p); c=2 if k=='uv' else 3
   assert len(words)==a['tris']*3*c*4,k
   t=one('Buffers');g('glBindBuffer',None,U,U)(ABUF,t)
   g('glBufferData',None,U,C.c_size_t,V,U)(ABUF,len(words),C.create_string_buffer(words),0x88e4)
   buffers[k]=(t,c)
  modes={}
  for mode in ('normal','marker'):
   code=a[mode];key=tuple(code[k]['sha'] for k in ('vertex','fragment'))
   if key not in linked:
    linked[key]=e.program({k:load_bytes(folder,p).decode() for k,p in code.items()})
   prog=linked[key];sel=one('VertexArrays');vao(sel)
   for k,(t,c) in buffers.items():
    i=g('glGetAttribLocation',I,U,S)(prog,k.encode())
    if i<0:continue
    g('glBindBuffer',None,U,U)(ABUF,t);g('glEnableVertexAttribArray',None,U)(i)
    g('glVertexAttribPointer',None,U,I,U,C.c_ubyte,I,V)(i,c,0x1406,0,0,None)
   modes[mode]=(prog,sel)
  parts.append((a,modes))
 e.e0('native exact original/additive roles')
 def draw(view,look):
  marker=look=='M'
  bind=g('glBindFramebuffer',None,U,U);bind(FBO,drawFBO)
  g('glViewport',None,I,I,I,I)(0,0,w,h)
  for x in [0xbe2,0x0c11,0x809e,0x80a0]:flag(x,False)
  flag(0xb71,True);flag(0xb44,False)
  g('glDepthMask',None,C.c_ubyte)(1);g('glDepthFunc',None,U)(0x0203)
  g('glClearColor',None,F,F,F,F)(0,0,0,1);g('glClear',None,U)(0x4000|0x0100)
  use(BG);vao(blank);m(BG,'clipWorld',view['clipWorld']);m(BG,'view',view['view']);v(BG,'viewport',[w,h])
  f(BG,'floorY',manifest['floorY']-.00002);f(BG,'logFC',logFC);b(BG,'marker',marker)
  g('glDrawArrays',None,U,I,I)(4,0,3)
  flag(0xb44,True)
  for a,modes in parts:
   if look=='A' and a['added']:continue
   p,vbo=modes['marker' if marker else 'normal'];use(p);vao(vbo)
   dfg=name(p,'dfgLUT')
   if not marker:assert dfg>=0,(a['name'],look)
   if dfg>=0:
    g('glActiveTexture',None,U)(0x84c0+unit)
    assert integer(0x8069)==lut and lut!=resolve
    g('glUniform1i',None,I,I)(dfg,unit)
    actual=I();g('glGetUniformiv',None,U,I,P)(p,dfg,C.byref(actual));assert actual.value==unit
   for k,x in [('projectionMatrix',view['projection']),('viewMatrix',view['view']),('modelMatrix',ID),
               ('modelViewMatrix',view['view']),('normalMatrix',view['normalView'])]:m(p,k,x)
   v(p,'cameraPosition',view['eye']);v(p,'diffuse',a['diffuse']);v(p,'emissive',a['emissive'])
   v(p,'ambientLightColor',[0,0,0]);b(p,'isOrthographic',0)
   for k,x in [('opacity',1),('roughness',a['roughness']),('metalness',a['metalness']),('toneMappingExposure',1),
              ('logDepthBufFC',logFC)]:f(p,k,x)
   for k,x in view['sun'].items():v(p,'directionalLights[0].'+k,x)
   for k,x in view['hemi'].items():v(p,'hemisphereLights[0].'+k,x)
   g('glDrawArrays',None,U,I,I)(4,0,3*a['tris'])
  e.e0('studio lit pass')
  bind(0x8ca8,drawFBO);bind(0x8ca9,readFBO)
  g('glBlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,w,h,0,0,w,h,0x4000,0x2600)
  bind(FBO,readFBO);a=np.zeros((h,w,4),np.uint8)
  g('glReadPixels',None,I,I,I,I,U,U,V)(0,0,w,h,0x1908,0x1401,a.ctypes.data)
  e.e0('native raw RGBA readback')
  return a[::-1].copy()
 records={}
 for phase,view in manifest['cameras'].items():
  images={};words=[]
  for k in 'AABMABMB':
   x=draw(view,k)
   assert np.array_equal(x,images.setdefault(k,x)),(phase,k)
   words.append([k,e.sha(x.tobytes())])
  A,B,M=[images[k] for k in 'ABM']
  scope=np.max(M[:,:,:3],axis=2)>0
  rgb=np.max(np.abs(A[:,:,:3].astype(np.int16)-B[:,:,:3]),axis=2)
  assert not np.any(rgb[~scope]) and np.array_equal(A[:,:,3],B[:,:,3]) and np.all(A[:,:,3]==255)
  strong=int((rgb>3).sum())
  roles=[int(((q>229)&(rgb>3)).sum()) for q in M[:,:,:3].transpose(2,0,1)]
  assert strong>19000 and min(roles)>150,(phase,strong,roles)
  img=Image.new('RGB',(w*2,h+42),(23,29,36));d=ImageDraw.Draw(img)
  d.text((19,14),'EXISTING UPPER SPECIMEN',fill=(218,226,233),stroke_width=0)
  d.text((w+19,14),'KENT STREET LOWER FRONTAGE / 2016 STUDY',fill=(218,226,233),stroke_width=0)
  img.paste(Image.fromarray(A).convert('RGB'),(0,42));img.paste(Image.fromarray(B).convert('RGB'),(w,42))
  o=out/(phase+'-matched.webp');img.save(o,lossless=True,method=5)
  Image.fromarray(B).convert('RGB').save(out/(phase+'-lower-native.webp'),lossless=True,method=5)
  M=Image.fromarray(np.uint8(scope)*255)
  M.save(out/(phase+'-added-mask.png'),optimize=True)
  records[phase]={'camera':view,'cold_and_immediate_A_B_rollback':words,'insidePixels':int(scope.sum()),
    'strongRGBgt3':strong,'fullRolesHoodsCaseGlass':roles,'alpha':0,'exterior':0,
    'matchedLosslessWebpSha256':e.sha(o.read_bytes())}
  print(phase,strong,roles,flush=True)
 seq={x:int(sum(a['tris'] for a,_ in parts if a['added']==which)) for x,which in [('prior',False),('new',True)]}
 with (out/'receipt.json').open('x') as fh:
  json.dump({'scope':'Detached studio, source-grounded 2016 façade interpretation only. No source imagery, no addressed world or placement.',
   'glVersion':e.driver,'renderer':g('glGetString',S,U)(0x1f01).decode(),'shape':manifest['view'],'rgba':8,'depth':24,'samples':4,
   'dfg':{'unit':unit,'texture':lut,'differentResolveTexture':resolve,'format':'16x16 RG16F/RG/HALF_FLOAT','bytes':manifest['dfg']},
   'oldSourceUntouched':True,'thirdPartyPixels':False,'triangles':seq,'views':records},fh,indent=2);fh.write('\n')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--fixture',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
 a=p.parse_args();a.out.mkdir(exist_ok=False);run(a.fixture,a.out)
