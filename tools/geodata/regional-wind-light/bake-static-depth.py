"""Rebuild the local fixed-sun field from the shipped rigid mast and nacelle; no map or photograph is used.
Each 0.125 m WRG1 texel stores signed distance to the projected caster and the upper caster Y."""
from pathlib import Path
import numpy as np, math,json,hashlib,gzip
from scipy.ndimage import distance_transform_edt
import argparse,struct
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('source',type=Path,help='directory produced by extract-original-casters.mjs')
cli.add_argument('out',type=Path,help='new output directory')
args=cli.parse_args();ROOT=args.source;OUT=args.out;OUT.mkdir(parents=True,exist_ok=True)
S=np.array([-.60,.74,-.31]);S/=np.linalg.norm(S);F=-S[[0,2]]/np.linalg.norm(S[[0,2]]);R=np.array([-F[1],F[0]])
def xyz_to_q(xyz):
 flat=xyz[:,[0,2]]-xyz[:,1:2]*S[[0,2]]/S[1]
 return np.column_stack((flat@F,flat@R))
parts={}
for row in json.loads((ROOT/'actual-shape-sources.json').read_text())['geometry']:
 name=row['id'];p=np.fromfile(ROOT/f'{name}.f64','<f8').reshape((-1,3));ind=np.fromfile(ROOT/f'{name}.u32','<u4').reshape((-1,3))
 q=xyz_to_q(p);D=.125
 L=np.floor((q.min(axis=0)-1.65)/D)*D
 U=np.ceil((q.max(axis=0)+1.65)/D)*D
 N=np.rint((U-L)/D).astype(int)
 Z=np.full((N[1],N[0]),-np.inf)
 front=0
 for i in ind:
  a,b,c=q[i];xyz=p[i]
  v=b-a;w=c-a;den=v[0]*w[1]-v[1]*w[0]
  if abs(den)<1e-12:continue
  # Actual frontside up-sun triangle. True under-seated base cap still lives in the source.
  if np.cross(xyz[1]-xyz[0],xyz[2]-xyz[0])@S<=1e-12:continue
  front+=1
  lx=np.maximum(0,np.floor((q[i].min(axis=0)-L)/D-.5).astype(int));ux=np.minimum(N-1,np.ceil((q[i].max(axis=0)-L)/D-.5).astype(int))
  iy,ix=np.mgrid[lx[1]:ux[1]+1,lx[0]:ux[0]+1];x=L[0]+(ix+.5)*D-a[0];y=L[1]+(iy+.5)*D-a[1]
  u=(x*w[1]-y*w[0])/den;v2=(v[0]*y-v[1]*x)/den
  keep=(u>=-1e-10)&(v2>=-1e-10)&(u+v2<=1+1e-10)
  z=xyz[0,1]+u*(xyz[1,1]-xyz[0,1])+v2*(xyz[2,1]-xyz[0,1]);z0=Z[lx[1]:ux[1]+1,lx[0]:ux[0]+1]
  np.maximum(z0,np.where(keep,z,-np.inf),out=z0)
 hit=np.isfinite(Z)
 inner=distance_transform_edt(hit)-.5
 outer,ip=distance_transform_edt(~hit,return_indices=True);outer-=.5
 sdf=np.where(hit,inner,-outer)*D
 closestZ=Z[ip[0],ip[1]]
 # One unsigned 8-bit signed-distance code and an unsigned 16-bit height (centimetres + 2 m).
 clamp=1.35
 sdf8=np.rint((np.clip(sdf,-clamp,clamp)+clamp)*255/(2*clamp)).astype(np.uint8)
 z16=np.rint((closestZ+2)*100).astype(np.uint16)
 z16[sdf< -clamp]=0
 rgba=np.zeros((*Z.shape,4),np.uint8);rgba[:,:,0]=sdf8;rgba[:,:,1]=z16%256;rgba[:,:,2]=z16//256;rgba[:,:,3]=255

 # Split three exact bytes into reversible horizontal differences; no linear-light texel changes.
 a=rgba[:,:,:3];rr=np.empty_like(a);rr[:,:1]=a[:,:1];rr[:,1:]=a[:,1:]-a[:,:-1]
 raw=b'WRG1'+struct.pack('<HH',int(N[0]),int(N[1]))+np.ascontiguousarray(rr.transpose(2,0,1)).tobytes()
 wire=bytearray(gzip.compress(raw,compresslevel=9,mtime=0));wire[9]=255
 (OUT/f'{name}.wrg.gz').write_bytes(wire)
 report={'width':int(N[0]),'height':int(N[1]),'metresPerPixel':D,'originST':L.tolist(),
   'originalPosition':row['position'],'originalIndices':row['indices'],'wireBytes':len(wire),'rawBytes':len(raw),
   'wireSHA256':hashlib.sha256(wire).hexdigest(),'rawSHA256':hashlib.sha256(raw).hexdigest(),'RGBASHA256':hashlib.sha256(rgba.tobytes()).hexdigest()}
 parts[name]=report;print(name,len(wire),report['wireSHA256'])
(OUT/'rebuild-receipt.json').write_text(json.dumps(parts,indent=2)+'\n')
