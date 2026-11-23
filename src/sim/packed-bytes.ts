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
 constructor(url:string,total:number,request:typeof fetch=(input,init)=>fetch(input,init)){
  if(!Number.isSafeInteger(total)||total<=0)throw Error('Invalid packed size');
  this.url=url;this.total=total;this.request=request;
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
  const end=offset+size-1,range=offset+'-'+end;
  const response=await this.request(this.url,{headers:{Range:'bytes='+range}});
  if(!response.ok)throw Error('Pack transfer failed: '+response.status);
  // Check headers before reading the body of a malformed partial response.
  if(response.status===206&&response.headers.get('content-range')!=='bytes '+range+'/'+this.total){
   void response.body?.cancel().catch(()=>{});
   throw Error('Mismatched pack content range');
  }
  if(response.status!==200&&response.status!==206){
   void response.body?.cancel().catch(()=>{});
   throw Error('Unsupported pack response: '+response.status);
  }
  const bytes=await response.arrayBuffer();
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
