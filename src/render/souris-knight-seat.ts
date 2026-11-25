import type {BufferAttribute,Mesh} from 'three';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';

export const KNIGHT_SEAT={
 id:'q131',ordinal:33,rows:548,offset:3160146,bytes:23589,
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 chunk:'58ea53baa3ebee8377380583ca29cb91d13a7d8c7185e5fbfd0129e0cf5f116e',
 row:'6e01aa3d7a57721882075810bada740255fd9d86accf660688937474cb4ce717',
 bounds:[-62.247517,46.342794,-62.115853,46.375008],
 proof:{vertices:31176,start:2259,end:2298},
 xz:[73122.55525639614,17122.716939925675],face0:Math.PI/3,width:4.58,entrySide:3,entryReach:1.19,entryHalfWidth:.70,
 position:'6b59843f4a18ea3c7a93a79185165d67a504ccfb18b4f8f45955d79ae59bc6d9',
 normal:'8e166cbd095e33078b36d539c1743151fb1f727a15cd9e55a65d5e5b40a0d709'
} as const;

export type KnightSeat={floor:(x:number,z:number)=>number;resident:()=>boolean;verifiedCover:()=>Promise<boolean>};
export function knightGroundSupports(t:Terrain,h:string|undefined,c:Cover){
 const {xz:[x,z],width,face0}=KNIGHT_SEAT;
 if(!standardLandAtlasMatches(t,h,c)||t.surveyGrids.some(g=>g.spec.tileX===28&&g.spec.tileZ===14)||
    c.waterInsets.some(q=>q.intersects(x-15,z-15,x+15,z+15)))return false;
 const half=width*.5;
 const dry=(a:number,u:number,h:number)=>{
  const px=x+Math.sin(a)*h+Math.cos(a)*u,pz=z-Math.cos(a)*h+Math.sin(a)*u;
  return t.isLand(px,pz)&&c.distance(t,px,pz)>.75;
 };
 // An explicit shoreline veto, not a geographic radius that moves the tower
 // to a nearby drier plot. Independently inspect actual support in the native mesh.
 for(let j=0;j<4;j++)for(let i=0;i<=16;i++){
  if(!dry(face0+Math.PI*.5*j,(i/8-1)*half,half))return false;
 }
 const {entrySide,entryReach,entryHalfWidth}=KNIGHT_SEAT;
 const access=face0+Math.PI*.5*entrySide;
 for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){
  if(!dry(access,(i/4-1)*entryHalfWidth,half+j*entryReach/8))return false;
 }
 return true;
}
type AtlasTile={id:string;count:number;offset:number;bytes:number;bounds:readonly number[]};
export function knightOwns(atlas:string|undefined,t:AtlasTile){
 const c=KNIGHT_SEAT;
 return !!globalThis.crypto?.subtle&&atlas===c.atlas&&t.id===c.id&&t.count===c.rows&&
  t.offset===c.offset&&t.bytes===c.bytes&&t.bounds.length===4&&t.bounds.every((v,i)=>v===c.bounds[i]);
}
const sha=async (bytes:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),q=>q.toString(16).padStart(2,'0')).join('');
export async function knightExactOwner(raw:ArrayBuffer,rows:number,row:unknown,mesh:Mesh){
 try{
  const s=KNIGHT_SEAT,{start,end,vertices}=s.proof,g=mesh.geometry,k=mesh.userData.beaconTriangles as [number,number]|undefined;
  if(raw.byteLength!==s.bytes||rows!==s.rows||!k||k[0]!==start||k[1]!==end||g.index||g.groups.length||
     g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==6)return false;
  const span=(n:string)=>{
   const p=g.getAttribute(n) as BufferAttribute;
   if(!p||p.itemSize!==3||p.count!==vertices||p.normalized||!(p.array instanceof Float32Array)||!(p.array.buffer instanceof ArrayBuffer))throw Error('Unexpected source mesh');
   return new Uint8Array(p.array.buffer,p.array.byteOffset+start*12,(end-start)*12);
  };
  const json=JSON.stringify(row);if(!json||json.length>700)return false;
  const [w,j,p,n]=await Promise.all([sha(raw),sha(new TextEncoder().encode(json)),sha(span('position')),sha(span('normal'))]);
  return w===s.chunk&&j===s.row&&p===s.position&&n===s.normal;
 }catch{return false;}
}
