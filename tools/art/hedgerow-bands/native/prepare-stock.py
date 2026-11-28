"""Prepare an isolated ordinary-flight baseline in a fresh path, not a game change."""
import argparse,json,shutil,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,required=True)
p.add_argument('--deps',type=Path,required=True,help='existing project node_modules')
p.add_argument('--out',type=Path,required=True)
a=p.parse_args();D=Path(__file__).resolve().parent
r=a.checkout.resolve();d=a.out.resolve();dep=a.deps.resolve()
rev=subprocess.check_output(['git','-C',str(r),'rev-parse','HEAD'],text=True).strip()
assert rev=='971ae83965b6a94b51cd8a562d2d1f619e02d177'
assert not d.exists() and dep.is_dir()
app=d/'app';app.mkdir(parents=True)
for f in ['index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json']:
 shutil.copyfile(r/f,app/f)
shutil.copytree(r/'src',app/'src')
for f in ['tools/art/basin-head-cannery-finish/basin-waterfront-finish.ts',
          'tools/art/north-cape-lighthouse/north-cape-lens-draft.ts',
          'tools/art/summerside-station/roof-finish/rail-roof-finish.ts']:
 (app/f).parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(r/f,app/f)
(app/'public').symlink_to(r/'public',target_is_directory=True)
(app/'node_modules').symlink_to(dep,target_is_directory=True)
courses=json.loads((D.parent/'evidence/private-physical-routes.json').read_text())['examples']
with (app/'src/sim/places.ts').open('a') as f:
 f.write('\n// Isolated QA-only ordinary departures. No altered camera, physics or art.\nSITES.push(...'+json.dumps([j['departure'] for j in courses.values()],indent=2)+');\n')
m=app/'src/main.ts';s=m.read_text()
s="import {hedgeStockProof} from './render/hedge-stock-proof.ts';\n"+s
a=s.index(" const submitWorld=");b=s.index("\n const drawWorld=",a)
q=s[a:b];assert q.count("renderer.render(scene,camera)") == 4
s=s[:a]+""" const hedgeRead=hedgeStockProof(renderer,scene,camera,vegetation,
  ()=>({site:SITES[activeSite].id,mode:ui.mode,view,x:f.x,z:f.z}));
"""+q.replace("renderer.render(scene,camera)", "hedgeRead(()=>renderer.render(scene,camera))")+s[b:]
m.write_text(s)
shutil.copyfile(D/'hedge-stock-proof.ts',app/'src/render/hedge-stock-proof.ts')
qa=d/'qa';qa.mkdir()
for f in ['serve.py','stock.py','score-scope.py']:shutil.copyfile(D/f,qa/f)
