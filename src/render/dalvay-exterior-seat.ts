import type {Mesh,BufferAttribute} from 'three';
import type {OlearyLink} from './oleary-railway/program-gate.ts';
import type {Terrain} from '../sim/terrain.ts';import type {Cover} from '../sim/cover.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';
export const DALVAY={id:'q12203',ordinal:71,rows:242,offset:2933919,bytes:10736,bounds:[-63.120632,46.41127,-63.06489,46.423054],
 xz:[9720.17952514535,9481.48449424835],proof:{vertices:13608,start:4533,end:4644},
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 chunk:'0b6d20f110aacb2ed4cee678fcb7ce7a9bb2a6d3c0e9a87734a24ef01d6b0099',
 row:'a96b750d2c5c68f54b9c1e662e5a1da94cbef7b053fbe50a96b322a3b44a8130',
 position:'29f9b0864ca13f49c05afa22768c8da9f8fee5c3f8c1b11c3024213936ce8842',
 normal:'d635502240b75ed5296edeb01e28dac7664339725c570b0f216847055e3fec2e'} as const;
/** All six original full-cohort attributes; no sibling is resampled or rewritten. */
const originalAttributes={"position":[3,"29f9b0864ca13f49c05afa22768c8da9f8fee5c3f8c1b11c3024213936ce8842"],"uv":[2,"0dd31c16d183b2d752d6dcd45d963b656163f4681e4c3f52344b4f54dcf459fe"],"color":[3,"9afd0395dee8d6b91334f6eeeaec943c9436c3f1de4252e9c83918c820c81c93"],"topFlag":[1,"2807fd5c6a5c812cc0997d81e94b5e9a824c631200ef005f1822f4c60842d3ea"],"facadeStyle":[1,"f9d90d4955ecf71daab59dea5bbb997fce361cff7270366c00960c4192f75b10"],"normal":[3,"d635502240b75ed5296edeb01e28dac7664339725c570b0f216847055e3fec2e"]} as const;
export const DALVAY_STANDARD_RANGE={near:1800,prepare:1000,maxY:435} as const;
export type DalvaySeat={resident:()=>boolean;verifiedCover:()=>Promise<boolean>;
 /** Ordinary route only. Never acquire or first replace the owner close to the lens. */
 standard?:{scope:()=>boolean;early:()=>boolean;link:OlearyLink}};
export function dalvaySiteSupports(t:Terrain,sha:string|undefined,c:Cover){
 const [x,z]=DALVAY.xz;
 if(!standardLandAtlasMatches(t,sha,c)||t.surveyGrids.some(q=>q.spec.tileX===17&&(q.spec.tileZ===12||q.spec.tileZ===13))||
  c.waterInsets.some(q=>q.intersects(x-29,z-29,x+29,z+29)))return false;
 for(const dx of[-26,0,26])for(const dz of[-26,0,26])if(!t.isLand(x+dx,z+dz)||c.distance(t,x+dx,z+dz)<24)return false;
 return true;
}
export const dalvayOwner=(sha:string|undefined,t:{id:string;count:number;offset:number;bytes:number;bounds:readonly number[]})=>
 !!globalThis.crypto?.subtle&&sha===DALVAY.atlas&&t.id===DALVAY.id&&t.count===DALVAY.rows&&t.offset===DALVAY.offset&&t.bytes===DALVAY.bytes&&
 t.bounds.length===4&&t.bounds.every((v,i)=>v===DALVAY.bounds[i]);
export async function dalvayDigest(b:BufferSource){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function dalvaySource(raw:ArrayBuffer,rows:number,row:unknown,mesh:Mesh){
 try{const g=mesh.geometry,p=DALVAY.proof,s=mesh.userData.beaconTriangles as readonly number[]|undefined;
  if(raw.byteLength!==DALVAY.bytes||rows!==DALVAY.rows||!s||s[0]!==p.start||s[1]!==p.end||g.index||g.groups.length||
   g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==6)return false;
  const buf=(name:string,width:number)=>{const a=g.getAttribute(name) as BufferAttribute;if(a?.count!==p.vertices||a.itemSize!==width||a.normalized||!(name==='facadeStyle'?a.array instanceof Uint8Array:a.array instanceof Float32Array)||!(a.array.buffer instanceof ArrayBuffer))throw Error();
   return new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);};
  const text=JSON.stringify(row);if(!text||text.length>900)return false;
  const attrs=Object.entries(originalAttributes);
  const [w,r,actual]=await Promise.all([dalvayDigest(raw),dalvayDigest(new TextEncoder().encode(text)),Promise.all(attrs.map(([name,[width]])=>dalvayDigest(buf(name,width))))]);
  return w===DALVAY.chunk&&r===DALVAY.row&&actual.every((v,i)=>v===attrs[i][1][1]);
 }catch{return false;}
}

type GroundRow={lod:number,fine?:{visible:boolean,parent:unknown,material:unknown,userData:Record<string,unknown>,geometry:{index:{count:number}|null,getAttribute:(key:string)=>{count:number}|undefined}},local:unknown,relief?:unknown};
export function dalvayGroundPair(a:GroundRow|undefined,b:GroundRow|undefined,localGrade:boolean){
 const original=(p:GroundRow|undefined)=>{const g=p?.fine;return !!p&&p.lod===112&&!!g&&g.visible&&!!g.parent&&g.material===p.local&&
  !p.relief&&!g.userData.localGrade&&!g.userData.coastalSurvey&&g.geometry.index?.count===112*112*6&&g.geometry.getAttribute('position')?.count===113*113;};
 return !localGrade&&original(a)&&original(b);
}
