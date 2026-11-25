"""Pre-candidate independently computed finite original moving blade tests. Normals, simulator meshes/donor imagery are not edited."""
from pathlib import Path
import json,hashlib,math,argparse,numpy as np
D=Path(__file__).resolve().parent
J=lambda p:json.loads(p.read_text());H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def pose(v,angle,M,origin):
 c=math.cos(angle);s=math.sin(angle);p=v.copy();p[:,1]=v[:,1]*c-v[:,2]*s;p[:,2]=v[:,1]*s+v[:,2]*c;return p@M[:3,:3].T+(M[:3,3]-origin)
def raster(v,ix,local,K,xx,zz):
 shp=(len(zz),len(xx));hi=np.full(shp,-np.inf);radius=np.full(shp,-1.,'f4');vane=np.zeros(shp,'u1');sourceTop=[v[:,1].min(),v[:,1].max()];q=v[:,[0,2]]-v[:,1,None]*K
 for it in ix:
  e=q[it];t=v[it];a,b,c=e;lo=e.min(0);up=e.max(0);x0,x1=np.searchsorted(xx,[lo[0]-1e-9,up[0]+1e-9]);z0,z1=np.searchsorted(zz,[lo[1]-1e-9,up[1]+1e-9])
  if x0==x1 or z0==z1:continue
  f=b-a;d=c-a;den=f[0]*d[1]-f[1]*d[0]
  if abs(den)<1.e-11:continue
  xx0=xx[None,x0:x1]-a[0];zz0=zz[z0:z1,None]-a[1];u=(xx0*d[1]-zz0*d[0])/den;w=(f[0]*zz0-f[1]*xx0)/den;ons=(u>=-1.e-9)&(w>=-1.e-9)&(u+w<=1.000000001);key=np.s_[z0:z1,x0:x1];yy=t[0,1]+u*(t[1,1]-t[0,1])+w*(t[2,1]-t[0,1]);see=ons&(yy>hi[key])
  if not see.any():continue
  hi[key][see]=yy[see]
  if local is not None:
   oy=local[it,1];oz=local[it,2];ly=oy[0]+u[see]*(oy[1]-oy[0])+w[see]*(oy[2]-oy[0]);lz=oz[0]+u[see]*(oz[1]-oz[0])+w[see]*(oz[2]-oz[0]);r=np.sqrt(ly**2+lz**2);radius[key][see]=r;vane[key][see]=((np.floor(np.arctan2(lz,ly)/(2*math.pi/3)+.5).astype('i4')%3)+1).astype('u1')
 return hi,radius,vane
def check(pos,ix,sun,orig,ref):
 t=pos[ix];e1=t[:,1]-t[:,0];e2=t[:,2]-t[:,0];p=np.cross(sun,e2);det=np.einsum('ij,ij->i',e1,p);valid=abs(det)>1e-11;inv=1./np.where(valid,det,1.);m=0.;bad=0;hi=0
 for o,truth in zip(orig,ref):
  to=o-t[:,0];u=np.einsum('ij,ij->i',to,p)*inv;cross=np.cross(to,e1);v=(cross@sun)*inv;dist=np.einsum('ij,ij->i',e2,cross)*inv;keep=valid&(u>=-1e-9)&(v>=-1e-9)&(u+v<=1.000000001)&(dist>=.025/sun[1])
  top=o[1]+sun[1]*dist[keep].max()if keep.any()else -np.inf
  if np.isfinite(top)!=np.isfinite(truth):bad+=1
  elif np.isfinite(top):m=max(m,abs(top-truth));hi+=1
 return {'count':len(orig),'hit':hi,'mismatch':bad,'maxDepthErrorM':m}
def main():
 P=argparse.ArgumentParser();P.add_argument('--original',type=Path,required=True);P.add_argument('--out',type=Path,required=True);a=P.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 reg=D/'independent-moving-shadow-gates.json';assert H(reg)=='fe670b5e2d5a6584164537282f267d23434660f06dad1e12554d94d4f3aac578'
 R=J(reg);sun=np.array(R['realSun']);K=sun[[0,2]]/sun[1];xx=np.arange(-15.937,150.10001,.2);zz=np.arange(-26.063,111.10001,.2);X=xx[None,:];Z=zz[:,None];S=J(a.original/'registered-original-sources.json');out={'registered':H(reg),'sourceExtraction':H(a.original/'registered-original-sources.json'),'method':'Every positive solar ray tested against every original 3D triangle at 12 independently registered clock values; separate projected raster plus double-sided 3D Moller-Trumbore on stratified true-positive/empty receivers. Stored compact private truth only, no author bake/footprint or runtime modification. All source orientations from actual original batch matrix + original compiled phase expression. Real mounted GPU proof remains separate.','rows':{}}
 for k,(id,g)in enumerate(S['rows'].items()):
  load=lambda typ,ext,dtype:np.fromfile(a.original/(id+'-'+typ+ext),dtype).reshape(-1,3)
  v=load('rotor','.f32','<f4').astype('f8');idx=load('rotor','.u32','<u4');base=np.array(g['base']).reshape(4,4).T;sp=np.array(g['spindle']).reshape(4,4).T;mv=load('mast','.f32','<f4').astype('f8')@base[:3,:3].T;mi=load('mast','.u32','<u4');sTop,_,_=raster(mv,mi,None,K,xx,zz); radius=g['radius'];hub=g['hub'];rows=[];p0=None;positions=[]
  for j,row in enumerate(g['clocks']):
   pp=pose(v,row['theta'],sp,base[:3,3]);positions.append(pp);alternate=pose(v,row['thetaFMA'],sp,base[:3,3]);upper,rad,wing=raster(pp,idx,v,K,xx,zz);inside=np.isfinite(upper);I=np.flatnonzero(inside);full=inside.sum();assert len(I)>1000
   # Independent exact physical rays in original 3D at 2 emitter-side locations, not just a chance hit in an empty broad region.
   gen=np.random.default_rng(272537+1097*k+j);po=gen.choice(I,175,replace=False);empty=np.flatnonzero(~inside);ng=gen.choice(empty,95,replace=False);loc=np.r_[po,ng];jz,jx=np.unravel_index(loc,upper.shape);yh=-25+gen.uniform(0,50,len(loc));org=np.column_stack([xx[jx]+yh*K[0],yh,zz[jz]+yh*K[1]]);goal=upper[jz,jx].copy();goal[goal<yh+.025]=-np.inf;ray=check(pp,idx,sun,org,goal);assert ray['mismatch']==0 and ray['maxDepthErrorM']<1e-5,(id,j,ray)
   layers={};ds=[('ym25',-25),('y0',0),('yp25',25),('lowstress',hub-.33*radius),('highstress',hub+.33*radius),('above',hub+radius+3)]
   for ax,az in [(.15,-.09),(-.12,.17)]:ds.append((f'slope{ax},{az}',(ax*X+az*Z)/(1.-ax*K[0]-az*K[1])))
   for n,y in ds:
    m=upper>y+.025;layers[n]={'rotorOnly':int(m.sum()),'sourceStaticOverlap':int((m&(sTop>y+.025)).sum()),'vaneOuter':{str(vn):int((m&(wing==vn)&(rad>=.75*radius)).sum())for vn in [1,2,3]}}
   F=a.out/(id+'-'+str(j)+'.npz');np.savez_compressed(F,xx=xx,zz=zz,top=upper.astype('<f4'),topSourceRadius=rad,sourceVane=wing)
   same=None if p0 is None else float(np.max(np.linalg.norm(pp-p0,axis=1)));p0=pp;rows.append({'time':row['time'],'theta':row['theta'],'nearPhaseCoefficient':g['angleRateFromActualShader'],'3DIndependent':ray,'nominalShelledBoundsY':[round(float(pp[:,1].min()),6),round(float(pp[:,1].max()),6)],'maxShaderFMAPrecisionDeltaM':round(float(np.max(np.linalg.norm(pp-alternate,axis=1))),7),'maxDistanceFromPrecedingTimeM':same,'fullHardProjectionPixels':int(full),'pinnedTruthSHA256':H(F),'layers':layers})
  periodic=float(np.max(np.linalg.norm(positions[0]-positions[-1],axis=1)));assert periodic<.03,(id,periodic)
  for l in [1,8,9]:
   dt=g['clocks'][l+1]['time']-g['clocks'][l]['time'];expected=radius*2*math.sin(g['angleRateFromActualShader']*dt*.5);actual=np.max(np.linalg.norm(positions[l+1]-positions[l],axis=1));assert abs(actual-expected)<.03,(id,l,actual,expected)
  out['rows'][id]={'sourceTriangles':len(idx),'sourcePixelsPerPhase':int(upper.size),'periodicMaxDisplacementM':periodic,'areaPerCellM2':.04,'phaseRows':rows};print(id,len(rows),sum(s['3DIndependent']['count']for s in rows),'full range',min(s['fullHardProjectionPixels']for s in rows),max(s['fullHardProjectionPixels']for s in rows),'periodic',periodic,flush=True)
 result=a.out/'ray-truth-manifest.json';result.write_text(json.dumps(out,indent=2)+'\n');print('SHA256',H(result),flush=True)
if __name__=='__main__':main()
