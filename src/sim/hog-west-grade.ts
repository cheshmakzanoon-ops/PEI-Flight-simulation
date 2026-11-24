import {HOG_WEST_GRADE as S} from './hog-west-grade.generated.ts';

export async function pinnedHogBuildingIndex(base:string,get:typeof fetch=fetch,ms=2000){
 if(!globalThis.crypto?.subtle)return false;
 const signal=AbortSignal.timeout(ms);
 try{
  const r=await get(base+'buildings/index.json',{signal});
  if(r.status!==200||!r.body){void r.body?.cancel().catch(()=>{});return false;}
  const bytes=new Uint8Array(S.atlasIndexBytes),reader=r.body.getReader();
  let length=0;
  try{
   for(;;){
    const entry=await reader.read();
    if(entry.done)break;
    if(length+entry.value.length>bytes.length)return false;
    bytes.set(entry.value,length);length+=entry.value.length;
   }
  }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
  if(length!==bytes.length||signal.aborted)return false;
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  return !signal.aborted&&sha===S.atlasIndexSha256;
 }catch{return false;}
}
