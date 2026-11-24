import {BowleyPond,type BowleySpec} from './bowley-pond.ts';

export type CavendishWaterSource=BowleySpec&Readonly<{
 file:string;compressedBytes:number;decodedBytes:number;wireSha256:string;sha256:string;
 terrainSha256:string;coverCompressedSha256:string;coverDecodedSha256:string;
}>;
export function cavendishAtlasMatches(s:CavendishWaterSource,terrainSha:string|undefined,coverSha:string|undefined,coverRawSha:string|undefined){
 return terrainSha===s.terrainSha256&&coverSha===s.coverCompressedSha256&&coverRawSha===s.coverDecodedSha256;
}
const h=(bytes:ArrayBuffer)=>crypto.subtle.digest('SHA-256',bytes).then(d=>Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join(''));
async function bounded(stream:ReadableStream<Uint8Array>|null,limit:number){
 if(!stream)return;
 const reader=stream.getReader(),buffer=new Uint8Array(limit);
 let n=0;
 try{
  for(;;){
   const item=await reader.read();
   if(item.done)return n===limit?buffer.buffer:buffer.buffer.slice(0,n);
   if(item.value.byteLength>limit-n)return;
   buffer.set(item.value,n);n+=item.value.byteLength;
  }
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** One native slot. Invalid, obsolete or late data never changes land. */
export async function loadCavendishWaterCore(s:CavendishWaterSource,base:string,request:typeof fetch=fetch,timeout=1400){
 if(!globalThis.crypto?.subtle||s.decodedBytes!==s.width*s.height||
  s.decodedBytes>3_000_000||s.decodedBytes<=s.compressedBytes)return;
 const controller=new AbortController();const signal=controller.signal;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const read=async()=>{
  const response=await request(base+s.file,{signal});
  if(response.status!==200||signal.aborted){void response.body?.cancel().catch(()=>{});return;}
  let raw=await bounded(response.body,s.decodedBytes);
  if(!raw||signal.aborted)return;
  if(raw.byteLength===s.compressedBytes){
   if(await h(raw)!==s.wireSha256||signal.aborted)return;
   raw=await bounded(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),s.decodedBytes);
  }
  if(!raw||raw.byteLength!==s.decodedBytes||await h(raw)!==s.sha256||signal.aborted)return;
  const q=new Uint8Array(raw),{width,height}=s;
  for(let x=0;x<width;x++)if(q[x]<=128||q[(height-1)*width+x]<=128)return;
  for(let y=0;y<height;y++)if(q[y*width]<=128||q[y*width+width-1]<=128)return;
  if(!q.some(v=>v<128)||q.includes(128))return;
  return new BowleyPond(s,q);
 };
 try{return await Promise.race([read(),new Promise<undefined>(done=>{
  timer=setTimeout(()=>{controller.abort();done(undefined);},timeout);
 })]);}
 catch{return undefined;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
