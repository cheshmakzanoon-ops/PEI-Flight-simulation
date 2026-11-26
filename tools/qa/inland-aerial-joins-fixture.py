#!/usr/bin/env python3
"""Create an isolated test build input with one QA-only departure; no runtime code changes."""
import argparse
import json
import shutil
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout', type=Path, default=Path.cwd())
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--corridors', type=Path, help='JSON receipt of private virtual corridor positions')
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
anchor = '\n];\n// The lower route'
if src.count(anchor) != 1:
    raise ValueError('The departure roster moved; revalidate this isolated fixture.')
if args.corridors:
    rows = json.loads(args.corridors.read_text())
    if not isinstance(rows, list) or not rows:
        parser.error('Expected one or more private corridor records')
    fixture = ''.join('\n '+json.dumps(dict(
        id='qa-'+r['name'], name='Technical QA: '+r['name'], region='Technical QA',
        lon=r['lon'],lat=r['lat'],heading=r['heading'],height=r['agl'],
        note='Private fixed replay. Not an operational departure.'))+',' for r in rows)
else:
    fixture = """
 {id:'qa-inland-image-crossing',name:'Test only: west image join',region:'Prince County',lon:-63.83635482655934,lat:46.44884465839125,heading:90,height:42,note:'Private fixed replay. Not an operational departure.'},"""
places.write_text(src.replace(anchor, fixture+anchor, 1))
print('Fixture created. Build its directory with npm run build; the real checkout was not edited.')
