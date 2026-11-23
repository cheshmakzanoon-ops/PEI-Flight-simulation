import {unpackGzip} from './compression.ts';

const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b:Uint8Array){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return ((~c)>>>0).toString(16).padStart(8,'0');}

/** Independently bounded optional assets. Do not install partial or late layers in flight. */
export async function readCoastalPack<T>(url:string,fetcher:typeof fetch,timeoutMs:number,stamp:{decodedBytes:number;crc32:string;sha256:string},decode:(b:ArrayBuffer)=>T){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const read=async()=>{
  const r=await fetcher(url,{signal:controller.signal});if(!r.ok)return;
  const buffer=await unpackGzip(await r.arrayBuffer());
  if(buffer.byteLength!==stamp.decodedBytes||crc32(new Uint8Array(buffer))!==stamp.crc32)return;
  if(globalThis.crypto?.subtle){
   const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));
   if(Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==stamp.sha256)return;
  }
  return decode(buffer);
 };
 try{return await Promise.race([read(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(undefined);},timeoutMs);})]);}
 catch{return undefined;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
