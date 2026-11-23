#!/usr/bin/env python3
"""Matched actual Three.js scenes of one independently replaceable Montague roof and porch."""
import argparse
import importlib.util
import os
from pathlib import Path

s=importlib.util.spec_from_file_location('paired',Path(__file__).with_name('montague-hall-frames.py'))
paired=importlib.util.module_from_spec(s)
s.loader.exec_module(paired)

t=(-62.64638,46.16339875)
paired.poses={
 'croft-street':paired.geometric((-62.646516,46.163573),t,7,4.95),
 'croft-verandah':paired.geometric((-62.64630,46.163201),t,7,4.90),
 'croft-roofline':paired.geometric((-62.646757,46.163633),t,7,22),
 'croft-flight':paired.geometric((-62.645674,46.164295),t,7,118),
 'east-point-control':paired.poses['east-point-control']
}

def stage(repo,root,deps,void_probe):
    paired.stage_target(repo,root,deps,void_probe,'montagueMacdonaldModel',
        'const macdonald=this.montagueMat?',48,(52,53,58))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
    p.add_argument('--deps',type=Path);p.add_argument('--views',default=','.join(paired.poses))
    p.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
    p.set_defaults(void_probe=False)
    paired.fixed.stage=stage
    paired.fixed.run(p.parse_args())
