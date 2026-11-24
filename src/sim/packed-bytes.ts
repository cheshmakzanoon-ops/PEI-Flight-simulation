const TRANSIENT_HTTP = new Set([408, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [180, 480] as const;
class InterruptedPackTransfer extends Error {}

export async function boundedPackedBody(body:ReadableStream<Uint8Array>|null,limit:number){
 if(!body)throw Error('Missing bounded response body');
 const bytes=new Uint8Array(limit),reader=body.getReader();
 let used=0;
 try{
  for(;;){
   const r=await reader.read();if(r.done)return bytes.buffer.slice(0,used);
   if(r.value.byteLength>limit-used){
    void reader.cancel().catch(()=>{});
    throw Error('Packed response body exceeds limit');
   }
   bytes.set(r.value,used);used+=r.value.byteLength;
  }
 }finally{reader.releaseLock();}
}

/**
 * Read independent chunks from an immutable, version-matched binary pack.
 * Range-capable hosts never have to transfer the complete file. A simple
 * static server can ignore Range and return the full pack once instead.
 */
export class PackedBytes {
 private full?:ArrayBuffer;
 private acceptsRange=false;
 private probe?:Promise<ArrayBuffer>;
 private readonly url:string;
 private readonly total:number;
 private readonly request:typeof fetch;
 private readonly strict:boolean;
 constructor(url:string,total:number,request:typeof fetch=(input,init)=>fetch(input,init),strict=false){
  if(!Number.isSafeInteger(total)||total<=0)throw Error('Invalid packed size');
  this.url=url;this.total=total;this.request=request;this.strict=strict;
 }
 async read(offset:number,size:number):Promise<ArrayBuffer>{
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(size)||size<=0||size>this.total-offset){
   throw Error('Packed read out of bounds');
  }
  if(this.full)return this.full.slice(offset,offset+size);
  if(this.acceptsRange)return this.fetchRange(offset,size);
  if(this.probe){
   try{await this.probe;}catch{/* the initiating reader reports its own error */}
   return this.read(offset,size);
  }
  const probe=this.fetchRange(offset,size);
  this.probe=probe;
  try{return await probe;}finally{this.probe=undefined;}
 }
 private async fetchRange(offset:number,size:number){
  for(let attempt=0;;attempt++){
   // Another range can have completed a full-pack fallback while this read waited.
   if(this.full)return this.full.slice(offset,offset+size);
   try{return await this.transfer(offset,size);}
   catch(error){
    if(!(error instanceof InterruptedPackTransfer)||attempt>=RETRY_DELAYS_MS.length)throw error;
    await new Promise(resolve=>setTimeout(resolve,RETRY_DELAYS_MS[attempt]));
   }
  }
 }
 private async transfer(offset:number,size:number){
  const end=offset+size-1,range=offset+'-'+end;
  let response:Response;
  try{response=await this.request(this.url,{headers:{Range:'bytes='+range}});}
  catch(error){
   if(error instanceof TypeError)throw new InterruptedPackTransfer('Pack connection failed',{cause:error});
   throw error;
  }
  if(!response.ok){
   void response.body?.cancel().catch(()=>{});
   const message='Pack transfer failed: '+response.status;
   if(TRANSIENT_HTTP.has(response.status))throw new InterruptedPackTransfer(message);
   throw Error(message);
  }
  // Check headers before reading the body of a malformed partial response.
  if(response.status===206&&response.headers.get('content-range')!=='bytes '+range+'/'+this.total){
   void response.body?.cancel().catch(()=>{});
   throw Error('Mismatched pack content range');
  }
  if(response.status!==200&&response.status!==206){
   void response.body?.cancel().catch(()=>{});
   throw Error('Unsupported pack response: '+response.status);
  }
  let bytes:ArrayBuffer;
  try{bytes=await (this.strict?boundedPackedBody(response.body,response.status===206?size:this.total):response.arrayBuffer());}
  catch(error){
   if(error instanceof TypeError)throw new InterruptedPackTransfer('Pack response interrupted',{cause:error});
   throw error;
  }
  if(response.status===200&&bytes.byteLength===this.total){
   this.full=bytes;
   return bytes.slice(offset,offset+size);
  }
  if(response.status===206&&bytes.byteLength===size){
   this.acceptsRange=true;
   return bytes;
  }
  throw Error('Incorrect pack response length');
 }
}
