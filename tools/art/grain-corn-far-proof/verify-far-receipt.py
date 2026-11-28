"""Apply the detached small-footprint gates to the independent scored receipts."""
from hashlib import sha256
import argparse,json,statistics
from pathlib import Path

a=argparse.ArgumentParser(description=__doc__)
a.add_argument("angular",type=Path)
a.add_argument("moving",type=Path)
p=a.parse_args()

angular_raw=p.angular.read_bytes()
moving_raw=p.moving.read_bytes()
s=json.loads(angular_raw)["rows"]
q=json.loads(moving_raw)["frames"]
digest=lambda b:sha256(b).hexdigest()
poses=[[7.4,11.6],[96.8,13.2],[186.2,15.3],[278.7,17.6],[359.1,14.1]]
expect={(i,n,az,e)for i in (0,1)for n in (16,32)for az,e in poses}
if len(s)!=20 or {(x["variant"],x["px"],x["azimuth"],x["elev"])for x in s}!=expect or len(q)!=120:
    raise ValueError("incomplete detached far view docket")
assert sorted(x["frame"] for x in q)==list(range(120))
stat={}
for n in (16,32):
    rows=[x for x in s if x["px"]==n]
    y=[x["dense"]for x in rows]
    avg_err=statistics.mean(j["symmetricError"]for j in y)
    strong=statistics.mean(min(j["oldLinear"]["symmetricError"],j["oldNearest"]["symmetricError"])for j in rows)
    assert avg_err/strong<=.8
    assert all(.85<=j["mass"]<=1.15 and max(j["dualLumaP90"])<=15 and j["falseIsland"]<=.03 and j["missedCore"]<=.10 for j in y)
    assert all(j["dense"]["symmetricError"]<=min(j["oldLinear"]["symmetricError"],j["oldNearest"]["symmetricError"])+.025 for j in rows)
    stat[n]={"minMaxMass":[min(j["mass"]for j in y),max(j["mass"]for j in y)],
             "relativeSymmetricAlphaErrorVsBetterSameViewControl":avg_err/strong,
             "maxDualBackgroundDisplayLumaP90":max(max(j["dualLumaP90"])for j in y),
             "maxConservativeIslandAlpha":max(j["falseIsland"]for j in y),
             "maxMissingCore":max(j["missedCore"]for j in y)}
motion={}
for n in (20,23):
    x=[r for r in q if r["span"]==n]
    y=[r for r in x if "relativePhaseRMS"in r]
    assert len(x)==60 and len(y)==56
    assert all(.85<=j["mass"]<=1.15 and max(j["brightP90"],j["darkP90"])<=15 for j in x)
    assert all(j["relativePhaseRMS"]<=1 for j in y)
    motion[n]={"frames":len(x),"phasePairs":len(y),
        "nativeMassMinMax":[min(j["mass"]for j in x),max(j["mass"]for j in x)],
        "maxBrightP90":max(j["brightP90"]for j in x),
        "maxDarkP90":max(j["darkP90"]for j in x),
        "phaseMedianRelativeRMS":statistics.median(j["relativePhaseRMS"]for j in y),
        "phaseMaxRelativeRMS":max(j["relativePhaseRMS"]for j in y),
        "phaseMaxResidualCodes":max(j["residualPhaseRMS"]for j in y)}
print(json.dumps({
    "scope":"Detached far-only original source synthesis. No game texture, land placement, active flight, shading or runtime performance claim.",
    "matrix":"Two original weathered clusters, actual source 4x Mesa, linked Three.js r187 transport",
    "angularPages":144,"standVariants":2,"linearAssociatedUploadBytes":783360,
    "sourcePageMipExtents":[32,16,8,4],"angular":{"viewCount":10,"results":stat,"rawSummarySHA256":digest(angular_raw)},
    "motion":{"linkedFrames":120, "results":motion,"rawSummarySHA256":digest(moving_raw)},
},indent=2))
