#!/usr/bin/env python3
"""Build the optional signed-Cover-qualified OSM ground-level sidewalk layer.

Usage: /usr/bin/python3 tools/geodata/bake-sidewalks.py <pinned Geofabrik .pbf>
Requires GDAL/GEOS and NumPy. Writes only the versioned data, receipts and TS manifest.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
import math
import re
import struct
from pathlib import Path
import zlib

import numpy as np
from osgeo import ogr

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT/'public/world'
SOURCE_SHA = 'a194019961a640669474f9679a23a8fb9a7522d3ff08f0852e61c4d20d6d4bd7'
ARCHIVE = 'https://download.geofabrik.de/north-america/canada/prince-edward-island/prince-edward-island-261101.osm.pbf'
KINDS = {'concrete':0,'cement':0,'concrete:plates':1,'paving_stones':2,'brick':3,'sett':4,'asphalt':5}
BOX = 100
TILE = 850
A = 6378137*math.pi/180.
T = 1-.00669437999014*math.sin(math.radians(46.5))**2
MLON = A*math.cos(math.radians(46.5))/math.sqrt(T)
MLAT = A*(1-.00669437999014)/T**1.5
CITIES = [('Charlottetown',-63.132,46.257,5800,150),
          ('Summerside',-63.783,46.402,3300,135),
          ('Montague',-62.651,46.169,3400,150)]
# Conservative grade/footprint exclusions for independently rendered bespoke art, in local metres.
HARBOUR = (5831.22,29705.34,6164.44,29989.80)


def project(lon,lat):
    return (lon+63.2)*MLON,(46.5-lat)*MLAT


def sha(b):
    return hashlib.sha256(b).hexdigest()


def document(dest,node):
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(node,indent=2)+'\n')


def gz(b):
    # Explicit gzip stream is stable between runs on the same zlib API.
    return gzip.compress(b,compresslevel=9,mtime=0)


def bounds(points):
    return min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)


def region(x,z):
    for name,lon,lat,r,width in CITIES:
        p=project(lon,lat)
        if math.hypot(x-p[0],z-p[1])<r:return name,width
    return 'Other PEI',150


def line(points):
    l=ogr.Geometry(ogr.wkbLineString)
    for x,z in points:l.AddPoint_2D(x,z)
    return l


def polygon(points):
    ring=ogr.Geometry(ogr.wkbLinearRing)
    for x,z in points:ring.AddPoint_2D(x,z)
    ring.CloseRings()
    p=ogr.Geometry(ogr.wkbPolygon)
    p.AddGeometry(ring)
    return p


def expanded(box,r):
    return box[0]-r,box[1]-r,box[2]+r,box[3]+r


class Obstacles:
    def __init__(self):
        self.items=[]
        self.cells=defaultdict(list)

    def add(self,points,geometry,base):
        b=bounds(points)
        for key in self.keys(expanded(b,base)):
            self.cells[key].append(len(self.items))
        self.items.append((b,geometry,base,{}))

    def keys(self,b):
        for z in range(math.floor(b[1]/BOX),math.floor(b[3]/BOX)+1):
            for x in range(math.floor(b[0]/BOX),math.floor(b[2]/BOX)+1):
                yield (x,z)

    def clip(self,l,r):
        b=geometry_bounds(l)
        cand=set()
        for key in self.keys(expanded(b,r)):
            cand.update(self.cells.get(key,()))
        for i in sorted(cand):
            a,g,base,memo=self.items[i]
            n=r+base
            if a[2]+n<b[0] or a[3]+n<b[1] or a[0]-n>b[2] or a[1]-n>b[3]:continue
            if n not in memo:memo[n]=g.Buffer(n,8)
            m=memo[n]
            if l.Intersects(m):
                l=l.Difference(m)
                if l.IsEmpty():break
        return l


def geometry_bounds(l):
    a,b,c,d=l.GetEnvelope()
    return (a,c,b,d)


def lines(g):
    if g is None or g.IsEmpty():return
    if g.GetGeometryName()=='LINESTRING':
        yield [(x,z) for x,z,*_ in g.GetPoints()]
    elif g.GetGeometryName() in ('GEOMETRYCOLLECTION','MULTILINESTRING'):
        for ch in g:
            yield from lines(ch)


def keep_length(pts):
    return len(pts)>1 and (n:=length(pts))>=2.5 and math.dist(pts[0],pts[-1])>=1.3 and math.isfinite(n)


def length(pts):
    return sum(math.dist(a,b) for a,b in zip(pts,pts[1:]))


def obstacles_from_atlas():
    roads=Obstacles()
    data=gzip.decompress((WORLD/'roads.bin.gz').read_bytes())
    magic,version,count=struct.unpack_from('>IHI',data)
    assert magic==0x50454952 and version==1
    i=10
    for j in range(count):
        n,flags=struct.unpack_from('>HB',data,i);i+=3
        points=[]
        for u in range(n):
            lon,lat=struct.unpack_from('>II',data,i);i+=8
            points.append(project(lon/1e5-65,lat/1e5+45))
        # Exact baked, rendered plan-view rectangle; terrain elevation never moves its XZ.
        w=[2.,2.8,3.6,4.8,6.4][flags&7]
        for a,b in zip(points,points[1:]):
            x,z=a;u,v=b;L=math.hypot(u-x,v-z)
            if L<.05:continue
            dx=(v-z)/L*w;dz=(x-u)/L*w
            q=[(x+dx,z+dz),(x-dx,z-dz),(u-dx,v-dz),(u+dx,v+dz)]
            roads.add(q,polygon(q),.24)
    assert i==len(data)
    buildings=Obstacles()
    index=json.loads((WORLD/'buildings/index.json').read_text())
    packed=(WORLD/'buildings/tiles.pack').read_bytes()
    assert sha(packed)==index['sha256']
    for tile in index['tiles']:
        part=packed[tile['offset']:tile['offset']+tile['bytes']]
        for f in json.loads(gzip.decompress(part))['features']:
            q=[project(*p) for p in f['footprint']]
            if len(q)<3:continue
            obj=polygon(q)
            # Runtime extrusion always owns both orientations' outer envelope.
            # Keep historic/nested invalid ring records conservative without GEOS errors.
            if not obj.IsValid():
                obj=obj.ConvexHull()
                if obj.GetGeometryName() != 'POLYGON':continue
            buildings.add(q,obj,.66)
    return roads,buildings,index['sha256'],sha(data)


def covers():
    meta=json.loads((WORLD/'cover.json').read_text())
    packed=(WORLD/'cover.bin.gz').read_bytes()
    assert sha(packed)==meta['compressedSha256']
    nx,nz=meta['width'],meta['height']
    w,s,e,n=meta['bounds']
    left,top=project(w,n);right,bottom=project(e,s)
    sx=(right-left)/nx;sz=(bottom-top)/nz
    data=np.frombuffer(gzip.decompress(packed),np.uint8).reshape(nz,nx,2)[:,:,1]
    def good(a,b,r):
        x1,z1,x2,z2=expanded(bounds([a,b]),r)
        if x1<=HARBOUR[2] and x2>=HARBOUR[0] and z1<=HARBOUR[3] and z2>=HARBOUR[1]:return False
        i=math.floor((x1-left)/sx-.5);j=math.floor((z1-top)/sz-.5)
        p=math.floor((x2-left)/sx-.5)+1;q=math.floor((z2-top)/sz-.5)+1
        if i<0 or j<0 or p>=nx or q>=nz:return False
        # Keep off the two independent irregular East/West Point survey pieces.
        # Conservative: their complete renderer atlas tiles are excluded.
        for col,row in ((31,12),(1,9)):
            if (x1<left+(col+1)*(right-left)/32 and x2>left+col*(right-left)/32
                and z1<top+(row+1)*(bottom-top)/22 and z2>top+row*(bottom-top)/22):
                return False
        # Positive entire interpolation support in the *rendered* signed Cover:
        # bilinear interpolation is a convex combination of these very texels.
        return np.min(data[j:q+1,i:p+1]) >= 129
    return good,meta['compressedSha256']


def soil_runs(pts,r,good):
    out=[]
    for a,b in zip(pts,pts[1:]):
        l=math.dist(a,b)
        if l<.045:continue
        n=math.ceil(l/2.)
        u=a
        for k in range(1,n+1):
            v=interpolate(a,b,k/n) if k<n else b
            if good(u,v,r):
                if not out:out=[u]
                elif out[-1]!=u:out.append(u)
                out.append(v)
            elif out:
                yield out;out=[]
            u=v
    if out:yield out


def interpolate(a,b,k):
    return a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k


def similar_end(p,prev):
    return math.dist(p,prev) < .024


def simplify(pts):
    # Remove coastline-sampling subdivisions that have not altered the
    # source polyline (no Douglas-Peucker curve/position approximation).
    out=[]
    for p in pts:
        if out and similar_end(p,out[-1]):continue
        if len(out)>1:
            a,b=out[-2:]
            area=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
            if abs(area)<1e-7 and (b[0]-a[0])*(p[0]-b[0])+(b[1]-a[1])*(p[1]-b[1])>0:
                out[-1]=p;continue
        out.append(p)
    return out


def break_angles(points):
    # Bounded miter at up to 61 degrees. Tiny false connector knots and
    # mapped right-angle corners stay physically separated rather than overlap.
    if len(points)<2:return
    a=0;replace=None
    for i in range(1,len(points)-1):
        p,o,q=points[i-1:i+2]
        d,e=math.dist(p,o),math.dist(o,q)
        if d<.04 or e<.04:continue
        dot=((o[0]-p[0])*(q[0]-o[0])+(o[1]-p[1])*(q[1]-o[1]))/(d*e)
        if dot>=.50:continue
        # Deliberate cut: enough room for full ribbons whose bent corners
        # could otherwise produce a crossing loop at a source-path cusp.
        end=interpolate(o,p,min(.4,.95/d))
        run=points[a:i]+[end]
        if replace is not None:run[0]=replace
        if keep_length(run):yield run
        replace=interpolate(o,q,min(.4,.95/e));a=i
    left=points[a:]
    if replace is not None:left[0]=replace
    if keep_length(left):yield left


def extract(pbf):
    # Use the GDAL OSM driver, which excludes uploader/member/account data.
    ogr.UseExceptions()
    ds=ogr.Open(str(pbf))
    q=ds.GetLayerByName('lines')
    q.SetAttributeFilter("highway='footway'")
    accepted=[]
    for row in q:
        tags=dict(re.findall(r'"([^"]+)"=>"([^"]*)"',row.GetField('other_tags')or''))
        [g,s]=[row.GetGeometryRef(),tags.get('surface')]
        if tags.get('footway')!='sidewalk' or s not in KINDS or g is None or g.GetGeometryName()!='LINESTRING':continue
        if any(tags.get(tag,'no') not in ('no','0','false') for tag in ('bridge','tunnel','covered','indoor','level','layer')):continue
        coords=[(lon,lat) for lon,lat,*_ in g.GetPoints()]
        pp=simplify([project(*c) for c in coords])
        l=length(pp)
        if not 2.5<=l<=3500:continue
        k,z=pp[len(pp)//2]
        city,d=region(k,z)
        sw=tags.get('width')
        if sw and re.fullmatch(r'[0-9]+(?:\.[0-9]+)?(?:\s*m)?',sw):
            rw=float(sw.strip().rstrip('m'));d=round(rw*100)
            if not 90<=d<=280:continue
            declared=True
        else:
            # A variable or ambiguous number is not a trustworthy survey width.
            declared=False
        accepted.append(dict(id=row.GetField('osm_id'),coordinates=coords,surface=s,sourceWidth=sw,
                             city=city,widthCm=d,declaredWidth=declared,L=l,points=pp,kind=KINDS[s]))
    return accepted


def joined(rows):
    # Combine along exactly shared source nodes only when the physical
    # material and nominal width are the same and the join is not branched.
    def key(w,p):return (w['kind'],w['widthCm'],w['declaredWidth'],p)
    graph=defaultdict(list)
    for r,w in enumerate(rows):
        p=w['points'];graph[key(w,p[0])].append((r,False));graph[key(w,p[-1])].append((r,True))
    taken=set()
    for j,w in enumerate(rows):
        if j in taken:continue
        taken.add(j);src=[j]
        p=w['points'][:]
        for front in (False,True):
            if front:p.reverse()
            while True:
                opts=graph[key(w,p[-1])]
                if len(opts)!=2:break
                nexts=[(k,back) for k,back in opts if k not in taken]
                if len(nexts)!=1:break
                k,back=nexts[0];new=rows[k]['points'][::-1] if back else rows[k]['points']
                a,o,b=p[-2],p[-1],new[1]
                u,v=math.dist(a,o),math.dist(o,b)
                dotted=((o[0]-a[0])*(b[0]-o[0])+(o[1]-a[1])*(b[1]-o[1]))/max(1e-6,u*v)
                if dotted<.50 or length(p)+rows[k]['L']>480:break
                p+=new[1:];taken.add(k);src.append(k)
        yield w,p[::-1],src


def quantize(p):
    return (round(p[0]*100),round(p[1]*100))


def to_chunk(p):
    # Split long coordinate deltas before storing centimetre signed Int16 increments.
    out=[]
    for a,b in zip(p,p[1:]):
        n=math.ceil(math.dist(a,b)/280)
        if not out:out=[quantize(a)]
        for k in range(1,n+1):
            point=quantize(interpolate(a,b,k/n))
            if point!=out[-1]:out.append(point)
    return out


def actual_strip(q,width):
    # Match physical runtime offset geometry after *centimetre quantization*.
    # Never approve a thin crossing due to comparing only the unrounded axis.
    path=[(x*.01,z*.01) for x,z in q]
    norm=[]
    for a,b in zip(path,path[1:]):
        d=math.dist(a,b);norm.append(((b[1]-a[1])/d,(a[0]-b[0])/d))
    sections=[]
    for i,(x,z) in enumerate(path):
        a,b=norm[max(0,i-1)],norm[min(len(norm)-1,i)]
        u,v=a[0]+b[0],a[1]+b[1];L=math.hypot(u,v)
        u,v=(u/L,v/L) if L>1e-8 else b
        r=width*.005*min(1.155,1/max(.01,u*b[0]+v*b[1]))
        sections.append(((x-u*r,z-v*r),(x+u*r,z+v*r)))
    for (a,b),(d,c) in zip(sections,sections[1:]):
        yield [a,b,c,d]


def protected_contact(poly,obstacles):
    b=bounds(poly)
    g=polygon(poly)
    ids=set()
    for key in obstacles.keys(expanded(b,.0001)):ids.update(obstacles.cells.get(key,()))
    for j in ids:
        a,h,_,_=obstacles.items[j]
        if a[2]<b[0] or a[3]<b[1] or a[0]>b[2] or a[1]>b[3]:continue
        if g.Intersects(h) and g.Intersection(h).GetArea()>1e-8:return True
    return False


def simple_strips(q,width,approved):
    p=[(x*.01,z*.01) for x,z in q]
    if not keep_length(p):return
    local=Obstacles()
    for i,quad in enumerate(actual_strip(q,width)):
        a,b,c,d=quad
        def signed(u,v,w):
            return (v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0])
        if (signed(a,b,c)<1e-8 or signed(a,c,d)<1e-8
            or protected_contact(quad,local) or protected_contact(quad,approved)):
            # Reserve the longer independent pieces; never smooth/replace
            # the source alignment. Tiny uncertain knots may leave gaps.
            yield from simple_strips(q[:i+1],width,approved)
            yield from simple_strips(q[i+1:],width,approved)
            return
        local.add(quad,polygon(quad),0.)
    for quad,g,_,_ in local.items:
        ring=g.GetGeometryRef(0)
        approved.add([(x,z) for x,z,*_ in ring.GetPoints()],g,0.)
    yield (q,p)


def main():
    argparse_args=argparse.ArgumentParser(description=__doc__)
    argparse_args.add_argument('pbf',type=Path)
    args=argparse_args.parse_args()
    if sha(args.pbf.read_bytes())!=SOURCE_SHA:raise SystemExit('Unpinned OSM source PBF')
    rows=sorted(extract(args.pbf),key=lambda w:(not w['declaredWidth'],-w['L'],int(w['id'])))
    roads,buildings,buildhash,roadhash=obstacles_from_atlas()
    good,coverhash=covers()
    print(f'{len(rows)} source ways; {len(roads.items)} exact road rectangles, {len(buildings.items)} protected building envelopes',flush=True)
    accepted=Obstacles();approved=Obstacles()
    src_support={}
    tiles=defaultdict(list);used=set();counts=defaultdict(Counter);bykind=Counter();longest=[]
    for r in rows:
        counts[r['city']]['mappedWays']+=1
        counts[r['city']]['mappedMetres']+=r['L']
    for w,points,src in joined(rows):
        r=w['widthCm']*.005
        # Bounded miter ≤1.155*halfwidth, plus coordinate quantization and
        # polygon buffer chord allowance (8 samples/quarter).
        safe=math.ceil((r*1.156+.065)*100)/100
        for p in break_angles(simplify(points)):
            l=roads.clip(line(p),safe)
            l=buildings.clip(l,safe)
            # Once a sidewalk owns a strip, no second possibly duplicated way
            # can cover that same plan-view footprint.
            l=accepted.clip(l,safe)
            for v in lines(l):
                for candidate in soil_runs(v,safe,good):
                    p2=simplify(candidate)
                    # GEOS difference can return a reversed sub-line; orientation
                    # continuity is still preserved on the complete accepted run.
                    if not keep_length(p2):continue
                    q=to_chunk(p2)
                    if len(q)<2 or len(q)>480:continue
                    if not line(p2).IsSimple():continue
                    for pp,shape in simple_strips(q,w['widthCm'],approved):
                        edge=line(shape)
                        live=[]
                        for k in src:
                            if k not in src_support:src_support[k]=line(rows[k]['points']).Buffer(.015,6)
                            if src_support[k].Intersects(edge) and src_support[k].Intersection(edge).Length()>.035:
                                live.append(k)
                        if not live:raise SystemExit('Retained geometry without source support')
                        for aa,bb in zip(shape,shape[1:]):
                            if math.dist(aa,bb)>.037:
                                accepted.add([aa,bb],line([aa,bb]),safe+.045)
                        box=bounds(shape);tile=(math.floor((box[0]+box[2])/(2*TILE)),math.floor((box[1]+box[3])/(2*TILE)))
                        p0=pp[0]
                        phase=(p0[0]*89 ^ p0[1]*167)&65535
                        tiles[tile].append((w['kind'],w['widthCm'],phase,pp,live))
                        L=length(shape)
                        counts[w['city']]['fragments']+=1
                        counts[w['city']]['acceptedMetres']+=L
                        counts[w['city']]['taggedWidthMetres']+=L*w['declaredWidth']
                        bykind[w['kind']]+=L
                        used.update(live)
                        longest.append((round(L,3),w['city'],int(w['id']),[p0[0]*.01,p0[1]*.01],w['surface']))
    for j in used:counts[rows[j]['city']]['contributingWays']+=1
    ways=[{k:v for k,v in rows[n].items() if k in ('id','coordinates','surface','sourceWidth','city','widthCm','declaredWidth')} for n in sorted(used)]
    def sorted_tiles():
        for (x,z),frames in sorted(tiles.items()):yield x,z,frames
    npnt=sum(len(d[3]) for li in tiles.values() for d in li)
    nfrag=sum(len(li) for li in tiles.values())
    assert len(tiles)<512 and nfrag<8000 and npnt<80000
    o=bytearray(struct.pack('<4sHHII',b'SWK1',1,len(tiles),nfrag,npnt))
    exported=[]
    for x,z,frames in sorted_tiles():
        o.extend(struct.pack('<hhH',x,z,len(frames)))
        for kind,w,phase,pp,src in frames:
            a,b=pp[0]
            o.extend(struct.pack('<BHHHii',kind,w,phase,len(pp),a,b))
            for c,d in pp[1:]:
                o.extend(struct.pack('<hh',c-a,d-b));a,b=c,d
            exported.append([kind,w,phase,pp,[rows[k]['id'] for k in src]])
    replica=gz(json.dumps(dict(schema=1,source=ARCHIVE,ways=ways,fragmentsXZcm=exported),separators=(',',':')).encode())
    db=ROOT/'data/odbl/sidewalks/mapped-sidewalks.json.gz'
    db.parent.mkdir(parents=True,exist_ok=True);db.write_bytes(replica)
    asset='pedestrian/odbl/v1/sidewalks.bin.gz';f=WORLD/asset
    f.parent.mkdir(parents=True,exist_ok=True);payload=gz(o);f.write_bytes(payload)
    manifest={'id':'mapped-sidewalks-v1','asset':asset,'projectedTileMetres':TILE,'tiles':len(tiles),
        'paths':nfrag,'points':npnt,'decodedBytes':len(o),'compressedBytes':len(payload),
        'sha256':sha(o),'crc32':f'{zlib.crc32(o)&0xffffffff:08x}',
        'pinCoverSha256':coverhash,'pinBuildingAtlasSha256':buildhash,'pinRoadGeometrySha256':roadhash}
    ts=ROOT/'src/render/sidewalks.generated.ts'
    ts.write_text('// Generated by tools/geodata/bake-sidewalks.py.\n'
                  +'export const SIDEWALKS='+json.dumps(manifest,indent=2)+' as const;\n')
    report=dict(manifest,source=ARCHIVE,sourceSha256=SOURCE_SHA,odblDerivativeSha256=sha(replica),
                contributingSourceWays=len(ways),byRegion={k:{a:round(v,3) for a,v in b.items()} for k,b in counts.items()},
                acceptedMetresByKind={k:round(v,3) for k,v in sorted(bykind.items())},
                longestAcceptedPaths=sorted(longest,reverse=True)[:20],compressedSha256=sha(payload),
                protectedRoadRectangles=len(roads.items),protectedBuildings=len(buildings.items))
    document(ROOT/'data/odbl/sidewalks/selection.json',report)
    print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':
    main()
