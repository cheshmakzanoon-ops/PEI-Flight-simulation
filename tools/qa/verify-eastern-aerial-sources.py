#!/usr/bin/env python3
"""Authenticate the original texels and continuous cover support of eastern joins."""
import argparse
import gzip
from hashlib import sha256
from io import BytesIO
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image


ATLAS = 'a92bad71e77dfb72cf02c7e4934543a86f9ac528f0cee057ddcdb16c724e1207'
COVER = 'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9'
NAMES = ('kings-central-cropland','queens-south-grassland','kings-shared-fields','queens-eastern-grassland')


def digest(data):
    return sha256(data).hexdigest()


def checked(data, sha, label):
    if digest(data) != sha:
        raise ValueError('Unrecognized source: ' + label)
    return data


def cover_axis(a, b, scale):
    # Union of nearest land-cover and every possible bilinear coast tap.
    return min(math.floor(a*scale), math.floor(a*scale-.5)), max(math.floor(b*scale), math.floor(b*scale-.5)+1)


def verify(repo, selected=NAMES):
    world = repo / 'public/world'
    names = repo / 'src/render/inland-ortho-windows.ts'
    left = names.read_text().split('export const INLAND_ORTHO_WINDOWS=')[1]
    plans = {p['name']:p for p in json.loads(left.split(' as const;')[0])}
    atlas = json.loads(checked((world/'detail/index.json').read_bytes(), ATLAS, 'atlas'))
    assert [atlas[k] for k in ('columns','rows','tilePixels','bounds')] == [32,22,640,[-64.47,45.94,-61.93,47.1]]
    cover = np.frombuffer(checked(gzip.decompress((world/'cover.bin.gz').read_bytes()), COVER, 'cover'),
                          dtype=np.uint8).reshape(2720,4096,2)

    def texture(id, lock):
        wire = atlas['tiles'][id]
        pack = atlas['packs'][wire['pack']]
        if wire['pack'] not in packs:
            p = checked((world/'detail'/pack['file']).read_bytes(),pack['sha256'],pack['file'])
            assert len(p) == pack['bytes']
            packs[wire['pack']] = p
        blob = packs[wire['pack']][wire['offset']:wire['offset']+wire['bytes']]
        assert wire['sha256'] == lock and len(blob) == wire['bytes'] and wire['offset'] >= 0
        with Image.open(BytesIO(checked(blob,lock,id))) as im:
            assert im.size == (640,640)
            return np.asarray(im.convert('RGB'))

    packs = {}
    receipts = []
    if not selected or len(set(selected)) != len(selected):
        raise ValueError("Select distinct authored windows")
    for name in selected:
        p = plans[name]
        x,z = map(int,p['first'].split('-'))
        axis = p['axis']
        lo,c0,c1,hi = p['alongSourceTexels']
        assert axis in ('x','z') and lo+2 == c0 and c0+16 == c1 and c1+2 == hi and 0 <= lo < hi <= 640
        east = axis == 'x'
        edge = x+1 if east else z+1
        assert p['edge'] == edge and p['second'] == f'{x+east}-{z+int(not east)}'
        narrow = (edge-1.25/640,edge+1.25/640)
        wide = ((z if east else x)+lo/640,(z if east else x)+hi/640)
        ax,az = (narrow,wide) if east else (wide,narrow)
        x0,x1 = cover_axis(*ax,4096/32)
        z0,z1 = cover_axis(*az,2720/22)
        assert 0 <= x0 <= x1 < 4096 and 0 <= z0 <= z1 < 2720
        assert p['coverBox'] == [x0,z0,x1-x0+1,z1-z0+1]
        rg = cover[z0:z1+1,x0:x1+1]
        assert rg.flatten().tolist() == p['coverRG']
        classes = sorted(map(int,np.unique(rg[:,:,0])))
        code = int(rg[:,:,1].min())
        assert not set(classes)-{30,40} and code >= 148
        first,second = texture(p['first'],p['nsha']),texture(p['second'],p['ssha'])
        if east:
            matrix = np.concatenate([first[lo:hi,-2:],second[lo:hi,:2]],axis=1)
        else:
            matrix = np.concatenate([first[-2:,lo:hi],second[:2,lo:hi]],axis=0).transpose(1,0,2)
        assert matrix.shape == (20,4,3)
        samples = matrix[c0-lo:c1-lo].astype(np.float64)
        distance = lambda a,b: np.linalg.norm(a-b, axis=1)
        inner = (distance(samples[:,0],samples[:,1])+distance(samples[:,2],samples[:,3]))*.5
        rgb = distance(samples[:,1],samples[:,2])
        receipts.append(dict(name=name,axis=axis,owners=[p['first'],p['second']],window=[lo,c0,c1,hi],
            donorWireSHA256=[p['nsha'],p['ssha']],exactSourceRGBSHA256=digest(matrix.tobytes()),
            coverBox=p['coverBox'],classes=classes,minimumCoverCode=code,
            medianNativeStep=round(float(np.median(rgb)),3),medianInnerNeighbourStep=round(float(np.median(inner)),3)))
    return dict(atlas=ATLAS,decodedCover=COVER,windows=receipts,scope='Original source only; no added ground truth or aerial resolution.')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,default=Path.cwd())
    p.add_argument('--out',type=Path)
    p.add_argument('--window',action='append',help='Exact authored window name; repeat to check several')
    args = p.parse_args()
    report = json.dumps(verify(args.checkout,args.window or NAMES),indent=2)+'\n'
    if args.out:
        args.out.write_text(report)
    else:
        print(report,end='')
