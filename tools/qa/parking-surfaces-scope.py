#!/usr/bin/env python3
"""Verify actual emitted surface outlines against independent source/atlas protections."""
import argparse,gzip,importlib.util,json,math
from pathlib import Path
from osgeo import ogr

api=importlib.util.spec_from_file_location('bake',Path(__file__).resolve().parents[1]/'geodata/bake-parking-surfaces.py')
b=importlib.util.module_from_spec(api);api.loader.exec_module(b)
geo=b.geo

def bbox_matches(index,box,reach):
    ids=set()
    for key in index.keys(geo.expanded(box,reach)):ids.update(index.cells.get(key,()))
    for idx in ids:
        a,g,_,_=index.items[idx]
        if a[2]+reach>=box[0] and a[3]+reach>=box[1] and a[0]-reach<=box[2] and a[1]-reach<=box[3]:yield g

def merged(a):
    arr=ogr.Geometry(ogr.wkbMultiPolygon)
    for g in a:
        for ch in b.shapes(g):
            if not ch.IsValid():ch=ch.MakeValid()
            for p in b.shapes(ch):arr.AddGeometry(p)
    return arr.UnionCascaded()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('mesh_report',type=Path);p.add_argument('output',type=Path);p.add_argument('--find-issues',action='store_true')
    a=p.parse_args()
    q=json.loads(a.mesh_report.read_text());api=b.ROOT/'data/odbl/parking-surfaces'
    vector=json.loads(gzip.decompress((api/'sources.json.gz').read_bytes()))
    pinned={k['id']:merged([b.makepoly([[geo.project(*q) for q in a] for a in rr]) for rr in k['coordinates']])
           for k in vector['sources']}
    ids={','.join(map(str,t)):s for t,s in vector['tilePieceSourceIds']}
    roads,structures,*_=geo.obstacles_from_atlas()
    walks,_=b.sidewalk_exclusions()
    land,_=b.land_proof()
    map_before=geo.Obstacles()
    extra=[(k,geo.polygon(p))for k,p in q['extra']]
    probes=0;area=0;min_sep=dict(roads=1e5,structures=1e5,sidewalks=1e5);out=[];danger=[];min_cover=[]
    max_diff=0.;maximum_overlap=0.;overlap_total=0.
    t_safe=0
    for tile in q['rows']:
        model=[0.]*7
        for ii,(mode,core,rim) in enumerate(tile['lots']):
            def convert(j):
                return [b.makepoly([[[tile['ox']+x*.001,tile['oz']+z*.001]for x,z,_ in rr]for rr in p])for p in j]
            shapes=convert(core)+convert(rim)
            shape=merged(shapes)
            if shape.IsEmpty() or not shape.IsValid():raise ValueError(('Broken surface',tile['id'],ii))
            ix=ids[tile['id']][ii];origin=pinned[ix]
            outside=shape.Difference(origin.Buffer(.004,3)).GetArea()
            if outside>2e-5:out.append((ix,outside))
            raw=sum(sum(x.GetArea()for x in b.shapes(g.MakeValid())) for g in shapes)
            model[mode]+=raw
            # Only numerical rounding on a shared edge can produce overlap here.
            maximum_overlap=max(maximum_overlap,raw-shape.GetArea())
            if not land(shape):min_cover.append(ix)
            box=geo.geometry_bounds(shape)
            for name,index in (('roads',roads),('structures',structures),('sidewalks',walks),('other parking',map_before)):
                for g in bbox_matches(index,box,2.):
                    d=shape.Distance(g)
                    if name in min_sep:min_sep[name]=min(min_sep[name],d)
                    if d<1e-7 and shape.Intersection(g).GetArea()>1e-7:danger.append((ix,name,shape.Intersection(g).GetArea()))
            for name,g in extra:
                if shape.Intersection(g).GetArea()>1e-7:danger.append((ix,name,shape.Intersection(g).GetArea()))
            map_before.add([(box[0],box[1]),(box[2],box[3])],shape,0.)
            probes+=1;area+=shape.GetArea()
        for u,v in zip(model,tile['areas']):
            max_diff=max(max_diff,abs(u-v))
            if abs(u-v)>.04:t_safe+=1
    stat=dict(q['stat'],pieces=probes,totalActualAreaM2=area,minProtectedSeparationM=min_sep,
      signedCoverExclusionsMissed=min_cover,sourceOutlineEscapes=out,actualProtectedOverlaps=danger,
      maxWithinRingOverlapM2=maximum_overlap,maxEarcutPlanDeltaM2=max_diff,tilesWithPlanDeltaOver04=t_safe)
    a.output.write_text(json.dumps(stat,indent=2)+'\n')
    print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in stat.items()},indent=2))
    if not a.find_issues:
        assert not (out or danger or min_cover or t_safe or max_diff>.04 or maximum_overlap>.01)

if __name__=='__main__':main()
