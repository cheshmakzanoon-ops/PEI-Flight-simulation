/** 2-D metre coordinates in the mesh's local ground plane. */
export type GroundPoint = {x:number;z:number};
export type Triangle = [GroundPoint,GroundPoint,GroundPoint];
/** Signed normal of the ridge, in renderer coordinates (+X east, +Z south). */
export interface RoofRidge {
  origin: GroundPoint;
  normal: GroundPoint;
  peakM: number;
  /** Positive rise per metre on each side of the ridge. */
  leftSlope: number;
  rightSlope: number;
}
const EPS=1e-8;
export const ridgeOffset=(point:GroundPoint,ridge:RoofRidge)=>
  (point.x-ridge.origin.x)*ridge.normal.x+(point.z-ridge.origin.z)*ridge.normal.z;
export const roofHeight=(point:GroundPoint,ridge:RoofRidge)=>{
  const d=ridgeOffset(point,ridge);
  return ridge.peakM-(d<0?-d*ridge.leftSlope:d*ridge.rightSlope);
};
const mix=(a:GroundPoint,b:GroundPoint,t:number):GroundPoint=>
  ({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const across=(a:number,b:number)=>(a < -EPS && b > EPS) || (a > EPS && b < -EPS);
export const splitRoofEdge=(a:GroundPoint,b:GroundPoint,ridge:RoofRidge)=>{
  const da=ridgeOffset(a,ridge),db=ridgeOffset(b,ridge);
  return across(da,db)?[a,mix(a,b,da/(da-db)),b]:[a,b];
};
const signedArea=(a:GroundPoint,b:GroundPoint,c:GroundPoint)=>
  (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);

/**
 * Split any already-triangulated footprint only where the fitted ridge crosses
 * it. Original winding is preserved and holes stay empty because no point
 * outside an input triangle is added.
 */
export function splitRoofTriangle(triangle:Triangle,ridge:RoofRidge):Triangle[]{
  const offset=triangle.map(v=>ridgeOffset(v,ridge));
  if(offset.every(v=>v>=-EPS)||offset.every(v=>v<=EPS))return [triangle];
  const out:Triangle[]=[];
  for(const sign of [-1,1]){
    const clipped:GroundPoint[]=[];
    for(let i=0;i<3;i++){
      const j=(i+1)%3,a=triangle[i],b=triangle[j],da=offset[i],db=offset[j];
      if(sign*da>=-EPS)clipped.push(a);
      if(across(da,db))clipped.push(mix(a,b,da/(da-db)));
    }
    for(let i=1;i<clipped.length-1;i++){
      const a=clipped[0],b=clipped[i],c=clipped[i+1];
      if(Math.abs(signedArea(a,b,c))>EPS)out.push([a,b,c]);
    }
  }
  return out;
}
