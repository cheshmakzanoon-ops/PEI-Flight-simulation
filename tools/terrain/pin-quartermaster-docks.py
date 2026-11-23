#!/usr/bin/env python3
"""Extract only mapped Quartermaster pier axes and shared junctions, never OSM user metadata."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
SPINES=['157136818','251161701','251167697']
FINGERS=[str(i) for i in range(251168229,251168261) if i not in (251168249,251168257)]
IDX=SPINES+FINGERS

def pin(path):
    root=ET.parse(path).getroot()
    nodes={n.get('id'):[float(n.get('lon')),float(n.get('lat'))] for n in root.findall('node')}
    ways={w.get('id'):w for w in root.findall('way') if w.get('id') in IDX}
    refs=lambda w:[n.get('ref') for n in w.findall('nd')]
    sp={id:set(refs(ways[id])) for id in SPINES}
    records=[]
    for k in IDX:
        w=ways[k]
        supported={t.get('k'):t.get('v') for t in w.findall('tag')}
        if supported.get('man_made')!='pier' or supported.get('area')=='yes':
            raise ValueError(f'Expected linear pier {k}')
        n=refs(w)
        j=[(id,i) for id in SPINES if id!=k for i,ref in enumerate(n) if ref in sp[id]]
        if k in FINGERS and len(j)!=1:raise ValueError(f'A finger must connect to one of the reviewed spines, {k}')
        records.append(dict(id=k,version=int(w.get('version')),role='spine' if k in SPINES else 'finger',
                            junctions=j,coordinates=[nodes[p] for p in n]))
    m=dict(schema=1,place='Quartermaster Marina, Charlottetown, Prince Edward Island',
       license='ODbL 1.0',attribution='© OpenStreetMap contributors',
       licenseURL='https://opendatacommons.org/licenses/odbl/1-0/',sourceLicense='https://www.openstreetmap.org/copyright',
       source='Original linear pier coordinates; not slip assignments, width, height or bathymetry.',
       extractSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),coordinates='WGS84 longitude/latitude',
       ways=records)
    folder=ROOT/'data/odbl/quartermaster';folder.mkdir(parents=True,exist_ok=True)
    (folder/'docks.json').write_text(json.dumps(m,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('extract',type=Path)
    pin(p.parse_args().extract)
