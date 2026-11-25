#!/usr/bin/env python3
"""Compare points in known original vs candidate actual submitted Three ground faces."""
import argparse,json,math,statistics
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--old',type=Path,required=True)
p.add_argument('--candidate',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--mode',choices=('coupled','stock'),default='coupled')
a=p.parse_args()
old=json.loads(a.old.read_text())[0]
new=json.loads(a.candidate.read_text())[0]
assert old['name']==new['name'] and old['pose']==new['pose'],'Comparison camera or elevation moved.'
assert old['diag']['buildingTiles']==new['diag']['buildingTiles']
assert old['diag']['beaconsfieldReview'] and new['diag']['beaconsfieldReview']
def canonical_roster(d):
    return sorted((tuple(r['root']),tuple(r['shape']),r['isHedge']) for r in d['frontageStems']['stems'])
assert canonical_roster(old)==canonical_roster(new),'An existing tree was moved, changed or replaced.'
assert old['frontageStems']['instanceCount']==new['frontageStems']['instanceCount']
draws=new['diag']['drawCalls']-old['diag']['drawCalls']
A,B=old['groundRays'],new['groundRays']
eq=lambda x,y,eps=7.0e-6:abs(x-y)<=eps
interior=[]
fringe=[]
unmodified=[]
mesh_visual_error=[]
core_contact_error=[]
for u,v in zip(A,B,strict=True):
    assert (u['x'],u['z'],u['key'],u['lod'],u['land'])==(v['x'],v['z'],v['key'],v['lod'],v['land'])
    assert v['lod']==112 and v['land']
    wr=v.get('gradeWeight',0)
    assert math.isfinite(wr) and 0<=wr<=1.0000001
    tolerance=7.0e-6 if wr<=1.0e-8 else .0005
    # Mounted mesh coordinates are Float32; retain a sub-millimetre allowance
    # inside the newly subdivided fine surface. World exterior remains strict.
    mesh_visual_error.append(abs(v['visualRendererY']-v['visualCPUY']))
    assert eq(v['visualRendererY'],v['visualCPUY'],tolerance),(v,'actual render/visual sampler disagree')
    delta=v['visualRendererY']-u['visualRendererY']
    if wr<=1.0e-8:
        assert eq(delta,0) and v['colliderY']==u['colliderY'],(v,'stock footprint changed')
        unmodified.append(delta)
    elif wr>=.99999:
        core_contact_error.append(abs(v['colliderY']-v['visualRendererY']))
        assert eq(v['colliderY'],v['visualRendererY'],.0005),(v,'100% actual/aircraft contact mismatch')
        interior.append(delta)
    else:
        fringe.append(delta)
assert len(A)==len(B) and len(A)>=60
if a.mode=='stock':
    assert len(unmodified)==len(A) and not interior and not fringe
    assert old['fileSha256']==new['fileSha256'] and draws==0 and old['diag']['triangles']==new['diag']['triangles']
else:
    assert unmodified and (interior or fringe)
    assert 0<=draws<=1,('Expected at most one scoped shadow receiver draw',draws)
stats=lambda rows:dict(n=len(rows),medianM=statistics.median(rows) if rows else None,
    minM=min(rows) if rows else None,maxM=max(rows) if rows else None)
a.out.write_text(json.dumps(dict(scope='Actual live Three terrain at 60 preregistered QA points, not geological validation.',view=new['name'],
 requestedMode=a.mode,scopedDrawDelta=draws,maxActualVersusVisualM=max(mesh_visual_error),maxCoreActualVersusAircraftM=max(core_contact_error,default=0),unchanged=stats(unmodified),fringe=stats(fringe),full=stats(interior),oldRGB=old['fileSha256'],newRGB=new['fileSha256']),indent=2)+'\n')
