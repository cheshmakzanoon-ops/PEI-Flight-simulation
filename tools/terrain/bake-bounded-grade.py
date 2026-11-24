"""Pack game-aligned measured relief without touching its inherited terrain fence."""
import gzip, json, math, hashlib, argparse
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from pyproj import Transformer

def bake(native,proposal,world,out):
    support=np.load(native)
    grade=np.load(proposal)
    ox,oy=map(float,support['upper_left_3979'])
    limit=support['allow']
    # Native support is reserved for the whole adjacent game triangle, not
    # merely for where the moved vertex was sampled in the source.
    clear=ndi.distance_transform_edt(limit)
    height=json.loads((world/'terrain.json').read_text())
    raw=gzip.decompress((world/height['file']).read_bytes())
    assert hashlib.sha256(raw).hexdigest()==height['sha256']
    image=np.frombuffer(raw,'<i2').reshape(height['height'],height['width'])
    west,south,east,north=height['bounds']
    a=6378137*math.pi/180;phi=math.radians(46.5);ecc=.00669437999014;t=1-ecc*math.sin(phi)**2
    sx=a*math.cos(phi)/math.sqrt(t);sz=a*(1-ecc)/t**1.5
    left=(west+63.2)*sx;top=(46.5-north)*sz
    spanX=(east-west)*sx;spanZ=(north-south)*sz
    tileW=spanX/32;tileH=spanZ/22;parentW=tileW/112;parentH=tileH/112
    to_ll=Transformer.from_crs(3979,4326,always_xy=True)
    to_local=Transformer.from_crs(4326,3979,always_xy=True)
    jj,ii=np.nonzero(limit)
    lon,lat=to_ll.transform(ox+ii+.5,oy-jj-.5)
    sampleX=(lon+63.2)*sx;sampleZ=(46.5-lat)*sz
    i=int((sampleX.mean()-left)//tileW);j=int((sampleZ.mean()-top)//tileH)
    x0=left+i*tileW;z0=top+j*tileH
    u0=math.floor((sampleX.min()-x0)/parentW);v0=math.floor((sampleZ.min()-z0)/parentH)
    u1=math.ceil((sampleX.max()-x0)/parentW);v1=math.ceil((sampleZ.max()-z0)/parentH)
    if not (0<u0<u1<112 and 0<v0<v1<112):raise ValueError('Crosses parent terrain boundary.')
    sub=32
    nx=(u1-u0)*sub+1;nz=(v1-v0)*sub+1
    stepX,stepZ=parentW/sub,parentH/sub
    xx,zz=np.meshgrid(x0+(u0+np.arange(nx)/sub)*parentW,z0+(v0+np.arange(nz)/sub)*parentH)
    e,n=to_local.transform(xx/sx-63.2,46.5-zz/sz)
    ns=[oy-n-.5,e-ox-.5]
    def native_at(a):return ndi.map_coordinates(a,ns,order=1,prefilter=False,mode='constant',cval=0)
    reserve=np.hypot(stepX,stepZ)+.74
    approved=native_at(clear)>reserve
    # Validate the entire projected rectangle incident on each moved
    # vertex. Its native bounding box conservatively contains all its
    # triangles, including both branches of the fixed gameplay diagonal.
    corners=[to_local.transform((xx+x)/sx-63.2,46.5-(zz+z)/sz)
             for x in (-stepX,stepX) for z in (-stepZ,stepZ)]
    all_e,all_n=map(np.asarray,zip(*corners))
    pad=.001
    j0=np.floor(oy-all_n.max(axis=0)-pad).astype(int)
    j1=np.floor(oy-all_n.min(axis=0)+pad).astype(int)
    i0=np.floor(all_e.min(axis=0)-ox-pad).astype(int)
    i1=np.floor(all_e.max(axis=0)-ox+pad).astype(int)
    within=(j0>=0)&(i0>=0)&(j1<limit.shape[0])&(i1<limit.shape[1])
    valid=np.zeros(approved.shape,dtype=bool)
    for rr,cc in zip(*np.nonzero(approved&within)):
        valid[rr,cc]=limit[j0[rr,cc]:j1[rr,cc]+1,i0[rr,cc]:i1[rr,cc]+1].all()
    approved&=valid
    approved[[0,-1]]=False;approved[:,[0,-1]]=False
    def atlas(xx,zz):
        ux=np.clip((xx-left)/spanX*image.shape[1]-.5,0,image.shape[1]-1)
        uz=np.clip((zz-top)/spanZ*image.shape[0]-.5,0,image.shape[0]-1)
        iy=np.minimum(np.floor(uz).astype(int),image.shape[0]-2)
        ix=np.minimum(np.floor(ux).astype(int),image.shape[1]-2)
        dx=ux-ix;dz=uz-iy
        values=np.stack([image[iy,ix],image[iy,ix+1],image[iy+1,ix],image[iy+1,ix+1]])
        weights=np.stack([(1-dx)*(1-dz),dx*(1-dz),(1-dx)*dz,dx*dz])*(values!=-32768)
        return np.divide((values*weights).sum(0),weights.sum(0),out=np.zeros(values.shape[1:],dtype=float),where=weights.sum(0)>0)
    col=np.arange(nx)/sub;row=np.arange(nz)/sub
    ci=np.minimum(col.astype(int),u1-u0-1);ri=np.minimum(row.astype(int),v1-v0-1)
    dx=(col-ci)[None,:];dz=(row-ri)[:,None]
    bx=x0+(u0+ci[None,:])*parentW;bz=z0+(v0+ri[:,None])*parentH
    nw=atlas(bx,bz);ne=atlas(bx+parentW,bz);sw=atlas(bx,bz+parentH);se=atlas(bx+parentW,bz+parentH)
    wind=np.where(dx+dz<=1,nw+(ne-nw)*dx+(sw-nw)*dz,se+(sw-se)*(1-dx)+(ne-se)*(1-dz))+.12
    raw_delta=native_at(grade['relative_delta'])
    edges=ndi.binary_dilation(approved,structure=np.ones((3,3),bool))&~approved
    outside=np.column_stack((xx[edges],zz[edges]));outsideY=wind[edges]
    y=np.column_stack((xx[approved],zz[approved]))
    cap=np.empty(len(y))
    for q in range(0,len(y),128):
        d=np.linalg.norm(y[q:q+128,None,:]-outside[None,:,:],axis=-1)
        cap[q:q+len(d)]=np.min(outsideY[None,:]+.105*d,axis=1)
    surface=np.zeros_like(wind);surface[approved]=np.maximum(0,np.minimum(raw_delta[approved],cap-wind[approved]))
    quant=np.floor(surface*100+1e-9).astype('<i2')
    groundweight=np.zeros_like(quant,dtype=np.uint8)
    blend=native_at(grade['physical_blend'])
    groundweight[quant>0]=np.maximum(1,np.round(blend[quant>0]*255)).astype(np.uint8)
    data=quant.tobytes()+groundweight.tobytes()
    out.write_bytes(gzip.compress(data,compresslevel=9,mtime=0))
    shape=dict(id='green-gables-southwest-measured-grade',kind='inland',tileX=i,tileZ=j,firstX=u0,firstZ=v0,cellsX=u1-u0,cellsZ=v1-v0,
              sub=sub,relativeToParent=True,sha256=hashlib.sha256(data).hexdigest(),nativeSampleReserveMetres=reserve)
    actual_y=wind+quant*.01
    dsX=np.diff(actual_y,axis=1)/stepX;dsZ=np.diff(actual_y,axis=0)/stepZ
    positive=quant>0
    alters=positive[:-1,:-1]|positive[1:,:-1]|positive[:-1,1:]|positive[1:,1:]
    slopes=np.r_[np.hypot(dsX[:-1],dsZ[:,:-1])[alters],np.hypot(dsX[1:],dsZ[:,1:])[alters]]
    print(json.dumps(dict(shape=shape,dimensionsXY=[nx,nz],sampleSpacingXY=[stepX,stepZ],positive=int(positive.sum()),
       maxRelMetres=float(quant.max()/100),triangleSlopeRatios=np.quantile(slopes,[.5,.9,.95,1.]).tolist(),
       addedTriangles=2*((nx-1)*(nz-1)-(u1-u0)*(v1-v0)),decodedBytes=len(data),wireBytes=out.stat().st_size),indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('native','design','world','out'):p.add_argument(name,type=Path)
    a=p.parse_args()
    bake(a.native,a.design,a.world,a.out)
