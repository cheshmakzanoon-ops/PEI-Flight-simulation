"""Bake geometric roof replacement candidates while preserving neutral materials and exact plan IDs."""
import argparse,json,hashlib,runpy,sys,gzip
from pathlib import Path
from collections import Counter,defaultdict
import numpy as np
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('--root',type=Path,default=Path.cwd())
cli.add_argument('--scratch',type=Path,required=True)
cli.add_argument('--out',type=Path,required=True)
cli.add_argument('--exclusions',type=Path)
arg=cli.parse_args()
p=arg.scratch;root=arg.root;dest=arg.out
sys.argv=['existing-fitter','--root',str(root),'--scratch',str(p)]
C=runpy.run_path(str(root/'tools/geodata/fit-house-roof-planes.py'))
pack=(root/'public/world/buildings/tiles.pack').read_bytes()
idx=json.loads((root/'public/world/buildings/index.json').read_text()); assert hashlib.sha256(pack).hexdigest()==idx['sha256']

def registered(fname,marker):
 s=(root/'src/render'/fname).read_text()
 model=json.loads(s.split(marker+'=',1)[1].split(' as const')[0])
 return {(tile,r[0]) for tile,rs in model.items() for r in rs}
reserved=registered('farm-shells.generated.ts','export const FARM_PROFILES')|registered('home-envelopes.generated.ts','export const HOME_FORMS')
# Hand-authored tiles with known exact replacements can coexist (runtime priority),
# but this scout checks count overlap against the broader authored sets as well.
m=json.loads((root/'src/sim/fitted-roofs.json').read_text())
atlas={q['id']:q for q in idx['tiles']}
lookup={}
for q in (p/'windows').glob('group-*.npz'):
 with np.load(q) as a:
  for k in a:
   if k.endswith('_origin'):lookup[k[:-7]]=q
cases=[]; reasons=Counter();ids=defaultdict(list)
exclude=json.loads(arg.exclusions.read_text()) if arg.exclusions else []
excluded={(r['tile'],r['i'])for r in exclude}
for r in sorted(json.loads((p/'residential-shapes.json').read_text()),key=lambda q:(q['tile'],q['i'])):
 tid,i=r['tile'],r['i']; key=tid+'_'+str(i)
 if (tid,i) in excluded:reasons['additional absolute mesh gate']+=1;continue
 if (tid,i) in reserved or any(u['tile']==tid and u['firstLonLat']==r['fp'][0] and u['vertices']==len(r['fp']) for u in m['roofs']):reasons['already-authored source']+=1;continue
 if r['olderP90']-r['p90']<.15:reasons['gain under .15m']+=1;continue
 q=atlas[tid];data=pack[q['offset']:q['offset']+q['bytes']];assert hashlib.sha256(data).hexdigest()==q['sha256']
 assert json.loads(gzip.decompress(data))['features'][i]['footprint']==r['fp']
 with np.load(lookup[key]) as f:
  pos,heights,ring,hold,datum,sha=C['sample_area'](f,r)
  assert r['windowSHA']==sha and int(hold.sum())==r['nHold']
 ll=(pos[hold]+np.array(r['world']))/C['scale']+C['origin']
 Y=heights[hold]+datum
 codes=np.rint(np.asarray(r['planes'])*[1000,1e6,1e6]).astype(int).ravel().tolist()
 ring_literal=[round(d*1e6) for vertex in r['fp'] for d in vertex]
 ids[tid].append([i,ring_literal,round(1000*datum),*codes])
 cases.append(dict(tile=tid,i=i,city=r['city'],kind=r['kind'],surveyHash=sha,footprint=r['fp'],oldP90=r['olderP90'],p90=r['p90'],expectedDatum=datum,points=np.c_[ll,Y].tolist()))
strj=lambda x:json.dumps(x,separators=(',',':'))
dest.write_text('// Native survey roof planes, ordered by exact atlas slot. Do not hand edit.\nexport const NEUTRAL_ATLAS_SHA='+strj(idx['sha256'])+';\nexport const NEUTRAL_ROWS={\n'+',\n'.join(' '+strj(t)+':'+strj(rows)for t,rows in ids.items())+'\n} as const;\n')
(p/'roof-holdout.json').write_text(strj(cases)+'\n')
print(dict(Counter(r['city']for r in cases)),len(cases),sum(len(r['points']) for r in cases),reasons)
