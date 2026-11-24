#!/usr/bin/env python3
"""Rebuild one source-pinned dry near-mesh inset; no network or repo writes."""
import argparse,gzip,hashlib,math,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.ndimage import distance_transform_edt,map_coordinates
from osgeo import gdal,osr
PINNED={
 'prince':((6,7,71,58),'35a5f28cfcf29f763f1b3881dc5c2f35a02b37d815b7a8f254e132d5e4da4d45','a015540a30329090e418ea8b7b2b4a6bf9198578bc85a3fa386a1cca810f966d','45c4f25cefe685c144ab1508af227eef9c4743276e99516194cadd9a1929706c'),
 'kings':((30,11,41,109),'30fa2bb1d2b043d21a32b0cc0383760a2a628540192f877ddadff3f38e310422','6d6fbaf360f120e8a835e004c23ccebdf54fccb716a4c2136ee33da3313d1047','971fe5d89a315ce62a209ad3508160bd538647a90b8c33a4bede43ff4b5f866a'),
}
digest=lambda b:hashlib.sha256(b).hexdigest()
def crs(id):
 a=osr.SpatialReference()
 a.ImportFromEPSG(id);a.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return a
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--county',choices=PINNED,required=True)
 p.add_argument('--dtm',type=Path,required=True);p.add_argument('--dsm',type=Path,required=True)
 p.add_argument('--output',type=Path,required=True);p.add_argument('--checkout',type=Path,required=True)
 a=p.parse_args();tx,ix,sx,rx=PINNED[a.county];root=a.checkout.resolve()
 tileX,tileZ,firstX,firstZ=tx
 if digest(a.dtm.read_bytes())!=ix or digest(a.dsm.read_bytes())!=sx:
  raise ValueError('Raster bytes do not match the reviewed survey crops.')
 gdal.UseExceptions();osr.UseExceptions()
 dtm,dsm=gdal.Open(str(a.dtm)),gdal.Open(str(a.dsm))
 gt=dtm.GetGeoTransform();assert gt==dsm.GetGeoTransform() and gt[1]==1 and gt[5]==-1
 assert dtm.RasterXSize==250 and dtm.RasterYSize==200 and dtm.GetSpatialRef().GetAuthorityCode(None)=='3979'
 rawEarth=dtm.ReadAsArray();rawSurface=dsm.ReadAsArray()
 phi=46.5*math.pi/180;e=.00669437999014;w=6378137;t=1-e*math.sin(phi)**2
 lonScale=w*math.pi/180*math.cos(phi)/math.sqrt(t);latScale=w*math.pi/180*(1-e)/t**1.5
 left,top=(-64.47+63.2)*lonScale,(46.5-47.1)*latScale
 dx,dz=2.54*lonScale/(32*112),1.16*latScale/(22*112)
 u=np.arange(65)/32
 x,z=np.meshgrid(left+(tileX*112+firstX+u)*dx,top+(tileZ*112+firstZ+u)*dz)
 geo=osr.CoordinateTransformation(crs(4326),crs(3979))
 def native(X,Z):
  lon,lat=-63.2+X/lonScale,46.5-Z/latScale
  return np.asarray(geo.TransformPoints(list(zip(lon.ravel(),lat.ravel()))))[:,:2]
 nn=native(x,z);cx=nn[:,0]-gt[0]-.5;cz=gt[3]-.5-nn[:,1]
 sample=lambda data:map_coordinates(data,[cz,cx],order=1,mode='constant',cval=np.nan).astype('f8').reshape(65,65)
 earth,surface=sample(rawEarth),sample(rawSurface)
 with tempfile.TemporaryDirectory(prefix='dune-relief-bake-') as t:
  folder=Path(t);(folder/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
  geoFile=folder/'input.f64';np.stack([-63.2+x/lonScale,46.5-z/latScale],axis=2).astype('<f8').tofile(geoFile)
  stockFile=folder/'surface.f64';bundle=folder/'probe.mjs'
  subprocess.run([str(root/'node_modules/.bin/esbuild'),str(root/'tools/geodata/hog-west-stock-ground.mjs'),
      '--bundle','--platform=node','--packages=external','--format=esm','--define:import.meta.env.BASE_URL="/"',
      '--outfile='+str(bundle)],check=True,cwd=root)
  subprocess.run(['node',str(bundle),str(root/'public/world'),str(geoFile),str(stockFile)],check=True,cwd=root)
  wx,wz,cover,stock=np.fromfile(stockFile,dtype='<f8').reshape(65,65,4).transpose((2,0,1))
 stepX=wx[0,1]-wx[0,0];stepZ=wz[1,0]-wz[0,0]
 co=[]
 for a0 in (-stepX-.05,stepX+.05):
  for b0 in (-stepZ-.05,stepZ+.05):
   co.append(native(wx+a0,wz+b0))
 r=np.asarray(co);r[:,:,0]-=gt[0];r[:,:,1]=gt[3]-r[:,:,1]
 indices=np.floor(r.min(axis=0)).astype(int),np.floor(r.max(axis=0)).astype(int)
 allowed=np.zeros(65**2,dtype=bool);short=rawSurface-rawEarth
 for k,((x0,z0),(x1,z1)) in enumerate(zip(*indices)):
  if x0<0 or z0<0 or x1>=250 or z1>=200:continue
  m=rawEarth[z0:z1+1,x0:x1+1];q=short[z0:z1+1,x0:x1+1]
  allowed[k]=np.isfinite(m).all() and m.min()>.85 and q.max()<.27 and q.min()>-.055
 delta=earth+.12-stock
 good=allowed.reshape(65,65)&(cover>45)&(earth>.85)&(surface-earth>-.055)&(surface-earth<.27)&np.isfinite(earth)&np.isfinite(surface)&(abs(delta)<2.4)
 good[[0,-1],:]=False;good[:,[0,-1]]=False
 d=distance_transform_edt(good,sampling=(stepZ,stepX))
 g=np.clip((d-2.)/9.,0,1);weight=g*g*(3.-2.*g)
 offsets=np.rint(100*np.nan_to_num(delta*weight)).astype('<i2')
 weights=np.rint(255*weight).astype('u1')
 offsets[weights==0]=0;weights[offsets==0]=0
 payload=offsets.tobytes()+weights.tobytes()
 if digest(payload)!=rx:raise ValueError('Field or source epoch differs: '+digest(payload))
 b=bytearray(gzip.compress(payload,compresslevel=9,mtime=0));b[9]=3
 a.output.write_bytes(b)
 print(a.county,digest(payload),digest(b),len(b))
if __name__=='__main__':main()
