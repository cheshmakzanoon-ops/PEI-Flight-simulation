#!/usr/bin/python3
"""Prepare contact-safe adaptive relief seeds from existing licensed runtime maps."""
import argparse,gzip,json,math,struct
from pathlib import Path
from importlib.machinery import SourceFileLoader
import numpy as np
from scipy.ndimage import maximum_filter,minimum_filter
from osgeo import gdal,ogr
gdal.UseExceptions()
common=SourceFileLoader('study',str(Path(__file__).with_name('relief-contact-study.py'))).load_module()
n=112; cols=32; rows=22
f=math.radians(46.5);a=6378137;ecc=6.69437999014e-3;t=1-ecc*math.sin(f)**2
X=a*math.pi/180*math.cos(f)/math.sqrt(t); Z=a*(1-ecc)*math.pi/180/t**1.5
def p(lon,lat):return ((lon+63.2)*X,(46.5-lat)*Z)

def obstacles(world,geo):
    # int world cells plus conservative polygon buffers, not point-in-polygon votes.
    w,h=cols*n,rows*n
    mem=ogr.GetDriverByName('Memory').CreateDataSource('');ly=mem.CreateLayer('items',geom_type=ogr.wkbPolygon)
    definition=ly.GetLayerDefn()
    def rect(a,b,c,d):
        ring=ogr.Geometry(ogr.wkbLinearRing)
        for x,z in ((a,b),(c,b),(c,d),(a,d),(a,b)):ring.AddPoint_2D(x,z)
        poly=ogr.Geometry(ogr.wkbPolygon);poly.AddGeometry(ring);return poly
    def add(obj):
        f=ogr.Feature(definition);f.SetGeometry(obj);ly.CreateFeature(f)
    m=json.loads((world/'roads.json').read_text());ro=gzip.decompress((world/m['file']).read_bytes()) if 'file' in m else gzip.decompress((world/'roads.bin.gz').read_bytes())
    assert common.hashlib.sha256(ro).hexdigest()==m['sha256']
    magic,version,count=struct.unpack_from('>IHI',ro);assert magic==0x50454952 and version==1
    i=10
    for j in range(count):
        l,flags=struct.unpack_from('>HB',ro,i);i+=3
        points=[]
        for _ in range(l):
            x,z=struct.unpack_from('>II',ro,i);i+=8;points.append(p(x/1e5-65,z/1e5+45))
        c=[2.,2.8,3.6,4.8,6.4][flags&7]+12
        for a,b in zip(points,points[1:]):
            x,z=a;u,v=b;d=math.hypot(u-x,v-z)
            if d<.05:continue
            dx=(v-z)/d*c;dz=(x-u)/d*c
            ring=ogr.Geometry(ogr.wkbLinearRing)
            for px,pz in ((x+dx,z+dz),(x-dx,z-dz),(u-dx,v-dz),(u+dx,v+dz),(x+dx,z+dz)):ring.AddPoint_2D(px,pz)
            poly=ogr.Geometry(ogr.wkbPolygon);poly.AddGeometry(ring);add(poly)
        for x,z in points:add(rect(x-c,z-c,x+c,z+c))
    assert i==len(ro)
    index=json.loads((world/'buildings/index.json').read_text())
    pack=(world/'buildings'/index['file']).read_bytes();assert common.hashlib.sha256(pack).hexdigest()==index['sha256']
    for tile in index['tiles']:
        for q in json.loads(gzip.decompress(pack[tile['offset']:tile['offset']+tile['bytes']]))['features']:
            if not q['footprint']:continue
            x,z=zip(*(p(*ll) for ll in q['footprint']));r=12
            add(rect(min(x)-r,min(z)-r,max(x)+r,max(z)+r))
    raster=gdal.GetDriverByName('MEM').Create('',w,h,1,gdal.GDT_Byte);raster.SetGeoTransform(geo)
    assert gdal.RasterizeLayer(raster,[1],ly,burn_values=[1],options=['ALL_TOUCHED=TRUE'])==0
    return raster.ReadAsArray()!=0

def hedge_mask(world,geo):
    """Block every exact rendered root and conservative full-fade canopy-shadow footprint."""
    w,h=cols*n,rows*n
    ox,dx,_,oz,_,dz=geo
    root=world/'woodland/hedgerows-v1'
    raw=(root/'index.json').read_bytes();m=json.loads(raw)
    assert m['bounds']==[-64.47,45.94,-61.93,47.1] and m['cols']==cols and m['rows']==rows and m['recordBytes']==6
    packs=[]
    for rec in m['packs']:
        b=(root/rec['file']).read_bytes()
        assert len(b)==rec['bytes'] and common.hashlib.sha256(b).hexdigest()==rec['sha256']
        packs.append(b)
    acc=np.zeros((h+1,w+1),np.int32)
    count=0
    for rec in m['tiles']:
        i,j=map(int,rec['id'].split('-'))
        b=rec['offset'];raw=gzip.decompress(packs[rec['pack']][b:b+rec['bytes']])
        assert len(raw)==rec['count']*6 and common.hashlib.sha256(raw).hexdigest()==rec['sha256']
        q=np.frombuffer(raw,dtype=[('x','<u2'),('z','<u2'),('h','u1'),('style','u1')])
        x=(ox+i*n*dx+q['x']/8).astype(np.float32).astype(float)
        z=(oz+j*n*dz+q['z']/8).astype(np.float32).astype(float)
        height=q['h']/4;span=height*np.where(q['style']==1,1.68,1.19)
        ix=np.clip(np.floor((x-.71*span-1-ox)/dx).astype(int),0,w)
        jz=np.clip(np.floor((z-.595*span-1-oz)/dz).astype(int),0,h)
        rx=np.clip(np.floor((x+.43*height+.71*span+1-ox)/dx).astype(int)+1,0,w)
        sz=np.clip(np.floor((z+.21*height+.595*span+1-oz)/dz).astype(int)+1,0,h)
        for xx,zz,k in ((ix,jz,1),(rx,jz,-1),(ix,sz,-1),(rx,sz,1)):
            np.add.at(acc,(zz,xx),k)
        count+=len(q)
    assert count==sum(t['count'] for t in m['tiles']) and count>0
    return np.cumsum(np.cumsum(acc,axis=0,dtype=np.int32),axis=1,dtype=np.int32)[:-1,:-1]!=0

def seeds(world,atlas,out):
    m,base=common.read(world,'terrain');cm,cover=common.read(world,'cover')
    west,south,east,north=m['bounds']
    left,top=p(west,north);right,bottom=p(east,south)
    dx=(right-left)/(n*cols);dz=(bottom-top)/(n*rows)
    geo=(left,dx,0,top,0,dz)
    hard=obstacles(world,geo)|hedge_mask(world,geo)
    yy,xx=np.mgrid[0:rows*n,0:cols*n]
    # All intersections with the original class support are guarded, using
    # a one-cell expansion for a no-change skirt. Raw coast is never replaced.
    candidate=np.full_like(hard,True)
    for ox,oz in ((0,0),(0,1),(1,0),(1,1),(.5,.5)):
        u=(xx+ox)/cols/n;v=(yy+oz)/rows/n
        dist=common.atlas(2*(cover[:,:,1].astype(float)-128),u,v)
        cls=cover[np.minimum((v*cover.shape[0]).astype(int),cover.shape[0]-1),
          np.minimum((u*cover.shape[1]).astype(int),cover.shape[1]-1),0]
        candidate&=(dist>=148)&(cls!=10)&(cls!=50)&(cls!=80)&(cls!=90)&(cls!=95)
    candidate&=~hard
    candidate=minimum_filter(candidate,size=3)
    out.mkdir(parents=True,exist_ok=True);atlasmap=json.loads((atlas/'index.json').read_text())
    ds=gdal.Open(str(atlas/'overview-window.tif'))
    N=atlasmap['intervals'];gx,gz=np.meshgrid(np.linspace(0,1,n+1),np.linspace(0,1,n+1))
    dims=np.arange(n)/n
    stats=[]
    for entry in atlasmap['tiles']:
        i,j=map(int,entry['id'].split('-'))
        ok=candidate[j*n:(j+1)*n,i*n:(i+1)*n].copy()
        ok[0,:]=ok[-1,:]=ok[:,0]=ok[:,-1]=False
        if not ok.any():continue
        # Exact 112 near facets. Source resampling uses the same index-space
        # coordinates that the three.js prototype will request.
        old=common.atlas(base,(i+gx)/cols,(j+gz)/rows,True)
        new=ds.ReadAsArray(i*N,j*N,N+1,N+1)
        sampled=np.where(new>-32766,np.round(new*10),-32768).astype('<i2')
        xx,zz=np.meshgrid((np.arange(n)+.5)/n,(np.arange(n)+.5)/n)
        raw=common.facets(new,xx,zz)
        before=common.facets(old,xx,zz);delta=np.abs(raw-before)
        localGood=minimum_filter(new,size=7)>-32766
        ok&=localGood[np.rint(zz*N).astype(int),np.rint(xx*N).astype(int)]
        significance=maximum_filter(np.where(ok,delta,0.),size=3)
        ok&=significance>0.65
        if not ok.any():continue
        # Sparse/narrow isolated patches often look worse; trim single cells
        # with no sharing, rather than repeating grid-aligned bumps.
        touch=maximum_filter(ok,footprint=np.array([[0,1,0],[1,0,1],[0,1,0]]))
        ok&=touch
        if not ok.any():continue
        result=dict(tile=entry['id'],count=int(ok.sum()),score=float(np.sum(delta[ok])),
          sites_2m=int(np.count_nonzero(ok&(delta>2))),maxDelta=float(np.max(delta[ok])),
          centerWorld=[left+(i+.5)*n*dx,top+(j+.5)*n*dz])
        stats.append(result)
        (out/(entry['id']+'.bin')).write_bytes(np.packbits(ok,bitorder='little').tobytes()+sampled.tobytes())
    stats.sort(key=lambda r:-r['score'])
    (out/'seed-report.json').write_text(json.dumps(stats,indent=2)+'\n')
    print(stats[:8])
if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('world',type=Path);a.add_argument('atlas',type=Path);a.add_argument('out',type=Path)
    q=a.parse_args();seeds(q.world,q.atlas,q.out)
