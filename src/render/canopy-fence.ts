import {CANOPY_FENCE as P} from './canopy-fence.generated.ts';
export type ReceiverBox=readonly [minX:number,minZ:number,maxX:number,maxZ:number];
const HEADER=24, MAGIC=0x46534831;
export class CanopyFence{
 private readonly view:DataView;
 private readonly offset:number;
 constructor(source:ArrayBuffer){
  if(source.byteLength!==P.rawBytes)throw Error('Incomplete forest overlay fence');
  const v=this.view=new DataView(source);
  const start=this.offset=HEADER+4*(P.height+1);
  const count=v.getUint32(20,true);
  if(v.getUint32(0)!==MAGIC||v.getInt32(4,true)!==P.x0||v.getInt32(8,true)!==P.z0||
    v.getUint16(12,true)!==P.width||v.getUint16(14,true)!==P.height||v.getUint16(16,true)!==P.strideM||
    v.getUint16(18,true)!==1||start+count*4!==source.byteLength||v.getUint32(HEADER,true)!==0||
    v.getUint32(HEADER+P.height*4,true)!==count)throw Error('Unknown forest overlay fence schema');
 }
 allows(b:ReceiverBox){
  const [a,d,c,e]=b;
  if(!Number.isFinite(a+d+c+e)||a>=c||d>=e)return false;
  const x=Math.floor((a-P.x0)/P.strideM),X=Math.floor((c-P.x0)/P.strideM);
  const z=Math.floor((d-P.z0)/P.strideM),Z=Math.floor((e-P.z0)/P.strideM);
  if(x<0||z<0||X>=P.width||Z>=P.height||X-x>5||Z-z>5)return false;
  const v=this.view;
  for(let j=z;j<=Z;j++){
   let low=v.getUint32(HEADER+j*4,true),end=v.getUint32(HEADER+(j+1)*4,true),high=end;
   while(low<high){
    const mid=(low+high)>>>1;
    if(v.getUint16(this.offset+mid*4+2,true)<x)low=mid+1;else high=mid;
   }
   if(low<end&&v.getUint16(this.offset+low*4,true)<=X)return false;
  }
  return true;
 }
}
type Pins=Partial<Record<keyof typeof P.pins,string>>;
export function canopyFenceMatches(q:Pins){
 return (Object.keys(P.pins) as Array<keyof typeof P.pins>).every(k=>P.pins[k]===q[k]);
}
const hash=(b:ArrayBuffer)=>crypto.subtle.digest('SHA-256',b).then(q=>Array.from(new Uint8Array(q),x=>x.toString(16).padStart(2,'0')).join(''));
async function read(stream:ReadableStream<Uint8Array>|null,cap:number){
 if(!stream)return;
 const chunks=new Uint8Array(cap),r=stream.getReader();
 let used=0;
 try{
  for(;;){
   const q=await r.read();
   if(q.done)return used===cap?chunks.buffer:chunks.buffer.slice(0,used);
   if(q.value.length>cap-used)return;
   chunks.set(q.value,used);used+=q.value.length;
  }
 }finally{void r.cancel().catch(()=>{});r.releaseLock();}
}
export async function loadCanopyFence(base:string,get:typeof fetch=fetch,timeout=3500){
 if(!globalThis.crypto?.subtle)return;
 const signal=AbortSignal.timeout(timeout);
 try{
  const r=await get(base+P.path,{signal});
  if(r.status!==200){void r.body?.cancel().catch(()=>{});return;}
  let raw=await read(r.body,P.rawBytes);
  if(!raw||signal.aborted)return;
  if(raw.byteLength===P.wireBytes){
   if(await hash(raw)!==P.wireSha||signal.aborted)return;
   raw=await read(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),P.rawBytes);
  }
  if(!raw||raw.byteLength!==P.rawBytes||await hash(raw)!==P.rawSha||signal.aborted)return;
  return new CanopyFence(raw);
 }catch{return;}
}
