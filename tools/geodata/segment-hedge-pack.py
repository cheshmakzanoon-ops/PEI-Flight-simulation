#!/usr/bin/python3
"""Keep slow non-Range hosts from fetching more than 535 kB per tile-group probe."""
import argparse,json
from hashlib import sha256
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--from',dest='a',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
m=json.loads((a.a/'index.json').read_text());pack=(a.a/'stands.pack').read_bytes()
assert len(pack)==m['bytes'] and sha256(pack).hexdigest()==m['sha256']
parts=[];active=bytearray();previous=0
def finish():
    filename='hedge-'+str(len(parts)).zfill(2)+'.pack'
    (a.out/filename).write_bytes(active)
    parts.append(dict(file=filename,bytes=len(active),sha256=sha256(active).hexdigest()))
    active.clear()
for tile in m['tiles']:
    start=tile['offset'];n=tile['bytes']
    assert start==previous and 0<n<535000
    previous+=n
    if len(active)+n>535000:finish()
    tile['offset']=len(active);tile['pack']=len(parts)
    active.extend(pack[start:start+n])
if active:finish()
assert previous==len(pack)
m['packs']=parts
(a.out/'index.json').write_text(json.dumps(m,separators=(',',':'))+'\n')
print(len(parts),sum(p['bytes'] for p in parts))
