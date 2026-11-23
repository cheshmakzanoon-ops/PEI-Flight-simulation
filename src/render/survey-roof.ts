import {ShapeUtils,Vector2} from 'three';
import {roofHeight,splitRoofEdge,splitRoofTriangle,type RoofRidge,type Triangle} from '../sim/roof-ridge.ts';

export type Pair=readonly [number,number];
export type RoofPoint=Readonly<{x:number;z:number}>;
type Polygon=readonly (readonly Pair[])[];
export type SurveyRoof=Readonly<{
 atlasSha256:string;
 sourceTileId:string;
 sourceFootprint:readonly Pair[];
 originXZ:Pair;
 levels:readonly Readonly<{y:number;top:readonly Polygon[];risers:readonly Polygon[]}>[];
 mainRidge?:Readonly<{originXZ:Pair;normalXZ:Pair;leftSlope:number;rightSlope:number}>;
}>;
type RoofCallbacks=Readonly<{
 roof:(a:RoofPoint,b:RoofPoint,c:RoofPoint,heights:readonly [number,number,number],level:number)=>void;
 riser:(a:RoofPoint,b:RoofPoint,lo:readonly [number,number]|undefined,hi:readonly [number,number],level:number)=>void;
}>;

/** Match the exact measured outline, not a centroid/radius approximation or a new atlas. */
export function matchesSurveyRoof(model:SurveyRoof,atlas:string|undefined,tile:string,outline:readonly Pair[],holes?:readonly (readonly Pair[])[]){
 if(atlas!==model.atlasSha256||tile!==model.sourceTileId||holes?.length||outline.length!==model.sourceFootprint.length)return false;
 return model.sourceFootprint.every((q,i)=>outline[i][0]===q[0]&&outline[i][1]===q[1]);
}
function signedRing(ring:readonly Pair[]){
 let sum=0;
 for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];sum+=a[0]*b[1]-a[1]*b[0];}
 return sum*.5;
}

/** Original terrain and neighbour geometry are not touched. Points are baked once with their streamed tile. */
export function emitSurveyRoof(model:SurveyRoof,draw:RoofCallbacks){
 const [ox,oz]=model.originXZ;
 const world=([x,z]:Pair)=>({x:x+ox,z:z+oz});
 const ridgeSpec=model.mainRidge;
 const ridge= ridgeSpec?{
   origin:{x:ridgeSpec.originXZ[0],z:ridgeSpec.originXZ[1]},
   normal:{x:ridgeSpec.normalXZ[0],z:ridgeSpec.normalXZ[1]},
   peakM:model.levels[0].y,leftSlope:ridgeSpec.leftSlope,rightSlope:ridgeSpec.rightSlope,
 } satisfies RoofRidge:undefined;
 const first=(p:RoofPoint,level:number)=>level===0&&ridge?roofHeight(p,ridge):model.levels[level].y;
 for(const [i,level] of model.levels.entries()){
  for(const poly of level.top){
   const rings=poly.map(ring=>ring.map(([x,z])=>new Vector2(x,z)));
   const idx=ShapeUtils.triangulateShape(rings[0],rings.slice(1));
   const points=rings.flat();
   for(const [ia,ib,ic] of idx){
    const a=points[ia],b=points[ib],c=points[ic];
    const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    if(Math.abs(area)<1e-9)continue;
    const q=world([a.x,a.y]),r=world([b.x,b.y]),s=world([c.x,c.y]);
    const tri:Triangle=area<0?[q,r,s]:[q,s,r];
    if(i===0&&ridge){for(const [u,v,w] of splitRoofTriangle(tri,ridge))draw.roof(u,v,w,[first(u,i),first(v,i),first(w,i)],i);}
    else draw.roof(...tri,[level.y,level.y,level.y],i);
   }
  }
  for(const polygon of level.risers)for(const [r,ring] of polygon.entries()){
   const sign=Math.sign(signedRing(ring))*(r===0?1:-1);
   for(let j=0;j<ring.length;j++){
    const a=ring[j],b=ring[(j+1)%ring.length];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5||!sign)continue;
    const u=world(sign>0?a:b),v=world(sign>0?b:a);
    const path=i<2&&ridge?splitRoofEdge(u,v,ridge):[u,v];
    for(let k=1;k<path.length;k++){
     const q=path[k-1],r=path[k];
     draw.riser(q,r,i===0?undefined:[first(q,i-1),first(r,i-1)],[first(q,i),first(r,i)],i);
    }
   }
  }
 }
}
