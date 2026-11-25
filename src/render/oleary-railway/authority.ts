import type {BufferAttribute,Mesh} from 'three';
import type {Cover} from '../../sim/cover.ts';
import type {Terrain} from '../../sim/terrain.ts';
import {project} from '../../sim/geo.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../sim/coastal-terrain.ts';
import {standardLandAtlasMatches} from '../meadow-standard.ts';
import {OLEARY_NATIVE_GRADE} from './grade.generated.ts';
import {olearyRimLevels,partitionOlearyNativeXYZ} from './grade-shape.ts';
import type {OlearyLink} from './program-gate.ts';
export const OLEARY={
 id:'q20213',ordinal:431,rows:542,offset:3427851,bytes:24668,
 bounds:[-64.232158,46.70122,-64.15301,46.737527],
 xz:[-78729.85614635695,-23078.19701513572],groundOrigin:31.862553817522524,
 proof:{vertices:32049,start:26343,end:26385},
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 chunk:'288874f91b78271c99fc53fc1776cc540b0a6445f7486701d551dff01452c8b0',
 row:'ed1aca976f1b29d77b32c601bc9cae4477f7cf50a2b5133bc04a70d5f9627700',
 grade:{id:'3-7',position:'4c2bbb800902bc66f59c67224e54b374f37a7c73c1945c272650ac3742865959',
  index:'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa'}
} as const;
const attrs={
 position:[3,'d12b6d0f4acffd9fe576dddaf2eddbf05b1d7dda2a6c65eecb96b9e04fb75a42'],
 uv:[2,'752f96ed80b0a0ea4a33edb3aa5e8d99134f2aca0fdd730689a118628db40025'],
 color:[3,'5707c1ea535163a444028c157b622ccc6f0a105a043042bc57f1bfbd02e75c69'],
 topFlag:[1,'1b475c3c932071c2742c6b87e49210dc742392038f9722b51e58ca38778fd6eb'],
 facadeStyle:[1,'513aaa75501a7b7f07de04bd9d77d80f7b7fbb67a244ff7f8395edcf84cfa03d'],
 normal:[3,'2423e4812fd3f94e84f095022cfdcc97e9ed50ed91417d96e08b0a15e2a21022']
} as const;
// Exact second native JavaScript result. The real pinned Chromium generator
// differs from Node in 41 V scalars, outside q431, by ≤3.64e-12 game m.
// No floating tolerance or UV write: both whole unmodified arrays are signed.
const nativeBrowserUV='5472a9b595817aa9cf0663af5910f64f1a53860e5e49403684cfab6a9bd223e6';
export async function olearySha(data:BufferSource){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
}
const viewBytes=(a:ArrayBufferView)=>{
 if(!(a.buffer instanceof ArrayBuffer))throw Error('Unowned or shared geometry storage');
 return new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
};
export const olearyAtlasOwner=(sha:string|undefined,t:{id:string;count:number;offset:number;bytes:number;bounds:readonly number[]})=>
 !!globalThis.crypto?.subtle&&sha===OLEARY.atlas&&t.id===OLEARY.id&&t.count===OLEARY.rows&&t.offset===OLEARY.offset&&t.bytes===OLEARY.bytes&&
 t.bounds.length===4&&t.bounds.every((v,i)=>v===OLEARY.bounds[i]);
/** Use the original draw's runtime projection, never a machine's rounded decimal midpoint. */
export const olearyDrawCenter=()=>{
 const [w,s,e,n]=OLEARY.bounds,a=project(w,n),b=project(e,s);return {x:(a.x+b.x)/2,z:(a.z+b.z)/2};
};
export function olearySiteAllows(terrain:Terrain,sha:string|undefined,cover:Cover){
 if(!standardLandAtlasMatches(terrain,sha,cover)||terrain.surveyGrids.some(x=>x.spec.tileX===3&&x.spec.tileZ===7))return false;
 const [x,z]=OLEARY.xz;
 if(cover.waterInsets.some(p=>p.intersects(x-14,z-14,x+14,z+14)))return false;
 return [-12,0,12].every(a=>[-12,0,12].every(b=>terrain.isLand(x+a,z+b)&&cover.distance(terrain,x+a,z+b)>18));
}
export function olearyCloseCamera(x:number,y:number,z:number){
 return Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)&&y>=OLEARY.groundOrigin-8&&y<OLEARY.groundOrigin+385&&Math.hypot(x-OLEARY.xz[0],z-OLEARY.xz[1])<1850;
}
export async function olearyOriginalSource(raw:ArrayBuffer,count:number,row:unknown,owner:Mesh){
 try{
  const g=owner.geometry,p=OLEARY.proof,a=owner.userData.beaconTriangles;
  if(raw.byteLength!==OLEARY.bytes||count!==OLEARY.rows||!a||a[0]!==p.start||a[1]!==p.end||
   g.index||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==6)return false;
  const encoded=JSON.stringify(row);if(!encoded||encoded.length>1400)return false;
  const digests=await Promise.all([olearySha(raw),olearySha(new TextEncoder().encode(encoded)),...Object.entries(attrs).map(async([name,[n,want]])=>{
   const v=g.getAttribute(name) as BufferAttribute;
   if(!v||v.count!==p.vertices||v.itemSize!==n||v.normalized||!(name==='facadeStyle'?v.array instanceof Uint8Array:v.array instanceof Float32Array))return false;
   const digest=await olearySha(viewBytes(v.array));
   return digest===want||(name==='uv'&&digest===nativeBrowserUV);
  })]);
  return digests[0]===OLEARY.chunk&&digests[1]===OLEARY.row&&digests.slice(2).every(p=>p===true);
 }catch{return false;}
}
type GradeOrigin={readonly x:number;readonly z:number};
/** Exact same association as the real World.patch(3,7,...), in this engine. */
export function olearyGradeCenter(t:Terrain):GradeOrigin{
 const w=(t.right-t.left)/WORLD_COLS,d=(t.bottom-t.top)/WORLD_ROWS;
 return {x:t.left+w*3+w/2,z:t.top+d*7+d/2};
}
/** Read-only lease on the original live World patch; rims are existing native LOD, not new art. */
export type OlearyNativeSurface={readonly fine?:Mesh;readonly seams?:string};
export type OlearySeat={readonly center:GradeOrigin;ground:()=>OlearyNativeSurface|undefined;verifiedCover:()=>Promise<boolean>;link:OlearyLink};
export async function olearyNativeGrade(ground:Mesh,expectedWorldCenter:GradeOrigin,seams:string){
 try{
  const g=ground.geometry,material=ground.material,i=g.index,p=g.getAttribute('position') as BufferAttribute,x=ground.position.x,z=ground.position.z;
  const stamp=OLEARY_NATIVE_GRADE,levels=olearyRimLevels(seams);
  if(!levels||x!==expectedWorldCenter.x||z!==expectedWorldCenter.z)return;
  if(!i||i.count!==112*112*6||p.count!==113*113||p.itemSize!==3||p.normalized||i.normalized||
   !(i.array instanceof Uint16Array)||!(p.array instanceof Float32Array))return;
  const ix=i.array,v=p.array,iv=i.version,pv=p.version;
  const intact=()=>ground.geometry===g&&ground.material===material&&ground.position.x===x&&ground.position.y===0&&ground.position.z===z&&
   ground.quaternion.x===0&&ground.quaternion.y===0&&ground.quaternion.z===0&&ground.quaternion.w===1&&
   ground.scale.x===1&&ground.scale.y===1&&ground.scale.z===1&&ground.layers.mask===1&&ground.matrixAutoUpdate&&
   g.index===i&&g.getAttribute('position')===p&&i.array===ix&&p.array===v&&i.version===iv&&p.version===pv&&
   !g.groups.length&&g.drawRange.start===0&&g.drawRange.count===Infinity;
  if(!intact())return;
  const parts=partitionOlearyNativeXYZ(v);if(!parts)return;
  const [a,b,...rims]=await Promise.all([olearySha(viewBytes(parts.inner)),olearySha(viewBytes(ix)),...parts.rim.map(r=>olearySha(viewBytes(r)))]);
  return a===stamp.interiorXYZSHA256&&b===OLEARY.grade.index&&
   rims.every((s,i)=>s===stamp.renderRimXYZSHA256BySideAndLOD[i][levels[i]])&&intact()?intact:undefined;
 }catch{return;}
}
