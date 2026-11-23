"""Emit literal outline and display-independent 2025 tone for supported roof pixels."""
from collections import defaultdict
from pathlib import Path
import argparse,gzip,hashlib,json,numpy as np
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--exclude',type=Path);a=p.parse_args()
R=a.root/'public/world';q=json.loads(a.input.read_text());idx=json.loads((R/'buildings/index.json').read_text());packed=(R/'buildings/tiles.pack').read_bytes()
sha=lambda a:hashlib.sha256(a).hexdigest()
assert sha(packed)==idx['sha256']==q['sources']['atlasSha']
assert sha((R/'detail/index.json').read_bytes())==q['sources']['sentinel2025IndexSha']
source={r['id']:r for r in idx['tiles']};cache={};emit=defaultdict(list)
held={(r['owner'],r['row'])for r in json.loads(a.exclude.read_text())}if a.exclude else set()
ids=sorted(q['proofCases'],key=lambda r:(r['owner'],r['row']))
for x in ids:
 id,row=x['owner'],x['row']
 if (id,row) in held:continue
 if id not in cache:
  t=source[id];data=packed[t['offset']:t['offset']+t['bytes']];assert sha(data)==t['sha256']
  cache[id]=json.loads(gzip.decompress(data))['features']
 q0=cache[id][row]
 assert not q0.get('holes') and np.max(np.abs(np.mean(q0['footprint'],axis=0)-x['centerLonLat']))<2e-12
 pts=[round(s*1e6)for point in q0['footprint'] for s in point]
 rgb=[round(v*2)for v in x['rgb']] # exact half-value medians after unambiguous pixels
 assert all(72<v<492 for v in rgb)
 emit[id].append([row,pts,*rgb])
j=lambda x:json.dumps(x,separators=(',',':'))
a.out.write_text('// Generated 2025 Sentinel-2 tone support on the exactly ordered large-roof atlas.\nexport const TONE_ATLAS_SHA='+j(idx['sha256'])+';\nexport const ROOF_TONES={\n'+',\n'.join(' '+j(t)+':'+j(v)for t,v in emit.items())+'\n} as const;\n')
print(sum(map(len,emit.values())),len(emit),'atlas tiles')
