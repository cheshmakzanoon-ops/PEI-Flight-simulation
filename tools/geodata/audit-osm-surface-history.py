#!/usr/bin/env python3
"""Compare a carried OSM pedestrian surface tag with its dated geometry.

Inputs are saved official OSM JSON histories. This program never requests
network resources or infers that a mapped surface still exists.
"""
import argparse
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path

from osgeo import ogr, osr

osr.UseExceptions()


def utc(value):
    if not isinstance(value, str) or not value.endswith('Z'):
        raise ValueError('Use an explicit UTC timestamp ending in Z')
    return datetime.fromisoformat(value[:-1] + '+00:00').astimezone(timezone.utc)


def history(rows, kind, ident):
    records = sorted((r for r in rows if r.get('type') == kind and r.get('id') == ident),
                     key=lambda r: int(r['version']))
    if not records or len(records) > 1024:
        raise ValueError(f'Missing or oversized history: {kind} {ident}')
    if [r['version'] for r in records] != list(range(1, len(records) + 1)):
        raise ValueError(f'Incomplete, duplicate or redacted history: {kind} {ident}')
    times = [utc(r['timestamp']) for r in records]
    if times != sorted(times):
        raise ValueError(f'Nonchronological history: {kind} {ident}')
    return list(zip(times, records, strict=True))


def projection():
    def crs(code):
        ref = osr.SpatialReference()
        ref.ImportFromEPSG(code)
        ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        return ref
    # PEI Double Stereographic; this is a metric survey projection, not a
    # guarantee that a consumer's game uses the same coordinate transform.
    return osr.CoordinateTransformation(crs(4326), crs(3979))


def effective(records, moment):
    return next((row for stamp, row in reversed(records) if stamp <= moment), None)


def surface(row):
    if not row.get('visible', True):
        return None
    value = row.get('tags', {}).get('surface')
    return value if isinstance(value, str) and value.strip() == value and value else None


def ring_for(way, index, date, transform):
    ids = way.get('nodes', [])
    if not 4 <= len(ids) <= 512 or ids[0] != ids[-1] or len(set(ids[:-1])) != len(ids) - 1:
        raise ValueError('Expected a simple closed OSM way without duplicate vertices')
    ring = ogr.Geometry(ogr.wkbLinearRing)
    selected = []
    for ident in ids[:-1]:
        r = effective(index.get(ident, []), date)
        if not r or not r.get('visible', True):
            raise ValueError(f'Missing visible node {ident} at {date.isoformat()}')
        lon, lat = r['lon'], r['lat']
        if not -65 <= lon <= -61 or not 45.5 <= lat <= 48:
            raise ValueError('Node falls outside the bounded PEI study area')
        x, y, _ = transform.TransformPoint(lon, lat)
        ring.AddPoint_2D(x, y)
        selected.append([ident, r['version']])
    ring.CloseRings()
    poly = ogr.Geometry(ogr.wkbPolygon)
    poly.AddGeometry(ring)
    if not poly.IsValid() or not 1e-4 <= poly.GetArea() <= 1e8:
        raise ValueError('Selected dated footprint is invalid or oversized')
    return poly, selected


def compare(way_history, node_history, way_id, observed_at):
    """Return dated area custody, not a current material map or licence finding."""
    timeline = history(way_history, 'way', way_id)
    moment = utc(observed_at)
    present = effective(timeline, moment)
    if not present or not present.get('visible', True):
        raise ValueError('No visible way at the requested observation date')
    label = surface(present)
    if label is None:
        raise ValueError('The observed way has no valid surface tag')
    applied = None
    last_value = None
    for stamp, row in timeline:
        if stamp > moment:
            break
        value = surface(row)
        if value != last_value:
            applied = (stamp, row) if value == label else None
        last_value = value
    if applied is None:
        raise ValueError('No complete surface-assignment event for the observed value')
    stamp, tagged = applied
    ids = set(tagged.get('nodes', [])) | set(present.get('nodes', []))
    if not 3 <= len(ids) <= 1024 or any(type(i) is not int or i <= 0 for i in ids):
        raise ValueError('Invalid dated vertex IDs')
    index = {i: [] for i in ids}
    for row in node_history:
        if row.get('type') == 'node' and row.get('id') in index:
            index[row['id']].append(row)
    index = {i: history(rows, 'node', i) for i, rows in index.items()}
    tx = projection()
    # Way revisions do not advance when the same member nodes are moved.
    # The old geometry uses effective node versions at the tag edit; the
    # current geometry uses effective node versions at the observed epoch.
    old, old_nv = ring_for(tagged, index, stamp, tx)
    new, new_nv = ring_for(present, index, moment, tx)
    union = old.Intersection(new)
    common = 0.0 if union.IsEmpty() else union.GetArea()
    before, after = old.GetArea(), new.GetArea()
    return {
        'way': way_id, 'surfaceTag': label, 'areaCRS': 'EPSG:3979', 'observedAt': observed_at,
        'mostRecentAssignment': {'wayVersion': tagged['version'], 'at': tagged['timestamp'],
                                 'changeset': tagged.get('changeset'), 'areaM2': before, 'nodeVersions': old_nv},
        'observedOutline': {'wayVersion': present['version'], 'at': present['timestamp'],
                            'changeset': present.get('changeset'), 'areaM2': after, 'nodeVersions': new_nv},
        'overlapM2': common, 'areaAddedSinceTagM2': max(0.0, after - common),
        'areaLostSinceTagM2': max(0.0, before - common),
        'overlapOfObserved': common / after,
        'scope': ('Geometry overlap is an upper bound for carrying an old material tag forward. '
                  'No area, including the overlap, establishes current surfacing, visibility, licence '
                  'or in-game placement. Validate recent independent evidence before applying material.'),
    }


def read_json(path):
    if path.stat().st_size > 8_000_000:
        raise ValueError('History file exceeds the bounded study input size')
    raw = path.read_bytes()
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get('elements'), list):
        raise ValueError('Expected an official OSM-format JSON elements array')
    return data['elements'], sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('way', type=int)
    parser.add_argument('way_history', type=Path)
    parser.add_argument('node_history', type=Path, help='One JSON file containing complete histories of the needed nodes')
    parser.add_argument('--observed-at', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    ways, way_hash = read_json(args.way_history)
    nodes, node_hash = read_json(args.node_history)
    report = compare(ways, nodes, args.way, args.observed_at)
    report['inputs'] = {'wayHistorySHA256': way_hash, 'nodeHistorySHA256': node_hash}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
