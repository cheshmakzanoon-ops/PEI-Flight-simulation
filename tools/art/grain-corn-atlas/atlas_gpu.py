"""Portable native Mesa renderer for an offline Three.js art atlas."""
import base64
import ctypes as C
from hashlib import sha256
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "grain-corn-anatomy"))
from egl_support import gl, I, U, V, e0, program, driver


def digest(data):
    return sha256(data).hexdigest()


def level_words(floating):
    return np.asarray(np.clip(np.rint(floating), 0, 255), dtype=np.uint8)


def open_capture(J, expected=None):
    if list(J["frame"]) != [256, 256] or J["three"] != "187":
        raise ValueError("unexpected locked canvas or Three.js version")
    W, H = J["frame"]
    if set(J["renderedOriginalGeometry"]) != {"variant-0", "variant-1"}:
        raise ValueError("exactly two independent cluster geometries are expected")
    gaze = [(c["variant"], c["elevation"], c["az"], c["orthographicSpanM"]) for c in J["cams"]]
    if expected is None:
        expected = [(f"variant-{i}", e, a, 5.2) for i in range(2)
                    for e in (25,64) for a in (19,109,199,289)]
    if gaze != expected:
        raise ValueError("the atlas angle or source projection docket changed")
    R = program(J["shader"])
    f=C.c_float;byte=C.c_ubyte
    F=lambda s,r,*a:gl('gl'+s,r,*a)
    def words(v):return (f*len(v))(*v)
    def data(a):
     u=base64.b64decode(a['data'],validate=True);assert len(u)==a['bytes'] and digest(u)==a['sha'];return u
    def make(fn):
     k=U();fn(1,C.byref(k));assert k.value;return k.value
    mkfb=F('GenFramebuffers',None,I,V);fb=F('BindFramebuffer',None,U,U)
    mkrb=F('GenRenderbuffers',None,I,V);rb=F('BindRenderbuffer',None,U,U)
    at=F('FramebufferRenderbuffer',None,U,U,U,U)
    rs=F('RenderbufferStorage',None,U,U,I,I);rms=F('RenderbufferStorageMultisample',None,U,I,U,I,I)
    check=F('CheckFramebufferStatus',U,U);read=F('ReadPixels',None,I,I,I,I,U,U,V)
    target={aa:make(mkfb) for aa in (0,4)}
    for aa,glf in target.items():
     fb(0x8d40,glf)
     for attachment,fmt in [(0x8ce0,0x8058),(0x8d00,0x81a6)]:
      b=make(mkrb);rb(0x8d41,b)
      if aa:rms(0x8d41,aa,fmt,W,H)
      else:rs(0x8d41,fmt,W,H)
      at(0x8d40,attachment,0x8d41,b)
     assert check(0x8d40)==0x8cd5
     n=I();F('GetIntegerv',None,U,V)(0x80a9,C.byref(n));assert n.value==aa
    vp=F('Viewport',None,I,I,I,I);clear=F('Clear',None,U);color=F('ClearColor',None,f,f,f,f)
    enable=F('Enable',None,U);disable=F('Disable',None,U)
    bind=F('BindBuffer',None,U,U);gen=F('GenBuffers',None,I,V);upload=F('BufferData',None,U,C.c_ssize_t,V,U)
    attr=F('GetAttribLocation',I,U,C.c_char_p);loc=F('GetUniformLocation',I,U,C.c_char_p)
    vtx=F('VertexAttribPointer',None,U,I,U,byte,I,V);ena=F('EnableVertexAttribArray',None,U)
    tr=F('UniformMatrix4fv',None,I,I,byte,V);tr3=F('UniformMatrix3fv',None,I,I,byte,V)
    draw=F('DrawElements',None,U,I,U,V);v3=F('Uniform3f',None,I,f,f,f);v1=F('Uniform1f',None,I,f)
    blit=F('BlitFramebuffer',None,I,I,I,I,I,I,I,I,U,U)
    def uv(k):
     v=loc(R,k.encode());assert v>=0,k;return v
    def packet(dataPack):
     out={}
     for name,geo in dataPack.items():
      M={}
      for role,g in geo['attrs'].items():
       d=data(g);v=make(gen);bind(0x8892,v);upload(0x8892,len(d),C.c_char_p(d),0x88e4)
       M[role]=(v,g)
      d=data(geo['index']);v=make(gen);bind(0x8893,v);upload(0x8893,len(d),C.c_char_p(d),0x88e4)
      out[name]=(M,v,geo['index']['count'])
     return out
    subject=packet(J['renderedOriginalGeometry'])
    enable(0x0b71)
    for mode in (0x0b44,0x0be2,0x0bd0,0x809e,0x0c11):disable(mode)
    F('UseProgram',None,U)(R);id4=np.eye(4).ravel().tolist()
    def submit(data):
     M,e,n=data
     for name,(v,g) in M.items():
      a=attr(R,name.encode());assert a>=0,name
      bind(0x8892,v);ena(a);vtx(a,g['itemSize'],{'Float32Array':0x1406,'Uint8Array':0x1401}[g['type']],g['normalized'],0,None)
     bind(0x8893,e);draw(4,n,0x1403,None)
    def capture(c):
        q=target[4]
        fb(0x8d40,q);vp(0,0,W,H);color(0.,0.,0.,0.);clear(0x4100)
        for key,m in [('modelMatrix',id4),('viewMatrix',c['view']),('modelViewMatrix',c['view']),('projectionMatrix',c['projection'])]:
            tr(uv(key),1,0,words(m))
        tr3(uv('normalMatrix'),1,0,words(c['normal']))
        v1(uv('cornFieldResponse'),1.)
        v1(uv('cornStudioGround'),0.)
        v3(uv('cameraPosition'),*c['eye'])
        v3(uv('cornDay'),*J['light'])
        submit(subject[c['variant']])
        fb(0x8ca8,q);fb(0x8ca9,target[0]);blit(0,0,W,H,0,0,W,H,0x4000,0x2600)
        fb(0x8ca8,target[0])
        a=np.empty((H,W,4),np.uint8)
        read(0,0,W,H,0x1908,0x1401,a.ctypes.data);e0('native alpha/radiance read')
        return a[::-1].copy()
    return capture
