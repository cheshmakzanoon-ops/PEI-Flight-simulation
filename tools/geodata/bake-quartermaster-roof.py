#!/usr/bin/env python3
"""Rebuild one measured stepped roof, keeping the precise existing footprint.

The evidence census is a committed OGL derivative of a bounded COPC/DSM query.
No network, photos, neighbouring models, changed ground, or geometry outside the
single original polygon. Exterior/edge infill is explicitly reconciling surfaces.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage as nd
from osgeo import gdal,ogr,osr

gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
ROOT=Path(__file__).resolve().parents[2]
S=ROOT/'data/roof-tiers'
atlas=ROOT/'public/world/buildings'
meta=json.loads((S/'quartermaster-roof-cells.json').read_text())
source=json.loads((atlas/'index.json').read_text())
pack=(atlas/'tiles.pack').read_bytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
if sha(pack)!=meta['buildingAtlas'] or source['sha256']!=meta['buildingAtlas']:
    raise ValueError('The source footprint atlas changed')
tile=next(t for t in source['tiles'] if t['id']==meta['tile'])
feat=json.loads(gzip.decompress(pack[tile['offset']:tile['offset']+tile['bytes']]))['features'][meta['featureIndex']]
if feat['footprint']!=meta['sourceFootprint'] or feat.get('holes'):
    raise ValueError('Original footprint changed or was split')
blob=(S/meta['file']).read_bytes()
raw=gzip.decompress(blob)
if sha(blob)!=meta['compressedSha256'] or sha(raw)!=meta['sha256'] or len(raw)!=meta['bytes']:
    raise ValueError('Unexpected evidence census bytes')
rows=np.frombuffer(raw,'<i2').reshape(-1,6)
if len(rows)!=meta['rows']:raise ValueError('Unexpected evidence grid')

# Distinct coherent terraces found in the measured source. The actual terrace
# elevations are robust medians of qualified class-6 cores, rounded to cm.
PRIORS=np.array([9.10,10.60,13.94,14.95,28.70,37.13,42.75])
X,Y=rows[:,:2].T.astype(np.int32)+6;df=rows[:,2]/100;n=rows[:,3];M=rows[:,4]/100;spread=rows[:,5]/100
origin=(meta['grid']['offsetXY'][0]-6,meta['grid']['offsetXY'][1]-6)
shape=(int(Y.max())+7,int(X.max())+7)
label=abs(M[:,None]-PRIORS).argmin(axis=1)
qual=(n>=3)&(spread<.85)&(abs(M-df)<=.65)&(abs(M-PRIORS[label])<=1.40)
MIN_COMPONENT=16
MAX_INFILL=3.75

def build(train):
    grid=np.full(shape,-1,dtype=np.int16)
    grid[Y[qual&train],X[qual&train]]=label[qual&train]
    for k in range(len(PRIORS)):
        c,_=nd.label(grid==k,np.ones((3,3)))
        size=np.bincount(c.ravel())
        grid[(c!=0)&(size[c]<MIN_COMPONENT)]=-1
    active=(grid[Y,X]>=0)
    choices=[np.round(float(np.median(M[active&(label==i)])),2) for i in range(len(PRIORS))]
    if not np.all(np.diff(choices)>.75):raise ValueError('Unstable/no separate evidence for a tier')
    d,w=nd.distance_transform_edt(grid<0,return_indices=True)
    pop=np.where(d<=MAX_INFILL,grid[tuple(w)],0).astype(np.int16)
    pop=nd.median_filter(pop,size=3)
    return pop,d,grid,np.array(choices)

def summary(a):
    q=np.abs(a)
    return dict(n=len(a),medianM=round(float(np.median(q)),5),p90M=round(float(np.quantile(q,.9)),5),
        p95M=round(float(np.quantile(q,.95)),5),within1m=int((q<=1).sum()))

# Block holdout checks both label assignment and robust band heights. Training
# never sees the classified returns inside each withheld 4×4 m group. Evaluate
# against the same locations in the DSM (not an independent acquisition).
folds=((X+origin[0])//4+3*((Y+origin[1])//4))%5
heldout=np.full(len(rows),np.nan)
for k in range(5):
    train=(folds!=k)
    fill,d,g,heights=build(train)
    heldout[~train]=heights[fill[Y[~train],X[~train]]]
fill,d,g,heights=build(np.ones(len(rows),dtype=bool))
active=(g[Y,X]>=0)
if np.sum(active)<8_900:raise ValueError('Insufficient classified support after connected-component filtering')
report=dict(reviewSource='1m DSM interior cross-checked with class-6 COPC; same capture, different representations',
  dsmInterior=len(rows),with3PointReturns=int((n>=3).sum()),
  copcAgreement3=summary((M-df)[n>=3]),copcAgreementStable3=summary((M-df)[(n>=3)&(spread<.85)]),
  admittedSeeds=int(active.sum()),suppressedOrUncertainInterior=int((~active).sum()),
  noNearSeedInterior=int((d[Y,X]>MAX_INFILL).sum()),maxModelInfillDistanceM=MAX_INFILL,
  holdoutAllDSM=summary(heldout-df),holdoutStableConsensus=summary((heldout-df)[active]),
  tiers=[dict(roofY=float(h),class6CoreCells=int(np.count_nonzero(active&(label==k))),
      dsmInteriorPredicted=int(np.count_nonzero(fill[Y,X]==k))) for k,h in enumerate(heights)])

NATIVE,WGS=osr.SpatialReference(),osr.SpatialReference()
NATIVE.ImportFromEPSG(3979);WGS.ImportFromEPSG(4326)
for s in (NATIVE,WGS):s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
to_wgs=osr.CoordinateTransformation(NATIVE,WGS)
to_native=osr.CoordinateTransformation(WGS,NATIVE)
world_anchor=(5970.,29816.)
a,e2,rad=6378137.,6.69437999014e-3,math.pi/180;lat=46.5*rad
fac=1-e2*math.sin(lat)**2
mx=a*rad*math.cos(lat)/math.sqrt(fac);mz=a*rad*(1-e2)/fac**1.5
def project(x,y):return (x+63.2)*mx-world_anchor[0],(46.5-y)*mz-world_anchor[1]
def ring(points):
    o=ogr.Geometry(ogr.wkbLinearRing)
    for x,y in points:o.AddPoint_2D(float(x),float(y))
    o.CloseRings()
    return o
def shape_from(points):
    o=ogr.Geometry(ogr.wkbPolygon);o.AddGeometry(ring(points));return o
def polygons(v):
    if v is None or v.IsEmpty():return
    if v.GetGeometryName()=='POLYGON':
        if v.GetArea()>.000025:yield v
    else:
        for i in range(v.GetGeometryCount()):yield from polygons(v.GetGeometryRef(i))
def coords(v):
    result=[]
    for g in polygons(v):
        rr=[]
        for k in range(g.GetGeometryCount()):
            r=g.GetGeometryRef(k)
            q=[[round(x,5),round(y,5)] for x,y,*_ in r.GetPoints()[:-1]]
            if len(set(map(tuple,q)))<3:continue
            rr.append(q)
        if rr:result.append(rr)
    return result

PRECISION=.00001  # GEOS snap-rounding before we serialize contours.
source_outline=shape_from([project(*q) for q in feat['footprint']]).SetPrecision(PRECISION)
def traced(mask):
    # Natives row index is northward; align GDAL's grid to the actual DSM cells.
    win=gdal.GetDriverByName('MEM').Create('',shape[1],shape[0],1,gdal.GDT_Byte)
    win.SetGeoTransform((origin[0],1,0,origin[1]+shape[0],0,-1))
    band=win.GetRasterBand(1);band.WriteArray(mask[::-1].astype(np.uint8))
    vrt=ogr.GetDriverByName('Memory').CreateDataSource('traced')
    layer=vrt.CreateLayer('traced',NATIVE,ogr.wkbPolygon)
    gdal.Polygonize(band,band,layer,-1,[],callback=None)
    multi=ogr.Geometry(ogr.wkbMultiPolygon)
    for feat in layer:
        g=feat.GetGeometryRef()
        if g.GetArea()<MIN_COMPONENT:continue
        for part in polygons(g.SimplifyPreserveTopology(.88)):
            p=ogr.Geometry(ogr.wkbPolygon)
            for i in range(part.GetGeometryCount()):
                r=part.GetGeometryRef(i).GetPoints()[:-1]
                p.AddGeometry(ring([project(*s[:2]) for s in to_wgs.TransformPoints(r)]))
            if not p.IsValid():p=p.MakeValid()
            for piece in polygons(p):
                if piece.GetArea()>=MIN_COMPONENT:multi.AddGeometry(piece)
    return multi.UnionCascaded() if multi.GetGeometryCount() else multi

# Level k is the union of surfaces at or above that tier. Nested state enforces
# exact shared seams when we subtract the level above. The base always keeps
# the exact original outline; the upper support never extends beyond it.
masks=[source_outline]
for k in range(1,len(heights)):
    nested=traced(fill>=k).Intersection(masks[-1]).SetPrecision(PRECISION)
    if not nested or nested.IsEmpty() or not nested.IsValid():raise ValueError('No valid supported tier perimeter')
    masks.append(nested)
planes=[]
for k,h in enumerate(heights):
    own=masks[k].Difference(masks[k+1]).SetPrecision(PRECISION) if k+1<len(heights) else masks[k]
    if not own.IsValid():raise ValueError('Roof tier topology did not survive quantization')
    top=coords(own);risers=coords(masks[k])
    if not top:raise ValueError('A tier has no top')
    planes.append(dict(y=float(h),top=top,risers=risers))
    report['tiers'][k].update(areaM2=round(own.GetArea(),3),components=len(top))

def actual(xc,yc):
    e,n=project(*to_wgs.TransformPoint(float(xc),float(yc))[:2])
    pt=ogr.Geometry(ogr.wkbPoint);pt.AddPoint_2D(e,n)
    for i in reversed(range(len(masks))):
        if masks[i].Intersects(pt):return heights[i]
    raise ValueError('An interior DSM cell fell outside the source building')
final=np.array([actual(x+origin[0]+.5,y+origin[1]+.5) for x,y in zip(X,Y,strict=True)])
report['serializedModelAllDSM']=summary(final-df)
report['serializedModelStableDSM']=summary((final-df)[active])
report['serializedModelStableCOPC']=summary((final-M)[active])
report['sourceOutlineM2']=round(source_outline.GetArea(),3)
# A small exact surveyed transform witness permits the TypeScript test to put
# all raster cells onto the actual render triangles without another CRS library.
ox,oy=meta['grid']['offsetXY'];unit=250.
def survey_projection(x,y):
    wx,wz=project(*to_wgs.TransformPoint(x,y)[:2])
    return np.array([wx,wz])+np.array(world_anchor)
q0=survey_projection(ox+.5,oy+.5)
dx=(survey_projection(ox+.5+unit,oy+.5)-q0)/unit
dy=(survey_projection(ox+.5,oy+.5+unit)-q0)/unit
max_err=max(np.linalg.norm(survey_projection(ox+.5+a,oy+.5+b)-q0-dx*a-dy*b) for a,b in rows[:,:2])
if max_err>.003:raise ValueError('Native-to-render test witness exceeds the 3mm local approximation limit')
report['qaProjection']={'worldOriginXZ':q0.tolist(),'eastStepXZ':dx.tolist(),'northStepXZ':dy.tolist(),'maxErrorM':max_err}

report['unknownRegions']='3.75m native nearest-core limit before 1m masking/generalization; otherwise use the supported lowest terrace within the exact original footprint'

data=dict(atlasSha256=meta['buildingAtlas'],sourceTileId=meta['tile'],sourceFeatureIndex=meta['featureIndex'],
          sourceFootprint=meta['sourceFootprint'],evidenceSha256=meta['sha256'],originXZ=world_anchor,levels=planes)
encoded=json.dumps(data,separators=(',',':'))
out=ROOT/'src/render/quartermaster-roof.generated.ts'
out.write_text('// Generated by tools/geodata/bake-quartermaster-roof.py. Do not edit.\nexport const QUARTERMASTER_ROOF = '+encoded+' as const;\n')
report['modelDataSha256']=sha(encoded.encode())
(ROOT/'docs/qa/quartermaster-roof-gate.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
