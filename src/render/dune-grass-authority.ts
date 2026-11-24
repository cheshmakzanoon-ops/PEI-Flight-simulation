import {DUNE_GRASS_AUTHORITY as SOURCE} from './dune-grass-authority.generated.ts';

const SHA=(b:ArrayBuffer)=>crypto.subtle.digest('SHA-256',b).then(p=>Array.from(new Uint8Array(p),x=>x.toString(16).padStart(2,'0')).join(''));
export type GrassAuthorityStamp=typeof SOURCE.index[number];

async function readExact(stream:ReadableStream<Uint8Array>|null,expected:number){
 if(!stream)return;
 const r=stream.getReader(),buffer=new Uint8Array(expected);
 let n=0;
 try{
  for(;;){
   const item=await r.read();
   if(item.done)return n===expected?buffer.buffer:undefined;
   if(n+item.value.length>expected)return;
   buffer.set(item.value,n);n+=item.value.length;
  }
 }finally{
  void r.cancel().catch(()=>{});r.releaseLock();
 }
}
export async function openDuneGrassAuthority(base:string,get:typeof fetch=fetch){
 if(!globalThis.crypto?.subtle)return;
 const signal=AbortSignal.timeout(3700);
 try{
  const r=await get(base+'dune-grass/v1/authority.pack',{signal});
  if(r.status!==200){void r.body?.cancel().catch(()=>{});return;}
  const b=await readExact(r.body,SOURCE.maskWireBytes);
  if(!b||signal.aborted||await SHA(b)!==SOURCE.sha256||signal.aborted)return;
  return new DuneGrassAuthority(b);
 }catch{return;}
}
export class DuneGrassAuthority{
 private packet:ArrayBuffer;
 constructor(verified:ArrayBuffer){this.packet=verified;}
 async read(s:GrassAuthorityStamp){
  if(!Number.isSafeInteger(s.offset)||s.offset<0||s.wire<=0||s.offset+s.wire>this.packet.byteLength||
    s.decoded<=20||s.decoded>SOURCE.maxDecodedBytes)return;
  try{
   const wire=this.packet.slice(s.offset,s.offset+s.wire);
   if(await SHA(wire)!==s.wireSHA256)return;
   const data=await readExact(new Blob([wire]).stream().pipeThrough(new DecompressionStream('gzip')),s.decoded);
   if(!data||await SHA(data)!==s.decodedSHA256)return;
   const b=new DataView(data);
   if(b.getUint32(0)!==0x44474c31||b.getInt32(4,true)!==s.grid[0]||b.getInt32(8,true)!==s.grid[1]||
     b.getUint16(12,true)!==s.cells[0]||b.getUint16(14,true)!==s.cells[1]||
     b.getUint16(16,true)!==s.tile[0]||b.getUint16(18,true)!==s.tile[1]||20+s.cells[0]*s.cells[1]!==data.byteLength)return;
   return new Uint8Array(data,20);
  }catch{return;}
 }
}
