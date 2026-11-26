#!/usr/bin/env python3
"""Rank abrupt joins in the signed playable Sentinel atlas; do not alter imagery.

Rank is a candidate screen only: an abrupt colour step may be a real crop
boundary. Each usable candidate still needs independent in-engine A/B controls.
"""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

ATLAS_SHA = 'a92bad71e77dfb72cf02c7e4934543a86f9ac528f0cee057ddcdb16c724e1207'
COVER_SHA = 'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9'
ROWS, COLS, PX = 22, 32, 640
WIDTH, HEIGHT = 4096, 2720
BOUNDS = (-64.47, 45.94, -61.93, 47.10)
HALF_STRIP = 1.25
WINDOW, TAPER = 20, 2


def signed(data, sha, label):
    if hashlib.sha256(data).hexdigest() != sha:
        raise ValueError('Unrecognised source: ' + label)
    return data


def read_edges(world):
    manifest = json.loads(signed((world/'detail/index.json').read_bytes(), ATLAS_SHA, 'atlas'))
    if (manifest['rows'], manifest['columns'], manifest['tilePixels'], tuple(manifest['bounds'])) != (ROWS, COLS, PX, BOUNDS):
        raise ValueError('Unexpected atlas grid')
    packs = []
    for meta in manifest['packs']:
        data = signed((world/'detail'/meta['file']).read_bytes(), meta['sha256'], meta['file'])
        if len(data) != meta['bytes']:
            raise ValueError('Unexpected packed byte count')
        packs.append(data)
    edges = {}
    for label, meta in manifest['tiles'].items():
        coord = tuple(map(int, label.split('-')))
        if len(coord) != 2 or not (0 <= coord[0] < COLS and 0 <= coord[1] < ROWS) or coord in edges:
            raise ValueError('Invalid atlas tile: ' + label)
        start = meta['offset']
        data = signed(packs[meta['pack']][start:start+meta['bytes']], meta['sha256'], label)
        if start < 0 or len(data) != meta['bytes']:
            raise ValueError('Unexpected tile byte count: ' + label)
        with Image.open(io.BytesIO(data)) as image:
            if image.size != (PX, PX):
                raise ValueError('Wrong decoded colour tile size: ' + label)
            rgb = np.asarray(image.convert('RGB'), dtype=np.float32)
        edges[coord] = (rgb[:4].copy(), rgb[-4:].copy(), rgb[:,:4].copy(), rgb[:,-4:].copy())
    return edges


def cover_box(tx, tz, axis, lo):
    hi = lo + WINDOW
    if axis == 'x':
        xs, zs = [tx + 1 - HALF_STRIP/PX, tx + 1 + HALF_STRIP/PX], [tz + lo/PX, tz + hi/PX]
    elif axis == 'z':
        xs, zs = [tx + lo/PX, tx + hi/PX], [tz + 1 - HALF_STRIP/PX, tz + 1 + HALF_STRIP/PX]
    else:
        raise ValueError('Axis must be x or z')
    x0,x1 = np.floor(np.array(xs)*WIDTH/COLS - .5).astype(int) + [0,1]
    z0,z1 = np.floor(np.array(zs)*HEIGHT/ROWS - .5).astype(int) + [0,1]
    return int(x0), int(z0), int(x1), int(z1)


def eligible(cover, box):
    x0,z0,x1,z1 = box
    if not (0 <= x0 <= x1 < cover.shape[1] and 0 <= z0 <= z1 < cover.shape[0]):
        return False
    group = cover[z0:z1+1,x0:x1+1]
    return int(group[:,:,1].min()) >= 148 and bool(np.isin(group[:,:,0], [30,40]).all())


def rank_window(cross, inner):
    p25, median = np.quantile(cross, [.25, .5])
    baseline = float(np.median(inner))
    score = float(p25) - baseline
    if p25 < 18 or median < 28 or score < 10:
        return None
    return dict(median=round(float(median),3), p25=round(float(p25),3),
                inner=round(baseline,3), score=round(score,3))


def contrasting_edges(edges, cover):
    counts = {k:{'adjacentPairs':0,'eligibleWindows':0,'highContrastWindows':0} for k in ('x','z')}
    found = []
    for (tx,tz), parts in sorted(edges.items()):
        for axis, peer, first, along_side in (
            ('x', (tx+1,tz), parts[3], 2),
            ('z', (tx,tz+1), parts[1].transpose(1,0,2), 0),
        ):
            if peer not in edges:
                continue
            stats = counts[axis]
            stats['adjacentPairs'] += 1
            second = edges[peer][along_side]
            if axis == 'z':
                second = second.transpose(1,0,2)
            cross = np.linalg.norm(first[:,3] - second[:,0], axis=-1)
            inner = (np.linalg.norm(first[:,3] - first[:,2], axis=-1) +
                     np.linalg.norm(second[:,0] - second[:,1], axis=-1)) * .5
            for lo in range(PX-WINDOW+1):
                box = cover_box(tx,tz,axis,lo)
                if not eligible(cover, box):
                    continue
                stats['eligibleWindows'] += 1
                core = slice(lo+TAPER, lo+WINDOW-TAPER)
                score = rank_window(cross[core], inner[core])
                if score is None:
                    continue
                stats['highContrastWindows'] += 1
                along = (lo+WINDOW*.5)/PX
                west,south,east,north = BOUNDS
                lon = west+(east-west)*(tx+(1 if axis=='x' else along))/COLS
                lat = north-(north-south)*(tz+(1 if axis=='z' else along))/ROWS
                found.append(dict(
                    axis=axis, ownerTiles=[f'{tx}-{tz}',f'{peer[0]}-{peer[1]}'],
                    alongWindow=[lo,lo+TAPER,lo+WINDOW-TAPER,lo+WINDOW],
                    centerLonLat=[round(lon,8),round(lat,8)],
                    coverBox=[box[0],box[1],box[2]-box[0]+1,box[3]-box[1]+1], **score))
    return counts, found


def rank_distinct(found, limit):
    selected = []
    occupied = {}
    for row in sorted(found, key=lambda r:(-r['score'],r['ownerTiles'],r['alongWindow'][0])):
        key = tuple(row['ownerTiles'])
        lo = row['alongWindow'][0]
        nearby = occupied.setdefault(key,[])
        if any(abs(lo - i) < WINDOW+4 for i in nearby):
            continue
        selected.append(row)
        nearby.append(lo)
        if len(selected) == limit:
            break
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', type=Path, default=Path.cwd())
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--limit', type=int, default=30)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error('--limit must be 1 to 1,000')
    world = args.checkout/'public/world'
    cover_raw = signed(gzip.decompress((world/'cover.bin.gz').read_bytes()), COVER_SHA, 'land cover')
    cover = np.frombuffer(cover_raw,np.uint8).reshape(HEIGHT,WIDTH,2)
    edges = read_edges(world)
    counts, candidates = contrasting_edges(edges, cover)
    report = dict(
        kind='Source contrast screen only; a high rank is not a render defect or permission to retouch',
        atlasSha256=ATLAS_SHA, decodedCoverSha256=COVER_SHA, authenticatedTiles=len(edges),
        counts=counts, distinctCandidates=rank_distinct(candidates, args.limit))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report,indent=2)+'\n')
    print(f'Screened {len(edges)} signed tiles, {sum(v["adjacentPairs"] for v in counts.values())} adjacent pairs; output {args.out}')


if __name__ == '__main__':
    main()
