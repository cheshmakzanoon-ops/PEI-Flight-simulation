#!/usr/bin/env python3
"""Bake opt-in-safe, mapped surface polygons without changing the existing terrain.

Requires GDAL/GEOS and NumPy. Input is the same pinned Geofabrik PEI archive
used by mapped sidewalks. Requires no image retrieval or external text data.
"""
from collections import Counter,defaultdict
from pathlib import Path
from osgeo import ogr
import argparse,gzip,importlib.util,json,math,re,struct,zlib
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
world=ROOT/'public/world'
spec=importlib.util.spec_from_file_location('bake_walk',Path(__file__).with_name('bake-sidewalks.py'))
geo=importlib.util.module_from_spec(spec);spec.loader.exec_module(geo)
TILE=1024
STYLE={'asphalt':0,'concrete':1,'paving_stones':2,'gravel':3,'fine_gravel':3,'compacted':4,'paved':5,'unpaved':6}
PREC=.0001
# Do not allow a separately triangulated irregular terrain tile to take this
# layer's regular cutting proof as its own. The actual survey AOIs remain intact.
SURVEY=[(31,12),(1,9)]
box_area=lambda a,b,c,d:geo.polygon([(a,b),(a,d),(c,d),(c,b)])

def rings(g):
    return [g.GetGeometryRef(i).GetPoints()[:-1] for i in range(g.GetGeometryCount())]

def shapes(g,cut=1e-5):
    if g is None or g.IsEmpty():return
    if g.GetGeometryName()=='POLYGON':
        if g.GetArea()>cut:yield g
    elif g.GetGeometryName() in ('MULTIPOLYGON','GEOMETRYCOLLECTION'):
        for part in g:yield from shapes(part,cut)

def makepoly(r):
    g=ogr.Geometry(ogr.wkbPolygon)
    for pts in r:
        q=ogr.Geometry(ogr.wkbLinearRing)
        for a,b in pts:q.AddPoint_2D(float(a),float(b))
        q.CloseRings();g.AddGeometry(q)
    return g

def shape(g):
    w=ogr.Geometry(ogr.wkbMultiPolygon)
    raw=[]
    for p in shapes(g,1e-15):
        r=[[[float(x),float(y)]for x,y,*_ in a]for a in rings(p)]
        raw.append(r)
        w.AddGeometry(makepoly([[geo.project(*q) for q in a] for a in r]))
    return w.SetPrecision(PREC),raw

def bbox_intersects(a,b):
    return a[0]<b[2] and a[2]>b[0] and a[1]<b[3] and a[3]>b[1]

def land_proof():
    meta=json.loads((world/'cover.json').read_text())
    body=(world/'cover.bin.gz').read_bytes()
    assert geo.sha(body)==meta['compressedSha256']
    nx,nz=meta['width'],meta['height'];w,s,e,n=meta['bounds']
    left,top=geo.project(w,n);right,bottom=geo.project(e,s)
    sx=(right-left)/nx;sz=(bottom-top)/nz
    data=np.frombuffer(gzip.decompress(body),np.uint8).reshape(nz,nx,2)[:,:,1]
    safe=(data[:-1,:-1]>=129)&(data[:-1,1:]>=129)&(data[1:,:-1]>=129)&(data[1:,1:]>=129)
    no=[geo.HARBOUR]
    for i,j in SURVEY:
        no.append((left+i*(right-left)/32,top+j*(bottom-top)/22,left+(i+1)*(right-left)/32,top+(j+1)*(bottom-top)/22))
    def dry(g):
        a,b,c,d=geo.expanded(geo.geometry_bounds(g),.025)
        if any(bbox_intersects((a,b,c,d),k) and g.Distance(box_area(*k))<=.045 for k in no):return False
        i=int(math.floor((a-left)/sx-.5));j=int(math.floor((b-top)/sz-.5))
        ni=int(math.floor((c-left)/sx-.5));nj=int(math.floor((d-top)/sz-.5))
        if i<0 or j<0 or ni>=nx-1 or nj>=nz-1:return False
        bad=np.argwhere(~safe[j:nj+1,i:ni+1])
        for p,q in bad:
            u=left+(q+i+.5)*sx;v=top+(p+j+.5)*sz
            if g.Intersects(box_area(*geo.expanded((u,v,u+sx,v+sz),.043))):return False
        return True
    return dry,meta['compressedSha256']

def overlaps(g,items,buffer):
    return items.clip(g,buffer)

def sidewalk_exclusions():
    source=ROOT/'data/odbl/sidewalks/mapped-sidewalks.json.gz'
    data=json.loads(gzip.decompress(source.read_bytes()))
    result=geo.Obstacles()
    for _,width,_,pp,_ in data['fragmentsXZcm']:
        for q in geo.actual_strip(pp,width):
            result.add(q,geo.polygon(q),.22)
    m=(ROOT/'public/world/pedestrian/odbl/v1/sidewalks.bin.gz').read_bytes()
    return result,geo.sha(gzip.decompress(m))

def extract(pbf):
    if geo.sha(pbf.read_bytes())!=geo.SOURCE_SHA:raise ValueError('Unpinned OSM archive')
    ds=ogr.Open(str(pbf))
    layer=ds.GetLayerByName('multipolygons')
    layer.SetAttributeFilter("amenity='parking'")
    rows=[];drop=Counter()
    for r in layer:
        g=r.GetGeometryRef()
        if not g or not g.IsValid():drop['invalid outline']+=1;continue
        tags=dict(re.findall(r'"([^"]+)"=>"([^"]*)"',r.GetField('other_tags')or''))
        material=tags.get('surface')
        if material not in STYLE:drop['untyped material']+=1;continue
        if tags.get('parking','surface') not in ('surface','street_side','layby') or tags.get('building','no')!='no' or any(tags.get(t,'0') not in ('0','no','false') for t in ['level','layer','bridge','covered','tunnel']):
            drop['above/below ground or ambiguous profile']+=1;continue
        if tags.get('access','use unspecified') in ('private','residents','no','delivery','permit'):
            drop['explicit access exclusion']+=1;continue
        q,raw=shape(g)
        if not 75<=q.GetArea()<=350000 or not q.IsValid():drop['shape size/quality']+=1;continue
        name=r.GetField('osm_way_id') or r.GetField('osm_id')
        mode='way' if r.GetField('osm_way_id') else 'relation'
        key=mode+'/'+name
        center=q.Centroid().GetPoint()[:2]
        cohort,width=geo.region(*center)
        rows.append(dict(id=key,geometry=q,raw=raw,material=material,style=STYLE[material],
                         center=center,cohort=cohort))
    return rows,drop

def make_cells(g,shade,ox,oz):
    def one(p):
        r=[]
        for seq in rings(p):
            a=[]
            for x,y,*_ in seq:
                pt=ogr.Geometry(ogr.wkbPoint);pt.AddPoint_2D(x,y)
                # Integer millimetres and 8-bit edge values. Edge strip follows real
                # boundary, including the edge of exclusions and mapped islands.
                z=[round((x-ox)*1000),round((y-oz)*1000),shade(pt)]
                if not a or z[:2]!=a[-1][:2]:a.append(z)
            if a and a[0][:2]==a[-1][:2]:a.pop()
            if len(a)>=3:r.append(a)
        return r
    return [a for p in shapes(g) if (a:=one(p))]

def pack_tiles(stock):
    raw=bytearray(struct.pack('<4sHHI',b'PKG1',1,len(stock),sum(len(t[1]) for t in stock)))
    def code(x):
        assert x>=0
        while x>=128:
            raw.append((x&127)|128)
            x>>=7
        raw.append(x)
    def coord(x):
        code((x<<1)^(x>>31))
    for (tx,tz),pieces in stock:
        raw.extend(struct.pack('<hhH',tx,tz,len(pieces)))
        for style,core,edge in pieces:
            raw.append(style)
            for band,polys in enumerate((core,edge)):
                code(len(polys))
                for poly in polys:
                    code(len(poly))
                    for ring in poly:
                        code(len(ring))
                        x0,z0=0,0
                        for x,z,v in ring:
                            coord(x-x0);coord(z-z0)
                            if band:raw.append(v)
                            x0,z0=x,z
    return bytes(raw)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('pbf',type=Path)
    a=p.parse_args()
    ogr.UseExceptions()
    rows,drops=extract(a.pbf)
    if not rows:raise ValueError('No eligible mapped surface shapes')
    roads,buildings,pinBuildings,pinRoad=geo.obstacles_from_atlas()
    sidewalk,pinSidewalk=sidewalk_exclusions()
    dry,pinCover=land_proof()
    earlier=geo.Obstacles();tiles=defaultdict(list);counts=defaultdict(Counter)
    sources=[];kept=defaultdict(list);initial=len(rows)
    # Exact material polygons take ownership before unspecified paved/unpaved.
    # Deterministically prefer the more detailed (smaller) exact polygon.
    rows.sort(key=lambda r:(r['style'] in (5,6),r['geometry'].GetArea(),r['id']))
    for r in rows:
        if not dry(r['geometry']):drops['unreliable signed-land envelope']+=1;continue
        target=r['geometry']
        for existing in (roads,buildings,sidewalk,earlier):
            if existing:target=overlaps(target,existing,.038)
            if target.IsEmpty():break
        if target.IsEmpty():drops['entirely overlapping protected geometry']+=1;continue
        of=[]
        for g in shapes(target.SetPrecision(PREC)):
            if g.GetArea()<32 or not g.IsValid():continue
            d=.48 if r['style'] in (0,1,2,5) else .69
            interior=g.Buffer(-d,3).SetPrecision(PREC)
            if interior.IsEmpty() or interior.GetArea()<8 or interior.GetArea()<.28*g.GetArea():continue
            edge=g.Difference(interior).SetPrecision(PREC);ref=g.Boundary()
            def shade(pt):return round(255*min(1.,max(0.,ref.Distance(pt)/d)))
            if abs(interior.GetArea()+edge.GetArea()-g.GetArea())>.012:raise ValueError('Loss of coverage inside selected lot')
            cx,cz=g.Centroid().GetPoint()[:2];key=math.floor(cx/TILE),math.floor(cz/TILE)
            ox,oz=(key[0]+.5)*TILE,(key[1]+.5)*TILE
            core=make_cells(interior,lambda p:255,ox,oz);band=make_cells(edge,shade,ox,oz)
            if not core or not band:raise ValueError('Invalid lot topology')
            # Prevent a second rendered polygon from taking the same ground.
            box=geo.geometry_bounds(g)
            earlier.add(((box[0],box[1]),(box[2],box[3])),g,.028)
            tiles[key].append([r['style'],core,band])
            of.append((key,r['style'],r['id'],g.GetArea()))
        if not of:
            drops['narrow/fractional remainder']+=1
            continue
        sources.append(dict(id=r['id'],surface=r['material'],coordinates=r['raw']))
        for key,k,source,L in of:
            kept[key].append(source)
            counts[r['cohort']]['areaM2']+=L
            counts[r['cohort']]['pieces']+=1
            counts[r['material']]['areaM2']+=L
            counts[r['material']]['pieces']+=1
        counts[r['cohort']]['sourceLots']+=1
        counts[r['material']]['sourceLots']+=1
    stock=[[list(k),v]for k,v in sorted(tiles.items())]
    blob=pack_tiles(stock)
    out=geo.gz(blob);asset='ground/odbl/v1/parking-surfaces.bin.gz'
    f=world/asset;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(out)
    src=geo.gz(json.dumps(dict(archive=geo.ARCHIVE,sources=sources,tilePieceSourceIds=[[list(k),kept[k]] for k,v in sorted(tiles.items())]),
           separators=(',',':')).encode())
    q=ROOT/'data/odbl/parking-surfaces';q.mkdir(parents=True,exist_ok=True)
    (q/'sources.json.gz').write_bytes(src)
    spec={'id':'mapped-parking-surfaces-v1','asset':asset,'tiles':len(tiles),'lots':len(sources),'pieces':sum(map(len,tiles.values())),
         'projectedTileMetres':TILE,'decodedBytes':len(blob),'compressedBytes':len(out),'sha256':geo.sha(blob),
         'crc32':f'{zlib.crc32(blob)&0xffffffff:08x}','pinCoverSha256':pinCover,'pinBuildingAtlasSha256':pinBuildings,
         'pinRoadGeometrySha256':pinRoad,'pinSidewalkSha256':pinSidewalk}
    filename=ROOT/'src/render/parking-surfaces.generated.ts'
    filename.write_text('// Generated by tools/geodata/bake-parking-surfaces.py.\nexport const MAPPED_PARKING='+
                        json.dumps(spec,indent=2)+' as const;\n')
    receipt=dict(spec,source=geo.ARCHIVE,archiveSha256=geo.SOURCE_SHA,eligibleBeforeClipping=initial,
                 excluded=dict(drops),counts={k:{w:round(n,2)for w,n in l.items()}for k,l in counts.items()},
                 compressedSha256=geo.sha(out),odblSha256=geo.sha(src))
    geo.document(q/'selection.json',receipt)
    print(json.dumps(receipt,indent=2),flush=True)

if __name__=='__main__':main()
