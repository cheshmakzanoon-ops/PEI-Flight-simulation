#!/usr/bin/env python3
"""Regenerate numerical training returns for the one measured Prince County building.

Usage: python tools/geodata/prince-survey-roof/rebuild-training.py --checkout . --out /tmp/pei-roof
Needs Python, numpy, laspy with lazrs COPC support, gdaltransform (GDAL) and curl.
The only online input is this manifest's official, fixed-range COPC object; --offline-range-dir
can supply the same ten SHA-256 checked START-END.bin byte ranges instead. No arbitrary location,
source URL, prediction height, hidden elevation or all-return dump is selectable. The program
rechecks the actual shipped 14-point AEB polygon, exact geographic transforms, spatial/pulse
split and canonical output hashes before writing any training arrays.
"""
import argparse
import gzip
import hashlib
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from laspy import CopcReader
from laspy.copc import Bounds

AUTHORITY='53a2e6ae167073d134bad7c049b77f47b53db951feb211fc6eecf9d7e8f66473'
OFFICIAL='https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/pei_2020_335000_711000.copc.laz'
def sha(b): return hashlib.sha256(b).hexdigest()

def checked_footprint(checkout, authority):
    buildings=checkout/'public/world/buildings'
    index=json.loads((buildings/'index.json').read_text()); pack=(buildings/index['file']).read_bytes()
    expected=authority['target']; assert sha(pack)==index['sha256']==expected['packSHA256']
    tile=next(t for t in index['tiles'] if t['id']==expected['tile'])
    wire=pack[tile['offset']:tile['offset']+tile['bytes']]; assert sha(wire)==tile['sha256']==expected['tileSHA256']
    feature=json.loads(gzip.decompress(wire))['features'][expected['ordinal']]
    assert feature=={'footprint':expected['footprint'],'height':expected['top'],'minHeight':expected['min']}
    return np.array(feature['footprint'])

class LockedRanges:
    def __init__(self, a, offline):
        self.obj=a['officialObject']; assert self.obj['url']==OFFICIAL
        self.allow={(start,end):digest for start,end,digest in a['ranges']}
        self.cache={}; self.pos=0; self.offline=offline
        assert len(self.allow)==10 and sum(v-u+1 for u,v in self.allow)==a['totalAllowedBytes']==3048853
    def seek(self,p,whence=0):
        if whence==1:p+=self.pos
        elif whence==2:p+=self.obj['bytes']
        elif whence!=0:raise ValueError('Unsupported seek')
        if not 0<=p<=self.obj['bytes']:raise ValueError('Out of bounds')
        self.pos=p
    def tell(self): return self.pos
    def close(self): pass
    def read(self,n):
        if n==0:return b''
        start=self.pos; end=start+n-1; key=(start,end)
        if n<0 or key not in self.allow:raise ValueError(f'Refusing unpinned range {key}')
        if key not in self.cache:
            if self.offline:
                b=(self.offline/f'{start}-{end}.bin').read_bytes()
            else:
                with tempfile.TemporaryDirectory() as tmp:
                    hp=Path(tmp)/'headers';response=subprocess.run(['curl','--proto','=https','--fail','--silent','--show-error','--connect-timeout','9','--max-time','22','--retry','3','--retry-all-errors','--retry-max-time','50','--max-filesize',str(n),'-r',f'{start}-{end}','-H','Accept-Encoding: identity','-H','If-Match: '+self.obj['etag'],'-D',str(hp),OFFICIAL],capture_output=True,timeout=90,check=True)
                    header=hp.read_text(encoding='latin1').lower()
                    assert re.search(r'(?m)^http/\S+ 206(?: |\r?$)',header) and f'content-range: bytes {start}-{end}/{self.obj["bytes"]}' in header and 'etag: '+self.obj['etag'] in header
                    b=response.stdout
            assert len(b)==n and sha(b)==self.allow[key],f'Unexpected signed source {key}'
            self.cache[key]=b
        self.pos+=n
        return self.cache[key]

def transform(values,source,target,decimals=8):
    stdin=''.join(f'{x:.{decimals}f} {y:.{decimals}f}\n' for x,y in values)
    res=subprocess.run(['gdaltransform','-s_srs',source,'-t_srs',target],input=stdin,text=True,capture_output=True,check=True)
    return np.loadtxt(res.stdout.splitlines())[:,:2]

def footprint_test(xy,rim):
    inner=np.zeros(len(xy),dtype=bool); dist=np.full(len(xy),np.inf)
    for a,b in zip(rim,np.roll(rim,-1,axis=0)):
        edge=b-a; t=np.clip(((xy-a)*edge).sum(1)/np.dot(edge,edge),0,1)
        dist=np.minimum(dist,np.linalg.norm(xy-a-t[:,None]*edge,axis=1))
        cut=(a[1]>xy[:,1])!=(b[1]>xy[:,1]);inner[cut]^=xy[cut,0]<(b[0]-a[0])*(xy[cut,1]-a[1])/(b[1]-a[1])+a[0]
    return inner,dist

def signature(data):
    h=hashlib.sha256(b'pei-q0322-47-roster-v1\0')
    for key in ['id','class_id','zone','source_flightline','block','xz','xy2954','uv']+(['native_z'] if 'native_z' in data else []):
        a=data[key];values=np.rint(a*1000).astype('<i8') if key in ('xz','xy2954','uv','native_z') else a.astype('<i8')
        h.update(key.encode()+b'\0');h.update(struct.pack('<B',values.ndim));h.update(np.asarray(values.shape,dtype='<u8').tobytes());h.update(values.tobytes(order='C'))
    return h.hexdigest()

def training_ground(training, file, expected):
    # Equal geographic vote per 2.5m ground cell; duplicate laser lines do not bias the center reference.
    is_ground=training['class_id']==2; uv=training['uv'][is_ground];z=training['native_z'][is_ground]
    _,groups=np.unique(np.floor(uv/2.5).astype('i4'),axis=0,return_inverse=True)
    m=np.vstack([(np.median(uv[groups==k,0]),np.median(uv[groups==k,1]),np.median(z[groups==k])) for k in range(int(groups.max())+1)])
    x=np.column_stack((m[:,:2],np.ones(len(m))));w=np.ones(len(m))
    for _ in range(12):
        b=np.linalg.lstsq(x*w[:,None]**.5,m[:,2]*w**.5,rcond=None)[0];res=m[:,2]-x@b
        scale=max(.05,1.4826*np.median(np.abs(res-np.median(res))));w=np.minimum(1.,1.5*scale/np.maximum(1.e-12,np.abs(res)))
    assert np.allclose(b,expected,rtol=0,atol=1.e-9)
    err=np.abs(z-(uv@b[:2]+b[2]));return {'trainPointArchive':sha(file.read_bytes()),'class2TrainRows':len(uv),'equallyRepresented2p5mBins':len(m),
        'fit':'2.5m XY ground-cell medians, twelve deterministic Huber IRLS updates; model [slopeU,slopeV,localInterceptNativeZ], local UV registered original ground footprint origin. No roof heights, future candidate or held truth used.','nativeZEquals_AUplusBVplusC':b.tolist(),'medianTrainingGroundHeightError':float(np.median(err)),
        'p90TrainingGroundHeightError':float(np.percentile(err,90)),'p95TrainingGroundHeightError':float(np.percentile(err,95)),'evaluation':'Freeze emitted stock and candidate GAME Y top values. Add (native ground intercept minus actual game centre anchor plane used to emit the cap) to both before native residual. The subtraction is symmetric with respect to stock/candidate. TRAIN only is used for the constant alignment, never a separate per-live-model bias. Also verify withheld native class2 ground distribution against this locked plane (median<=0.30 m, p90<=0.75 m) before any HAG attribution. No claim about absolute vertical datum.'}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--checkout',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);parser.add_argument('--offline-range-dir',type=Path);args=parser.parse_args()
    if not __debug__:raise RuntimeError('Run with assertions enabled')
    wire=Path(__file__).with_name('source-authority.json').read_bytes();assert sha(wire)==AUTHORITY; a=json.loads(wire)
    fp=checked_footprint(args.checkout,a);target=a['target'];native=a['nativeProjection'];read=LockedRanges(a,args.offline_range_dir)
    rim=transform(fp,'EPSG:4326','EPSG:2954');assert np.allclose(rim,target['native2954Controls'],rtol=0,atol=.001)
    rect=np.array(native['bounds2954']);center=np.array(target['origin2954']);basis=np.array(target['axes2954'])
    with CopcReader(read,close_fd=False,http_num_threads=1) as cloud:
        hdr=cloud.header;wkt=hdr.vlrs.get_by_id('LASF_Projection',(2112,))[0].string
        assert sha(wkt.encode())==native['wktSHA256'] and 'AUTHORITY["EPSG","2961"]' in wkt and hdr.point_format.id==6
        corners=transform(np.array([[x,y] for x in rect[::2] for y in rect[1::2]]),'EPSG:2954',wkt);lo=corners.min(0)-.03;hi=corners.max(0)+.03
        assert np.allclose([lo,hi],native['originalCOPCProjectedBounds'],atol=1e-5,rtol=0) and np.all(hdr.mins[:2]<=lo) and np.all(hdr.maxs[:2]>=hi)
        rows=cloud.query(bounds=Bounds(lo,hi));assert set(read.cache)==set(read.allow)
        xy=transform(np.column_stack((rows.x,rows.y)),wkt,'EPSG:2954');uv=(xy-center)@basis.T
        valid=(~np.asarray(rows.withheld,dtype=bool))&(xy>=rect[:2]).all(1)&(xy<=rect[2:]).all(1)
        inside,dist=footprint_test(xy,rim);cls=np.asarray(rows.classification)
        roof=valid&(cls==6)&inside&(dist>=.85);ground=valid&(cls==2)&~inside&(dist>3)&(dist<=16);keep=roof|ground
        flight=np.asarray(rows.point_source_id,dtype='<u2');channel=np.asarray(rows.scanner_channel,dtype='u1');gps=np.asarray(rows.gps_time,dtype='<f8');assert np.isfinite(gps).all() and (gps>0).all()
        dtype=np.dtype([('sf','<u2'),('ch','u1'),('gps','<u8')]);keys=np.rec.fromarrays([flight,channel,gps.view('<u8')],dtype=dtype);assert dtype.itemsize==11
        unique,ids=np.unique(keys,return_inverse=True);cells=np.floor((uv+500)/5).astype('i4');spatial=(3*cells[:,0]+5*cells[:,1]+1)%7==0
        reserved=np.zeros(len(unique),'?');reserved[ids[keep&spatial]]=True
        pulse=np.fromiter((int.from_bytes(hashlib.blake2b(bytes(k),digest_size=8,person=b'PEI221-v1').digest(),'little')%7==0 for k in unique),'?',len(unique))
        is_held=reserved[ids]|pulse[ids];assert not np.intersect1d(ids[keep&is_held],ids[~is_held]).size
        kept=np.flatnonzero(keep);train=kept[~is_held[kept]];held=kept[is_held[kept]]
        assert [len(kept),len(train),len(held)]==[a[k] for k in ('expectedValidRows','expectedTrainingRows','expectedHeldXYRows')]
        ll=transform(xy[kept],'EPSG:2954','EPSG:4326',4);rad=np.pi/180;t=1-6.69437999014e-3*np.sin(46.5*rad)**2
        meters=np.array([6378137*rad*np.cos(46.5*rad)/np.sqrt(t),-6378137*rad*(1-6.69437999014e-3)/t**1.5]);world=(ll-[-63.2,46.5])*meters
        shared={'id':kept.astype('u4'),'xz':world,'xy2954':xy[kept],'uv':uv[kept],'class_id':np.where(roof[kept],6,2).astype('u1'),'zone':np.where(uv[kept,1]>=15,0,np.where(uv[kept,0]<2.5,1,2)).astype('u1'),'source_flightline':flight[kept],'block':cells[kept]}
        training={k:v[~is_held[kept]] for k,v in shared.items()}; xy_only={k:v[is_held[kept]] for k,v in shared.items()}
        training['native_z']=np.array(rows[train].z,dtype='f8')  # Only the released whole-pulse split, never all point elevations.
    assert signature(training)==a['trainSemanticMMHash'] and signature(xy_only)==a['heldXYSemanticMMHash']
    args.out.mkdir(parents=True,exist_ok=True);np.savez_compressed(args.out/'train-points.npz',**training);np.savez_compressed(args.out/'predict-only-held-xy.npz',**xy_only)
    ground=training_ground(training,args.out/'train-points.npz',a['expectedGround'])
    # Different BLAS/LAPACK versions can round a slope or residual differently at 1e-15 m.
    # Recompute and tightly compare before serializing the original immutable reference receipt.
    canonical=a['canonicalGroundReference'];assert ground['class2TrainRows']==canonical['class2TrainRows'] and ground['equallyRepresented2p5mBins']==canonical['equallyRepresented2p5mBins']
    prof=['medianTrainingGroundHeightError','p90TrainingGroundHeightError','p95TrainingGroundHeightError']
    maxdiff=max(max(abs(ground[k]-canonical[k]) for k in prof),float(np.max(np.abs(np.array(ground['nativeZEquals_AUplusBVplusC'])-canonical['nativeZEquals_AUplusBVplusC']))))
    assert maxdiff<1.e-9 and ground['fit']==canonical['fit'] and ground['evaluation']==canonical['evaluation']
    canonical_wire=(json.dumps(canonical,indent=2)+'\n').encode();assert sha(canonical_wire)==a['canonicalGroundReferenceSHA256']
    (args.out/'training-ground-reference.json').write_bytes(canonical_wire)
    receipt={'sourceAuthoritySHA256':AUTHORITY,'downloadedOrAuthenticatedCacheBytes':a['totalAllowedBytes'],'exactSignedRanges':len(read.cache),'trainingRows':len(train),'heldXYRows':len(held),'trainingSignatureMM':signature(training),'heldXYSignatureMM':signature(xy_only),'withheldNumericZReleased':False,'groundRecomputeLargestScalarAbsDifference':maxdiff,'reconstructedTrainingFileSHA256':ground['trainPointArchive'],'canonicalOriginalGroundReceiptSHA256':a['canonicalGroundReferenceSHA256']}
    (args.out/'source-rebuild.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
if __name__=='__main__':main()
