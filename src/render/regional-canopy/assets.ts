import {boundedPackedBody} from '../../sim/packed-bytes.ts';
import {canopyEnvelope,regionalDigest,type RegionalStand} from './spec.ts';

export type CanopyRow=readonly [x:number,z:number,height:number,width:number];
const SIGNATURE=0x52435631,HEAD=12,ROW=16;
const positive=(x:number)=>Number.isFinite(x)&&x>0;
/** Validate the exact LE file before accepting any scene or GPU allocation. */
export function decodeRegionalCanopy(raw:ArrayBuffer,s:RegionalStand){
 if(!s.count||s.count>480||raw.byteLength!==s.decodedBytes||raw.byteLength!==HEAD+s.count*ROW)return;
 const a=new DataView(raw);
 if(a.getUint32(0)!==SIGNATURE||a.getUint32(4,true)!==Number(s.id)||a.getUint16(8,true)!==s.count||a.getUint16(10,true))return;
 const out:CanopyRow[]=[],seen=new Set<string>();
 const [x0,z0,x1,z1]=s.canopyBounds;
 for(let i=0;i<s.count;i++){
  const at=HEAD+i*ROW,x=a.getFloat32(at,true),z=a.getFloat32(at+4,true),h=a.getFloat32(at+8,true),w=a.getFloat32(at+12,true);
  if(!positive(h)||h<8||h>23||!positive(w)||w<4||w>15||!Number.isFinite(x)||!Number.isFinite(z))return;
  const r=canopyEnvelope(h,w),key=x+':'+z;
  if(x-r<x0||x+r>x1||z-r<z0||z+r>z1||seen.has(key))return;
  seen.add(key);out.push([x,z,h,w]);
 }
 return out;
}
export const REGIONAL_CANOPY_TIMEOUT=1550;
/** One exact gzip payload, or the browser-inflated body of that same declared gzip transfer.
 * A failed or slow answer never changes the original surroundings. */
export async function readRegionalCanopy(base:string,s:RegionalStand,get:typeof fetch=fetch,ms=REGIONAL_CANOPY_TIMEOUT){
 if(!globalThis.crypto?.subtle||s.wireBytes<=0||s.wireBytes>=s.decodedBytes||s.decodedBytes>7700)return;
 const a=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const job=async()=>{
  const response=await get(base+'regional-canopy-v1/'+s.file,{signal:a.signal,redirect:'error'});
  const enc=response.headers.get('content-encoding')?.toLowerCase()??'identity',length=response.headers.get('content-length');
  if(response.status!==200||response.redirected||!response.body||a.signal.aborted||
     (enc!=='gzip'&&enc!=='identity')||(length!==null&&length!==String(s.wireBytes))||response.headers.has('content-range')){
   void response.body?.cancel().catch(()=>{});return;
  }
  const limit=enc==='gzip'?s.decodedBytes:s.wireBytes;
  let raw=await boundedPackedBody(response.body,limit);
  if(raw.byteLength!==limit||a.signal.aborted)return;
  if(enc==='identity'){
   if(await regionalDigest(raw)!==s.wireSha||a.signal.aborted)return;
   raw=await boundedPackedBody(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),s.decodedBytes);
  }
  if(raw.byteLength!==s.decodedBytes||await regionalDigest(raw)!==s.decodedSha||a.signal.aborted)return;
  return decodeRegionalCanopy(raw,s);
 };
 try{return await Promise.race([job(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{a.abort();resolve(undefined);},ms);})]);}
 catch{return;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
