/** Unmounted mathematical roof surface. No actual terrain seat, walls or graphics install. */
import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import {project} from '../../../src/sim/geo.ts';
import {roofHeight,splitRoofTriangle,type GroundPoint,type RoofRidge} from '../../../src/sim/roof-ridge.ts';
export type RoofStudy={
 sourceOrdinal:number,
 sourceOuterRingWGS84:readonly (readonly [number,number])[],
 projectionLocal:{
  anchorLonLat:readonly [number,number];
  unitAcrossXZ:readonly [number,number];
  ridgeOriginLocalXZ:readonly [number,number];
  slopePerLocalMetre:number;
  peakMOrtho:number;
  maxLinearAcrossErrorM:number;
 }
};
export function makeEastPointRoofStudy(h:RoofStudy){
 const {sourceOrdinal:id,sourceOuterRingWGS84:r,projectionLocal:p}=h;
 if((id!==48&&id!==49)||r.length!==(id===48?8:6)||r.some(q=>q.length!==2||q.some(x=>!Number.isFinite(x)))||
    p.anchorLonLat.length!==2||p.anchorLonLat.some(v=>!Number.isFinite(v))||
    !Number.isFinite(p.maxLinearAcrossErrorM)||p.maxLinearAcrossErrorM<0||p.maxLinearAcrossErrorM>.001||
    !Number.isFinite(p.peakMOrtho)||p.peakMOrtho<18||p.peakMOrtho>24||
    !Number.isFinite(p.slopePerLocalMetre)||p.slopePerLocalMetre<.33||p.slopePerLocalMetre>.47||
    !p.ridgeOriginLocalXZ.every(Number.isFinite)||Math.hypot(...p.ridgeOriginLocalXZ)>4||
    !p.unitAcrossXZ.every(Number.isFinite)||Math.abs(Math.hypot(...p.unitAcrossXZ)-1)>.00001)return;
 const pivot=project(...p.anchorLonLat);
 const ring=r.map(q=>project(...q)).map(v=>({x:v.x-pivot.x,z:v.z-pivot.z}));
 if(ring.some(b=>Math.hypot(b.x,b.z)>24)||new Set(ring.map(b=>b.x+'/'+b.z)).size!==r.length)return;
 const floor=ShapeUtils.triangulateShape(ring.map(a=>new Vector2(a.x,-a.z)),[]);
 if(floor.length!==r.length-2)return;
 // Local vertical origin is the measured candidate ridge to preserve precision.
 const ridge:RoofRidge={origin:{x:p.ridgeOriginLocalXZ[0],z:p.ridgeOriginLocalXZ[1]},
  normal:{x:p.unitAcrossXZ[0],z:p.unitAcrossXZ[1]},peakM:0,
  leftSlope:p.slopePerLocalMetre,rightSlope:p.slopePerLocalMetre};
 const P:number[]=[],det=(a:GroundPoint,b:GroundPoint,c:GroundPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 let area=0;
 const slots=[];
 for(const [i,j,k] of floor){
  const old=[ring[i],ring[j],ring[k]] as const;
  const tris=splitRoofTriangle([...old],ridge);
  if(!tris.length)return;
  slots.push(tris.length);
  for(const tri of tris){
   const [a,b,c]=tri,v=det(a,b,c);
   if(Math.abs(v)<.000001)return;
   area+=Math.abs(v)*.5;
   // Upward winding in the engine's +Y-up, +Z-south coordinate frame.
   for(const u of v<0?[a,b,c]:[a,c,b]){
    const y=roofHeight(u,ridge);
    if(y>1e-8||y< -4)return;
    P.push(u.x,y,u.z);
   }
  }
 }
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(P,3));geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {geometry,ridge,ring,authority:{sourceOrdinal:id,worldAnchorXZ:[pivot.x,pivot.z],
  hypothesizedVerticalOriginM:p.peakMOrtho,projectedAreaM2:area,oldPlanTriangles:floor.length,
  roofTriangles:P.length/9,newTrianglesEachOriginal:slots}} as const;
}
