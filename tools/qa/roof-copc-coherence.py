#!/usr/bin/env python3
"""Offline QA: verify absolute roof envelopes against bounded official COPC Class 6.
Requires NumPy, laspy with lazrs, and GDAL's gdaltransform. Writes aggregate JSON only.
An interior-mismatch screen, not a fit, independent acquisition, or release permit.
"""
import argparse,gzip,hashlib,io,json,math,os,re,stat,subprocess,time,zipfile
from urllib.error import URLError
from pathlib import Path
from urllib.request import Request,HTTPRedirectHandler,build_opener
import numpy as np

sha=lambda a:hashlib.sha256(a).hexdigest()
ROOT='https://canelevation-lidar-point-clouds.s3.ca-central-1.amazonaws.com/pointclouds_nuagespoints/PEI/Prince_Edward_Island_2020/'
POINTFILE=re.compile(re.escape(ROOT)+r'pei_2020_[0-9]+_[0-9]+\.copc\.laz')
SAFE_NAME=re.compile(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}\.npz')
HEX64=re.compile('[0-9a-f]{64}')
STRONG_ETAG=re.compile(r'"[a-f0-9]{32}(?:-[0-9]{1,4})?"')
MAX_CACHE=12_000_000
MAX_POINTS=125_000
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None  # Fail this response, never dispatch the redirect target.
def strict_int(v,lo,hi):
    if type(v) is not int or not lo<=v<=hi:raise ValueError('integer outside allowed envelope')
    return v
def digest(v):
    if not isinstance(v,str) or not HEX64.fullmatch(v):raise ValueError('invalid digest')
    return v
def regular_bytes(path,maximum):
    fd=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_NONBLOCK',0))
    with os.fdopen(fd,'rb') as f:
        st=os.fstat(f.fileno())
        if not stat.S_ISREG(st.st_mode) or st.st_size<1 or st.st_size>maximum:raise ValueError('not a bounded regular file')
        b=f.read(maximum+1)
        if len(b)!=st.st_size:raise ValueError('file changed or exceeded allowance')
    return b
def cache_read(root,spec):
    name=spec['privateWindowFile']
    if not isinstance(name,str) or not SAFE_NAME.fullmatch(name):raise ValueError('invalid private basename')
    base=root.resolve(strict=True);path=base/name
    if path.is_symlink() or path.resolve(strict=True).parent!=base:raise ValueError('private cache path escape')
    data=regular_bytes(path,MAX_CACHE)
    if sha(data)!=digest(spec['privateWindowSHA256']):raise ValueError('cache window changed')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        items=archive.infolist()
        if len(items)!=1 or items[0].filename!='points.npy' or not 1<=items[0].file_size<=MAX_POINTS*7*8+4096:
            raise ValueError('cache archive exceeds projection envelope')
        raw=archive.read(items[0],pwd=None)
    if len(raw)!=items[0].file_size:raise ValueError('cache member length changed')
    body=io.BytesIO(raw);version=np.lib.format.read_magic(body)
    read_head={(1,0):np.lib.format.read_array_header_1_0,(2,0):np.lib.format.read_array_header_2_0}.get(version)
    if read_head is None:raise ValueError('unsupported cached array version')
    shape,fortran,dtype=read_head(body,max_header_size=4096)
    if len(shape)!=2 or not 0<=shape[0]<=MAX_POINTS or shape[1]!=7 or dtype.str not in ('<f8','>f8') or fortran:
        raise ValueError('cache array shape or dtype invalid')
    if len(raw)-body.tell()!=shape[0]*7*8:raise ValueError('cache data does not match array header')
    p=np.frombuffer(raw,dtype=dtype,offset=body.tell()).reshape(shape)
    if not np.isfinite(p).all():raise ValueError('unexpected cached nonfinite coordinate')
    return p

class OfficialRange:
    def __init__(self,url,expected):
        if not POINTFILE.fullmatch(url): raise ValueError('not a PEI 2020 official point-cloud object')
        self.size=strict_int(expected['sourceObjectBytes'],1024,2**33)
        self.etag=expected['etag']
        if not isinstance(self.etag,str) or not STRONG_ETAG.fullmatch(self.etag):raise ValueError('invalid exact source ETag')
        self.url=url; self.pos=self.wire=self.requested=self.requests=0
        self.opener=build_opener(NoRedirect());self.deadline=time.monotonic()+170.
    def tell(self): return self.pos
    def seek(self,p,w=io.SEEK_SET):
        self.pos=p+(0 if w==0 else self.pos if w==1 else self.size)
        if self.pos<0: raise ValueError('negative offset')
        return self.pos
    def read(self,n):
        if n==0: return b''
        if n<0 or n>4_000_000 or self.pos+n>self.size:raise ValueError('COPC range outside bounds')
        h=f'bytes={self.pos}-{self.pos+n-1}'
        for attempt in range(2):
            if self.requested+n>12_000_000 or self.requests>=100:raise ValueError('COPC cumulative budget exceeded')
            left=self.deadline-time.monotonic()
            if left<=0:raise TimeoutError('COPC object deadline exceeded')
            self.requested+=n;self.requests+=1
            try:
                with self.opener.open(Request(self.url,headers={'Range':h,'If-Match':self.etag,'Accept-Encoding':'identity'}),timeout=min(42.,left)) as res:
                    mr=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',res.headers.get('Content-Range',''))
                    if res.geturl()!=self.url or res.status!=206 or not mr or tuple(map(int,mr.groups()))!=(self.pos,self.pos+n-1,self.size):
                        raise ValueError('nonmatching exact 206 range')
                    if res.headers.get('ETag')!=self.etag:raise ValueError('unrecognized point object revision')
                    data=res.read(n+1)
                break
            except (URLError,TimeoutError) as ex:
                if attempt or getattr(ex,'code',0) in (301,302,303,305,307,308,412,416):raise
                time.sleep(.7)
        if len(data)!=n:raise ValueError('incorrect response length')
        self.pos+=n;self.wire+=n
        return data

def transform(p,src,dest):
    if not len(p): return np.empty((0,2))
    c=subprocess.run(['gdaltransform','-s_srs',src,'-t_srs',dest],input=''.join(f'{x:.12f} {y:.12f}\n' for x,y in p),
      capture_output=True,text=True,check=True,env={**os.environ,'PROJ_NETWORK':'OFF'})
    o=np.array([list(map(float,line.split()[:2])) for line in c.stdout.splitlines()])
    if o.shape!=np.asarray(p).shape or not np.isfinite(o).all(): raise ValueError('projection result not finite')
    return o
def boundary(polygon,pts):
    yes=np.zeros(len(pts),bool); d2=np.full(len(pts),np.inf)
    for a,b in zip(polygon,np.roll(polygon,-1,axis=0)):
        u=b-a; d=pts-a; s=u@u
        if s<=0: raise ValueError('duplicate consecutive outline point')
        if abs(u[1])>1e-10: yes^=((pts[:,1]>a[1])!=(pts[:,1]>b[1]))&(d[:,0]<d[:,1]*u[0]/u[1])
        q=d-np.clip(d@u/s,0,1)[:,None]*u
        d2=np.minimum(d2,np.einsum('ij,ij->i',q,q))
    return yes,np.sqrt(d2)
def indexes(b):
    return np.asarray([[x,y] for x in (b[0],b[2]) for y in (b[1],b[3])],float)
def full_cells(plan):
    # Centre-to-edge disk reserve covers the complete grid square; no diagonal
    # claim inside a mixed, merely centroid-contained native edge cell.
    limit=np.floor(plan.min(0)).astype(int);stop=np.ceil(plan.max(0)).astype(int)
    if any(stop-limit>300): raise ValueError('window exceeds single building QA')
    ij=np.asarray([(x,y) for x in range(limit[0],stop[0]) for y in range(limit[1],stop[1])])
    inside,dist=boundary(plan,ij+.5)
    return {tuple(v) for v in ij[inside&(dist>math.sqrt(.5)+1e-6)]}
def metrics(raw):
    return [round(float(a),6) for a in np.quantile(raw,[.50,.90,.95,1])] if len(raw) else []
def geometry(fit,record):
    if record.get('holes'): raise ValueError('holes require separate source plan proof')
    outline=np.asarray(record['footprint'],float)
    if not np.array_equal(outline,fit['outlineWGS84']): raise ValueError('ordered footprint changed')
    native=transform(outline,'EPSG:4326','EPSG:3979')
    b=np.r_[native.min(0)-3,native.max(0)+3]
    if any(b[2:]-b[:2]>300): raise ValueError('window budget')
    return native,b
def coherent_cells(supported):
    suspect={k:[round(float(np.median(v)),6),len(v)] for k,v in supported.items() if abs(np.median(v))>.40}
    comps=[]
    while len(suspect):
        p=min(suspect);pending=[p];sign=math.copysign(1,suspect[p][0]);out=[]
        while pending:
            k=pending.pop()
            if k not in suspect or suspect[k][0]*sign<0:continue
            out.append([*map(int,k),*suspect.pop(k)])
            e,n=k;pending.extend([(e-1,n),(e+1,n),(e,n-1),(e,n+1)])
        comps.append(sorted(out))
    comps.sort(key=lambda c:(-len(c),c))
    return comps
def replay(owner,fit,plan,b,stream,data,sr,local=None):
    if local is not None:
        p=cache_read(local,fit)
        xy=p[:,:2]; z,c,w,ps=p[:,2:6].T
        ma=np.all((xy>=b[:2]-.000005)&(xy<=b[2:]+.000005),axis=1)
        if not np.all(ma):raise ValueError('local source escaped window')
        raw_pin=None
    else:
        from laspy.copc import Bounds
        x=transform(indexes(b),'EPSG:3979',sr)
        pp=data.query(bounds=Bounds(x.min(0)-.05,x.max(0)+.05))
        if len(pp)>MAX_POINTS:raise ValueError('too many native returns in bounded owner')
        xy=transform(np.c_[pp.x,pp.y],sr,'EPSG:3979')
        ma=np.all((xy>=b[:2])&(xy<=b[2:]),axis=1)
        xy=xy[ma]; z,c,w,ps=[np.asarray(v)[ma] for v in (pp.z,pp.classification,pp.withheld,pp.point_source_id)]
        # Sorted integer LAS coordinates and flags, portable little endian.
        rec=np.array(list(zip(*(np.asarray(v)[ma] for v in (pp.X,pp.Y,pp.Z,pp.classification,pp.withheld,pp.point_source_id,pp.gps_time)))),
          dtype=[('X','<i4'),('Y','<i4'),('Z','<i4'),('C','u1'),('W','u1'),('S','<u2'),('T','<f8')])
        raw_pin=sha(np.sort(rec,order=rec.dtype.names).tobytes())
    classes=dict(zip(*[r.tolist() for r in np.unique(c.astype('u1'),return_counts=True)]))
    valid=(c==6)&(~np.asarray(w,dtype=bool))

    a,dist=boundary(plan,xy);inboard=valid&a&(dist>=.71)
    ll=transform(xy[inboard],'EPSG:3979','EPSG:4326')
    phi=math.radians(46.5);dt=1-0.00669437999014*math.sin(phi)**2
    world=(ll-[-63.2,46.5])*(6378137*math.pi/180*np.array([math.cos(phi)/math.sqrt(dt),-(1-.00669437999014)/dt**1.5]))
    centre=np.mean((np.asarray(fit['outlineWGS84'])-[-63.2,46.5])*
      (6378137*math.pi/180*np.array([math.cos(phi)/math.sqrt(dt),-(1-.00669437999014)/dt**1.5])),axis=0)
    M=np.asarray(fit['absolutePlanesGameXZ'],float)
    if M.ndim!=2 or M.shape[1]!=3 or len(M)<2 or len(M)>4 or not np.isfinite(M).all(): raise ValueError('invalid witness envelope')
    planes=np.c_[np.ones(len(world)),world-centre]@M.T; arg=planes.argmin(axis=1)
    dy=z[inboard]-planes.min(1);sqr=full_cells(plan);buckets={}
    for k,e in zip(np.floor(xy[inboard]).astype(int),dy):
        k=tuple(k)
        if k in sqr: buckets.setdefault(k,[]).append(e)
    supported={k:v for k,v in buckets.items() if len(v)>=3}
    comps=coherent_cells(supported)
    plane=[{'count':int(sum(arg==i)),'absP50_90_95_maxM':metrics(abs(dy[arg==i]))} for i in range(M.shape[0])]
    if not len(sqr) or len(supported)/len(sqr)<.60 or any(p['count']<50 for p in plane):
        outcome='insufficient Class6 interior coverage'
    elif any(len(c)>=2 for c in comps): outcome='hold coherent contradictory interior'
    elif any(p['absP50_90_95_maxM'][1]>.45 for p in plane): outcome='hold weak plane'
    else: outcome='no coherent interior contradiction at this threshold'
    return dict(owner=owner,window3979=b.tolist(),rawSortedIntegerAndClassGPSSHA256=raw_pin,
      windowPointCount=len(xy),classCounts=classes,flightlines=sorted(set(map(int,ps[inboard]))),
      admittedClass6Count=len(dy),completeNativeCells=len(sqr),cellsWithAtLeast3Raw=len(supported),perPlane=plane,
      signedResidual1mCellComponents=comps,screenResult=outcome)

def main():
    arg=argparse.ArgumentParser(description=__doc__);arg.add_argument('fixture',type=Path);arg.add_argument('buildings_dir',type=Path);arg.add_argument('report',type=Path);arg.add_argument('--private-window-cache',type=Path,help='Known exact privately cached projected COPC windows')
    a=arg.parse_args()
    witness=regular_bytes(a.fixture,65536);proof=json.loads(witness)
    idx=json.loads(regular_bytes(a.buildings_dir/'index.json',1_500_000))
    if proof.get('version')!=1 or idx['file']!='tiles.pack' or idx['sha256']!=digest(proof['atlasSHA256']):
        raise ValueError('wrong version or atlas identity')
    if len(proof['rows']) not in range(1,33) or not 100<=len(proof['nativeHorizontalWKT'])<=4096:
        raise ValueError('unsupported fixture size')
    sour=proof['expectedPointObjects']
    if not 1<=len(sour)<=16 or any(not POINTFILE.fullmatch(p) for p in sour):raise ValueError('unsupported point object scope')
    pools={};owners={};seen=set();results=[]
    with (a.buildings_dir/'tiles.pack').open('rb') as fd:
        st=os.fstat(fd.fileno())
        if not stat.S_ISREG(st.st_mode) or st.st_size!=strict_int(idx['bytes'],1,256*1024*1024) or hashlib.file_digest(fd,'sha256').hexdigest()!=proof['atlasSHA256']:
            raise ValueError('atlas contents mismatch')
        for c in proof['rows']:
            tid,slot=c['owner'];strict_int(slot,0,50_000)
            if (tid,slot) in seen or not re.fullmatch('q[0-3]{1,12}',tid) or c['copcURL'] not in sour:
                raise ValueError('ambiguous unapproved fixture owner or source')
            seen.add((tid,slot)); spec=next(q for q in idx['tiles'] if q['id']==tid)
            outline=c['outlineWGS84'];plane=c['absolutePlanesGameXZ']
            if not 3<=len(outline)<=179 or not 2<=len(plane)<=4 or not all(len(p)==2 and -65<p[0]<-61 and 45<p[1]<48 for p in outline):
                raise ValueError('unsupported outline or roof')
            if tid not in owners:
                size=strict_int(spec['bytes'],20,2_000_000)
                fd.seek(strict_int(spec['offset'],0,st.st_size-size));src=fd.read(size)
                if sha(src)!=digest(spec['sha256']):raise ValueError('owner chunk checksum')
                with gzip.GzipFile(fileobj=io.BytesIO(src)) as stream:
                    body=stream.read(6_000_001)
                    if len(body)>6_000_000:raise ValueError('oversize decoded owner')
                owners[tid]=json.loads(body)['features']
            if digest(c['ownerChunkSHA256'])!=spec['sha256'] or slot>=len(owners[tid]):raise ValueError('unexpected owner identity')
            q,b=geometry(c,owners[tid][slot])
            pools.setdefault(c['copcURL'],[]).append((c,q,b))
    inputs=[]
    for u,rows in pools.items():
        if a.private_window_cache is not None:
            for c,p,b in rows:results.append(replay(c['owner'],c,p,b,None,None,proof['nativeHorizontalWKT'],a.private_window_cache))
            inputs.append(dict(url=u,source='independently pinned previously range-read windows',**sour[u]))
            continue
        from laspy import CopcReader
        rd=OfficialRange(u,sour[u])
        with CopcReader(rd,close_fd=False,http_num_threads=1) as ch:
            sr=ch.header.vlrs.get_by_id('LASF_Projection',(2112,))[0].string.strip(chr(0))
            if not sr or sr!=proof['nativeHorizontalWKT']:raise ValueError('unexpected native reference')
            for c,p,b in rows: results.append(replay(c['owner'],c,p,b,rd,ch,sr))
        inputs.append(dict(url=u,sourceObjectBytes=rd.size,etag=rd.etag,readBytes=rd.wire,rangeRequests=rd.requests,budgetedRequestedBytes=rd.requested,nativeHorizontalWKTSHA256=sha(sr.encode())))
    doc=dict(fixtureSHA256=sha(witness),atlasSHA256=proof['atlasSHA256'],inputs=inputs,rows=results,
      interpretation="Same-2020 acquisition raw returns, not a new flight/public as-built record. No raw raster or point bytes copied into output.")
    a.report.write_text(json.dumps(doc,indent=2)+'\n')
    for row in results:print(*row['owner'],row['admittedClass6Count'],[len(c) for c in row['signedResidual1mCellComponents']],row['screenResult'])
if __name__=='__main__': main()
