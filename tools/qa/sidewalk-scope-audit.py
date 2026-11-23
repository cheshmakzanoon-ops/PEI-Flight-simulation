#!/usr/bin/env python3
"""Check actual mitered-renderer strips against the input road, roof and land data."""
import argparse
from collections import Counter
import gzip
import importlib.util
import json
import math
from pathlib import Path
from osgeo import ogr

api=importlib.util.spec_from_file_location('bake',Path(__file__).resolve().parents[1]/'geodata/bake-sidewalks.py')
geo=importlib.util.module_from_spec(api)
api.loader.exec_module(geo)


def neighbors(index,box,search):
    ids=set()
    for key in index.keys(geo.expanded(box,search)):
        ids.update(index.cells.get(key,()))
    for idx in ids:
        a,g,_,_=index.items[idx]
        if a[2]+search>=box[0] and a[3]+search>=box[1] and a[0]-search<=box[2] and a[1]-search<=box[3]:
            yield idx,g


def linesweep():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('mesh_report',type=Path)
    p.add_argument('output',type=Path)
    p.add_argument('--find-problems',action='store_true')
    args=p.parse_args()
    m=json.loads(args.mesh_report.read_text())
    draw=m['report']
    routes=m['projected']
    root=Path(__file__).resolve().parents[2]
    data=json.loads(gzip.decompress((root/'data/odbl/sidewalks/mapped-sidewalks.json.gz').read_bytes()))
    fragments=data['fragmentsXZcm']
    exact={w['id']:geo.line([geo.project(*p) for p in w['coordinates']]) for w in data['ways']}
    r,b,_,_=geo.obstacles_from_atlas()
    contains,_=geo.covers()
    walked=geo.Obstacles()
    metadata=[]
    stats=Counter()
    max_source=0.;min_road=1e5;min_build=1e5;signed_miss=[];crossings=[];scope=[];length=0
    for rec,source in zip(routes,fragments,strict=True):
        assert rec['style']==source[0]
        points=rec['points'];src=ogr.Geometry(ogr.wkbMultiLineString)
        for wid in source[4]:src.AddGeometry(exact[wid])
        for xy in points:
            pt=ogr.Geometry(ogr.wkbPoint);pt.AddPoint_2D(*xy)
            max_source=max(max_source,src.Distance(pt))
        for j,(a,c) in enumerate(zip(points,points[1:])):
            length+=math.dist(a,c)
            for s in range(1,4):
                q=geo.interpolate(a,c,s/4)
                pt=ogr.Geometry(ogr.wkbPoint);pt.AddPoint_2D(*q)
                max_source=max(max_source,src.Distance(pt));stats['sourceAlignmentSamples']+=1
        for i,q in enumerate(rec['quads']):
            ident=rec['id']+':'+str(i)
            g=geo.polygon(q)
            assert g.IsValid() and not g.IsEmpty(),ident
            box=geo.bounds(q)
            for index,name in ((r,'road'),(b,'building')):
                for _,test in neighbors(index,box,3):
                    d=g.Distance(test)
                    if name=='road':min_road=min(d,min_road)
                    elif name=='building':min_build=min(d,min_build)
                    if d==0. and g.Intersects(test) and g.Intersection(test).GetArea()>1e-7:
                        scope.append((name,ident,g.Intersection(test).GetArea()))
            for idx,other in neighbors(walked,box,.001):
                if g.Intersects(other):
                    overlap=g.Intersection(other).GetArea()
                    if overlap>2e-7:crossings.append((ident,metadata[idx],overlap))
            walked.add(q,g,0.)
            metadata.append(ident)
            # Sample full strip cover in bounded spans (its conservative
            # endpoint cross section captures both miter overhangs).
            l=max(math.dist(q[0],q[3]),math.dist(q[1],q[2]))
            n=max(1,math.ceil(l/1));s=q[0];v=q[1]
            for j in range(n):
                u=geo.interpolate(q[0],q[3],(j+1)/n)
                y=geo.interpolate(q[1],q[2],(j+1)/n)
                box=geo.bounds([s,v,u,y]);stats['landWholeStripIntervals']+=1
                if not contains(box[:2],box[2:],.0005):signed_miss.append(ident)
                s,v=u,y
            stats['quads']+=1
    result=dict(**stats,**{k:draw[k] for k in ('paths','pathSpans','rejected','topTris','wallTris','maxSlopeGroundError','wrongWinding')},
                minRoadSeparationM=min_road,minBuildingSeparationM=min_build,maxSourceCentrelineErrorM=max_source,
                roundedSourceLengthM=length,overlappingFootprints=crossings,protectedGeometryIntrusions=scope,
                signedCoverProofFailures=signed_miss)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in result.items()},indent=2))
    if not args.find_problems:
        assert not crossings and not scope and not signed_miss and not draw['rejected'] and max_source<.014

if __name__=='__main__':linesweep()
