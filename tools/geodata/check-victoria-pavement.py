#!/usr/bin/env python3
"""Re-read and compare the bounded public pavement support witness, not imagery."""
import argparse,hashlib,io,json,math,re,subprocess,urllib.request
from pathlib import Path
import numpy as np
from laspy import CopcReader
from laspy.copc import Bounds

URL='https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_390000_687000.copc.laz'
ETAG='"c17d479236802bc5de76f7292e0e380d-6"'
class Range:
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
        if n<0 or n+self.total>18_000_000 or self.queries>=170:
            raise ValueError('Bounded source-extent byte budget exceeded')
        request=urllib.request.Request(URL,headers={'Range':f'bytes={self.pos}-{self.pos+n-1}',
            'Accept-Encoding':'identity','If-Match':ETAG})
        with urllib.request.urlopen(request,timeout=45) as r:
            match=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',r.headers.get('Content-Range',''))
            if r.status!=206 or r.headers.get('ETag')!=ETAG or not match or (
                tuple(int(match[k])for k in (1,2,3))!=(self.pos,self.pos+n-1,49_770_045)):
                raise OSError('Unexpected official COPC source byte range')
            data=r.read(n+1)
        if len(data)!=n:raise OSError('Truncated public COPC source range')
        self.total+=n;self.pos+=n;self.queries+=1
        return data

def convert(points,src,dst):
    rows=''.join(f'{a:.11f} {b:.11f}\n'for a,b in points)
    ll=subprocess.check_output(['gdaltransform','-s_srs',src,'-t_srs',dst],input=rows,text=True)
    return np.array([list(map(float,s.split()[:2]))for s in ll.splitlines()])
def sections(rows,witness):
    u,d,z,c,I,id,a=rows.T
    valid=(c==2)&(id==26975)
    for s in witness:
        center=s['stationMetres'];take=valid&(abs(u-center)<4.8);central=take&(abs(d)<2.1)
        base,slope=np.linalg.lstsq(np.c_[np.ones(central.sum()),u[central]-center],z[central],rcond=None)[0]
        Z=z-base-(u-center)*slope
        for sign,name,ranges in ((-1,'north',np.arange(2.15,4.95,.05)),
                                 (1,'south',np.arange(2.55,4.95,.05))):
            score=[]
            for b in ranges:
                p0=d*sign
                inner=take&(p0>b-.58)&(p0<b-.12);outer=take&(p0>b+.12)&(p0<b+.58)
                a,b0=int(inner.sum()),int(outer.sum())
                if min(a,b0)<4:continue
                z0,z1=np.median(Z[inner]),np.median(Z[outer])
                score.append((round(float(z1-z0),3),round(float(sign*b),2),a,b0,round(float(z0),3),round(float(z1),3)))
            q=max(score)
            assert q==tuple(s[name].values()),(center,name,q,s[name])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=Path(__file__).resolve().parents[2]/'data/victoria-pavers/public-geometry-witness.json')
    a=p.parse_args()
    receipt=json.loads(a.source.read_text())
    A,B=np.asarray(receipt['axisWGS84'])
    m=6378137*math.pi/180;f=1-.00669437999014*math.sin(math.radians(46.5))**2
    scale=np.array([m*math.cos(math.radians(46.5))/math.sqrt(f),-m*(1-.00669437999014)/f**1.5])
    project=lambda p:(p-A)*scale
    u=project(B);L=np.linalg.norm(u);u/=L;v=np.array([-u[1],u[0]])
    bb=np.array([A+((a*u+b*v)/scale)for a,b in [(-15,-21),(L+17,-21),(L+17,21),(-15,21)]])
    r=Range()
    with CopcReader(r,close_fd=False,http_num_threads=1) as cloud:
        wkt=cloud.header.vlrs.get_by_id('LASF_Projection',(2112,))[0].string
        corners=convert(bb,'EPSG:4326',wkt);min_,max_=corners.min(axis=0),corners.max(axis=0)
        p=cloud.query(bounds=Bounds(min_,max_))
        keep=~np.asarray(p.withheld).astype(bool);xy=np.c_[p.x,p.y][keep]
        xz=project(convert(xy,wkt,'EPSG:4326'))
        d=np.c_[xz@u,xz@v,np.asarray(p.z)[keep],np.asarray(p.classification)[keep],np.asarray(p.intensity)[keep],
            np.asarray(p.point_source_id)[keep],np.asarray(p.scan_angle)[keep]]
        d=d[(d[:,0]>=-15)&(d[:,0]<=L+17)&(np.abs(d[:,1])<=21)]
    attrs,n=np.unique(d[:,3],return_counts=True)
    seen={str(int(k)):int(v)for k,v in zip(attrs,n)}
    assert seen==receipt['officialPointCloud']['allUnwithheldClasses']
    digest=hashlib.sha256(d.astype('<f8').tobytes()).hexdigest()
    assert digest==receipt['officialPointCloud']['worldProjectedCohortSHA256'],digest
    sections(d,receipt['witnessScans'])
    print(json.dumps(dict(rows=len(d),ranges=r.queries,transferredBytes=r.total,
        witnessedSections=len(receipt['witnessScans']),classes=seen,cohortSHA256=digest),indent=2))
if __name__=='__main__':main()
