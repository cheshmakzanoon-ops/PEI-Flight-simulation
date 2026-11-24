import {GROUND as G} from './ground.generated.ts';
import type {World} from '../world.ts';

export type SourisEastGround=()=>Promise<(()=>boolean)|undefined>;

/** Decode-verified cover data can already be available in a review mode.
 * Standard verifies that same in-memory raster only when the source tile is
 * streamed. No reread, new request, or boot-time dependency is introduced. */
export function sourisEastGround(world:World,terrainSha:string|undefined,road:()=>string|undefined):SourisEastGround|undefined{
 if(terrainSha!==G.terrain||world.cover.sourceSha!==G.cover||!globalThis.crypto?.subtle)return;
 let pending:ReturnType<SourisEastGround>|undefined;
 return ()=>pending??=(async()=>{
  let cover=world.cover.sourceDecodedSha;
  try{
   if(!cover){
    const b=world.cover.bytes;
    if(!(b.buffer instanceof ArrayBuffer))return;
    const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(b.buffer,b.byteOffset,b.byteLength));
    cover=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
   }
  }catch{return;}
  if(cover!==G.coverDecoded)return;
  let old:object|undefined,pass=false;
  return ()=>{
   if(road()!==G.road)return false;
   const current=world.rollingCanopyOwner(G.boundsXZ);
   if(!current||current.key!==G.key){old=undefined;pass=false;return false;}
   if(current.geometry!==old){
    old=current.geometry;
    pass=G.controls.every(([x,z,visual,contact,dry])=>{
     const s=world.surface(x,z);
     return s.land&&!s.runway&&Math.abs(s.height-contact)<.004&&
      Math.abs(world.visualGroundHeight(x,z)-visual)<.004&&
      Math.abs(world.cover.distance(world.terrain,x,z)-dry)<.006;
    });
   }
   return pass;
  };
 })();
}
