import type {BufferAttribute,BufferGeometry,Mesh,Vector3} from 'three';
import type {Terrain} from '../../sim/terrain.ts';
import type {Cover} from '../../sim/cover.ts';
import type {Site} from '../../sim/places.ts';
import {SCENERY_REVIEWS} from '../../app/scenery-profile.ts';

export const POINT_PRIM={
 origin:[12356.575162683861,49999.340437527324],datum:4.845,terrainTile:'18-19',
 tile:'q100',ordinal:266,offset:1370208,bytes:22661,rows:495,bounds:[-63.03929,45.997282,-62.882458,46.085052],
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 wire:'8a3f6a101af7a24664ca727d23cf98f40cfa53223dc1b51d099432b08b3ac9da',
 row:'6b169b92b12465f32c75ceacb87d627f83b78ee1a0c0ad37bdacb5973e8c9ab1',
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 cover:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 coverDecoded:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 road:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
 sidewalk:'e2dce7c86c4b5cd45ea45fb92ed89c2ae504306e4349e1291e627a669630e384',
 parking:'071f8b599e27afcda8a1924cb152135f342c47756de1667fea28c0fdbb294303',
 proof:{vertices:29745,start:17820,end:17877},
 worldMatrix:[.979624736392066,0,8.2002497947542e-7,12356.575162683861,
   0,1,0,4.845,-7.627647477837259e-7,0,.9877505628901417,49999.340437527324,0,0,0,1]
} as const;
export const POINT_PRIM_DEPARTURE:Site={
 id:'point-prim-offshore',name:'Point Prim · lighthouse pass',region:'Queens County',
 lon:-63.04529820978229,lat:46.048000381690265,heading:55,height:72,
 note:'Begin offshore at 72 metres. A virtual flight, not a navigation route.'
};
const conflicts=['surveyRelief','inlandRelief','buildingShadows','indianRiverReview','northCapeWind','seatedRoads',
 'seatedForestShadows','woodland3D','canopyLight','sourceGrassNap'] as const;
export function pointPrimDepartureAvailable(q:URLSearchParams){
 const mode=q.get('scenery');return q.has('pointPrimStudy')||!mode||mode==='standard';
}
export function pointPrimRequested(q:URLSearchParams){
 const mode=q.get('scenery');
 if(q.has('stockPointPrim')||(mode&&mode!=='standard')||conflicts.some(k=>q.has(k)))return false;
 if(q.has('pointPrimStudy'))return true;
 return !SCENERY_REVIEWS.some(r=>q.has(r.flag))&&
  !['duneReliefStudy','duneSandDetail','kingsDryCrownStudy','greenGablesBarnReview','cavendishDetail',
    'gablesGradeReview','duneGrassSurface','mappedLaneCanopyStudy','northRusticoSoil','regionalCanopyStudy'].some(k=>q.has(k));
}
export function pointPrimBase(terrain:Terrain,cover:Cover,terrainSha:string|undefined){
 const p=POINT_PRIM,{width,height,bounds}=terrain.spec;
 return !!globalThis.crypto?.subtle&&terrainSha===p.terrain&&cover.sourceSha===p.cover&&
  width===4096&&height===2720&&cover.width===width&&cover.height===height&&
  bounds.every((q,i)=>q===[-64.47,45.94,-61.93,47.1][i])&&bounds.length===4;
}
export function pointPrimLayers(road:string|undefined,buildings:string|undefined,walk:string|undefined,parking:string|undefined){
 const p=POINT_PRIM;return road===p.road&&buildings===p.atlas&&walk===p.sidewalk&&parking===p.parking;
}
export function pointPrimOwner(sha:string|undefined,t:{id:string;offset:number;bytes:number;bounds:readonly number[]}){
 const p=POINT_PRIM;
 return sha===p.atlas&&t.id===p.tile&&t.offset===p.offset&&t.bytes===p.bytes&&t.bounds.length===4&&t.bounds.every((x,i)=>x===p.bounds[i])&&!!globalThis.crypto?.subtle;
}
export async function pointPrimDigest(raw:BufferSource){
 if(!globalThis.crypto?.subtle)return;
 try{
  const h=await crypto.subtle.digest('SHA-256',raw);
  return Array.from(new Uint8Array(h),p=>p.toString(16).padStart(2,'0')).join('');
 }catch{return;}
}
export async function pointPrimWire(raw:ArrayBuffer){
 return raw.byteLength===POINT_PRIM.bytes&&await pointPrimDigest(raw)===POINT_PRIM.wire;
}
export type PointPrimStock=Readonly<{mesh:Mesh;geometry:BufferGeometry;wire:ArrayBuffer;row:string;count:number}>;
const drawPins=[
 ['position',3,'5eeffa8b4bad716935a87bf31dda0b4b4e5d86d262510467e3f4ccb85a7383ac'],
 ['uv',2,'fc79aa27eee44a9c961e828a1f814a5fa02e325d76fc78d6102bc687ab9aa384'],
 ['color',3,'2cbd24c0b9c3b58ba8febedf3f7c5b77272b587a9666169cbe7fb9e8950068e2'],
 ['topFlag',1,'98d244f0c68262eead7fa57c8e1469dce12a2d13e09ec0f9ac3fecd4984b2bde'],
 ['facadeStyle',1,'7fd4c47c5d718261c637827e3ab7fd8eed9917a08c5512f05e259e1af6d775a2'],
 ['normal',3,'7ffb791f14342e3174d8d5897775c099002a687f4ba5dfb0afd639671ccbd5db']
] as const;
export async function pointPrimDrawSource(q:PointPrimStock){
 try{
  const {proof,rows,row}=POINT_PRIM,{mesh,geometry}=q,s=mesh.userData.beaconTriangles as [number,number]|undefined;
  if(q.count!==rows||q.row.length>1024||geometry!==mesh.geometry||geometry.index||
     !s||s[0]!==proof.start||s[1]!==proof.end||Object.keys(geometry.attributes).length!==drawPins.length||
     geometry.groups.length||geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity)return false;
  const checks=drawPins.map(async([name,n,hash])=>{
   const a=geometry.getAttribute(name) as BufferAttribute|undefined;
   if(!a||a.count!==proof.vertices||a.itemSize!==n||a.normalized||!(a.array.buffer instanceof ArrayBuffer))return false;
   if(name==='facadeStyle'?!(a.array instanceof Uint8Array):!(a.array instanceof Float32Array))return false;
   const actual=await pointPrimDigest(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
   // Both full UV arrays were observed independently on the same wire,row,
   // footprint scope and five other byte-identical attributes.
   return actual===hash||name==='uv'&&actual==='8a26fb36606fb804399fdff0c5fa69da9ac9646636a9e7ada7d824448275c5f5';
  });
  return (await Promise.all([pointPrimWire(q.wire),
   pointPrimDigest(new TextEncoder().encode(q.row)).then(h=>h===row),...checks])).every(Boolean);
 }catch{return false;}
}
/** Aircraft and actual submitted eye both stay inside a bounded Standard low-view lease.
 * On range exit the craft is already far beyond the tiny physical grade footprint. */
export function pointPrimNear(x:number,y:number,z:number,eye:Pick<Vector3,'x'|'y'|'z'>,active:boolean){
 const [a,b]=POINT_PRIM.origin,r=active?1350:1080;
 const inside=(x:number,y:number,z:number,h:number)=>(x-a)**2+(z-b)**2<r*r&&
  Number.isFinite(y)&&y>POINT_PRIM.datum-8&&y<POINT_PRIM.datum+h;
 return inside(x,y,z,active?325:240)&&inside(eye.x,eye.y,eye.z,active?355:270);
}
