#!/usr/bin/env python3
"""Reacquire the bounded, pinned COPC support for the 571 Main Street roof plan."""
import argparse,gzip,hashlib,json,runpy,subprocess
from pathlib import Path
import numpy as np

def convert(points,src,dst):
    rows=''.join(f'{x:.11f} {y:.11f}\n'for x,y in points)
    res=subprocess.check_output(['gdaltransform','-s_srs',src,'-t_srs',dst],input=rows,text=True)
    return np.array([list(map(float,s.split()[:2]))for s in res.splitlines()])

def check_osm(root,path):
    from osgeo import ogr
    ogr.UseExceptions()
    w=json.loads((root/'data/odbl/montague-macdonald/way-witness.json').read_text())
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1_048_576),b''):digest.update(b)
    assert digest.hexdigest()==w['upstreamSha256']
    dataset=ogr.Open(str(path));db=dataset.GetLayerByName('multipolygons')
    db.SetSpatialFilterRect(-62.64662,46.16319,-62.64606,46.16365)
    result=[]
    for f in db:
        if (f.GetField('osm_way_id') or f.GetField('osm_id'))!=w['buildingWay']['id']:continue
        for p in f.GetGeometryRef():
            for j in range(p.GetGeometryCount()):
                result.append([list(c[:2])for c in p.GetGeometryRef(j).GetPoints()[:-1]])
    def canon(r):
        return {frozenset(frozenset((tuple(a),tuple(b)))for a,b in zip(q,q[1:]+q[:1]))for q in r}
    assert canon(result)==canon(w['buildingWay']['rings'])
    print('Verified public OSM building way 347992572 from the pinned extract.')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--pbf',type=Path,help='Re-audit the separately licensed ODbL witness')
    p.add_argument('--check-pbf-only',action='store_true')
    a=p.parse_args()
    if a.pbf:check_osm(a.root,a.pbf)
    if a.check_pbf_only:
        assert a.pbf,'Provide a local pinned Geofabrik archive'
        return
    from laspy import CopcReader
    from laspy.copc import Bounds
    hall=runpy.run_path(str(a.root/'tools/geodata/sample-montague-hall.py'))
    m=json.loads((a.root/'public/world/buildings/index.json').read_text())
    b=next(t for t in m['tiles']if t['id']=='q103301')
    with (a.root/'public/world/buildings/tiles.pack').open('rb') as f:
        f.seek(b['offset'])
        q=json.loads(gzip.decompress(f.read(b['bytes'])))['features'][350]
    fp=np.asarray(q['footprint'])
    u=convert(fp,'EPSG:4326','EPSG:2961')
    bounds=[u.min(0)-11,u.max(0)+11]
    stream=hall['Range']()
    with CopcReader(stream,close_fd=False,http_num_threads=1) as cloud:
        p=cloud.query(bounds=Bounds(*bounds))
        keep=~np.asarray(p.withheld).astype(bool)
        raw=np.c_[p.x,p.y,p.z,np.asarray(p.classification),np.asarray(p.intensity),
                  np.asarray(p.point_source_id),np.asarray(p.scan_angle)][keep]
        wkt=cloud.header.vlrs.get_by_id('LASF_Projection',(2112,))[0].string
        native=convert(raw[:,:2],wkt,'EPSG:3979')
        rows=np.c_[native,raw[:,2:]]
    digest=hashlib.sha256(rows.astype('<f8').tobytes()).hexdigest()
    receipt=json.loads((a.root/'data/montague-macdonald/native-validation.json').read_text())
    assert digest==receipt['pinnedSourceCropSha256']
    a.out.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(a.out/'native-points.npz',points=rows,
        outline=convert(fp,'EPSG:4326','EPSG:3979'),footprint=fp)
    checked=dict(rows=len(rows),ranges=stream.queries,transferredBytes=stream.total,
                 extent2961=np.asarray(bounds).tolist(),source=hall['URL'],cohortSha256=digest)
    (a.out/'acquisition.json').write_text(json.dumps(checked,indent=2)+'\n')
    print(json.dumps(checked,indent=2))
if __name__=='__main__':main()
