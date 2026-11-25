#!/usr/bin/env python3
"""Compile the pinned OSM main Confederation Trail into ground-only strips.

Run from the repository with GDAL/GEOS, NumPy and Node >=22:
  /usr/bin/python3 tools/geodata/bake-confederation-trail.py <pinned OSM full JSON>

Only exact OpenStreetMap IDs, way revisions, coordinates and relevant trail tags
are redistributed. Account fields and edit timestamps never enter the outputs.
"""
from collections import Counter, defaultdict
from pathlib import Path
import argparse
import gzip
import importlib.util
import json
import math
import struct
import subprocess
import zlib

import numpy as np
from osgeo import ogr

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT / 'public/world'
SPECS = Path(__file__).parent
spec = importlib.util.spec_from_file_location('walks', SPECS / 'bake-sidewalks.py')
geo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geo)

RELEASE = 1
TILE = 880
RELATION = 4740520
VERSION = 61
SOURCE = 'https://www.openstreetmap.org/api/0.6/relation/4740520/full.json'
HASH = '66e19f29e054cc034a55aaf1c78ea9b5046c2c3de1c138561b256d2189cf9fe3'
KINDS = {'compacted': 0, 'fine_gravel': 1}
BASE_WIDTH_CM = 200
FEATHER = .72
ASSET = 'trails/odbl/v1/confederation-main.bin.gz'
# Only conventional still-dry stock surfaces. ESA unknown, snow, water,
# herbaceous wetland, mangrove and moss/lichen do not establish an exposed bed.
CLASSES = (10, 20, 30, 40, 50, 60)


def unpack(name):
    return gzip.decompress((WORLD / name).read_bytes())


def sidewalk_owners():
    body = unpack('pedestrian/odbl/v1/sidewalks.bin.gz')
    tag, v, nt, npth, npts = struct.unpack_from('<4sHHII', body)
    assert (tag, v) == (b'SWK1', 1)
    i, paths, points = 16, 0, 0
    hit = geo.Obstacles()
    for _ in range(nt):
        _, _, count = struct.unpack_from('<hhH', body, i)
        i += 6
        for _ in range(count):
            _, wid, _, n, x, z = struct.unpack_from('<BHHHii', body, i)
            i += 15
            coords = [(x, z)]
            for _ in range(n - 1):
                dx, dz = struct.unpack_from('<hh', body, i)
                i += 4
                x += dx
                z += dz
                coords.append((x, z))
            for strip in geo.actual_strip(coords, wid):
                hit.add(strip, geo.polygon(strip), .20)
            paths += 1
            points += n
    assert (i, paths, points) == (len(body), npth, npts)
    return hit, geo.sha(body)


def append_obstacle(obstacles, g, base):
    if not g or g.IsEmpty():
        return
    if not g.IsValid():
        g = g.MakeValid()
    if g.GetGeometryName() == 'POLYGON':
        b = geo.geometry_bounds(g)
        obstacles.add(((b[0], b[1]), (b[2], b[3])), g, base)
    elif g.GetGeometryName() in ('GEOMETRYCOLLECTION', 'MULTIPOLYGON'):
        for part in g:
            append_obstacle(obstacles, part.Clone(), base)


def parking_owners():
    body = unpack('ground/odbl/v1/parking-surfaces.bin.gz')
    tag, v, nt, ni = struct.unpack_from('<4sHHI', body)
    assert (tag, v) == (b'PKG1', 1)
    i, total = 12, 0
    hit = geo.Obstacles()

    def code():
        nonlocal i
        x = 0
        for k in (0, 7, 14, 21):
            b = body[i]
            i += 1
            x += (b & 127) << k
            if b < 128:
                return x
        raise ValueError('Parking coordinate revision')

    def coord():
        v = code()
        return (v >> 1) ^ -(v & 1)

    for _ in range(nt):
        tx, tz, n = struct.unpack_from('<hhH', body, i)
        i += 6
        ox, oz = 1024 * (tx + .5), 1024 * (tz + .5)
        for _ in range(n):
            i += 1
            for rim in range(2):
                for _ in range(code()):
                    g = ogr.Geometry(ogr.wkbPolygon)
                    for _ in range(code()):
                        ring = ogr.Geometry(ogr.wkbLinearRing)
                        x = z = 0
                        for _ in range(code()):
                            x += coord()
                            z += coord()
                            i += rim
                            ring.AddPoint_2D(ox + x * .001, oz + z * .001)
                        ring.CloseRings()
                        g.AddGeometry(ring)
                    append_obstacle(hit, g, .21)
            total += 1
    assert (i, total) == (len(body), ni)
    return hit, geo.sha(body)


def surveyed_owners():
    # Read exact JavaScript authority for pavement and the geographically bounded
    # bespoke harbour/water scopes. The runtime also excludes irregular terrain.
    js = """
import {RUNWAYS} from './src/sim/places.ts';
import {COASTAL_SPECS} from './src/sim/coastal-surveys.generated.ts';
console.log(JSON.stringify({runways:RUNWAYS.map(r=>[r.id,r.p,r.q,r.width]),coastal:COASTAL_SPECS.map(s=>[s.tileX,s.tileZ])}));
"""
    literal = subprocess.check_output(['node', '--experimental-strip-types', '--input-type=module', '-e', js], cwd=ROOT)
    data = json.loads(literal)
    q = geo.Obstacles()
    for _, a, b, width in data['runways']:
        point = [(r['x'], r['z']) for r in (a,b)]
        pad = geo.line(point).Buffer(width*.5+35.,8)
        append_obstacle(q,pad,.22)
    return q, data


def dry_support(coastal):
    data = json.loads((WORLD / 'cover.json').read_text())
    raw = (WORLD / 'cover.bin.gz').read_bytes()
    assert geo.sha(raw) == data['compressedSha256']
    decoded = gzip.decompress(raw)
    nx, nz = data['width'], data['height']
    w, s, e, n = data['bounds']
    left, top = geo.project(w, n)
    right, bottom = geo.project(e, s)
    sx, sz = (right-left)/nx, (bottom-top)/nz
    a = np.frombuffer(decoded, dtype=np.uint8).reshape(nz,nx,2)
    supported = (a[:,:,1] >= 129) & np.isin(a[:,:,0], CLASSES)
    no = [geo.HARBOUR]
    for i,j in coastal:
        no.append((left+i*(right-left)/32, top+j*(bottom-top)/22,
                   left+(i+1)*(right-left)/32,top+(j+1)*(bottom-top)/22))

    def covers(x1, z1, x2, z2):
        if any(x1 < b[2] and x2 > b[0] and z1 < b[3] and z2 > b[1] for b in no):
            return False
        i, j = math.floor((x1-left)/sx-.5), math.floor((z1-top)/sz-.5)
        p, q = math.floor((x2-left)/sx-.5)+1, math.floor((z2-top)/sz-.5)+1
        return i >= 0 and j >= 0 and p < nx and q < nz and bool(np.all(supported[j:q+1,i:p+1]))

    def whole_strip(q):
        # A long diagonal strip can have a wet texel in its bounding box
        # while the actual polygon never enters that bilinear support. Check
        # the exact emitted polygon against the closed cells of bad texels.
        eps=.019
        x1,z1,x2,z2=geo.expanded(geo.bounds(q),eps)
        if covers(x1,z1,x2,z2):
            return True
        i,j=math.floor((x1-left)/sx-.5),math.floor((z1-top)/sz-.5)
        p,k=math.floor((x2-left)/sx-.5)+1,math.floor((z2-top)/sz-.5)+1
        if i<0 or j<0 or p>=nx or k>=nz:
            return False
        surface=geo.polygon(q)
        def box(a,b,c,d):
            return geo.polygon(((a,b),(a,d),(c,d),(c,b)))
        if any(x1<b[2] and x2>b[0] and z1<b[3] and z2>b[1] and surface.Distance(box(*b))<=eps for b in no):
            return False
        for r,s in np.argwhere(~supported[j:k+1,i:p+1]):
            px,pz=left+(i+s+.5)*sx,top+(j+r+.5)*sz
            if surface.Distance(box(px-sx,pz-sz,px+sx,pz+sz))<=eps:
                return False
        return True

    return covers, whole_strip, data['compressedSha256'], geo.sha(decoded)


def grade_sections(points, width):
    cm = geo.to_chunk(points)
    p = np.asarray(cm, dtype=float)
    d = np.diff(p,axis=0)
    n = np.column_stack((d[:,1],-d[:,0])) / np.hypot(*d.T)[:,None]
    normal = np.vstack((n[0], n))
    nextn = np.vstack((n, n[-1]))
    m = normal + nextn
    norm = np.hypot(*m.T)[:,None]
    m = np.divide(m,norm,where=norm>1e-8,out=nextn.copy())
    amount = (width*.5)*np.minimum(1.155,1/np.maximum(.01,np.sum(m*nextn,axis=1)))
    return [tuple(map(int,q)) for q in np.column_stack((p,np.round(m*amount[:,None])))]


def xz(q):
    return q[0] * .01, q[1] * .01


def strip(a, b):
    x,z,u,v = a[:4]
    X,Z,U,V = b[:4]
    return tuple(((i*.01,j*.01) for i,j in ((x-u,z-v),(x+u,z+v),(X+U,Z+V),(X-U,Z-V))))


def cross(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])


def genuine(q):
    a,b,c,d = q
    return cross(a,b,c)>1e-8 and cross(a,c,d)>1e-8


def cut_tiles(sections):
    """Interpolate already-mitered sections, not separately recomputed joins."""
    lengths = [0.]
    for a,b in zip(sections,sections[1:]):
        lengths.append(lengths[-1]+math.dist(xz(a),xz(b)))
    total = lengths[-1]
    if total < 2.5:
        return
    current, group = None, []
    chunks, canonical = [], {}

    def piece(a,b,t,start,edge):
        x = [round(at+(bt-at)*t) for at,bt in zip(a,b)]
        along = start+edge*t
        fade = min(1.,along/FEATHER,(total-along)/FEATHER)
        fade = max(0,min(255,round(255*fade)))
        key = tuple(x[:2])
        old = canonical.get(key)
        # A feather event a few millimetres from a grid event can round
        # to the same centre. Take the earlier offset and safest opacity
        # in both cells, rather than leaving a one-texel seam.
        canonical[key] = (*x,fade) if old is None else (*old[:4],min(old[4],fade))
        return canonical[key]

    for i,(a,b) in enumerate(zip(sections,sections[1:])):
        li,lj = lengths[i:i+2]
        edge = lj-li
        if edge < .009:
            continue
        ts = [0.,1.]
        for axis in (0,1):
            lo,hi = sorted((a[axis],b[axis]))
            for v in range((lo//(TILE*100)+1)*TILE*100,hi,TILE*100):
                if a[axis] != b[axis]:
                    ts.append((v-a[axis])/(b[axis]-a[axis]))
        for t in (FEATHER,total-FEATHER):
            if li+.001 < t < lj-.001:
                ts.append((t-li)/edge)
        ts = sorted(set(ts))
        for u,v in zip(ts,ts[1:]):
            h = .5*(u+v)
            cell = tuple(math.floor((j+(k-j)*h)/(TILE*100)) for j,k in zip(a[:2],b[:2]))
            p,s = piece(a,b,u,li,edge),piece(a,b,v,li,edge)
            if p[:2] == s[:2]:
                continue
            if cell != current:
                if len(group)>1:
                    chunks.append((current,group))
                group = [p]
                current = cell
            if group[-1][:2] != p[:2]:
                # Continuous coordinate/offset at natural and tile boundaries.
                raise ValueError('Clipping changed an exact miter joint')
            group.append(s)
    if len(group)>1:
        chunks.append((current,group))
    for cell,run in chunks:
        yield cell,[canonical[q[:2]] for q in run]


def approval(first, whole_strip, owners, accepted):
    for _,span in first:
        for a,b in zip(span,span[1:]):
            q = strip(a,b)
            if not genuine(q):
                return 'quantised invalid'
            if not whole_strip(q):
                return 'quantised cover'
            if any(geo.protected_contact(q,s) for s in owners):
                return 'quantised owner'
            if geo.protected_contact(q,accepted):
                return 'quantised overlap'
    return ''


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('json', type=Path)
    args = p.parse_args()
    ogr.UseExceptions()
    raw = args.json.read_bytes()
    if geo.sha(raw) != HASH:
        raise ValueError('Unpinned Confederation Trail full export')
    obj = json.loads(raw)
    entities = obj['elements']
    nodes = {o['id']:(o['lon'],o['lat']) for o in entities if o['type']=='node'}
    ways = {o['id']:o for o in entities if o['type']=='way'}
    r, = [o for o in entities if o['type']=='relation']
    assert (r['id'],r['version'],len(r['members'])) == (RELATION,VERSION,109)
    roads, buildings, hash_buildings, hash_roads = geo.obstacles_from_atlas()
    sides, hash_sides = sidewalk_owners()
    parking, hash_parking = parking_owners()
    runway, authority = surveyed_owners()
    owners = (roads,buildings,sides,parking,runway)
    cover, whole_strip, hash_cover, decoded_cover = dry_support(authority['coastal'])
    terrain = json.loads((WORLD/'terrain.json').read_text())
    accepted = geo.Obstacles()
    provisional = geo.Obstacles()
    tiles = defaultdict(list)
    steps, counts, material, used = Counter(), Counter(), Counter(), set()
    picked = []
    for i,m in enumerate(r['members']):
        assert m['type']=='way'
        o = ways[m['ref']]
        tags = o['tags']
        coords = [nodes[x] for x in o['nodes']]
        route = [geo.project(*p) for p in coords]
        l = geo.length(route)
        steps['fullRelation'] += l
        source = {
            'id':o['id'],'version':o['version'],'memberIndex':i,
            'coordinates':coords,
            'tags':{k:tags[k] for k in ('highway','surface','bridge','layer','tunnel','ford','covered','indoor','level','width','access') if k in tags},
        }
        picked.append(source)
        neutral = ('no','false','0','')
        if (tags.get('highway')!='cycleway' or tags.get('surface') not in KINDS or
            any(tags.get(k,'') not in neutral for k in ('bridge','tunnel','layer','ford','covered','indoor','level'))
            or tags.get('access') in ('private','no','permit','customers')):
            counts['heldByTags']+=1
            steps['heldByTags']+=l
            continue
        try:
            width = round(100 * float(tags.get('width','2').removesuffix(' m')))
        except ValueError:
            width = 0
        if not 100<=width<=300:
            counts['heldWidth']+=1
            steps['heldWidth']+=l
            continue
        steps['positivelyMapped']+=l
        steps['sourceTaggedWidth' if 'width' in tags else 'sourceNominalWidth']+=l
        counts['eligibleWays']+=1
        safe = math.ceil((width*.005*1.156+.092)*100)/100
        for p0 in geo.break_angles(geo.simplify(route)):
            line = geo.line(p0)
            if not line.IsSimple():
                counts['selfOverlap']+=1
                continue
            for name,sourceObstacle in zip(('road','building','sidewalk','parking','runway','overlap'), (*owners,provisional)):
                before = line.Length()
                line = sourceObstacle.clip(line,safe)
                steps[name+'Clipped']+=max(0.,before-line.Length())
                if line.IsEmpty():
                    break
            for pp in geo.lines(line):
                dry = list(geo.soil_runs(pp,safe,lambda a,b,d:cover(*geo.expanded(geo.bounds([a,b]),d))))
                steps['coverOrWetlandHeld']+=max(0.,geo.length(pp)-sum(geo.length(a)for a in dry))
                for line in dry:
                    path = geo.simplify(line)
                    if not geo.keep_length(path) or not geo.line(path).IsSimple():
                        counts['fragmentTooSmallOrComplex']+=1
                        continue
                    section = grade_sections(path,width)
                    candidate = list(cut_tiles(section))
                    rejected = approval(candidate,whole_strip,owners,accepted)
                    if rejected or not candidate:
                        counts[rejected or 'unpackable']+=1
                        steps['quantisedHeld']+=geo.length(path)
                        continue
                    counts['admittedPathGroups']+=1
                    source_kind = tags['surface']
                    for cell,ss in candidate:
                        if any(max(abs(p-q)for p,q in zip(a[:2],b[:2]))>32767 for a,b in zip(ss,ss[1:])):
                            raise ValueError('Nonlocal path delta')
                        tiles[cell].append((KINDS[source_kind],int('width' in tags),width,o['id'],ss))
                        met = geo.length([xz(q) for q in ss])
                        steps['retained']+=met
                        steps['retainedTaggedWidth' if 'width' in tags else 'retainedNominalWidth']+=met
                        material[source_kind]+=met
                        for a,b in zip(ss,ss[1:]):
                            q = strip(a,b)
                            accepted.add(q,geo.polygon(q),0.)
                    for a,b in zip(section,section[1:]):
                        axis = [xz(a),xz(b)]
                        provisional.add(axis,geo.line(axis),max(.06,width*.005-.08))
                    used.add(o['id'])
        if (i+1)%25==0:
            print('input members',i+1,'of 109',flush=True)
    # Prevent interior duplicate ribbon surfaces within a path and across
    # chunks; touch at exact shared section is deliberately permitted.
    final = geo.Obstacles()
    for q,g,_,_ in accepted.items:
        ring = [(x,z)for x,z,*_ in g.GetGeometryRef(0).GetPoints()[:-1]]
        if geo.protected_contact(ring,final):
            raise ValueError('Nontrivial overlap in final strip polygons')
        final.add(ring,g,0.)
    nt = len(tiles)
    paths = sum(map(len,tiles.values()))
    sections = sum(len(s)for t in tiles.values() for _,_,_,_,s in t)
    assert 0<nt<512 and 0<paths<6400 and 0<sections<65000
    payload = bytearray(struct.pack('<4sHHII',b'CTF1',RELEASE,nt,paths,sections))
    export = []
    for (tx,tz),runs in sorted(tiles.items()):
        assert len(runs)<300
        payload.extend(struct.pack('<hhH',tx,tz,len(runs)))
        export.append([tx,tz,runs])
        for kind,tag,width,way,ss in runs:
            payload.extend(struct.pack('<BBHIH',kind,tag,width,way,len(ss)))
            x,z,u,v,f = ss[0]
            payload.extend(struct.pack('<iihhB',x,z,u,v,f))
            for X,Z,u,v,f in ss[1:]:
                payload.extend(struct.pack('<hhhhB',X-x,Z-z,u,v,f))
                x,z=X,Z
    wire = geo.gz(payload)
    manifest = {
        'id':'confederation-main-odbl-v1','asset':ASSET,'projectedTileMetres':TILE,
        'decodedBytes':len(payload),'compressedBytes':len(wire),'sha256':geo.sha(payload),
        'wireSha256':geo.sha(wire),'crc32':f'{zlib.crc32(payload)&0xffffffff:08x}',
        'pins': {'terrain':terrain['sha256'],'cover':hash_cover,'coverDecoded':decoded_cover,
                 'roads':hash_roads,'buildings':hash_buildings,'sidewalk':hash_sides,'parking':hash_parking},
        'tiles':nt,'paths':paths,'sections':sections,
        'runways':[[i,a['x'],a['z'],b['x'],b['z'],w]for i,a,b,w in authority['runways']],
        'protectedCoasts':authority['coastal'],
        'keys':[[x,z]for x,z in sorted(tiles)],
    }
    derived = geo.gz(json.dumps(dict(
        schema=1, relation=RELATION, relationVersion=VERSION, source=SOURCE, sourceSHA256=HASH,
        license='https://opendatacommons.org/licenses/odbl/1-0/',
        kindIndex=['compacted','fine_gravel'],
        sourceMembers=picked, exactRuntimeTileSectionsXZcm=export,
    ),separators=(',',':')).encode())
    report = dict(
        **{k:v for k,v in manifest.items() if k!='keys'},
        source=SOURCE, sourceSha256=HASH, relation=RELATION, version=VERSION, sourceMemberWays=109,
        acceptedPlanPolygonCount=len(accepted.items), contributingWays=len(used),
        sourceWayCountBreakdown=dict(counts), lengthMetres={k:round(v,3)for k,v in steps.items()},
        admittedMaterialMetres={k:round(v,3)for k,v in material.items()},
        fallbackFullWidthMetres=BASE_WIDTH_CM*.01, sourceWidthLabel='OSM tags only; not a survey', protectionObjectCounts=dict(zip(('road','building','sidewalk','parking','runway'),(len(o.items) for o in owners))),
        signedCoverClasses=CLASSES, geographicRuntimeAuthority=authority,
        openDatabaseSHA256=geo.sha(derived),
    )
    data = ROOT/'data/odbl/confederation-trail'
    data.mkdir(parents=True,exist_ok=True)
    (data/'trail-source-and-sections.json.gz').write_bytes(derived)
    geo.document(data/'qualification.json',report)
    f=WORLD/ASSET
    f.parent.mkdir(parents=True,exist_ok=True)
    f.write_bytes(wire)
    compact = json.dumps(manifest.pop('keys'),separators=(',',':'))
    generated = json.dumps(manifest,indent=2)[:-2] + ',\n  "keys": '+compact+'\n}'
    (ROOT/'src/render/confederation-trail.generated.ts').write_text('// Generated by tools/geodata/bake-confederation-trail.py.\nexport const CONFEDERATION_TRAIL='+generated+' as const;\n')
    print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':
    main()
