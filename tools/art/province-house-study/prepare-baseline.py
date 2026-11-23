"""Build an instrumented, frame-identical baseline from pinned original E files."""
from pathlib import Path
from argparse import ArgumentParser
import hashlib,tarfile,shutil

PIN='e1880fdc7d58e00a4225700ad93efa7dd6ba42dcf77569328babbf5a585f4041'
ORIGINAL={'package.json': 'f3eee27024167590e399a2bee1b6697f4b2359c4443b00355673d33aa7d8d5cf', 'package-lock.json': 'b2c5f8a677f7c1f25b10a892f4a324bdd0cef9fe4b0238f1ca0236db89ef9b5a', 'tsconfig.json': 'e761dbef700e2d2d309f1298f0c517ae559ea9d0465ea37abc37af158d309a30', 'index.html': '6e2e27fd5b6ca6deb5207ed28138665f2743ab70ebfc0c4c2d81072a8602f615', 'src/main.ts': 'd2f86334d0ee518191eddcb14ad9281d446226a5a38b4fcd610df831ef40183d', 'src/masonry.ts': '3a3a0727d93c306daa8648d2fa0f706f2f499fe6830f41b5aae312029dbd9cae', 'src/portico.ts': '3b0a20aa4edc8426259064ecd860585c71374ef1a1745a7ba239645b4df4d982'}
p=ArgumentParser()
p.add_argument('reference',type=Path,help='E art source directory from the pinned commit, or the original frozen E archive')
p.add_argument('dest',type=Path)
a=p.parse_args()
a.dest.mkdir(parents=True,exist_ok=True)
if any(a.dest.iterdir()):
 raise ValueError('Destination must be empty to avoid mixing builds.')
def sha(f):return hashlib.sha256(f.read_bytes()).hexdigest()
if a.reference.is_file():
 if sha(a.reference)!=PIN:raise ValueError('Use the original frozen E archive.')
 with tarfile.open(a.reference) as tar:tar.extractall(a.dest,filter='data')
elif a.reference.is_dir():
 for file,hash0 in ORIGINAL.items():
  if sha(a.reference/file)!=hash0:raise ValueError(f'Unexpected E version for {file}.')
 for file in ORIGINAL:
  target=a.dest/file;target.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(a.reference/file,target)
else:raise FileNotFoundError(a.reference)
for file,hash0 in ORIGINAL.items():
 if sha(a.dest/file)!=hash0:raise ValueError(f'Unexpected E source for {file}.')

def once(s,old,new):
 assert s.count(old)==1, f'Unexpected E source around {old}'
 return s.replace(old,new)

f=a.dest/'src'/'portico.ts';s=f.read_text()
s=once(s,'  const plain =','  const texturePrepare:Record<string,number>={};\n  const plain =')
s=once(s,'    const { map,normalMap,roughnessMap } = ashlarMaps(family,size);','    const start=performance.now();\n    const { map,normalMap,roughnessMap } = ashlarMaps(family,size);\n    texturePrepare[family]=performance.now()-start;')
s=once(s,'return {stagedGeometry,nearOrders,approachOrders,unworked,neutral,finite};','return {stagedGeometry,nearOrders,approachOrders,unworked,neutral,finite,texturePrepare};')
f.write_text(s)
f=a.dest/'src'/'main.ts';s=f.read_text()
s=once(s,'const renderer =','const phaseStart=performance.now();\nconst renderer =')
s=once(s,'unworked,neutral,finite}=porticoStudy();','unworked,neutral,finite,texturePrepare}=porticoStudy();\nconst prepareEnd=performance.now();')
s=once(s,"render(true,'street',true,'auto');","const firstRenderStart=performance.now();\nrender(true,'street',true,'auto');\nconst firstRenderEnd=performance.now();\n(Object.assign(window,{porticoBoot:{ready:Promise.resolve(),phaseStart,prepareEnd,firstRenderStart,firstRenderEnd,texturedEnd:firstRenderEnd,texturePrepare}}));")
probe=(Path(__file__).parent/'src'/'main.ts').read_text().split('async function geometryFingerprint(){',1)[1].split('Object.assign(window,{portico:',1)[0]
s=once(s,'Object.assign(window,{portico:{render,inspect,stonePoint}});','async function geometryFingerprint(){'+probe+'Object.assign(window,{portico:{render,inspect,stonePoint,geometryFingerprint}});')
f.write_text(s)
