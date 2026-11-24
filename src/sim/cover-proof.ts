import type {Cover} from './cover.ts';
const pending=new WeakMap<Cover,Promise<string|undefined>>();
/** Hash the immutable decoded raster at most once for all locally qualified
 * owners. No fetch and no boot-time work. A changed Cover instance gets
 * its own proof. */
export function verifyDecodedCover(c:Cover):Promise<string|undefined>{
 if(c.sourceDecodedSha)return Promise.resolve(c.sourceDecodedSha);
 const old=pending.get(c);if(old)return old;
 const result=(async()=>{
  try{
   const a=c.bytes,buffer=a.buffer;
   if(!globalThis.crypto?.subtle||!(buffer instanceof ArrayBuffer))return;
   const result=await crypto.subtle.digest('SHA-256',new Uint8Array(buffer,a.byteOffset,a.byteLength));
   return Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,'0')).join('');
  }catch{return;}
 })();
 pending.set(c,result);return result;
}
