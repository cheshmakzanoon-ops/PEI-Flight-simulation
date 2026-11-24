import {Vector3,type PerspectiveCamera} from 'three';

/** Conservative device-pixel vertical span of actual world points. If a
 * point crosses the near plane, keep the finer model rather than guessing. */
export function projectedVerticalPixels(samples:readonly Vector3[],camera:PerspectiveCamera,deviceHeight:number,scratch:Vector3){
 if(!Number.isFinite(deviceHeight)||deviceHeight<=0||samples.length<2)return Infinity;
 const m=camera.projectionMatrix.elements,k=m[5],off=m[9];
 if(!(k>0)||!Number.isFinite(off))return Infinity;
 let low=Infinity,high=-Infinity;
 for(const q of samples){
  scratch.copy(q).applyMatrix4(camera.matrixWorldInverse);
  if(!(scratch.z<-.08)||!Number.isFinite(scratch.y))return Infinity;
  const y=-k*scratch.y/scratch.z-off;
  low=Math.min(low,y);high=Math.max(high,y);
 }
 return (high-low)*deviceHeight*.5;
}
