"""Register the surveyed open fairway support to exactly bounded game texture."""
import argparse,gzip,hashlib,json,math
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from pyproj import Transformer
cli=argparse.ArgumentParser(description=__doc__)
for name in ('source','out','metadata'):cli.add_argument(name,type=Path)
cli.add_argument('--source-sha256',required=True)
cli.add_argument('--verify',action='store_true')
a=cli.parse_args()
if hashlib.sha256(a.source.read_bytes()).hexdigest()!=a.source_sha256:raise ValueError('Certified source does not match.')
d=np.load(a.source,allow_pickle=False);native=d['approved'];L,T=d['upper_left_3979'];k=.5
if native.dtype!=np.bool_ or native[0].any() or native[-1].any() or native[:,0].any() or native[:,-1].any():
    raise ValueError('Artifact must leave every native edge dry.')
projection=Transformer.from_crs(3979,4326,always_xy=True);inverse=Transformer.from_crs(4326,3979,always_xy=True)
p=math.radians(46.5);f=1-.00669437999014*math.sin(p)**2
ax=6378137*math.pi/180*math.cos(p)/math.sqrt(f)
az=6378137*math.pi/180*(1-.00669437999014)/f**1.5
j,i=np.nonzero(native);lo,la=projection.transform(L+i+.5,T-j-.5)
rx=(lo+63.2)*ax;rz=(46.5-la)*az
left,top=math.floor(rx.min()-4),math.floor(rz.min()-4);right,bottom=math.ceil(rx.max()+4),math.ceil(rz.max()+4)
w,h=round((right-left)/k),round((bottom-top)/k)
x,z=np.meshgrid(left+(np.arange(w)+.5)*k,top+(np.arange(h)+.5)*k)
def ground_xy(a,b):return inverse.transform(a/ax-63.2,46.5-b/az)
e,n=ground_xy(x,z)
dist=ndi.map_coordinates(ndi.distance_transform_edt(native),[T-n-.5,e-L-.5],order=1,mode='constant',cval=0)
b=np.clip((dist-1.25)/3.5,0,1)
# Signed world grid with independent source-coverage check for all
# bilinear interpolation support. Full AABB deliberately overshoots triangles.
xs,zs=map(np.asarray,zip(*[ground_xy(x+dx,z+dz)for dx in (-k,k)for dz in (-k,k)]))
ix0=np.floor(xs.min(0)-L-.001).astype(int);ix1=np.floor(xs.max(0)-L+.001).astype(int)
iz0=np.floor(T-zs.max(0)-.001).astype(int);iz1=np.floor(T-zs.min(0)+.001).astype(int)
valid=(ix0>=0)&(iz0>=0)&(ix1<native.shape[1])&(iz1<native.shape[0])
for u,v in zip(*np.nonzero(b)):
 if not valid[u,v] or not native[iz0[u,v]:iz1[u,v]+1,ix0[u,v]:ix1[u,v]+1].all():b[u,v]=0
bytes_=np.rint(b*b*(3-2*b)*255).astype(np.uint8).tobytes()
zip_=gzip.compress(bytes_,compresslevel=9,mtime=0)

nonzero=int(np.count_nonzero(np.frombuffer(bytes_,dtype=np.uint8)))
m={'left':left,'top':top,'step':k,'width':w,'height':h,'nativeQualifiedSquareMetres':int(native.sum()),
 'positiveTexels':nonzero,'sampleEquivalentM2':nonzero*.25,'rawSha':hashlib.sha256(bytes_).hexdigest(),
 'wireSha':hashlib.sha256(zip_).hexdigest(),'rawBytes':len(bytes_),'wireBytes':len(zip_),
 'rawScope':'OSM1353393025 AND direct unblocked native AND 4+ valid Sentinel dates'}
if a.verify:
    if a.out.read_bytes()!=zip_ or json.loads(a.metadata.read_text())!=m:raise ValueError('Replayed fairway archiving disagrees.')
else:
    a.out.write_bytes(zip_)
    a.metadata.write_text(json.dumps(m,indent=2)+'\n')
print(m)
