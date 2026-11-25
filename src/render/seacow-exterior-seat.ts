import type { BufferAttribute,Mesh } from 'three';
import type {Cover} from '../sim/cover.ts';
import type {Terrain} from '../sim/terrain.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';

/** This origin is the centroid of the already-shipped Canadian AEB socket, not the
 * offshore chart-list light coordinate and not a surveyed current-day footing. */
export const SEACOW={
 id:'q03020',ordinal:133,rows:272,offset:403528,bytes:11965,
 bounds:[-63.814828,46.305538,-63.75561,46.338574],xz:[-46830.368005760836,20465.84852914366],
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 chunk:'f668b5dedea68e02901afcc7f7c17e945e62afdcd9c68c5654c981c5b17d8e05',
 row:'786734877c905882a292f41ce77ea34bfca16dfa0b1dc7f0ed20c65502b3a4f3',
 proof:{vertices:15972,start:9348,end:9414},
 position:'01a2bee84ee4e620cbabd7659f86a59be8c46f67fcd5c3c82b6b0b5a4030cfb6',
 normal:'3ff0097f01c143cb64ab49960af41f3f28946a6fdfbd150101c422d6b87606b2',
} as const;
export type SeacowSeat={floor:(x:number,z:number)=>number;resident:()=>boolean;verifiedCover:()=>Promise<boolean>};
export function seacowSiteSupports(t:Terrain,h:string|undefined,c:Cover){
 const [x,z]=SEACOW.xz;
 if(!standardLandAtlasMatches(t,h,c)||t.surveyGrids.some(g=>g.spec.tileX===8&&g.spec.tileZ===14)||
    c.waterInsets.some(q=>q.intersects(x-8,z-8,x+8,z+8)))return false;
 for(const dx of [-6,0,6])for(const dz of [-6,0,6])if(!t.isLand(x+dx,z+dz)||c.distance(t,x+dx,z+dz)<40)return false;
 return true;
}
export function seacowOwner(atlas:string|undefined,t:{id:string;count:number;offset:number;bytes:number;bounds:readonly number[]}){
 return !!globalThis.crypto?.subtle&&atlas===SEACOW.atlas&&t.id===SEACOW.id&&t.count===SEACOW.rows&&
  t.offset===SEACOW.offset&&t.bytes===SEACOW.bytes&&t.bounds.length===4&&t.bounds.every((x,i)=>x===SEACOW.bounds[i]);
}
async function hash(raw:BufferSource){
 const d=await crypto.subtle.digest('SHA-256',raw);
 return Array.from(new Uint8Array(d),q=>q.toString(16).padStart(2,'0')).join('');
}
export async function seacowSource(raw:ArrayBuffer,rows:number,row:unknown,m:Mesh){
 try{
  const g=m.geometry,s=m.userData.beaconTriangles as number[]|undefined,{start,end,vertices}=SEACOW.proof;
  if(raw.byteLength!==SEACOW.bytes||rows!==SEACOW.rows||!s||s[0]!==start||s[1]!==end||g.index||g.groups.length||
     g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==6)return false;
  const slice=(name:string)=>{const a=g.getAttribute(name) as BufferAttribute;
   if(a?.count!==vertices||a.itemSize!==3||a.normalized||!(a.array instanceof Float32Array)||
      !(a.array.buffer instanceof ArrayBuffer))throw Error('Wrong original scene geometry');
   return new Uint8Array(a.array.buffer,a.array.byteOffset+start*12,(end-start)*12);
  };
  const text=JSON.stringify(row);
  if(!text||text.length>800)return false;
  const [ch,r,p,n]=await Promise.all([hash(raw),hash(new TextEncoder().encode(text)),hash(slice('position')),hash(slice('normal'))]);
  return ch===SEACOW.chunk&&r===SEACOW.row&&p===SEACOW.position&&n===SEACOW.normal;
 }catch{return false;}
}
