import {Matrix4,Vector4,type Camera} from 'three';

// All displaced old/new triangles from the signed N112 2020 pack. The
// stationary sewing ring is not part of this moved-volume exclusion.
const lower=[32080.20,2.18,6882.59],upper=[32258.74,16.22,6992.20];
const corners:Vector4[]=[];
for(const x of [lower[0],upper[0]])for(const y of [lower[1],upper[1]])for(const z of [lower[2],upper[2]])corners.push(new Vector4(x,y,z,1));
const view=new Matrix4(),p=new Vector4();
/** A single conclusive clip plane proves no contributing displaced
 * terrain. Unknown or borderline cameras conservatively draw the ridge. */
export function kingsRidgeMayDraw(camera:Camera){
 view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 let bottom=-Infinity;
 for(const corner of corners){
  p.copy(corner).applyMatrix4(view);
  if(!Number.isFinite(p.y+p.w))return true;
  bottom=Math.max(bottom,p.y+p.w);
 }
 return bottom>=-.05;
}
