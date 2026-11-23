#!/usr/bin/python3
"""Rebuild the small surveyed Basin Head bank from pinned NRCan and OSM inputs."""
from pathlib import Path
import argparse,math,gzip,json,struct,runpy,hashlib,zlib
import numpy as np
from scipy.ndimage import map_coordinates
from osgeo import osr
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--world',type=Path,required=True)
parser.add_argument('--channel-bake',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True);parser.add_argument('--generated',type=Path)
parser.add_argument('--native-window',type=Path,help='checked optional cache rather than refetching native mosaic')
parser.add_argument('--without-cannery',action='store_true',help='Rebuild prior inlet-only reference')
args=parser.parse_args();world=args.world;args.out.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
if args.native_window and args.native_window.exists():
    cached=np.load(args.native_window);H=cached['dtm'];X,Y=cached['xyFirst']
else:
    helper=runpy.run_path(str(root/'tools/qa/roof-fit-pilot.py'))
    _,dtm,geo,to=helper['open_models']()
    cx,cy,_=to.TransformPoint(-62.10880,46.3800)
    i,j=int((cx-geo[0])//geo[1])-480,int((cy-geo[3])//geo[5])-480
    H=dtm.ReadAsArray(i,j,960,960).astype('<f4')
    X,Y=geo[0]+(i+.5)*geo[1],geo[3]+(j+.5)*geo[5]
    if args.native_window:np.savez_compressed(args.native_window,dtm=H,xyFirst=[X,Y])
assert sha(H.astype('<f4',copy=False).tobytes())=='429d2cd826b6cec577f08614b6335c3f16091f459aa9c8402b5eaba60fc07b07'

M=json.loads((world/'terrain.json').read_text());C=json.loads((world/'cover.json').read_text())
terrain=np.frombuffer(gzip.decompress((world/M['file']).read_bytes()),'<i2').reshape(M['height'],M['width'])
land=np.frombuffer(gzip.decompress((world/C['file']).read_bytes()),'u1').reshape(C['height'],C['width'],2)
cut=args.channel_bake;r=json.loads((cut/'inlet-bake.json').read_text())
mask=gzip.decompress((cut/'basin-head-channel.rg.gz').read_bytes())
assert sha(mask)==r['rawSha']=='5fb177952ea7ef0b0dcd9e50a0f11fdb64f5939a7122f1ea775af7e0cd99f142'
sg=np.frombuffer(mask,'u1').reshape(r['height'],r['width'],2)
W,S,E,N=M['bounds'];rad=np.pi/180;ee=.00669437999014;T=1-ee*np.sin(46.5*rad)**2
MX=6378137*rad*np.cos(46.5*rad)/np.sqrt(T);MZ=6378137*rad*(1-ee)/T**1.5
def project(x,z):return (x+63.2)*MX,(46.5-z)*MZ
def smooth(q,a,b):
 m=np.clip((q-a)/(b-a),0,1);return m*m*(3-2*m)
west,north=project(W,N);east,south=project(E,S);dx,dz=(east-west)/(32*112),(south-north)/(22*112)
l,t,s,b=r['boundsXZ']
i0,j0=np.floor((np.array([l-18,t-16])-np.array([west,north]))/[dx,dz]).astype(int)
i1,j1=np.ceil((np.array([s+18,b+16])-np.array([west,north]))/[dx,dz]).astype(int)
assert i0//112==29 and j0//112==13 and i1//112==29 and j1//112==13
split=14
i,j=np.meshgrid(np.linspace(i0,i1,(i1-i0)*split+1),np.linspace(j0,j1,(j1-j0)*split+1))
u,v=i/(32*112),j/(22*112);lon=W+(E-W)*u;lat=N-(N-S)*v
x,z=project(lon,lat)
def base(a,b):
 sx=(a/(32*112))*M['width']-.5;sy=(b/(22*112))*M['height']-.5
 ix=np.floor(sx).astype(int);iz=np.floor(sy).astype(int);i=sx-ix;j=sy-iz
 samples=[terrain[iz,ix],terrain[iz,ix+1],terrain[iz+1,ix],terrain[iz+1,ix+1]]
 weights=[(1-i)*(1-j),i*(1-j),(1-i)*j,i*j]
 mass=sum((q>-32000)*f for q,f in zip(samples,weights))
 return np.maximum(0,np.divide(sum(np.where(q>-32000,q,0)*f for q,f in zip(samples,weights)),mass,where=mass>0,out=np.zeros_like(mass)))
ui,vi=np.floor(i),np.floor(j);a,c=i-ui,j-vi
NW,NE,SW,SE=base(ui,vi),base(ui+1,vi),base(ui,vi+1),base(ui+1,vi+1)
old=np.where(a+c<=1,NW+(NE-NW)*a+(SW-NW)*c,SE+(SW-SE)*(1-a)+(NE-SE)*(1-c))
src=osr.SpatialReference();src.ImportFromEPSG(4326);src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
dst=osr.SpatialReference();dst.ImportFromEPSG(3979);dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
op=osr.CoordinateTransformation(src,dst)
p=np.asarray(op.TransformPoints(np.column_stack([lon.ravel(),lat.ravel()]))).reshape((*x.shape,3))
px,py=p[:,:,0]-X,Y-p[:,:,1]
source=map_coordinates(H,[py,px],order=1,mode='constant',cval=-32767)
valid=(source>-30000)&np.isfinite(source)
cover=map_coordinates(land[:,:,1].astype(float),[v*C['height']-.5,u*C['width']-.5],order=1)
lo=2*(cover-128)
raw=map_coordinates(sg[:,:,0].astype(float),[(z-t)/(b-t)*(r['height']-1),(x-l)/(s-l)*(r['width']-1)],order=1,mode='constant',cval=255)
boundary=(raw-128)*.25
Wsrc=map_coordinates(sg[:,:,1].astype(float),[(z-t)/(b-t)*(r['height']-1),(x-l)/(s-l)*(r['width']-1)],order=1,mode='constant',cval=0)/255
field=lo+Wsrc*(np.minimum(lo,boundary)-lo)
edge=np.minimum.reduce((i-i0,i1-i,j-j0,j1-j))
weight=smooth(edge,0,1.0)*smooth(Wsrc,.02,.86)*valid
landmark=root/'data/odbl/basin-head-channel/cannery-way.json'
includes_landmark=landmark.exists() and not args.without_cannery
if includes_landmark:
 witness=json.loads(landmark.read_text())
 assert witness['way']==361588784 and len(witness['outer'])==4
 a0,a1,a2,a3=np.asarray([project(lon,lat) for lon,lat in witness['outer']])
 axes=np.column_stack([a1-a0,a3-a0])
 u0,v0=np.linalg.solve(axes,(np.c_[x.ravel(),z.ravel()]-a0).T).reshape(2,*x.shape)
 du=np.maximum.reduce([-u0,u0-1.23,np.zeros_like(u0)])*np.linalg.norm(axes[:,0])
 dv=np.maximum.reduce([-v0,v0-1,np.zeros_like(v0)])*np.linalg.norm(axes[:,1])
 # The surveyed dry grade beneath the Cannery was missing from the coarse
 # game surface. Recover it without inheriting a new land/water classifier.
 supported=(1-smooth(np.hypot(du,dv),.0,12.5))*smooth(edge,0,1.0)*valid
 weight=np.maximum(weight,supported)
# surveyed dry banks source only. Current height authority on visible dry
# land never takes below-surface bathymetry as a new executable plateau.
native=np.where(valid,np.maximum(.02,source),old)
roads=gzip.decompress((world/'roads.bin.gz').read_bytes());cursor=10
near=np.full_like(old,1e8)
for _ in range(struct.unpack_from('>I',roads,6)[0]):
 n,k=struct.unpack_from('>HB',roads,cursor);cursor+=3
 xy=[]
 for j0r in range(n):
  a0,b0=struct.unpack_from('>II',roads,cursor);cursor+=8
  xy.append(project(a0/1e5-65,b0/1e5+45))
 for (a0,b0),(a1,b1) in zip(xy,xy[1:]):
  if max(a0,a1)<x.min()-50 or min(a0,a1)>x.max()+50 or max(b0,b1)<z.min()-50 or min(b0,b1)>z.max()+50:continue
  dd,dz1=a1-a0,b1-b0
  if dd*dd+dz1*dz1<1e-6:continue
  f=np.clip(((x-a0)*dd+(z-b0)*dz1)/(dd*dd+dz1*dz1),0,1)
  near=np.minimum(near,np.hypot(x-a0-f*dd,z-b0-f*dz1))
weight*=smooth(near,9,19)
# Existing objects retain exact grades throughout their known footprint.
build=json.loads((world/'buildings/index.json').read_text());pack=(world/'buildings'/build['file']).read_bytes()
for rr in build['tiles']:
 for q in json.loads(gzip.decompress(pack[rr['offset']:rr['offset']+rr['bytes']]))['features']:
  if not q.get('footprint'):continue
  gx,gz=project(*np.array(q['footprint']).T)
  if gx.max()<x.min()-10 or gx.min()>x.max()+10 or gz.max()<z.min()-10 or gz.min()>z.max()+10:continue
  d1=np.maximum.reduce((gx.min()-x,np.zeros_like(x),x-gx.max()))
  d2=np.maximum.reduce((gz.min()-z,np.zeros_like(z),z-gz.max()))
  weight*=smooth(np.hypot(d1,d2),4,10)
out=old+weight*(native-old)
fit=(weight>.96)&(field>0)&(source>=0)
mask=(weight>0)&(field>=0)
print('mesh',int(i0%112),int(j0%112),int(i1-i0),int(j1-j0),split,out.shape)
print('dry valid',int(fit.sum()),'dry scope',int(mask.sum()),'visible delta p50 p90 p100',np.quantile(abs(out-old)[mask],[.50,.90,1]).tolist())
P=project(-62.10866107,46.37827283)
k=np.unravel_index(np.argmin((x-P[0])**2+(z-P[1])**2),x.shape)
print('near worst preliminary',dict(old=float(old[k]),native=float(source[k]),candidate=float(out[k]),weight=float(weight[k]),field=float(field[k])))
q=np.rint((out-old)*100).astype('<i2');a=np.rint(weight*255).astype('uint8')
a[(a==0)&(q!=0)]=1
assert not np.any(q[[0,-1],:]) and not np.any(q[:,[0,-1]])
raw=q.tobytes()+a.tobytes()
archive=bytearray(gzip.compress(raw,9,mtime=0));archive[9]=255
name='basin-bank-terrain-v2.cm.gz' if includes_landmark else 'basin-bank-terrain.cm.gz'
plan=dict(id='basin-head-native-bank',kind='inland',relativeToParent=True,tileX=29,tileZ=13,
    firstX=int(i0%112),firstZ=int(j0%112),cellsX=int(i1-i0),cellsZ=int(j1-j0),sub=split,
    decodedBytes=len(raw),sha256=sha(raw),compressedSha256=sha(archive),crc32=f'{zlib.crc32(raw)&0xffffffff:08x}',
    asset='harbour/odbl/v1/'+name,compressedBytes=len(archive),pinTerrainSha256=M['sha256'],pinBasinSha256=r['rawSha'])
(args.out/name).write_bytes(archive)
(args.out/'bank-native-bake.json').write_text(json.dumps(plan,indent=2)+'\n')
if args.generated:args.generated.write_text('// Generated from pinned native HRDEM samples and exact parent-facet deltas.\nexport const BASIN_GROUND='+json.dumps(plan,indent=2)+' as const;\n')
