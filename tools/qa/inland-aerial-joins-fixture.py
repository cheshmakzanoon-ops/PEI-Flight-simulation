#!/usr/bin/env python3
"""Create an isolated test build input with one QA-only departure; no runtime code changes."""
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', type=Path, default=Path.cwd())
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
repo = args.checkout.resolve()
out = args.out.resolve()
if out == repo or repo in out.parents:
    parser.error('Choose an unused directory outside the real checkout.')
if not (repo/'node_modules').is_dir():
    parser.error('Run npm ci in the real checkout first.')
out.mkdir(parents=False, exist_ok=False)
shutil.copytree(repo/'src',out/'src')
for name in ('index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'):
    shutil.copy2(repo/name,out/name)
for name in ('public','node_modules'):
    (out/name).symlink_to(repo/name, target_is_directory=True)
places = out/'src/sim/places.ts'
src = places.read_text()
anchor = '\n];\nfunction cyyg10SimulatorEnds'
if src.count(anchor) != 1:
    raise ValueError('The departure roster moved; revalidate this isolated fixture.')
fixture = """,
 {id:'qa-inland-image-crossing',name:'Test only: west image join',region:'Prince County',lon:-63.83635482655934,lat:46.44884465839125,heading:90,height:42,note:'Private fixed replay. Not an operational departure.'}"""
places.write_text(src.replace(anchor, fixture+anchor, 1))
print('Fixture created. Build its directory with npm run build; the real checkout was not edited.')
