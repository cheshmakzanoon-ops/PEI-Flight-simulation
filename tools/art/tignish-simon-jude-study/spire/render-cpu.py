#!/usr/bin/env python3
"""Analytic private plate from emitted Three.js triangles. Not a photo or WebGL render."""
from pathlib import Path
import argparse
import json
import numpy as np
from PIL import Image,ImageDraw

def render(w,h,xyz,norm,col,names,cam,background=True):
    dw=np.ones((h,w),np.float64)*float('inf')
    if background:
        shade=np.linspace(.959,.888,h)
        out=np.dstack([np.repeat(shade[:,None]*m,w,axis=1) for m in (.981,.993,1)])
    else:
        out=np.zeros((h,w,3),float)
    mark=np.full((h,w),-1,np.int32)
    v,p=[np.array(cam[k]).reshape((4,4),order='F') for k in ('view','projection')]
    sun=np.array([-.37,.69,.63]);sun/=np.linalg.norm(sun)
    screen=np.column_stack((xyz,np.ones(len(xyz))))@(p@v).T
    screen[:,:2]=screen[:,:2]*[w/2,-h/2]+[w/2,h/2]
    for k,(P,normal,C) in enumerate(zip(screen.reshape(-1,3,4),norm[::3],col[::3])):
        pp=P[:,:2]
        # Front-sided material, with a downward-screen Y axis.
        A,B,Cp=pp
        ab,ac=B-A,Cp-A
        det=ab[0]*ac[1]-ab[1]*ac[0]
        if det>=-1e-9:
            continue
        a=np.maximum(np.floor(pp.min(0)).astype(int),[0,0]);b=np.minimum(np.ceil(pp.max(0)).astype(int)+1,[w,h])
        if any(b<=a):
            continue
        x,y=np.meshgrid(np.arange(a[0],b[0])+.5,np.arange(a[1],b[1])+.5)
        x-=A[0];y-=A[1]
        t=(x*ac[1]-y*ac[0])/det;u=(ab[0]*y-ab[1]*x)/det
        d=P[0,2]+t*(P[1,2]-P[0,2])+u*(P[2,2]-P[0,2])
        yy=slice(a[1],b[1]);xx=slice(a[0],b[0])
        fit=(t>=0)&(u>=0)&(t+u<=1)&(d<dw[yy,xx])
        if not np.any(fit):
            continue
        lam=np.dot(normal,sun)
        rgb=np.clip(C*(.54+.68*max(0,lam)+.16*max(0.,normal[1])),0,1)
        rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.power(rgb,1/2.4)-.055)
        dw[yy,xx][fit]=d[fit];out[yy,xx][fit]=rgb;mark[yy,xx][fit]=k
    return Image.fromarray(np.uint8(np.rint(out*255)),'RGB'),mark

def run(d,out):
    q=json.loads(d.read_text())
    xyz,norm,col=[np.concatenate([np.array(s['data'][k]).reshape(-1,3) for s in q['streams']])
        for k in ('position','normal','color')]
    names=np.array([role for s in q['streams'] for role in s['names']])
    planes=np.array([x.startswith('core:') for x in names])
    opts=[]
    for c in q['views']:
        w,h=c['imageSize']
        im,m=render(w,h,xyz,norm,col,names,c)
        got={}
        for r in (0,1,3):
            for ch in ('pale reveal','shadowed backstop'):
                role=f'profile:{r}:{ch}'
                got[role]=int(np.sum(np.isin(m,np.flatnonzero(names==role))))
        _,s=render(w,h,xyz[np.repeat(planes,3)],norm[np.repeat(planes,3)],col[np.repeat(planes,3)],
                   names[planes],c,False)
        rows=np.flatnonzero(np.any(s>=0,axis=1))
        lengths=[int(np.sum(s[int(rows[0]+t*(rows[-1]-rows[0]))]>=0)) for t in (.17,.44,.79)]
        assert lengths[0]<lengths[1]<lengths[2],(c['name'],lengths)
        if c['name']!='return-unseen':
            expected={0,1} if c['name']=='front-flank' else {0,3}
            assert all(got[f'profile:{r}:pale reveal']>=30 and got[f'profile:{r}:shadowed backstop']>=25 for r in expected),(c['name'],got)
        opts.append({'view':c['name'],'nearTopToSkirtRowWidths':lengths,'knownRolePixels':got})
        p=ImageDraw.Draw(im)
        p.text((14,15),'TIGNISH   /   UPPER-SPIRE STUDY',fill=(50,67,69))
        p.text((14,30),'UNPLACED   /   ORIGINAL UNITS',fill=(77,91,93))
        p.text((14,h-26),c['name'].replace('-',' ').upper(),fill=(57,74,76))
        with (out/(c['name']+'.png')).open('xb') as image_file:
            im.save(image_file,format='PNG',optimize=True)
    return {'scope':'CPU plate from original Float32 Three.js submission positions, normals and vertex color. No photo/camera data, game or WebGL/device performance.',
      'samples':opts, 'triangles':sum(i['triangles'] for i in q['streams']), 'batches':[{'material':a['material'],
      'triangles':a['triangles'],'sha256':a['receipt']} for a in q['streams']]}

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('emitted',type=Path);a.add_argument('directory',type=Path)
    p=a.parse_args()
    p.directory.mkdir(parents=False,exist_ok=False)
    result=run(p.emitted,p.directory)
    print(json.dumps(result,indent=2))
