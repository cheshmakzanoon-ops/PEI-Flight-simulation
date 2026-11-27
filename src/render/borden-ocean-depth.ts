import * as T from 'three';
const exact=(q:number)=>Number.isFinite(q)&&Math.abs(q)<450_000;
const coldMajor=320_000;

/** Maximum positive plane clip w over the closed aperture. For a canonical
 * perspective matrix, w is forward eye depth and y(t) is affine in NDC x/y. */
export function stockOceanApertureDepth(camera:T.PerspectiveCamera,box:T.Box2,seaY:number){
 const R=camera.matrixWorld.elements,P=camera.projectionMatrix.elements;
 if(camera.far!==350000||P[0]<=0||P[5]<=0||P[11]!==-1||P[15]!==0||
    [1,2,3,4,6,7,12,13].some(i=>P[i]!==0)||!R.every(exact)||!P.every(exact)||!Number.isFinite(seaY)||
    R[13]<=seaY||!box.min.toArray().every(Number.isFinite)||!box.max.toArray().every(Number.isFinite)||box.isEmpty())return;
 const m=(x:number,y:number)=>R[1]*(x+P[8])/P[0]+R[5]*(y+P[9])/P[5]-R[9];
 const v=Math.max(m(box.min.x,box.min.y),m(box.min.x,box.max.y),m(box.max.x,box.min.y),m(box.max.x,box.max.y));
 // Covers well above combined matrix rounding at actual applied PEI
 // magnitudes. Horizon intersections and near zero slopes stay stock.
 if(v>-.001)return;
 const w=(R[13]-seaY+.035)/(-v-.0001);
 return Number.isFinite(w)&&w<coldMajor?w:undefined;
}
