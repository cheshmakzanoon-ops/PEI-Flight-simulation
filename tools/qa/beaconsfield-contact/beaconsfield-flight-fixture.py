#!/usr/bin/env python3
"""Build a scratch flight fixture with two Beaconsfield comparison routes; not a departure roster."""
import argparse
import shutil
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout',type=Path,default=Path.cwd())
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
repo,out=args.checkout.resolve(),args.out.resolve()
if repo==out or repo in out.parents or out.exists():
    parser.error('Choose a new directory outside the checkout.')
if not (repo/'node_modules').is_dir():
    parser.error('Install the existing locked dependencies in the checkout first.')
out.mkdir()
shutil.copytree(repo/'src',out/'src')
for name in ('index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts'):
    shutil.copy2(repo/name,out/name)
for name in ('public','node_modules'):
    (out/name).symlink_to(repo/name,target_is_directory=True)
p=out/'src/sim/places.ts'
s=p.read_text()
anchor='\n];\nfunction cyyg10SimulatorEnds'
if s.count(anchor)!=1:
    raise SystemExit('Checked departure roster moved; revalidate fixture.')
# Starts over real map space and uses existing simulator controls.
routes=[
    dict(id='qa-beacons-harbour',name='QA only: Beaconsfield harbour',region='Queens County',lon=-63.135787592230535,lat=46.22925383992724,heading=31,height=68),
    dict(id='qa-beacons-street',name='QA only: Beaconsfield street',region='Queens County',lon=-63.13073184227575,lat=46.23053402723724,heading=305,height=78),
]
import json
p.write_text(s.replace(anchor,',\n'+',\n'.join(json.dumps(x|{'note':'Virtual flight QA only; not an aviation route.'},ensure_ascii=False) for x in routes)+anchor,1))
