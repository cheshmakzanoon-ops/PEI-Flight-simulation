#!/usr/bin/env python3
"""Reacquire small pinned Montague windows and optionally check two OSM ways."""
import argparse,hashlib,io,json,re,runpy,subprocess,urllib.request
from pathlib import Path

import numpy as np

URL=('https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/'
     'pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_427000_679000.copc.laz')
ETAG='"f81e73668d3b7c1c1b283803715a9ece-7"'
COPC_SIZE=52934824
# Source CRS EPSG:2961 extent used for the Montague bridgehead witness.
EXTENT=[[527229.026489423,5112250.44861681],[527271.748819021,5112326.59172436]]
# EPSG:3979 native window first cell centre, columns, rows.
WINDOW=[2420994.5,312204.5,70,88]
RASTER_SHA='077e083eeebc5421df55df6fb7cf015153571a5a9413f5a42385b484922d7587'

class Range:
    """Reject unbounded downloads, mismatched ranges and source revisions."""
    def __init__(self):
        self.pos=0;self.total=0;self.queries=0
    def seek(self,p,whence=io.SEEK_SET):
        if whence==io.SEEK_CUR:p+=self.pos
        if whence not in (io.SEEK_CUR,io.SEEK_SET) or p<0:raise ValueError(whence,p)
        self.pos=p
    def tell(self):return self.pos
    def close(self):pass
    def read(self,n):
        if n==0:return b''
        if n<0 or n+self.total>6_000_000 or self.queries>=60:
            raise ValueError('Bounded Montague source request exceeded byte budget')
        req=urllib.request.Request(URL,headers={'Range':f'bytes={self.pos}-{self.pos+n-1}',
            'Accept-Encoding':'identity','If-Match':ETAG})
        with urllib.request.urlopen(req,timeout=45) as r:
            m=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',r.headers.get('Content-Range',''))
            if r.status!=206 or r.headers.get('ETag')!=ETAG or not m or (
                tuple(int(m[k])for k in (1,2,3))!=(self.pos,self.pos+n-1,COPC_SIZE)):
                raise OSError('Invalid scoped 206 response from the pinned point cloud')
            data=r.read(n+1)
        if len(data)!=n:raise OSError('Truncated source range')
        self.total+=n;self.pos+=n;self.queries+=1
        return data

def copc(out):
    from laspy import CopcReader
    from laspy.copc import Bounds
    r=Range()
    a,b=np.asarray(EXTENT)
    with CopcReader(r,close_fd=False,http_num_threads=1) as cloud:
        wkt=cloud.header.vlrs.get_by_id('LASF_Projection',(2112,))[0].string
        p=cloud.query(bounds=Bounds(a,b))
        keep=~np.asarray(p.withheld).astype(bool)
        raw=np.c_[p.x,p.y,p.z,np.asarray(p.classification),np.asarray(p.intensity),
                  np.asarray(p.point_source_id),np.asarray(p.scan_angle)][keep]
        txt=''.join(f'{x:.11f} {y:.11f}\n'for x,y in raw[:,:2])
        res=subprocess.check_output(['gdaltransform','-s_srs',wkt,'-t_srs','EPSG:3979'],input=txt,text=True)
        native=np.array([tuple(map(float,q.split()[:2]))for q in res.splitlines()])
        np.savez_compressed(out/'montague-copc-native.npz',points=np.c_[native,raw[:,2:]],source=URL,bounds=[a,b],wkt=wkt)
    codes,counts=np.unique(raw[:,3],return_counts=True)
    print(json.dumps(dict(layer='COPC',classes={int(k):int(v)for k,v in zip(codes,counts)},
        ranges=r.queries,networkBytes=r.total,epsg2961Extent=EXTENT)))

def raster(root,out):
    q=runpy.run_path(str(root/'tools/qa/roof-fit-pilot.py'))
    f=runpy.run_path(str(root/'tools/geodata/fit-farm-profiles.py'))
    dsm,dtm,gt,_=q['open_models']()
    x,y,w,h=WINDOW
    i,j=round(x-.5-gt[0]),round(gt[3]-.5-y)
    z,g=dsm.ReadAsArray(i,j,w,h),dtm.ReadAsArray(i,j,w,h)
    sha=f['fprint'](z,g)
    assert sha==RASTER_SHA,(sha,RASTER_SHA)
    np.savez_compressed(out/'montague-native-window.npz',dsm=z,dtm=g,X=x,Y=y)
    print(json.dumps(dict(layer='DSM / DTM',window=WINDOW,hash=sha)))

def osm(root,pbf):
    from osgeo import ogr
    ogr.UseExceptions()
    w=json.loads((root/'data/odbl/montague-bridgehead/way-witness.json').read_text())
    h=hashlib.sha256()
    with pbf.open('rb') as f:
        for b in iter(lambda:f.read(1_048_576),b''):h.update(b)
    assert h.hexdigest()==w['upstreamSha256']
    canon=lambda q:{frozenset(frozenset((tuple(a),tuple(b)))for a,b in zip(r,r[1:]+r[:1]))for r in q}
    box=(-62.648,46.1632,-62.6463,46.16399)
    ds=ogr.Open(str(pbf));build=ds.GetLayerByName('multipolygons');build.SetSpatialFilterRect(*box)
    data=[]
    for f in build:
        if (f.GetField('osm_way_id') or f.GetField('osm_id'))!=w['buildingWay']['id']:continue
        data.extend([[list(v[:2])for v in p.GetGeometryRef(j).GetPoints()[:-1]]
                     for p in f.GetGeometryRef() for j in range(p.GetGeometryCount())])
    assert canon(data)==canon(w['buildingWay']['rings'])
    ds=ogr.Open(str(pbf));lines=ds.GetLayerByName('lines');lines.SetSpatialFilterRect(*box)
    pts=[list(p[:2])for f in lines if f.GetField('osm_id')==w['streetPortion']['id']for p in f.GetGeometryRef().GetPoints()]
    u,v=[pts.index(x)for x in (w['streetPortion']['points'][0],w['streetPortion']['points'][-1])]
    portion=pts[min(u,v):max(u,v)+1]
    assert portion==w['streetPortion']['points'] or portion[::-1]==w['streetPortion']['points']
    print('Verified original ODbL hall way and consecutive Main Street orientation points.')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--layer',choices=('raster','copc'),required=True)
    p.add_argument('--pbf',type=Path)
    a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    if a.pbf:osm(a.root,a.pbf)
    if a.layer=='copc':copc(a.out)
    else:raster(a.root,a.out)
if __name__=='__main__':main()
