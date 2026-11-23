#!/usr/bin/env python3
"""Extract only the reviewed directed OSM coast, without raw OSM metadata."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
NEEDED={'251166158':'30','1006048216':'1'}
def extract(path):
    src=ET.parse(path).getroot()
    points={n.get('id'):[float(n.get('lon')),float(n.get('lat'))] for n in src.findall('node')}
    paths={}
    for w in src.findall('way'):
        k=w.get('id')
        if k not in NEEDED:continue
        tags={t.get('k'):t.get('v') for t in w.findall('tag')}
        if w.get('version')!=NEEDED[k] or tags.get('natural')!='coastline':
            raise ValueError('Unexpected coastline version/tag')
        paths[k]=[points[n.get('ref')] for n in w.findall('nd')]
    coast=paths['251166158']
    if coast[-1]!=paths['1006048216'][0] or len(coast)!=136:
        raise ValueError('Coastline chain changed')
    # The basin's seaward cut is an explicit derived boundary, not OSM
    # coastline. Verify it remains entirely on prior water during baking.
    local=coast[94:116]
    evidence=dict(schema=1,place='Quartermaster Marina, Charlottetown, Prince Edward Island',
        attribution='© OpenStreetMap contributors',license='ODbL 1.0',
        licenseURL='https://www.openstreetmap.org/copyright',
        sourceWay='https://www.openstreetmap.org/way/251166158/history',
        sourceWayId='251166158',sourceWayVersion=NEEDED['251166158'],
        connectedWayId='1006048216',connectedWayVersion=NEEDED['1006048216'],
        coordinates='WGS84 longitude/latitude, original way direction',
        sourceNodeRangeZeroBasedInclusive=[94,115],
        archivedExtractSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),
        edgeRule='Land is left of the directed OSM shoreline. Segment from end to start is the derived, prior-water-only mouth cut.',
        coast=local)
    (ROOT/'data/odbl/quartermaster/coast.json').write_text(json.dumps(evidence,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('xml',type=Path)
    extract(p.parse_args().xml)
