#!/usr/bin/python3
"""Rebuild the narrow Basin Head water mask from pinned OSM geometry and the base atlas."""
from pathlib import Path
import hashlib,gzip,json,math,zlib
import numpy as np
from scipy.ndimage import label
import argparse
from osgeo import ogr
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--world',type=Path,required=True);parser.add_argument('--osm-pbf',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True);parser.add_argument('--generated',type=Path)
args=parser.parse_args();world=args.world;args.out.mkdir(parents=True,exist_ok=True)
source_sha=hashlib.sha256(args.osm_pbf.read_bytes()).hexdigest()
assert source_sha=='a194019961a640669474f9679a23a8fb9a7522d3ff08f0852e61c4d20d6d4bd7'
ogr.UseExceptions()
dataset=ogr.Open(str(args.osm_pbf));layer=dataset.GetLayerByName('lines')
layer.SetSpatialFilterRect(-62.1142,46.3758,-62.1036,46.3828)
wanted={'1006381577','1006381579','1006381576','361588776'}
arrays={}
for row in layer:
    identifier=row.GetField('osm_id')
    if identifier not in wanted:continue
    assert identifier not in arrays
    if identifier=='361588776':
        assert row.GetField('highway')=='footway' and '"bridge"=>"yes"' in row.GetField('other_tags')
    else:assert '"natural"=>"coastline"' in row.GetField('other_tags')
    arrays[identifier]=np.asarray(row.GetGeometryRef().GetPoints(),dtype=float)[:,:2]
assert set(arrays)==wanted
manifest=json.loads((world/'cover.json').read_text())
a,b,c=(arrays[k] for k in ['1006381577','1006381579','1006381576'])
assert np.array_equal(a[-1],b[0]) and np.array_equal(c[0],b[-1])
west=np.vstack([a,b[1:35]]);east=np.vstack([c[::-1],b[-2:-38:-1]])
northCap=46.38237
def clip(w):
 i=np.flatnonzero((w[:-1,1]<northCap)&(w[1:,1]>=northCap))[0]
 a,b=w[i],w[i+1];return np.vstack([w[:i+1],a+(b-a)*(northCap-a[1])/(b[1]-a[1])])
west,east=clip(west),clip(east)
lonlat=np.vstack([west,east[::-1]])
R=math.pi/180;T=1-.00669437999014*math.sin(46.5*R)**2
mx=6378137*R*math.cos(46.5*R)/math.sqrt(T);mz=6378137*R*(1-.00669437999014)/T**1.5
def p(l):
    return np.stack([(l[...,0]+63.2)*mx,(46.5-l[...,1])*mz],axis=-1)
h=p(lonlat);cw,ch=manifest['width'],manifest['height']
W,S,E,N=manifest['bounds'];origin=p(np.array([W,N]));dx,dz=(p(np.array([E,S]))-origin)/[cw,ch]
digest=lambda b:hashlib.sha256(b).hexdigest()
archive=(world/manifest['file']).read_bytes()
assert digest(archive)==manifest['compressedSha256']
cover=np.frombuffer(gzip.decompress(archive),'u1').reshape(ch,cw,2)[:,:,1].astype(float)
def atlas(x,z):
 u=(x-origin[0])/dx-.5;v=(z-origin[1])/dz-.5;i=np.floor(u).astype(int);j=np.floor(v).astype(int);a=u-i;b=v-j
 return 2*((cover[j,i]*(1-a)+cover[j,i+1]*a)*(1-b)+(cover[j+1,i]*(1-a)+cover[j+1,i+1]*a)*b-128)
ends=np.array([h[0],h[-1]])
steps=np.linspace(0,1,701)
existingInlet=float(atlas(*(ends[0]+steps[:,None]*(ends[1]-ends[0])).T).max())
assert existingInlet<-5
div=64;nx0,nz0=np.floor((h.min(axis=0)-[32,32]-origin)/[dx,dz]-.5).astype(int)
nx1,nz1=np.ceil((h.max(axis=0)+[32,32]-origin)/[dx,dz]-.5).astype(int)
nx,nz=(nx1-nx0)*div+1,(nz1-nz0)*div+1
X,Z=origin+(np.array([nx0,nz0])+.5)*[dx,dz]
E,S=origin+(np.array([nx1,nz1])+.5)*[dx,dz]
x,z=np.meshgrid(np.linspace(X,E,nx),np.linspace(Z,S,nz))
inside=np.zeros_like(x,bool);q=np.full_like(x,1e40)
for a,b in zip(h,np.roll(h,-1,axis=0)):
 d=b-a;dx0,dz0=d
 if dz0:inside^=((a[1]>z)!=(b[1]>z))&(x<(z-a[1])*dx0/dz0+a[0])
 k=np.clip(((x-a[0])*dx0+(z-a[1])*dz0)/np.dot(d,d),0,1)
 q=np.minimum(q,(x-a[0]-dx0*k)**2+(z-a[1]-dz0*k)**2)
signed=np.sqrt(q)*np.where(inside,-1,1)+np.hypot(dx,dz)/div+.19 # strict polygon inset under quantization
def ramp(a,b,v):
 q=np.clip((v-a)/(b-a),0,1)
 return q*q*(3-2*q)
edge=np.minimum.reduce([x-X,E-x,z-Z,S-z])
# The northern cut closes inside the old broad wet channel, selectively
# fading corrections at the mapped banks before the analysis cut itself.
l=p(np.array([-62.108,northCap]))[1]
weight=ramp(7,18,edge)*(1-ramp(9,23,signed))*ramp(0,27,z-l)
r=np.rint(np.clip(signed*4+128,0,255)).astype('u1')
w=np.rint(weight*255).astype('u1');r[w==0]=128
raw=np.stack([r,w],axis=-1).tobytes()
old=atlas(x,z)
new=old+(w/255.)*(np.minimum(old,(r.astype(float)-128)*.25)-old)
changed=(old>=0)&(new<0)
cc,k=label(new<0,np.array([[0,1,0],[1,1,1],[0,1,0]],dtype='u1'))
bridge=arrays['361588776'];bridge=(bridge[1,:]-bridge[0,:])*np.linspace(.1,.9,9)[:,None]+bridge[0,:]
look=p(bridge)
take=np.rint((look-[X,Z])*div/[dx,dz]).astype(int)
allBridge=new[take[:,1],take[:,0]]
sample=np.column_stack([x[changed],z[changed]])
width=(sample.max(axis=0)-sample.min(axis=0))
components=np.unique(cc[changed],return_counts=True)
assert components[0].size==1
assert np.all(new<=old+1e-8) and not (changed & ~inside).any()
rec=dict(boundsXZ=[X,Z,E,S],baseGridIJ=[int(nx0),int(nz0),int(nx1),int(nz1)],
 width=int(nx),height=int(nz),divisions=div,cellMetres=[dx/div,dz/div],
 oldSeaCapMax=existingInlet,westVertices=len(west),eastVertices=len(east),
 maskChangedWaterCells=int(changed.sum()),wetCorrectionFootprintM2=float(changed.sum()*dx*dz/(div*div)),
 rectangleArea=(E-X)*(S-Z),wetComponents=[components[0].tolist(),components[1].tolist()],testedBridgePos=allBridge.tolist(),
 maxScopeSpan=width.tolist(),rawBytes=len(raw),rawSha=digest(raw))
print(json.dumps(rec,indent=2),flush=True)
witness=dict(source='https://download.geofabrik.de/north-america/canada/prince-edward-island.html',
    contributor='© OpenStreetMap contributors',license='https://www.openstreetmap.org/copyright',
    pbf='prince-edward-island-261101.osm.pbf',pbfSha256=source_sha,uses={'natural=coastline':['1006381577','1006381579','1006381576'],'bridge=footway':['361588776']},
    clipNorthLatitude=northCap,offshoreCap=[lonlat[0].tolist(),lonlat[-1].tolist()],
    west=west.tolist(),east=east.tolist(),bridge=arrays['361588776'].tolist())
(args.out/'source-witness.json').write_text(json.dumps(witness,indent=2)+'\n')
output=bytearray(gzip.compress(raw,9,mtime=0));output[9]=255
(args.out/'basin-head-channel.rg.gz').write_bytes(output)
rec['compressedBytes']=len(output);rec['archiveSha']=digest(output);rec['crc32']=f'{zlib.crc32(raw):08x}'
(args.out/'inlet-bake.json').write_text(json.dumps(rec,indent=2)+'\n')
plan={'id':'basin-head-channel-v1','asset':'harbour/odbl/v1/basin-head-channel.rg.gz',
 'mouthZ':float((h[0,1]+h[-1,1])*.5),**{k:rec[k]for k in ['boundsXZ','baseGridIJ','width','height','divisions','cellMetres','crc32']},
 'decodedBytes':len(raw),'sha256':digest(raw),'archiveSha256':digest(output),'compressedBytes':len(output),
 'pinCoverDecodedSha256':digest(gzip.decompress(archive)),
 'pinCoverSha256':manifest['compressedSha256']}
if args.generated:args.generated.write_text('// Derived from pinned OpenStreetMap coastline and legacy signed Cover.\nexport const BASIN_CHANNEL='+json.dumps(plan,indent=2)+' as const;\n')
