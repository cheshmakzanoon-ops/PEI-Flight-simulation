#!/usr/bin/env python3
"""Bake an original, deterministic two-elevation impostor atlas from synthetic branching trees.
No photograph or vendor game asset is used. Units within each model are fractions of
its mature height. Pillow is the only dependency. Run from the repository root.
"""
import math,random
from pathlib import Path
from PIL import Image,ImageDraw
D=384;OUT=256;TAU=math.tau

def tree(seed,needles):
    r=random.Random(seed);wood=[];fol=[];lobes=[]
    def branch(a,b,w):wood.append((a,b,w))
    if needles:
        trunk=(r.uniform(-.03,.03),.95,r.uniform(-.025,.025));branch((0,.0,0),trunk,.020)
        for k in range(14):
            lev=.15+k*.055; rad=(.31 if seed%2 else .26)*(1.-lev)**.74
            n=6+k%3;offset=r.random()*TAU
            for j in range(n):
                a=offset+j*TAU/n+r.uniform(-.19,.19);L=rad*r.uniform(.68,1.16);root=(trunk[0]*lev,lev,trunk[2]*lev)
                tip=(math.cos(a)*L+root[0],lev+r.uniform(-.009,.045),math.sin(a)*L+root[2]);branch(root,tip,.006*(1.-lev)+.002)
                for u in (.37,.61,.85,1.):
                    x=root[0]*(1-u)+tip[0]*u;y=lev+.023*(1-u);z=root[2]*(1-u)+tip[2]*u
                    lobes.append((x,y,z,(.061-.034*lev)*(1.30-.45*u),(.103-.046*lev)*(1.19-.34*u),68))
    else:
        lean=r.uniform(-.08,.08);branch((0,0,0),(lean*.30,.34,0),.027)
        n=12;offset=r.uniform(0,TAU)
        for j in range(n):
            lev=.27+.32*(j/n);a=offset+j*2.39996+r.uniform(-.26,.26)
            L=r.uniform(.20,.33)*(1.08-(lev-.32));Y=r.uniform(.54,.78)+.21*(j/n)
            root=(lean*lev,lev,.012*math.sin(j));mid=(math.cos(a)*L*.55+lean*.5,(Y+lev)*.52,math.sin(a)*L*.55)
            branch((lean*.30,.30,0),root,.016);branch(root,mid,.013)
            for k in range(3):
                aa=a+(k-1)*.72+r.uniform(-.25,.25);l=L*r.uniform(.40,.80);hh=Y+r.uniform(-.08,.055)
                tip=(mid[0]+math.cos(aa)*l,hh,mid[2]+math.sin(aa)*l);branch(mid,tip,.0065)
                lobes.append((*tip,r.uniform(.076,.13),r.uniform(.077,.138),220))
        lobes.append((lean,.88,.0,.10,.09,270))
    for cx,cy,cz,rx,ry,num in lobes:
        tint=r.uniform(.80,1.12)
        for _ in range(num):
            y=r.uniform(-1,1);theta=r.uniform(0,TAU);h=math.sqrt(1-y*y);x=h*math.cos(theta);z=h*math.sin(theta)
            radius=(r.random()**.26)*r.uniform(.86,1.15)
            pos=(cx+rx*x*radius,cy+ry*y*radius,cz+rx*z*radius)
            L=max(0, -.61*x+.61*y-.50*z);amb=.19+.42*max(0,(pos[1]-.20)/.77)+.24*(.5-pos[0])
            light=.39+.49*amb+.48*L*r.uniform(.66,1.12);base=(73,94,62) if needles else ((96,111,66)if seed%2 else (77,104,59));var=tint*r.uniform(.84,1.18)
            rgb=tuple(int(min(225,max(0,c*light*var))) for c in base)
            fol.append((pos,r.uniform(.003,.010) if needles else r.uniform(.004,.012),rgb))
    return wood,fol

def view(wood,fol,angle,above):
    # Plane basis normalized. Both views share world-space root and a grazing-angle
    # blend in the renderer; a high view is actual top projection of the same tree.
    ca,sa=math.cos(angle),math.sin(angle);el=math.radians(82 if above else 7);ce,se=math.cos(el),math.sin(el)
    def proj(q):
        x,y,z=q;horizontal=x*ca-z*sa;depth=x*sa+z*ca;v=y*ce-depth*se
        return (D*(.5+horizontal*.94),D*((.5 if above else .955)-(v-(.051 if above else 0))*.94),depth*ce+y*se)
    items=[]
    for a,b,w in wood:
        A=proj(a);B=proj(b);items.append(((A[2]+B[2])*.5,0,(A,B,w)))
    for q,w,rgb in fol:
        x,y,d=proj(q);items.append((d,1,(x,y,w*D,rgb)))
    im=Image.new('RGBA',(D,D));g=ImageDraw.Draw(im)
    for d,k,p in sorted(items,key=lambda a:a[0]):
        if not k:
            a,b,w=p;g.line((a[0],a[1],b[0],b[1]),fill=(65,56,40,255),width=max(1,round(D*w)));continue
        x,y,rr,rgb=p;g.ellipse((x-rr,y-rr*.66,x+rr,y+rr*.66),fill=(*rgb,255))
    return im.resize((OUT,OUT),Image.Resampling.LANCZOS)

if __name__=='__main__':
    atlas=Image.new('RGBA',(OUT*4,OUT*2))
    for i,(seed,needle) in enumerate([(267,False),(902,False),(351,True),(444,True)]):
        obj=tree(seed,needle)
        for j in range(2):atlas.paste(view(*obj,i*.61,j),(OUT*i,OUT*j))
    path=Path('public/art/canopy.webp');path.parent.mkdir(parents=True,exist_ok=True);atlas.save(path,'WEBP',quality=92,method=6,exact=True)
