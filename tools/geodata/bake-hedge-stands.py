#!/usr/bin/python3
"""Bake repeatable vegetation candidates inside mapped PEI woody hedgerows."""
from collections import Counter,defaultdict
from hashlib import sha256
import argparse,gzip,json,math,struct
from pathlib import Path
from osgeo import gdal,ogr,osr
import numpy as np
gdal.UseExceptions();ogr.UseExceptions();osr.UseExceptions()
CLUI='2403859043b620003c9954df37ddaf61296cd1f1f92a8ce9647474ab3621c699'
NATIVE_HEIGHT='aff898586dc11d42394b7866651a92d3f95ca1635dc2e8ebb58bf56737ec8b96'
NATIVE_COVER={'N45W066.tif':'a9ecfc04b044d75d68f5144af3240fa32792c3dcc77e7b429595935c610a80b0',
              'N45W063.tif':'54369b33af4459a37ad7eb6529da8fdf0bf7f102337ac760a200076f236cf941'}
BOUNDS=(-64.47,45.94,-61.93,47.10)
X0,Z0=-63.2,46.5
e2=6.69437999014e-3
rp=math.pi/180;ph=Z0*rp;g=1-e2*math.sin(ph)**2
MX=6378137*rp*math.cos(ph)/math.sqrt(g)
MZ=6378137*(1-e2)*rp/g**1.5
NX,NZ=32,22
LEFT,TOP=(BOUNDS[0]-X0)*MX,(Z0-BOUNDS[3])*MZ
W=(BOUNDS[2]-BOUNDS[0])*MX;D=(BOUNDS[3]-BOUNDS[1])*MZ
PITCH=8.
RECORD=struct.Struct('<HHBB')
RGRID=480.

def srs(epsg):
    r=osr.SpatialReference();r.ImportFromEPSG(epsg);r.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return r
def pos(lon,lat):return ((lon-X0)*MX,(Z0-lat)*MZ)
def geographic(x,z):return (x/MX+X0,Z0-z/MZ)
def bucket(box,pitch):
    for a in range(math.floor(box[0]/pitch),math.floor(box[1]/pitch)+1):
        for b in range(math.floor(box[2]/pitch),math.floor(box[3]/pitch)+1):
            yield a,b

class KnownSurfaces:
    def __init__(self,world,nativeCover):
        self.world=world
        meta=json.loads((world/'cover.json').read_text())
        data=(world/'cover.bin.gz').read_bytes()
        if sha256(data).hexdigest()!=meta['compressedSha256']:raise ValueError('Land cover mismatch')
        self.cover=np.frombuffer(gzip.decompress(data),dtype='uint8').reshape(meta['height'],meta['width'],2)
        self.coversha=meta['compressedSha256']
        ht=json.loads((world/'terrain.json').read_text())
        terrain=gzip.decompress((world/ht['file']).read_bytes())
        if sha256(terrain).hexdigest()!=ht['sha256']:raise ValueError('Elevation grid mismatch')
        self.land=np.frombuffer(terrain,dtype='<i2').reshape(ht['height'],ht['width'])
        self.roads=defaultdict(list)
        meta=json.loads((world/'roads.json').read_text());r=gzip.decompress((world/'roads.bin.gz').read_bytes())
        if sha256(r).hexdigest()!=meta['sha256']:raise ValueError('Road mismatch')
        self.roadsha=meta['sha256']
        rn=struct.unpack_from('>4sHI',r);assert rn== (b'PEIR',1,19465)
        i=10
        for unused in range(rn[-1]):
            n,flags=struct.unpack_from('>HB',r,i);i+=3
            seq=[pos(lon/1e5-65,lat/1e5+45) for lon,lat in struct.iter_unpack('>II',r[i:i+n*8])]
            i+=n*8;half=[2.,2.8,3.6,4.8,6.4][flags&7];guard=half+12.
            for (x,z),(a,b) in zip(seq,seq[1:]):
                dx=a-x;dz=b-z;d=dx*dx+dz*dz
                if not d:continue
                rec=(x,z,dx,dz,1/d,half)
                for key in bucket((min(x,a)-guard,max(x,a)+guard,min(z,b)-guard,max(z,b)+guard),RGRID):
                    self.roads[key].append(rec)
        assert i==len(r)
        self.localCover=[]
        self.localCoverPins={}
        west,south,east,north=BOUNDS
        for path in nativeCover:
            ds=gdal.Open(str(path));q=ds.GetGeoTransform()
            self.localCoverPins[path.name]=sha256(path.read_bytes()).hexdigest()
            assert self.localCoverPins[path.name]==NATIVE_COVER[path.name]
            assert ds.GetSpatialRef().IsSame(srs(4326)) and q[1]>0 and q[5]<0 and q[2]==q[4]==0
            ix=max(0,math.floor((west-q[0])/q[1]))
            jz=max(0,math.floor((north-q[3])/q[5]))
            ir=min(ds.RasterXSize,math.ceil((east-q[0])/q[1]))
            jb=min(ds.RasterYSize,math.ceil((south-q[3])/q[5]))
            assert ix<ir and jz<jb
            arr=ds.ReadAsArray(ix,jz,ir-ix,jb-jz)
            self.localCover.append((q,ix,jz,arr))
        self.buildings=defaultdict(list)
        b=world/'buildings';meta=json.loads((b/'index.json').read_text());pack=(b/meta['file']).read_bytes()
        if sha256(pack).hexdigest()!=meta['sha256']:raise ValueError('Building mismatch')
        self.buildingsha=meta['sha256']
        for tile in meta['tiles']:
            f=json.loads(gzip.decompress(pack[tile['offset']:tile['offset']+tile['bytes']]))
            for item in f['features']:
                geom=ogr.Geometry(ogr.wkbPolygon)
                for coords in (item['footprint'],*item.get('holes',[])):
                    ring=ogr.Geometry(ogr.wkbLinearRing)
                    for v in coords:ring.AddPoint_2D(*pos(*v))
                    ring.CloseRings();geom.AddGeometry(ring)
                if not geom.IsValid():geom=geom.MakeValid()
                G=geom.GetEnvelope()
                prep=geom.CreatePreparedGeometry()
                if not prep:continue
                l,r,b,t=G
                for key in bucket((l-12,r+12,b-12,t+12),RGRID):
                    self.buildings[key].append((G,geom,prep))
        self.pt=ogr.Geometry(ogr.wkbPoint)
    def where(self,x,z,crown):
        u=(x-LEFT)/W;v=(z-TOP)/D
        if not(0<=u<1 and 0<=v<1):return 'outside'
        h,w,_=self.cover.shape
        cl,co=self.cover[int(v*h),int(u*w)]
        fx=max(0,min(w-1,u*w-.5));fz=max(0,min(h-1,v*h-.5))
        ix=int(fx);jz=int(fz);tx=fx-ix;tz=fz-jz
        q=min(w-1,ix+1);p=min(h-1,jz+1)
        coast=((1-tx)*self.cover[jz,ix,1]+tx*self.cover[jz,q,1])*(1-tz)+((1-tx)*self.cover[p,ix,1]+tx*self.cover[p,q,1])*tz
        if co<=134 or coast<134.5:return 'coast'
        if cl in (80,90,95):return 'waterOrWetland'
        lon,lat=geographic(x,z)
        for T,x0,z0,arr in self.localCover:
            i=math.floor((lon-T[0])/T[1])-x0;j=math.floor((lat-T[3])/T[5])-z0
            if 0<=j<arr.shape[0] and 0<=i<arr.shape[1]:
                k=arr[j,i]
                if k in (80,90,95) or not k:return 'nativeWaterOrWetland'
                break
        else:return 'nativeCoverageMissing'
        h,w=self.land.shape
        if self.land[int(v*h),int(u*w)]==-32768:return 'nodata'
        if cl==10:return 'existingWoodland'
        key=math.floor(x/RGRID),math.floor(z/RGRID)
        for a,b,dx,dz,inv,half in self.roads.get(key,()):
            f=max(0,min(1,((x-a)*dx+(z-b)*dz)*inv))
            if (x-a-f*dx)**2+(z-b-f*dz)**2<=(half+max(3.5,crown+.75))**2:return 'road'
        self.pt.SetPoint_2D(0,x,z)
        for (l,r,b,t),geom,prep in self.buildings.get(key,()):
            if l-crown<=x<=r+crown and b-crown<=z<=t+crown and geom.Distance(self.pt)<=crown:
                return 'building'
        return 'eligible'

def sample_random(i,j,s):
    n=((i*1664525)^(j*1013904223)^(s*2246822519))&0xffffffff
    n=((n^(n>>16))*0x7feb352d)&0xffffffff;n=((n^(n>>15))*0x846ca68b)&0xffffffff
    return (n^(n>>16))/4294967296.0

def build(raw,world,forest,native_cover,out):
    receipt=json.loads((raw/'receipt.json').read_text())
    assert receipt['count']==13519 and receipt['objectIdsSHA256']==CLUI
    land=KnownSurfaces(world,native_cover)
    forest_data=gdal.Open(str(forest));gt=forest_data.GetGeoTransform();a=forest_data.ReadAsArray()
    native=srs(2954);wgs=srs(4326)
    assert forest_data.GetSpatialRef().IsSame(native) and (gt[1],gt[2],gt[4],gt[5])==(20.,0.,0.,-20.)
    forest_sha=sha256(forest.read_bytes()).hexdigest()
    assert forest_sha==NATIVE_HEIGHT
    def canopy(x,y):
        j=math.floor((y-gt[3])/gt[5]);i=math.floor((x-gt[0])/gt[1])
        if 0<=j<a.shape[0] and 0<=i<a.shape[1]:
            v=a[j,i]
            if v>0 and v<=80:return float(v)
        return 0.
    og=osr.CoordinateTransformation(native,wgs)
    native_at=osr.CoordinateTransformation(wgs,native)
    seen=set();tiles=defaultdict(list);source=set();note=Counter();county=defaultdict(Counter)
    pt=ogr.Geometry(ogr.wkbPoint)
    for p in receipt['pages']:
        b=gzip.decompress((raw/p['name']).read_bytes())
        assert sha256(b).hexdigest()==p['sha256'];page=json.loads(b)
        assert page['spatialReference']=={'wkid':2291,'latestWkid':2954} and len(page['features'])==p['count']
        for item in page['features']:
            f=item['attributes'];source.add(f['objectid']);assert f['landuse']=='AGR' and f['subuse']=='HR'
            con=Counter()
            for k in range(1,6):con[str(f['cover'+str(k)]).strip()]+=float(f['per'+str(k)] or 0)
            cw=con['TRE']+con['SHR']
            if cw<7:continue
            c=county[f['county']];c['eligibleHedges']+=1
            geom=ogr.CreateGeometryFromEsriJson(json.dumps(item['geometry'],separators=(',',':')))
            if not geom.IsValid():geom=geom.MakeValid()
            native_inset=geom.Buffer(-.08,8)
            geom.Transform(og);l,r,b,t=geom.GetEnvelope()
            x1,z1=pos(l,t);x2,z2=pos(r,b)
            G=native_inset.CreatePreparedGeometry()
            if not G:continue
            found=0
            for j in range(math.floor(z1/PITCH),math.floor(z2/PITCH)+1):
                for i in range(math.floor(x1/PITCH),math.floor(x2/PITCH)+1):
                    x=(i+.16+.68*sample_random(i,j,0))*PITCH
                    z=(j+.16+.68*sample_random(i,j,1))*PITCH
                    tx=math.floor((x-LEFT)/W*NX);tz=math.floor((z-TOP)/D*NZ)
                    if not(0<=tx<NX and 0<=tz<NZ):continue
                    ox=LEFT+tx*W/NX;oz=TOP+tz*D/NZ
                    qx=min(math.floor(W/NX*8),round((x-ox)*8));qz=min(math.floor(D/NZ*8),round((z-oz)*8))
                    x=ox+qx/8;z=oz+qz/8
                    lon,lat=geographic(x,z)
                    nx,ny,_=native_at.TransformPoint(lon,lat)
                    pt.SetPoint_2D(0,nx,ny)
                    if not G.Contains(pt):continue
                    if (i,j) in seen:note['duplicate']+=1;continue
                    seen.add((i,j))
                    if sample_random(i,j,2)>cw/10:
                        note['knownNonWoodyFraction']+=1;continue
                    shrub=sample_random(i,j,3)<con['SHR']/cw
                    var=sample_random(i,j,4)
                    stand=canopy(nx,ny)
                    if shrub:
                        h=2.1+var*1.85
                        typ=1
                    elif stand>=3:
                        h=max(3,min(16,stand*(.76+.27*var)));typ=2
                    else:
                        h=4.5+var*6.1;typ=3
                    crown=round(h*4)/4*(1.68 if shrub else 1.19)*.5+.55
                    why=land.where(x,z,crown)
                    if why!='eligible':
                        note[why]+=1;continue
                    if typ==2:c['standHeightSupport']+=1
                    tiles[tx,tz].append((qx,qz,round(h*4),typ))
                    c['instances']+=1;c['shrub' if shrub else 'tree']+=1;found+=1
            c['representedHedges']+=bool(found)
        print(p['name'],sum(len(v) for v in tiles.values()),flush=True)
    assert len(source)==receipt['count'] and sha256(','.join(map(str,sorted(source))).encode()).hexdigest()==CLUI
    out.mkdir(parents=True,exist_ok=True)
    catalog=[];blocks=[]
    for (i,j),recs in sorted(tiles.items(),key=lambda a:(a[0][1],a[0][0])):
        recs.sort(key=lambda q:(q[1],q[0]))
        content=b''.join(RECORD.pack(*q) for q in recs)
        block=gzip.compress(content,mtime=0,compresslevel=9)
        blocks.append(block)
        catalog.append(dict(id=f'{i}-{j}',bytes=len(block),count=len(recs),sha256=sha256(content).hexdigest()))
    pack=b''.join(blocks);size=0
    for row in catalog:row['offset']=size;size+=row['bytes']
    (out/'stands.pack').write_bytes(pack)
    manifest=dict(version=1,bounds=BOUNDS,cols=NX,rows=NZ,scanPitchMeters=PITCH,recordBytes=RECORD.size,
        bytes=len(pack),sha256=sha256(pack).hexdigest(),tiles=catalog,cluiIDs=CLUI,possibleDuplicateExclusions=note,
        coverSHA256=land.coversha,roadsSHA256=land.roadsha,buildingSHA256=land.buildingsha,
        localCoverSHA256=land.localCoverPins,forestNativeSHA256=forest_sha,forestNativeEPSG=2954,forestNativeSize=list(a.shape[::-1]),forestNativeTransform=gt,stats=county)
    (out/'index.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
    print(json.dumps({k:v for k,v in manifest.items() if k!='tiles'},indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for k in ('source','world','forest','out'):p.add_argument('--'+k,required=True,type=Path)
    p.add_argument('--cover10',required=True,nargs=2,type=Path)
    a=p.parse_args();build(a.source,a.world,a.forest,a.cover10,a.out)
