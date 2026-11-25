import type {BufferAttribute,Mesh} from 'three';
import type {Cover} from '../../sim/cover.ts';
import type {Terrain} from '../../sim/terrain.ts';
import {FORM} from './q192-form.generated.ts';

const [X,Z]=FORM.frame.originXZ;
// All 18 source triangles covering the prelocked 80 m world square. They
// are strictly interior to the unchanged World.patch(3,7,N112); no seam
// rows are touched, and nothing is sampled from the collision surface.
const facets=[32298,32301,32304,32307,32310,32313,32970,32973,32976,32979,32982,32985,33642,33645,33648,33651,33654,33657] as const;

export function olearyIndustrialDry(t:Terrain,c:Cover){
 return !c.waterInsets.some(p=>p.intersects(X-25,Z-25,X+25,Z+25))&&
  [-25,0,25].every(x=>[-25,0,25].every(z=>t.isLand(X+x,Z+z)&&c.distance(t,X+x,Z+z)>18));
}

/** Call only with the already authenticated original N112 lease. */
export function olearyIndustrialSeat(ground:Mesh){
 const g=ground.geometry,p=g.getAttribute('position') as BufferAttribute,i=g.index;
 if(!i||p.count!==12769||i.count!==75264)return;
 const x0=ground.position.x,z0=ground.position.z,xyz=(n:number)=>{
  const j=i.getX(n),col=j%113,row=Math.floor(j/113);
  if(!(col>0&&col<112&&row>0&&row<112))throw Error('q192 support outside native interior');
  return [x0+p.getX(j),p.getY(j),z0+p.getZ(j)];
 };
 const entries=facets.map(n=>{
  const [a,b,c]=[xyz(n),xyz(n+1),xyz(n+2)],dx=b[0]-a[0],dz=b[2]-a[2],ex=c[0]-a[0],ez=c[2]-a[2];
  return {a,b,c,dx,dz,ex,ez,D:dx*ez-dz*ex};
 });
 const sample=(x:number,z:number)=>{
  if(!(Math.abs(x-X)<=40&&Math.abs(z-Z)<=40))return NaN;
  for(const {a,b,c,dx,dz,ex,ez,D} of entries){
   const x1=x-a[0],z1=z-a[2],u=(x1*ez-z1*ex)/D,v=(dx*z1-dz*x1)/D;
   if(u>=-1.e-10&&v>=-1.e-10&&u+v<=1.0000000001)return a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v;
  }
  return NaN;
 };
 if(!Number.isFinite(sample(X,Z)))return;
 return sample;
}
