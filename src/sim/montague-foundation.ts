import {readCoastalPack} from './coastal-packs.ts';
import type {MeshSurveySource} from './coastal-terrain.ts';
import {WaterInset} from './harbour-cover.ts';
import {MONTAGUE_FOUNDATION as plan} from './montague-foundation.generated.ts';

export type MontagueFoundation={water:WaterInset;ground:MeshSurveySource};
/** Install both parts or neither. Only the existing fixed sea plane can be used. */
export function loadMontagueFoundation(base:string,fetcher:typeof fetch=fetch,timeoutMs=1550){
 return readCoastalPack<MontagueFoundation>(base+plan.asset,fetcher,timeoutMs,plan,b=>{
  const view=new DataView(b),head=8,n=plan.water.decodedBytes;
  if(view.getUint32(0,true)!==0x3046524d||view.getUint32(4,true)!==1)throw Error('Wrong Montague foundation version');
  const count=(plan.ground.cellsX*plan.ground.sub+1)*(plan.ground.cellsZ*plan.ground.sub+1);
  if(head+n+count*2!==b.byteLength)throw Error('Incomplete Montague foundation');
  const h=new Int16Array(count);
  for(let i=0;i<count;i++){
   const x=view.getInt16(head+n+2*i,true);
   if(x<-4000||x>5500)throw Error('Out-of-scope Montague ground');
   h[i]=x;
  }
  return {water:new WaterInset(new Uint8Array(b,head,n),{...plan.water,asset:plan.asset,sha256:plan.sha256,crc32:plan.crc32,pinCoverSha256:plan.pinCoverSha256}),ground:{spec:plan.ground,samples:h}};
 });
}
export function supportedMontagueFoundation(cover:string|undefined,terrain:string|undefined,coverDecoded:string|undefined){
 return cover===plan.pinCoverSha256&&terrain===plan.pinTerrainSha256&&coverDecoded===plan.pinCoverDecodedSha256;
}
