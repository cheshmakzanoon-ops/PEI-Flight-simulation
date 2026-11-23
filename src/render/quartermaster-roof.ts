import {Vector2,ShapeUtils} from 'three';
import {QUARTERMASTER_ROOF as model} from './quartermaster-roof.generated.ts';

type Pair=readonly [number,number];
type Point=Readonly<{x:number;z:number}>;
type Polygon=readonly (readonly Pair[])[];
type Caller=Readonly<{
 roof:(a:Point,b:Point,c:Point,y:number,level:number)=>void;
 riser:(a:Point,b:Point,below:number|undefined,y:number,level:number)=>void;
}>;

/** Exact source-atlas and complete outline match: no centroid/proximity substitution. */
export function supportedQuartermasterRoof(atlas:string|undefined,tile:string,outline:readonly Pair[],holes?:readonly (readonly Pair[])[]){
 if(atlas!==model.atlasSha256||tile!==model.sourceTileId||holes?.length||outline.length!==model.sourceFootprint.length)return false;
 return model.sourceFootprint.every((q,i)=>outline[i][0]===q[0]&&outline[i][1]===q[1]);
}
const [ox,oz]=model.originXZ;
const world=([x,z]:Pair)=>({x:x+ox,z:z+oz});
function signedRing(ring:readonly Pair[]){
 let sum=0;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];sum+=a[0]*b[1]-a[1]*b[0];}
 return sum*.5;
}

/** Traverse one shell without shared-volume overdraw, utilizing the building tile's existing material/draw. */
export function emitQuartermasterRoof(draw:Caller){
 let below:number|undefined;
 for(const [i,level] of model.levels.entries()){
  for(const poly of level.top as readonly Polygon[]){
   const rings=poly.map(ring=>ring.map(([x,z])=>new Vector2(x,z)));
   const idx=ShapeUtils.triangulateShape(rings[0],rings.slice(1));
   const points=rings.flat();
   for(const [ia,ib,ic] of idx){
    const a=points[ia],b=points[ib],c=points[ic];
    const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    if(Math.abs(area)<1e-9)continue;
    const q=world([a.x,a.y]),r=world([b.x,b.y]),s=world([c.x,c.y]);
    if(area<0)draw.roof(q,r,s,level.y,i);else draw.roof(q,s,r,level.y,i);
   }
  }
  for(const polygon of level.risers as readonly Polygon[])for(const [r,ring] of polygon.entries()){
   const sign=Math.sign(signedRing(ring))*(r===0?1:-1);
   for(let j=0;j<ring.length;j++){
    const a=ring[j],b=ring[(j+1)%ring.length];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5||!sign)continue;
    draw.riser(world(sign>0?a:b),world(sign>0?b:a),below,level.y,i);
   }
  }
  below=level.y;
 }
}
