import * as T from 'three';
import {PAVILION_ROOF} from './roof-evidence.generated.ts';
import {DATUM} from './frame.ts';
import {PLAN,CUT} from './roof.ts';
const edgeMargin=.026;
const upper=PAVILION_ROOF.coeff.slice(1).map(([u,v,h])=>[u,v,h-DATUM] as const);
const sides=PLAN.map((p,i,a)=>{
 const q=a[(i+1)%a.length];
 const e=new T.Vector2(q[1]-p[1],p[0]-q[0]).normalize();
 return [e.x,e.y,e.x*p[0]+e.y*p[1]+edgeMargin] as const; // inward normals on clockwise ring
});
const inside=(u:number,v:number)=>u>=CUT[0]+edgeMargin&&v>=CUT[1]+edgeMargin&&
 sides.every(([nx,ny,d])=>nx*u+ny*v>=d);
type XYH=readonly [number,number,number];

/** Conservative convex occlusion: all vertices of the opaque interior beam
 * must project strictly into the raised roof's support on BOTH extended
 * planes, while remaining strictly below each. Perspective projection to a
 * plane preserves convexity when all signed depth denominators have the same
 * sign. The first intersection with max(plane 1,plane 2) is consequently
 * inside the real roof too. Check the only direct shadow ray independently
 * so this optimization cannot alter a visible cast from the beam.
 * Values are metres in the model frame (u east, v north, y relative datum).
 */
export function interiorBeamHidden(vertices:readonly XYH[],eye:XYH,sun:XYH){
 if(!vertices.length||![...eye,...sun].every(Number.isFinite))return false;
 return upper.every(([x,y,c])=>{
  const e=eye[2]-x*eye[0]-y*eye[1]-c;
  const l=sun[2]-x*sun[0]-y*sun[1];
  if(e<=.026||l<=.015)return false;
  return vertices.every(([u,v,h])=>{
   const b=h-x*u-y*v-c;
   if(b>=-.026)return false;
   const t=-b/(e-b),k=-b/l;
   return inside(u+(eye[0]-u)*t,v+(eye[1]-v)*t) &&
          inside(u+sun[0]*k,v+sun[1]*k);
  });
 });
}

const cache=new WeakMap<T.BufferGeometry,XYH[]>();
const local=new T.Matrix4();
const eyeP=new T.Vector3(),lightV=new T.Vector3(),targetV=new T.Vector3();
export function pavilionBeamOccluded(mesh:T.Mesh,camera:T.Camera,light:T.DirectionalLight){
 if(!(camera as T.PerspectiveCamera).isPerspectiveCamera)return false;
 let pts=cache.get(mesh.geometry);
 if(!pts){
  const a=mesh.geometry.getAttribute('position');
  const unique=new Map<string,XYH>();
  for(let i=0;i<a.count;i++){
   const q:XYH=[a.getX(i),-a.getZ(i),a.getY(i)];
   unique.set(q.join(','),q);
  }
  pts=[...unique.values()];cache.set(mesh.geometry,pts);
 }
 local.copy(mesh.matrixWorld).invert();
 eyeP.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(local);
 lightV.setFromMatrixPosition(light.matrixWorld);
 targetV.setFromMatrixPosition(light.target.matrixWorld);
 lightV.sub(targetV).transformDirection(local);
 return interiorBeamHidden(pts,[eyeP.x,-eyeP.z,eyeP.y],[lightV.x,-lightV.z,lightV.y]);
}
