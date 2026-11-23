#!/usr/bin/env python3
"""Combine separately verified literal-roof cohorts of the same pinned atlas."""
from pathlib import Path
from collections import defaultdict
import argparse,json,re
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--out',required=True,type=Path)
p.add_argument('cohorts',nargs='+',type=Path)
a=p.parse_args()
if a.out.resolve() in [x.resolve()for x in a.cohorts]:
    p.error('Write a new file rather than replacing an input cohort.')
tile_rows=defaultdict(dict)
atlas=None
for source in a.cohorts:
    s=source.read_text()
    token=re.search(r'export const NEUTRAL_ATLAS_SHA="([a-f0-9]{64})";',s)
    if not token:raise ValueError(f'No valid atlas SHA in {source}')
    sha=token[1]
    if atlas and atlas!=sha:raise ValueError(f'{source} comes from a different atlas.')
    atlas=sha
    rows=json.loads(s.split('export const NEUTRAL_ROWS=',1)[1].split(' as const;')[0])
    for tile,L in rows.items():
        if not re.fullmatch(r'q[0-3]+',tile) or not isinstance(L,list):
            raise ValueError(f'Malformed tile {tile} in {source}')
        for slot,outline,datum,*planes in L:
            if type(slot) is not int or slot<0 or slot in tile_rows[tile]:
                raise ValueError(f'Unknown or duplicate site {tile}/{slot}')
            if not isinstance(outline,list) or len(outline)<6 or len(outline)%2 or any(type(x) is not int for x in outline):
                raise ValueError(f'Nonliteral ordered outline: {tile}/{slot}')
            if type(datum) is not int or len(planes) not in (3,6,9,12) or any(type(p) is not int for p in planes):
                raise ValueError(f'Malformed roof planes: {tile}/{slot}')
            tile_rows[tile][slot]=[slot,outline,datum,*planes]
if not tile_rows:raise ValueError('No roof models supplied.')
def compact(d):return json.dumps(d,separators=(',',':'))
out='// Native survey roof planes, ordered by exact atlas slot. Do not hand edit.\n'
out+='export const NEUTRAL_ATLAS_SHA='+compact(atlas)+';\nexport const NEUTRAL_ROWS={\n'
out+=',\n'.join(' '+compact(tile)+':'+compact([rows[k]for k in sorted(rows)])for tile,rows in sorted(tile_rows.items()))
a.out.write_text(out+'\n} as const;\n')
print(f'Combined {sum(map(len,tile_rows.values()))} roofs in {len(tile_rows)} original atlas chunks.')
