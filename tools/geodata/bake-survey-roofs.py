#!/usr/bin/env python3
"""Refit ONLY the 3 independently screened roof surfaces. Never download whole rasters."""
import argparse
import gzip
import hashlib
import json
import math
import runpy
from pathlib import Path

import numpy as np
from osgeo import osr


def build(atlas, gate_path, script):
    gate = json.loads(gate_path.read_text())
    pack = (atlas / "tiles.pack").read_bytes()
    index = json.loads((atlas / "index.json").read_text())
    sha = hashlib.sha256(pack).hexdigest()
    if sha != gate["atlasSha256"] or sha != index["sha256"]:
        raise ValueError("Changed footprint archive; rerun the independent pilot.")
    screened = [c for c in gate["cases"] if c.get("stable")]
    if len(screened) != 3 or set(c["county"] for c in screened) != {"Prince", "Queens", "Kings"}:
        raise ValueError("This pilot bake expects exactly the three independently reviewed anchors.")
    series = runpy.run_path(str(script))
    dsm, dtm, gt, to_survey = series["open_models"]()
    dst = dsm.GetSpatialRef()
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    wgs = osr.SpatialReference()
    wgs.ImportFromEPSG(4326)
    wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to_wgs = osr.CoordinateTransformation(dst, wgs)

    # The game frame is an equirectangular WGS84 tangent approximation, not the raster's Lambert grid.
    a, e2, rad = 6378137., 6.69437999014e-3, math.pi/180
    phi = 46.5 * rad
    t = 1-e2*math.sin(phi)**2
    perlon = a*rad*math.cos(phi)/math.sqrt(t)
    perlat = a*(1-e2)*rad/t**1.5
    out = []
    for c in screened:
        matching = []
        for tile in index["tiles"]:
            w, s, e, n = tile["bounds"]
            if not (w-.0015<c["lon"]<e+.0015 and s-.0015<c["lat"]<n+.0015):
                continue
            at, size = tile["offset"], tile["bytes"]
            features = json.loads(gzip.decompress(pack[at:at+size]))["features"]
            for i, f in enumerate(features):
                ll = np.array(f["footprint"])
                bbox = (ll.min(axis=0)+ll.max(axis=0))/2
                if abs(bbox[0]-c["lon"])<.0000006 and abs(bbox[1]-c["lat"])<.0000006:
                    matching.append((tile["id"], i, f))
        if len(matching) != 1:
            raise ValueError(f"{c['place']}: missing or ambiguous footprint.")
        tid, fi, f = matching[0]
        ll = np.array(f["footprint"])
        xx, yy, h, r, fingerprint = series["inside_samples"](f, dsm, dtm, gt, to_survey)
        if fingerprint != c["sourceWindowSha256"] or len(h) != c["n"]:
            raise ValueError("Survey window changed; independent review required.")
        X, Y = xx - xx.mean(), yy - yy.mean()
        edges = np.roll(r, -1, axis=0)-r
        angles = np.unique(np.r_[np.arange(12)*math.pi/12,
                                 np.round(np.arctan2(edges[:, 1], edges[:, 0]) % math.pi, 2)])
        train = np.full(len(h), True)
        best = None
        for theta in angles:
            across = X*math.cos(theta)+Y*math.sin(theta)
            if np.ptp(across) < 3:
                continue
            for offset in (.35, .425, .5, .575, .65):
                r0 = across.min()+offset*np.ptp(across)
                if (across<r0-1).sum()<6 or (across>r0+1).sum()<6:
                    continue
                design = np.c_[np.ones(len(h)), -abs(across-r0)]
                cf, loss = series["robust_fit"](design, h, train)
                if .12<=cf[1]<=1.73 and (best is None or loss<best[0]):
                    best=(loss, theta, float(r0), float(cf[0]), float(cf[1]))
        if best is None:
            raise ValueError("No viable surface in full refit.")
        loss, theta, r0, ridge_asl, slopeL = best
        ux, uy = math.cos(theta), math.sin(theta)

        # The renderer's 'base' is terrain.meshElevation at the unweighted outer-ring vertex mean, +0.05 m.
        lon, lat = ll.mean(axis=0)
        def dist_survey(lon_, lat_):
            xx_, yy_, *_ = to_survey.TransformPoint(float(lon_), float(lat_))
            return (xx_-xx.mean())*ux + (yy_-yy.mean())*uy - r0

        nx = (dist_survey(lon+1/perlon,lat)-dist_survey(lon-1/perlon,lat))*.5
        nz = (dist_survey(lon,lat-1/perlat)-dist_survey(lon,lat+1/perlat))*.5
        norm = math.hypot(nx,nz)
        nx, nz, signed0, slope = nx/norm,nz/norm,dist_survey(lon,lat)/norm,slopeL*norm

        # Bilinear DTM at the exact rendering base anchor, not zero datum or terrain-grid altitude.
        mx,my,*_=to_survey.TransformPoint(float(lon),float(lat))
        u,v=(mx-gt[0])/gt[1]-.5,(my-gt[3])/gt[5]-.5
        j,k=math.floor(u),math.floor(v)
        patch=dtm.ReadAsArray(j,k,2,2).astype(float)
        if (patch==dtm.GetRasterBand(1).GetNoDataValue()).any() or not np.all(np.isfinite(patch)):
            raise ValueError("No reliable local ground datum.")
        w0,h0=u-j,v-k
        ground=float((1-h0)*((1-w0)*patch[0,0]+w0*patch[0,1])+h0*((1-w0)*patch[1,0]+w0*patch[1,1]))
        top=ridge_asl-ground

        # Compare the final scene-space approximation against the full Lambert refit at EVERY source pixel.
        llim=np.array(to_wgs.TransformPoints(np.c_[xx,yy].tolist()))[:,:2]
        predicted = ridge_asl - slope*abs(nx*(llim[:,0]-lon)*perlon+nz*(lat-llim[:,1])*perlat+signed0)
        truth = ridge_asl - slopeL*abs(X*ux+Y*uy-r0)
        max_error=float(np.max(abs(predicted-truth)))
        walls=top-slope*abs(nx*(ll[:,0]-lon)*perlon+nz*(lat-ll[:,1])*perlat+signed0)
        if max_error>.01 or min(walls)<1.3 or max(walls)>f["height"]+1 or top>f["height"]+1:
            raise ValueError("Scene conversion exceeds tolerance or footprint boundary heights implausible.")
        out.append({
            "county": c["county"], "place": c["place"], "tile": tid, "featureIndex": fi,
            "firstLonLat": f["footprint"][0], "vertices": len(ll),
            "meanLonLat": [round(float(lon),10),round(float(lat),10)],
            "surveyWindowSha256": fingerprint, "interiorPixels": len(h),
            "axisX": round(nx,8), "axisZ": round(nz,8), "signedAtCenterM": round(signed0,6),
            "topAboveSurveyGroundM": round(top,6), "risePerRun": round(slope,8),
            "surveyGroundM": round(ground,5), "surveyCrestM": round(ridge_asl,5),
            "minBoundaryAglM": round(float(np.min(walls)),4), "maxBoundaryAglM": round(float(np.max(walls)),4),
            "fullFitMedianAbsM": round(loss,4), "maxSceneTransformErrorM": round(max_error,7),
        })
    return {"atlasSha256":sha, "localCoordinates":"X east; Z south; origin at unweighted footprint outer-ring vertex mean",
            "surfaceEquation":"relativeHeightM = topAboveSurveyGroundM - risePerRun * abs(axisX*dx + axisZ*dz + signedAtCenterM)",
            "roofs":out}


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", type=Path, default=Path("public/world/buildings"))
    parser.add_argument("--gate", type=Path, default=Path("docs/qa/roof-fit-pilot.json"))
    parser.add_argument("--pilot", type=Path, default=Path("tools/qa/roof-fit-pilot.py"))
    args=parser.parse_args()
    print(json.dumps(build(args.atlas,args.gate,args.pilot),indent=2))
