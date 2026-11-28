"""Actual Mesa GLES 4x end-to-end sampler transport of original Three r187 dense-array shader."""
import ctypes as C
from hashlib import sha256
from pathlib import Path
import json,sys
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'grain-corn-anatomy'))
from egl_support import gl, I,U,V,e0,program,driver

r=Path.cwd()
q=Path(sys.argv[1]);q.mkdir()
p=json.load(sys.stdin)
F=lambda s,t,*u:gl('gl'+s,t,*u)
width,height=p['frame']; assert (width,height)==(160,112) and len(p['cams'])==120 and p['three']=='187'
shader=program(p['shader'])
buf=lambda s:F('Gen'+s,None,I,V)
def get(fn):
    out=U();fn(1,C.byref(out));assert out.value;return out.value
f=C.c_float
fb=F('BindFramebuffer',None,U,U)
rb=F('BindRenderbuffer',None,U,U)
rr=F('RenderbufferStorage',None,U,U,I,I)
rs=F('RenderbufferStorageMultisample',None,U,I,U,I,I)
fa=F('FramebufferRenderbuffer',None,U,U,U,U)
frames=[get(buf('Framebuffers')) for _ in (0,1)]
readstate=F('GetIntegerv',None,U,V)
for i,k in enumerate(frames):
    fb(0x8d40,k);rb(0x8d41,get(buf('Renderbuffers')))
    if i:rs(0x8d41,4,0x8058,width,height)
    else:rr(0x8d41,0x8058,width,height)
    # Bind the actual renderbuffer by queried object name, never guessed.
    cur=I();readstate(0x8ca7,C.byref(cur))
    fa(0x8d40,0x8ce0,0x8d41,cur.value)
    assert F('CheckFramebufferStatus',U,U)(0x8d40)==0x8cd5
    samples=I();readstate(0x80a9,C.byref(samples));assert samples.value==(4 if i else 0)
# Pixel-store order is literal baked top-to-bottom pages; shader flips its t.
A=0x8c1a
F('ActiveTexture',None,U)(0x84c0)
F('BindTexture',None,U,U)(A,get(buf('Textures')))
P=F('TexParameteri',None,U,U,I)
for k,v in ((0x2801,0x2703),(0x2800,0x2601),(0x2802,0x812f),(0x2803,0x812f),(0x8072,0x812f),(0x813d,3)):
    P(A,k,v)
F('TexStorage3D',None,U,I,U,I,I,I)(A,4,0x8058,32,32,144)
sub=F('TexSubImage3D',None,U,I,I,I,I,I,I,I,U,U,V)
d=r/'dense-low-source-a'
manifest=json.loads((d/'receipt.json').read_bytes())['pages']
assert len(manifest)==144
for l,k in enumerate((32,16,8,4)):
    pages=[]
    for i,page in enumerate(manifest):
        m=next(x for x in page['outputs']if x['name']==f'angle-{i:03d}-{k:03d}.rgba')
        data=(d/m['name']).read_bytes()
        assert len(data)==m['length']==k*k*4 and sha256(data).hexdigest()==m['sha']
        pages.append(data)
    cube=b''.join(pages)
    sub(A,l,0,0,0,k,k,144,0x1908,0x1401,C.c_char_p(cube));e0('authenticated layer/mip upload')
F('UseProgram',None,U)(shader)
loc=F('GetUniformLocation',I,U,C.c_char_p)
vals={k:loc(shader,k.encode()) for k in ('sourceAngles','samplePlacement','indexBlend','elevationBlend')}
assert min(vals.values())>=0
F('Uniform1i',None,I,I)(vals['sourceAngles'],0)
b=get(buf('Buffers'));F('BindBuffer',None,U,U)(0x8892,b)
v=(f*9)(-1,-1,0,3,-1,0,-1,3,0)
F('BufferData',None,U,C.c_ssize_t,V,U)(0x8892,C.sizeof(v),v,0x88e4)
j=F('GetAttribLocation',I,U,C.c_char_p)(shader,b'position')
F('EnableVertexAttribArray',None,U)(j)
F('VertexAttribPointer',None,U,I,U,C.c_ubyte,I,V)(j,3,0x1406,False,0,None)
for setting in (0x0b71,0x0be2,0x0bd0,0x809e,0x0b44,0x0c11):
    F('Disable',None,U)(setting)
F('Viewport',None,I,I,I,I)(0,0,width,height)
u2=F('Uniform2f',None,I,f,f);u3=F('Uniform3f',None,I,f,f,f);u4=F('Uniform4f',None,I,f,f,f,f)
rows=[]
for i,c in enumerate(p['cams']):
    pl=c['placement']; az=c['az'];el=c['elevation'];var=int(c['variant'][-1])
    z=(az%360)/15;lo=int(z);hi=(lo+1)%24
    row=int(el>=14.5);f0=24*row+72*var;f1=f0+24;elev=(el-[10,14.5][row])/4.5
    assert 0<=elev<=1
    fb(0x8d40,frames[1]);F('ClearColor',None,f,f,f,f)(0.,0.,0.,0.);F('Clear',None,U)(0x4000)
    u3(vals['samplePlacement'],pl['cx'],pl['cy'],pl['span']);u4(vals['indexBlend'],lo,hi,z-lo,f0)
    u2(vals['elevationBlend'],f1,elev)
    F('DrawArrays',None,U,I,I)(0x0004,0,3)
    fb(0x8ca8,frames[1]);fb(0x8ca9,frames[0])
    F('BlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)(0,0,width,height,0,0,width,height,0x4000,0x2600)
    fb(0x8ca8,frames[0])
    pix=np.empty((height,width,4),np.uint8)
    F('ReadPixels',None,I,I,I,I,U,U,V)(0,0,width,height,0x1908,0x1401,pix.ctypes.data);e0('real mip multi-view output')
    pix=pix[::-1].copy(); assert (pix[:,:,:3]<=pix[:,:,3:]).all()
    yy,xx=np.where(pix[:,:,3]>0)
    assert (np.abs(xx+.5-pl['cx'])<pl['span']/2+1).all()and(np.abs(height-yy-.5-pl['cy'])<pl['span']/2+1).all()
    raw=pix.tobytes();path=f'gpu-{i:03d}.rgba';(q/path).write_bytes(raw)
    rows.append({'i':i,'file':path,'sha256':sha256(raw).hexdigest(),'covered':len(xx),'pl':pl})
(q/'receipt.json').write_text(json.dumps({'scope':'Actual detached low-angle linked shader 4×, linear associated buffer; not game optics, depth or scene blend','driver':driver,'drawsPerFrame':1,'arrayPages':144,'frames':rows},indent=2)+'\n')
