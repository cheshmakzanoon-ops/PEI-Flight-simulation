#!/usr/bin/env python3
"""Fit one Souris roof from a pinned DSM / classified LiDAR census, offline."""
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage as nd, optimize
from osgeo import gdal,ogr,osr

gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
ROOT=Path(__file__).resolve().parents[2]
R=ROOT/'data/roof-tiers'
meta=json.loads((R/'souris-roof-cells.json').read_text())
atlas=ROOT/'public/world/buildings'
manifest=json.loads((atlas/'index.json').read_text())
pack=(atlas/'tiles.pack').read_bytes()
sha=lambda x:hashlib.sha256(x).hexdigest()
if meta['buildingAtlas']!=manifest['sha256'] or sha(pack)!=meta['buildingAtlas']:raise ValueError('Changed source atlas')
tile=next(t for t in manifest['tiles'] if t['id']==meta['tile'])
f=json.loads(gzip.decompress(pack[tile['offset']:tile['offset']+tile['bytes']]))['features'][meta['featureIndex']]
if f['footprint']!=meta['sourceFootprint'] or f.get('holes'):raise ValueError('Unreviewed outline')
blob=(R/meta['file']).read_bytes();raw=gzip.decompress(blob)
if sha(blob)!=meta['compressedSha256'] or sha(raw)!=meta['sha256'] or len(raw)!=meta['bytes']:raise ValueError('Changed census')
rows=np.frombuffer(raw,'<i2').reshape(-1,6)
ix,iy,dm,n,cm,spread=rows.T.astype(np.int32)
ox,oy=meta['grid']['offsetXY'];X=ix+ox+.5;Y=iy+oy+.5
P=np.column_stack((X,Y));origin=P.mean(axis=0);p=P-origin
df,m=dm*.01,cm*.01
stable=(n>=3)&(spread<80)&(abs(dm-cm)<=50)
label=np.full(len(rows),-1,dtype=np.int16)
label[stable&(m>23)&(m<28.3)]=0
label[stable&(m>39.5)&(m<44.5)]=1
label[stable&(m>=44.5)&(m<52.)]=2
gx,gy=ix.astype(int)+6,iy.astype(int)+6
size=(gy.max()+7,gx.max()+7)
xmin,ymin=ox-6,oy-6
MAX_INFILL=3.15;MIN_UPPER_COMPONENT=16
W,N=osr.SpatialReference(),osr.SpatialReference()
W.ImportFromEPSG(4326);N.ImportFromEPSG(3979)
for s in (W,N):s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_native=osr.CoordinateTransformation(W,N)
to_wgs=osr.CoordinateTransformation(N,W)
ring_native=np.array(to_native.TransformPoints(f['footprint']))[:,:2]
paths=np.roll(ring_native,-1,axis=0)-ring_native
long=paths[np.argmax(np.linalg.norm(paths,axis=1))]
theta=(math.atan2(-long[0],long[1])+math.pi/2)%math.pi-math.pi/2

def roof(q,p):
    ang,across,crest,sl,sr=q
    d=p@np.array([math.cos(ang),math.sin(ang)])-across
    return crest-np.maximum(-d,0)*sl-np.maximum(d,0)*sr

def fit(train):
    which=train&(label==0)
    xx,h=p[which],m[which]
    u=xx@np.array([math.cos(theta),math.sin(theta)])
    q=[theta,float(np.median(u[h>=np.quantile(h,.87)])),float(np.quantile(h,.9)),.07,.035]
    bounds=([theta-.14,u.min()+3,h.max()-2,.002,.002],[theta+.14,u.max()-3,h.max()+1,.72,.72])
    out=optimize.least_squares(lambda s:roof(s,xx)-h,q,bounds=bounds,loss='soft_l1',f_scale=.15,max_nfev=50)
    if not out.success:raise ValueError('No stable gable fit')
    return out.x

def fill_groups(train):
    g=np.full(size,-1,dtype=np.int16)
    g[gy[train],gx[train]]=label[train]
    for k in (1,2):
        comp,_=nd.label(g==k,np.ones((3,3)))
        sizes=np.bincount(comp.ravel())
        g[(comp>0)&(sizes[comp]<MIN_UPPER_COMPONENT)]=-1
    accepted=(g[gy,gx]>=0)
    dist,ind=nd.distance_transform_edt(g<0,return_indices=True)
    groups=nd.median_filter(np.where(dist<=MAX_INFILL,g[tuple(ind)],0),size=3)
    heights=[None]+[round(float(np.median(m[accepted&(label==i)])),2) for i in (1,2)]
    return groups,accepted,heights,dist

def summary(values):
    a=np.abs(values)
    return dict(n=len(a),p50=round(float(np.median(a)),5),p90=round(float(np.quantile(a,.9)),5),
      p95=round(float(np.quantile(a,.95)),5),within1m=int(np.sum(a<=1.)))
folds=((X//4+3*(Y//4)).astype(int))%5
blend=np.zeros(len(rows));gableErr=[];planarErr=[];flatErr=[];shapeQ=[]
for k in range(5):
    train=folds!=k;hold=~train;predict=fit(train);groups,s,heights,_=fill_groups(train)
    estimate=roof(predict,p[hold]);group=groups[gy[hold],gx[hold]]
    for i in (1,2):estimate[group==i]=heights[i]
    blend[hold]=estimate
    stablehold=hold&(label==0);stabletrain=train&(label==0)
    q=p[stablehold]
    gableErr.extend(roof(predict,q)-m[stablehold])
    uv=np.c_[np.ones(stabletrain.sum()),p[stabletrain]]
    plane=np.linalg.lstsq(uv,m[stabletrain],rcond=None)[0]
    planarErr.extend(np.c_[np.ones(stablehold.sum()),q]@plane-m[stablehold])
    flatErr.extend(np.median(m[stabletrain])-m[stablehold])
    shapeQ.append(predict.tolist())
if summary(gableErr)['p90']>.20 or summary(gableErr)['p90']>=.5*summary(planarErr)['p90']:
    raise ValueError('Wait for a measured ridge; do not replace with an uncertain fit')
rq=fit(np.ones(len(rows),dtype=bool))
group,accepted,height,dist=fill_groups(np.ones(len(rows),dtype=bool))
height[0]=float(round(rq[2],5))
if not 16<=int(np.sum(accepted&(label==2)))<=1000 or height[1]<height[0]+8 or height[2]<height[1]+3:
    raise ValueError('Unexpected upper structures')
points=f['footprint']
corner=np.mean(points,axis=0)
A,e2,rad=6378137.,6.69437999014e-3,math.pi/180;lat=46.5*rad
w=1-e2*math.sin(lat)**2
xm=A*rad*math.cos(lat)/math.sqrt(w);zm=A*rad*(1-e2)/w**1.5
anchor=np.rint([(corner[0]+63.2)*xm,(46.5-corner[1])*zm]).astype(int)
def proj(lon,lat):return (lon+63.2)*xm-anchor[0],(46.5-lat)*zm-anchor[1]
def from_world(x,z):return (x+anchor[0])/xm-63.2,46.5-(z+anchor[1])/zm
def offset(x,z):
    Native=np.array(to_native.TransformPoint(*from_world(x,z))[:2])-origin
    return Native@np.array([math.cos(rq[0]),math.sin(rq[0])])-rq[1]
d0=offset(0.,0.);vx=(offset(1.,0.)-offset(-1.,0.))*.5;vz=(offset(0.,1.)-offset(0.,-1.))*.5
mag=math.hypot(vx,vz);nx,nz=vx/mag,vz/mag
crest=anchor-(d0/mag)*np.array([nx,nz])
mainRidge=dict(originXZ=np.round(crest,8).tolist(),normalXZ=[round(nx,10),round(nz,10)],
               leftSlope=round(float(rq[3])*mag,9),rightSlope=round(float(rq[4])*mag,9))
nativeSense=np.array([proj(*ll[:2]) for ll in to_wgs.TransformPoints(P.tolist())])
cross=(nativeSense+anchor-crest)@np.array([nx,nz])
transferred=height[0]-np.maximum(-cross,0)*mainRidge['leftSlope']-np.maximum(cross,0)*mainRidge['rightSlope']
ridgeError=np.max(abs(transferred-roof(rq,p)))
if ridgeError>.002:raise ValueError('Render coordinates distort the measured ridge')

prec=.00001
def ring(pts):
    g=ogr.Geometry(ogr.wkbLinearRing)
    for x,z in pts:g.AddPoint_2D(float(x),float(z))
    g.CloseRings();return g
def polygon(pts):
    g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(ring(pts));return g
def polys(g):
    if g is None or g.IsEmpty():return
    if g.GetGeometryName()=='POLYGON':
        if g.GetArea()>.000025:yield g
    else:
        for i in range(g.GetGeometryCount()):yield from polys(g.GetGeometryRef(i))
def vertices(g):
    return [[[[round(x,5),round(z,5)] for x,z,*_ in poly.GetGeometryRef(i).GetPoints()[:-1]]
            for i in range(poly.GetGeometryCount())] for poly in polys(g)]
def shell(supported):
    r=gdal.GetDriverByName('MEM').Create('',int(size[1]),int(size[0]),1,gdal.GDT_Byte)
    r.SetGeoTransform((int(xmin),1,0,int(ymin+size[0]),0,-1))
    band=r.GetRasterBand(1);band.WriteArray(supported[::-1].astype('u1'))
    ds=ogr.GetDriverByName('Memory').CreateDataSource('shell')
    m=ds.CreateLayer('positive',N,ogr.wkbPolygon)
    gdal.Polygonize(band,band,m,-1,[],callback=None)
    result=ogr.Geometry(ogr.wkbMultiPolygon)
    for o in m:
        p=o.GetGeometryRef()
        if p.GetArea()<MIN_UPPER_COMPONENT:continue
        for part in polys(p.SimplifyPreserveTopology(.85)):
            word=ogr.Geometry(ogr.wkbPolygon)
            for i in range(part.GetGeometryCount()):
                ll=to_wgs.TransformPoints(part.GetGeometryRef(i).GetPoints()[:-1])
                word.AddGeometry(ring([proj(*q[:2]) for q in ll]))
            if not word.IsValid():word=word.MakeValid()
            for g in polys(word):
                if g.GetArea()>MIN_UPPER_COMPONENT:result.AddGeometry(g)
    return result.UnionCascaded()

tiers=[polygon([proj(*pt) for pt in points]).SetPrecision(prec)]
for k in (1,2):
    higher=shell(group>=k).Intersection(tiers[-1]).SetPrecision(prec)
    if not higher or higher.IsEmpty() or not higher.IsValid():raise ValueError('Invalid upper footprint')
    tiers.append(higher)
levels=[]
areas=[]
for k,h in enumerate(height):
    top=tiers[k].Difference(tiers[k+1]).SetPrecision(prec) if k<2 else tiers[k]
    if not top.IsValid():raise ValueError('Invalid roof plane partition topology')
    levels.append(dict(y=h,top=vertices(top),risers=vertices(tiers[k])))
    areas.append(top.GetArea())

plane=[]
for pX,pZ in nativeSense:
    point=ogr.Geometry(ogr.wkbPoint);point.AddPoint_2D(float(pX),float(pZ))
    hit=[k for k,t in enumerate(tiers) if t.Intersects(point)]
    if not hit:raise ValueError('Interior native cell outside scene footprint')
    plane.append(max(hit))
plane=np.array(plane);testY=transferred.copy()
for k in (1,2):testY[plane==k]=height[k]
D=250.
def witness(x,y):
    v=to_wgs.TransformPoint(x,y)
    return np.array(proj(*v[:2]))+anchor
w0=witness(ox+.5,oy+.5)
px=(witness(ox+.5+D,oy+.5)-w0)/D;py=(witness(ox+.5,oy+.5+D)-w0)/D
err=float(np.max(np.linalg.norm(nativeSense+anchor-(w0+ix[:,None]*px+iy[:,None]*py),axis=1)))
report=dict(reviewSource='Class-6 building returns cross-checked with same-survey NRCan DSM; not an independent flight',
 rawCount=meta['class6']['class6UnwithheldUnique'],allInterior=len(rows),with3Class6=int((n>=3).sum()),
 matchingClass6Three=summary((m-df)[n>=3]),matchingClass6StableThree=summary((m-df)[(n>=3)&(spread<80)]),
 acceptedSourcesByTier=[int(np.count_nonzero(accepted&(label==i)))for i in range(3)],
 uncertainOrExcluded=int((~accepted).sum()),localMaximumEdgeInferenceM=MAX_INFILL,
 holdoutRidge=summary(gableErr),holdoutFlat=summary(flatErr),holdoutPlane=summary(planarErr),
 holdoutWhole=summary(blend-df),wholeMeshVsDSM=summary(testY-df),
 stableConsensusMesh=summary((testY-m)[accepted]),nativeRidgeFit=[float(x) for x in rq],
 nativeRidgeCVFits=shapeQ,sceneCoordinateRidgeWitnessMaxErrorM=float(ridgeError),
 originalOutlineM2=round(tiers[0].GetArea(),3),
 modelPlanAreaM2=[round(u,3)for u in areas],
 qaProjection={'worldOriginXZ':w0.tolist(),'eastStepXZ':px.tolist(),'northStepXZ':py.tolist(),'maxErrorM':err})
result=dict(atlasSha256=meta['buildingAtlas'],sourceTileId=meta['tile'],sourceFeatureIndex=meta['featureIndex'],
  sourceFootprint=points,evidenceSha256=meta['sha256'],originXZ=anchor.tolist(),mainRidge=mainRidge,levels=levels)
payload=json.dumps(result,separators=(',',':'))
(ROOT/'src/render/souris-roof.generated.ts').write_text('// Generated by tools/geodata/bake-souris-roof.py. Do not edit.\nexport const SOURIS_ROOF = '+payload+' as const;\nexport const SOURIS_ROOF_SHA256 = '+json.dumps(sha(payload.encode()))+';\n')
report['modelDataSha256']=sha(payload.encode())
(ROOT/'docs/qa/souris-roof-gate.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
