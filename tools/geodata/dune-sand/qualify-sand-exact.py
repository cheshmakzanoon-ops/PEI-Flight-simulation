#!/usr/bin/python3
"""Detached dune atlas source trial. Does not write game files."""
import argparse, json, math, gzip, struct
from hashlib import sha256
from collections import Counter, defaultdict
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates, minimum_filter, distance_transform_edt
from osgeo import gdal, ogr

gdal.UseExceptions();ogr.UseExceptions()
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--world',type=Path,required=True)
p.add_argument('--inventory',type=Path,required=True)
p.add_argument('--worldcover',type=Path,action='append',required=True)
p.add_argument('--out',type=Path,required=True)
control=p.parse_args();G=control.world;control.out.mkdir(parents=True,exist_ok=True)
digest='6cf0f501435006a9f1f3ffe27054cfade2bdb38f811915a406918b7b58bf39e5'
if sha256(control.inventory.read_bytes()).hexdigest()!=digest:raise ValueError('Unexpected dune survey revision')
if sha256((G/'cover.bin.gz').read_bytes()).hexdigest()!='46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863':
 raise ValueError('Unexpected stock signed cover')
if sha256((G/'woodland/v1/canopy-receiver-fence-24m.bin.gz').read_bytes()).hexdigest()!='3afcd194c8919cc97dec69cb696c824491e08221018d92e91d0100deb4609085':
 raise ValueError('Unexpected pinned overlays')

phi=46.5*math.pi/180;e=.00669437999014;a=6378137;t=1-e*math.sin(phi)**2
mlon=a*(math.pi/180)*math.cos(phi)/math.sqrt(t);mlat=a*(1-e)*(math.pi/180)/t**1.5
left=(-64.47+63.2)*mlon;top=(46.5-47.1)*mlat
D=(2.54*mlon,1.16*mlat);ndim=(32,22)
step=5.
base=np.frombuffer(gzip.decompress((G/'cover.bin.gz').read_bytes()),np.uint8).reshape(2720,4096,2)[:,:,1].astype(np.float32)
cf=gzip.decompress((G/'woodland/v1/canopy-receiver-fence-24m.bin.gz').read_bytes())
_,fx,fz,fw,fh,cell,_,nr=struct.unpack_from('>4s',cf)[0],*struct.unpack_from('<iiHHHHI',cf,4)
rows=np.frombuffer(cf,'<u4',fh+1,24);seg=np.frombuffer(cf,'<u2',nr*2,24+4*(fh+1)).reshape(nr,2)
def occupied(x,z):
 ix=np.floor((x-fx)/cell).astype(int);iz=np.floor((z-fz)/cell).astype(int)
 out=(ix<0)|(iz<0)|(ix>=fw)|(iz>=fh)
 assert not np.any(out)
 for j in np.unique(iz):
  k=iz==j;r=seg[rows[j]:rows[j+1]]
  p=np.searchsorted(r[:,1],ix[k],side='left')
  a=p<len(r);bad=np.zeros(len(a),dtype=bool)
  bad[a]=ix[k][a]>=r[:,0][p[a]];out[k]=bad
 return out

esaPins={'N45W066.tif':'a9ecfc04b044d75d68f5144af3240fa32792c3dcc77e7b429595935c610a80b0',
         'N45W063.tif':'54369b33af4459a37ad7eb6529da8fdf0bf7f102337ac760a200076f236cf941'}
if {p.name for p in control.worldcover}!=set(esaPins) or len(control.worldcover)!=2:
 raise ValueError('Pass both original named WorldCover tiles')
for p in control.worldcover:
 if sha256(p.read_bytes()).hexdigest()!=esaPins[p.name]:raise ValueError('Unverified WorldCover source')
rasters=[gdal.Open(str(f)) for f in control.worldcover]
def exact_esa(x,z):
 lng=-63.2+x/mlon;lat=46.5-z/mlat
 out=np.zeros(lng.shape,np.uint8)
 for ds in rasters:
  gf=ds.GetGeoTransform()
  ix=np.floor((lng-gf[0])/gf[1]).astype(int);iz=np.floor((lat-gf[3])/gf[5]).astype(int)
  sel=(ix>=0)&(iz>=0)&(ix<ds.RasterXSize)&(iz<ds.RasterYSize)
  if not np.count_nonzero(sel):continue
  ax,bx=ix[sel].min(),ix[sel].max();az,bz=iz[sel].min(),iz[sel].max()
  data=ds.ReadAsArray(int(ax),int(az),int(bx-ax+1),int(bz-az+1))
  out[sel]=data[iz[sel]-az,ix[sel]-ax]
 return out
def whole_esa(x,z,gap=5.050):
 out=np.ones(len(x),dtype=bool);seen=np.zeros(len(x),dtype=bool)
 for ds in rasters:
  gf=ds.GetGeoTransform()
  mn=np.floor((-63.2+(x-gap)/mlon-gf[0])/gf[1]).astype(int)
  mx=np.floor((-63.2+(x+gap)/mlon-gf[0])/gf[1]).astype(int)
  rn=np.floor((46.5-(z-gap)/mlat-gf[3])/gf[5]).astype(int)
  rx=np.floor((46.5-(z+gap)/mlat-gf[3])/gf[5]).astype(int)
  k=(mn>=0)&(mx<ds.RasterXSize)&(rn>=0)&(rx<ds.RasterYSize)
  if not k.any():continue
  left_top=(mn[k].min(),rn[k].min());right_bottom=(mx[k].max(),rx[k].max())
  a=ds.ReadAsArray(*(int(v) for v in (*left_top,right_bottom[0]-left_top[0]+1,right_bottom[1]-left_top[1]+1)))
  b=np.ones(k.sum(),bool)
  for i in range(4):
   for j in range(4):
    keep=(mn[k]+i<=mx[k])&(rn[k]+j<=rx[k])
    b[keep]&=a[rn[k][keep]+j-left_top[1],mn[k][keep]+i-left_top[0]]==60
  assert (mx[k]-mn[k]).max()<4 and (rx[k]-rn[k]).max()<4
  out[k]=b;seen|=k
 return out&seen
def box_geom(x,z,gap):
 b=ogr.Geometry(ogr.wkbLinearRing)
 for u,v in ((-1,-1),(1,-1),(1,1),(-1,1),(-1,-1)):
  b.AddPoint_2D(x+u*gap,z+v*gap)
 g=ogr.Geometry(ogr.wkbPolygon);g.AddGeometry(b);return g
def grid_geom(coords):
 p=ogr.Geometry(ogr.wkbPolygon)
 for seq in coords:
  r=ogr.Geometry(ogr.wkbLinearRing)
  for x,z,*_ in seq:r.AddPoint_2D((x+63.2)*mlon,(46.5-z)*mlat)
  p.AddGeometry(r)
 return p
features=json.loads(control.inventory.read_text())['features']
assert len(features)==483 and len({q['properties']['fid']for q in features})==483
out=defaultdict(Counter);written=defaultdict(set);centers=[]
for q in features:
 a=q['properties'];county=a['county'];o=out[county];o['source']+=1
 assert a['wet_type']=='SAND DUNE'
 if a['class1']!='SDW' or a['wet_per1']!=10 or a['subuse']=='FOR':
  o['heldMixedOrForested']+=1;continue
 p=grid_geom(q['geometry']['coordinates'])
 if not p.IsValid():o['invalidHeld']+=1;continue
 ax,bx,az,bz=p.GetEnvelope()
 i0,i1=math.floor((ax-left)/step)-2, math.ceil((bx-left)/step)+2
 j0,j1=math.floor((az-top)/step)-2, math.ceil((bz-top)/step)+2
 nx,nz=i1-i0,j1-j0
 if nx*nz>1800000:o['wideHeld']+=1;continue
 driver=ogr.GetDriverByName('Memory');m=driver.CreateDataSource('');ls=m.CreateLayer('dunes',geom_type=ogr.wkbPolygon)
 feature=ogr.Feature(ls.GetLayerDefn());feature.SetGeometry(p);ls.CreateFeature(feature)
 r=gdal.GetDriverByName('MEM').Create('',nx,nz,1,gdal.GDT_Byte)
 r.SetGeoTransform((left+i0*step,step,0,top+j0*step,0,step))
 gdal.RasterizeLayer(r,[1],ls,burn_values=[1]);mark=r.ReadAsArray()>0
 if not mark.any():continue
 x,z=np.meshgrid(left+(i0+.5+np.arange(nx))*step,top+(j0+.5+np.arange(nz))*step)
 dry=2*(map_coordinates(base,[(z-top)*2720/D[1]-.5,(x-left)*4096/D[0]-.5],order=1,mode='nearest')-128)
 o['sourceGrid']+=int(mark.sum());o['signedDryGrid']+=int((mark&(dry>27)).sum())
 if not np.any(mark&(dry>27)):continue
 esa=exact_esa(x,z);raw=mark&(dry>27)&(esa==60)&~occupied(x,z)
 o['bareDryClearGrid']+=int(raw.sum())
 within=minimum_filter(raw,size=3,mode='constant',cval=False)>0
 if not within.any():continue
 iy,ix=np.nonzero(within);px,pz=x[iy,ix],z[iy,ix]
 exact=whole_esa(px,pz)
 for a0 in (-5.050,5.050):
  for b0 in (-5.050,5.050):
   sd=2*(map_coordinates(base,[(pz+b0-top)*2720/D[1]-.5,(px+a0-left)*4096/D[0]-.5],order=1,mode='nearest')-128)
   exact&=(sd>27)&~occupied(px+a0,pz+b0)
 for j in np.flatnonzero(exact):
  exact[j]=p.Contains(box_geom(px[j],pz[j],5.050))
 within[iy,ix]=exact
 if not within.any():continue
 o['fullSupportPolygonCount']+=1;o['supportGrid']+=int(within.sum())
 ii=np.nonzero(within)
 for row,col in zip(i0+ii[1],j0+ii[0]):written[county].add((int(row),int(col)))
 j,i=np.unravel_index(np.argmax(distance_transform_edt(within)),within.shape)
 centers.append(dict(fid=a['fid'],county=county,hectares=a['hectares'],cells=int(within.sum()),lon=float(-63.2+x[j,i]/mlon),lat=float(46.5-z[j,i]/mlat),signedDryM=float(dry[j,i])))
caps={k:dict(m,uniqueSupportM2=25*len(written[k])) for k,m in sorted(out.items())}
print(json.dumps(caps,indent=2))
(control.out/'sand-qualification-exact.json').write_text(json.dumps(dict(classes=caps,candidates=sorted(centers,key=lambda x:-x['cells'])),indent=2)+'\n')
np.savez_compressed(control.out/'sand-qualified-exact.npz',**{k:np.asarray(sorted(v),dtype='<i4') for k,v in written.items()})
