#!/usr/bin/env python3
"""Exact NRCan atlas ordinals, native roof windows and OSM linkage for Water Street."""
from pathlib import Path
import argparse,gzip,hashlib,json,math,runpy,re,subprocess
import numpy as np
from osgeo import ogr,osr
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
parser.add_argument('--pbf',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
d=parser.parse_args();ROOT,HERE=d.root.resolve(),d.out.resolve()
if hashlib.sha256(d.pbf.read_bytes()).hexdigest()!='a194019961a640669474f9679a23a8fb9a7522d3ff08f0852e61c4d20d6d4bd7':
    parser.error('Wrong archived OSM input')
HERE.mkdir(parents=True,exist_ok=True)
roi=['-63.795','46.3901','-63.787','46.393']
for target,layer,where,cols in (
 ('water-street-osm.gpkg','multipolygons','building IS NOT NULL','osm_id,osm_way_id,building,other_tags'),
 ('water-street-roads.gpkg','lines',"name='Water Street'",'osm_id,highway')):
    dest=HERE/target
    if dest.exists():parser.error('Use a fresh output directory')
    subprocess.run(['ogr2ogr','-f','GPKG',str(dest),str(d.pbf),layer,'-spat',*roi,'-where',where,'-select',cols],check=True)
O=runpy.run_path(str(ROOT/'tools/qa/roof-fit-pilot.py'))
X=runpy.run_path(str(ROOT/'tools/geodata/fit-farm-profiles.py'))
P=ROOT/'public/world/buildings'
spec=json.loads((P/'index.json').read_text());p=(P/spec['file']).read_bytes()
assert hashlib.sha256(p).hexdigest()==spec['sha256']
ext=[-63.7948,46.39055,-63.78715,46.39296]
dsm,dtm,gt,transform=O['open_models']()
print('opened authoritative aligned COGs',gt,flush=True)
t=next(t for t in spec['tiles']if t['id']=='q032001')
f=json.loads(gzip.decompress(p[t['offset']:t['offset']+t['bytes']]))['features']
data={}
paths=ogr.Open(str(HERE/'water-street-osm.gpkg'))
layer=paths.GetLayer(0)
refpaths=[]
for feat in layer:
    fc=feat.GetGeometryRef().Clone();fc.Transform(transform)
    typ=feat.GetField('building')
    id=feat.GetField('osm_way_id') or feat.GetField('osm_id')
    tags=dict(re.findall(r'"([^"]+)"=>"([^"]*)"',feat.GetField('other_tags')or''))
    refpaths.append((fc,typ,id,{k:v for k,v in tags.items() if k in ('addr:housenumber','addr:street','height','building:levels','roof:shape','roof:material','building:material','shop','office','amenity','tourism','historic')}))
rows=[]
for i,a in enumerate(f):
    pp=np.array(a['footprint']);cx,cy=pp.mean(0)
    if not(ext[0]<cx<ext[2] and ext[1]<cy<ext[3]):continue
    fp=np.asarray(transform.TransformPoints(pp.tolist()))[:,:2]
    rr=ogr.Geometry(ogr.wkbLinearRing)
    for x,y in fp:rr.AddPoint_2D(x,y)
    rr.CloseRings();g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(rr)
    ar=g.GetArea()
    if ar<12 or not g.IsValid():continue
    minx,maxx,miny,maxy=g.GetEnvelope()
    bounds=(int(math.floor(minx-gt[0]))-3,int(math.floor(gt[3]-maxy))-3,int(math.ceil(maxx-gt[0]))+3,int(math.ceil(gt[3]-miny))+3)
    xml=g.GetEnvelope()
    match=[]
    for os,typ,oid,attrs in refpaths:
        x1,x2,y1,y2=os.GetEnvelope()
        if x1>maxx or x2<minx or y1>maxy or y2<miny or not os.IsValid():continue
        ov=g.Intersection(os).GetArea()
        if ov<.2*min(ar,os.GetArea()):continue
        match.append((round(ov/ar,3),round(ov/os.GetArea(),3),typ,oid,attrs))
    match.sort(reverse=True)
    rows.append(dict(id=i,centre=[cx,cy],atlas=t['id'],area=round(ar,2),height=a['height'],minHeight=a.get('minHeight'),outline=pp.tolist(),survey=fp.tolist(),bounds=list(bounds),osm=match))
u=min(r['bounds'][0] for r in rows);v=min(r['bounds'][1] for r in rows)
w=max(r['bounds'][2] for r in rows)-u;h=max(r['bounds'][3] for r in rows)-v
a=dsm.ReadAsArray(u,v,w,h);b=dtm.ReadAsArray(u,v,w,h)
x0=gt[0]+u+.5;y0=gt[3]-v-.5
print('window',u,v,w,h,'native first x,y',x0,y0,flush=True)
for r in rows:
    x,y,z,t=r['bounds'];a1=a[y-v:t-v,x-u:z-u];b1=b[y-v:t-v,x-u:z-u]
    coords=np.indices(a1.shape);mx,my=coords[1]+x0+x-u,y0-(coords[0]+y-v)
    mask,margin=X['mask_unit'](np.array(r['survey']),mx,my)
    ok=mask&(margin>1.12)&np.isfinite(a1)&np.isfinite(b1)&(a1-b1>1.15)&(a1-b1<38)
    if not ok.any():continue
    v1=(a1-b1)[ok];r['roofStats']=[round(float(w),3)for w in np.quantile(v1,[.05,.1,.25,.5,.75,.9,.95])];r['n']=int(ok.sum())
    r['m']=(round(float(np.min(b1[ok])),3),round(float(np.max(b1[ok])),3))
    r['sha']=X['fprint'](a1,b1)
np.savez_compressed(HERE/'water-street-dsm-dtm.npz',dsm=a,dtm=b,X=x0,Y=y0,rasterU=u,rasterV=v)
(HERE/'water-street-source-audit.json').write_text(json.dumps(rows,indent=2)+'\n')
for r in sorted(rows,key=lambda q:q['centre'][0]):
    if r['area']<58 or 'roofStats' not in r:continue
    print(str(r['id']).rjust(3),'A=',r['area'],'H=',r['height'],r['roofStats'],'C=',[round(x,7) for x in r['centre']],
          [{str(a):b for a,b in zip(('srcFrac','osmFrac','type','id','tags'),k)}for k in r['osm'][:3]],flush=True)
