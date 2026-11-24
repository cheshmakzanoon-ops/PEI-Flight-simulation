#!/usr/bin/env python3
"""Reproduce the bounded west Hog terrain grade with unchanged photo and coast margins.

Requires Python with GDAL, NumPy and SciPy, plus npm ci. Input must be the two
pinned, undistorted 380 x 240 1m GeoTIFF study windows documented in the receipt.
No network access; writes only the file supplied by --output.
"""
import argparse
import gzip
import hashlib
import math
from pathlib import Path
import subprocess
import tempfile
from osgeo import gdal, osr
import numpy as np
from scipy.ndimage import distance_transform_edt, map_coordinates

P=Path(__file__).resolve()
R=P.parents[2]
SOURCE=(
 ('dtm','84dbd8daecf6e94f5a1a077966c35a9254a8ea1e1abff03c01d50065009e225c'),
 ('dsm','b301379a09e466c943452095a0a68e0fbb10a89b163e684ab74f8f7f61609b1f'),
)
BASIS=[[132.37939370383538,.42967193920048885],[-1.4128004407630215,40.01067368965232]]

def sha(v):return hashlib.sha256(v).hexdigest()

def raster(path,fingerprint):
 if sha(path.read_bytes())!=fingerprint:raise ValueError(f'Source bytes do not match receipt: {path.name}')
 ds=gdal.Open(str(path))
 shape=(ds.RasterYSize,ds.RasterXSize)
 if shape!=(240,380) or tuple(ds.GetGeoTransform())!=(2313570.,1.,0.,314768.,0.,-1.) or ds.GetSpatialRef().GetAuthorityCode(None)!='3979':
  raise ValueError(f'Unexpected source registration: {path.name}')
 data=ds.ReadAsArray().astype(np.float64)
 data[data==ds.GetRasterBand(1).GetNoDataValue()]=np.nan
 return data

def main():
 p=argparse.ArgumentParser(description=__doc__)
 for name,_ in SOURCE:p.add_argument('--'+name,required=True,type=Path)
 p.add_argument('--output',required=True,type=Path)
 args=p.parse_args()
 dtm,dsm=[raster(getattr(args,n),digest)for n,digest in SOURCE]
 phi=46.5*math.pi/180;e=.00669437999014;a=6378137;t=1-e*math.sin(phi)**2
 mlon=a*(math.pi/180)*math.cos(phi)/math.sqrt(t);mlat=a*(1-e)*(math.pi/180)/t**1.5
 left=(-64.47+63.2)*mlon;top=(46.5-47.1)*mlat
 dx=2.54*mlon/(32*112);dz=1.16*mlat/(22*112)
 i,j=np.meshgrid(np.arange(65)/32,np.arange(65)/32)
 X=left+(7*112+101+i)*dx;Z=top+(8*112+81+j)*dz
 lon=-63.2+X/mlon;lat=46.5-Z/mlat
 wgs=osr.SpatialReference();wgs.ImportFromEPSG(4326);wgs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
 lam=osr.SpatialReference();lam.ImportFromEPSG(3979);lam.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
 points=np.array(osr.CoordinateTransformation(wgs,lam).TransformPoints(list(zip(lon.ravel(),lat.ravel()))))
 c=points[:,0]-2313570.5;r=314767.5-points[:,1]
 def warp(q):return map_coordinates(q,[r,c],order=1,mode='constant',cval=np.nan).reshape(X.shape)
 e,s=warp(dtm),warp(dsm)
 with tempfile.TemporaryDirectory(prefix='hog-west-grade-')as v:
  out=Path(v);(out/'node_modules').symlink_to(R/'node_modules',target_is_directory=True)
  inp=out/'geo.bin';result=out/'stock.bin'
  np.stack([lon,lat],axis=2).astype('<f8').tofile(inp)
  bundle=out/'stock.mjs'
  subprocess.run([str(R/'node_modules/.bin/esbuild'),str(P.with_name('hog-west-stock-ground.mjs')),
   '--bundle','--platform=node','--packages=external','--format=esm','--define:import.meta.env.BASE_URL="/"','--outfile='+str(bundle)],check=True,cwd=R)
  subprocess.run(['node',str(bundle),str(R/'public/world'),str(inp),str(result)],check=True,cwd=R)
  q=np.fromfile(result,dtype='<f8').reshape(65,65,4)
 x,z,coast,stock=q.transpose((2,0,1))
 u,v=np.linalg.inv(BASIS)@np.array([x.ravel()+49437.29465440328,z.ravel()+15594.744033968265])
 photo=((u>-.07)&(u<1.07)&(v>-.24)&(v<1.24)).reshape(x.shape)
 delta=e+.12-stock
 valid=(coast>36)&np.isfinite(e)&np.isfinite(s)&(e+.12>.9)&(s-e<.33)&(s-e>-.05)&(abs(delta)<2.49)&~photo
 valid[[0,-1],:]=False;valid[:,[0,-1]]=False
 d=distance_transform_edt(valid,sampling=(dz/32,dx/32))
 u=np.clip((d-1.8)/6,0,1);w=u*u*(3-2*u)
 D=np.rint(100*np.nan_to_num(delta*w)).astype('<i2');W=np.rint(255*w).astype('u1')
 D[W==0]=0;W[D==0]=0
 raw=D.tobytes()+W.tobytes()
 if sha(raw)!='bdf30d4db6b0afe3f5831148bf21ba70bbf967b5560ea76e652f2c12c283e026':
  raise ValueError(f'Survey/runtime changed; revision requires review: {sha(raw)}')
 packet=bytearray(gzip.compress(raw,mtime=0,compresslevel=9))
 packet[9]=3  # canonical gzip OS byte; Python revisions otherwise vary
 args.output.write_bytes(packet)
 print('Decoded SHA256',sha(raw),'compressed SHA256',sha(args.output.read_bytes()))

if __name__=='__main__':main()
