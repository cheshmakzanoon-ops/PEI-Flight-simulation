#!/usr/bin/env python3
"""Compare the exact AEB polygon to submitted Float32 roof triangles with GEOS."""
import argparse
import json
from pathlib import Path

from osgeo import ogr
ogr.UseExceptions()


def polygon(coords):
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for x, y in coords:
        ring.AddPoint_2D(x, y)
    ring.CloseRings()
    g = ogr.Geometry(ogr.wkbPolygon)
    g.AddGeometry(ring)
    return g


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('mesh', type=Path)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    wire = json.loads(args.mesh.read_text())
    source = polygon(wire['outline'])
    f = ogr.Geometry(ogr.wkbMultiPolygon)
    aggregate = 0.
    for face in wire['roof']:
        g = polygon([(x, z) for x, _, z in face])
        assert g.GetArea() > 1.e-8 and g.IsValid()
        f.AddGeometry(g)
        aggregate += g.GetArea()
    joined = f.UnionCascaded()
    report = dict(gameProjection='same metric tangent plane as Three scene', sourceAreaM2=source.GetArea(),
                  emittedAreaM2=joined.GetArea(), originalPlanMissingM2=source.Difference(joined).GetArea(),
                  beyondOriginalPlanM2=joined.Difference(source).GetArea(),
                  roofOverlapAreaM2=max(0., aggregate-joined.GetArea()), roofTriangles=len(wire['roof']))
    assert max(report[k] for k in ('originalPlanMissingM2', 'beyondOriginalPlanM2', 'roofOverlapAreaM2')) < .002, report
    args.out.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__=='__main__':
    main()
