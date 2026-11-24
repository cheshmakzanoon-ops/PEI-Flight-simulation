/** Fixed geospatial mask lattice. Tile addresses are signed, with floor division. */
export const FIELD_SHARD_SPAN=1024, FIELD_SHARD_CELL=4, FIELD_SHARD_HALO=2;
export const FIELD_SHARD_SIDE=FIELD_SHARD_SPAN/FIELD_SHARD_CELL+2*FIELD_SHARD_HALO;
export const FIELD_SHARD_BYTES=2*FIELD_SHARD_SIDE*FIELD_SHARD_SIDE;
export const FIELD_SHARD_VIEW=480;
export const FIELD_SHARD_LAYERS=4;
const INDEX_HEADER=12,PACK_ENTRY=36,CELL_ENTRY=80;
const LIMIT_PACKS=90,LIMIT_CELLS=4096,LIMIT_WIRE=210_000,LIMIT_ARCHIVE=9000;
const INDEX_CAP=INDEX_HEADER+LIMIT_PACKS*PACK_ENTRY+LIMIT_CELLS*CELL_ENTRY;

export type FieldCell=Readonly<{key:string;x:number;z:number;pack:number;offset:number;size:number;
 packedHash:string;decodedHash:string}>;
type FileRef=Readonly<{size:number;hash:string}>;
export type FieldDirectory=Readonly<{packs:readonly FileRef[];cells:ReadonlyMap<string,FieldCell>}>;
export const fieldKey=(x:number,z:number)=>x+':'+z;
const bytesHex=(u:Uint8Array)=>Array.from(u,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async(b:ArrayBuffer)=>bytesHex(new Uint8Array(await crypto.subtle.digest('SHA-256',b)));
const hex=(s:string)=>/^[a-f0-9]{64}$/.test(s);
const noHash=(s:string)=>/^0+$/.test(s);

export function readFieldDirectory(bytes:ArrayBuffer):FieldDirectory|undefined{
 const v=new DataView(bytes), ar=new Uint8Array(bytes);
 if(bytes.byteLength<INDEX_HEADER||bytes.byteLength>INDEX_CAP||v.getUint32(0)!==0x46435231||
    v.getUint16(4,true)!==1||v.getUint16(10,true)!==0)return;
 const np=v.getUint16(6,true),nr=v.getUint16(8,true);
 if(np<1||np>LIMIT_PACKS||nr<1||nr>LIMIT_CELLS||
    bytes.byteLength!==INDEX_HEADER+np*PACK_ENTRY+nr*CELL_ENTRY)return;
 const packs:FileRef[]=[], cells=new Map<string,FieldCell>();
 for(let p=0;p<np;++p){
  const at=INDEX_HEADER+p*PACK_ENTRY,size=v.getUint32(at,true),hash=bytesHex(ar.subarray(at+4,at+PACK_ENTRY));
  if(size<1||size>LIMIT_WIRE||noHash(hash))return;
  packs.push({size,hash});
 }
 const offsets=packs.map(()=>0);
 let lastX=-Infinity,lastZ=-Infinity;
 for(let n=0;n<nr;++n){
  const at=INDEX_HEADER+np*PACK_ENTRY+n*CELL_ENTRY;
  const x=v.getInt16(at,true),z=v.getInt16(at+2,true),pack=v.getUint16(at+4,true);
  const key=fieldKey(x,z),offset=v.getUint32(at+8,true),size=v.getUint32(at+12,true);
  if(v.getUint16(at+6,true)!==0||x<-125||x>116||z<-77||z>65||pack>=packs.length||
     x<lastX||(x===lastX&&z<=lastZ)||offset!==offsets[pack]||size<1||size>LIMIT_ARCHIVE||
     offset+size>packs[pack].size)return;
  const packedHash=bytesHex(ar.subarray(at+16,at+48)),decodedHash=bytesHex(ar.subarray(at+48,at+80));
  if(noHash(packedHash)||noHash(decodedHash))return;
  cells.set(key,{key,x,z,pack,offset,size,packedHash,decodedHash});
  offsets[pack]+=size;lastX=x;lastZ=z;
 }
 if(offsets.some((size,i)=>size!==packs[i].size))return;
 return {packs,cells};
}

/** The disk intersects at most two shard interiors per axis. */
export function fieldCandidates(x:number,z:number,dir:FieldDirectory){
 if(!Number.isFinite(x)||!Number.isFinite(z))return [];
 const rad=FIELD_SHARD_VIEW,L=FIELD_SHARD_SPAN, found:{cell:FieldCell;squared:number}[]=[];
 for(let tx=Math.floor((x-rad)/L);tx<=Math.floor((x+rad)/L);++tx)for(let tz=Math.floor((z-rad)/L);tz<=Math.floor((z+rad)/L);++tz){
  const cell=dir.cells.get(fieldKey(tx,tz));if(!cell)continue;
  const dx=Math.max(tx*L-x,0,x-(tx+1)*L),dz=Math.max(tz*L-z,0,z-(tz+1)*L);
  const squared=dx*dx+dz*dz;
  if(squared<=rad*rad)found.push({cell,squared});
 }
 return found.sort((a,b)=>a.squared-b.squared||a.cell.x-b.cell.x||a.cell.z-b.cell.z).map(q=>q.cell);
}

async function bound(stream:ReadableStream<Uint8Array>|null,max:number){
 if(!stream)return;
 const rd=stream.getReader(),buffer=new Uint8Array(max);let offset=0;
 try{
  for(;;){
   const {done,value}=await rd.read();
   if(done)return offset===max?buffer.buffer:buffer.buffer.slice(0,offset);
   if(offset+value.length>max)return;
   buffer.set(value,offset);offset+=value.length;
  }
 }finally{void rd.cancel().catch(()=>{});rd.releaseLock();}
}
const reject=(response:Response)=>{void response.body?.cancel().catch(()=>{});return undefined;};
async function readSized(res:Response,n:number){
 const len=res.headers.get('content-length');
 if(len&&Number(len)>n)return reject(res);
 return bound(res.body,n);
}
const zipped=(a:ArrayBuffer)=>{const v=new Uint8Array(a,0,Math.min(2,a.byteLength));return v[0]===0x1f&&v[1]===0x8b;};
function inflate(a:ArrayBuffer,n:number){
 return bound(new Blob([a]).stream().pipeThrough(new DecompressionStream('gzip')),n);
}

export type FieldIndexPin=Readonly<{packedSize:number;rawSize:number;packedHash:string;rawHash:string}>;

export class FieldShardSource {
 private readonly full=new Map<number,ArrayBuffer>();
 private readonly rangeReady=new Set<number>();
 private readonly probe=new Map<number,Promise<ArrayBuffer|undefined>>();
 readonly dir:FieldDirectory;
 readonly base:string;
 readonly request:typeof fetch;
 constructor(dir:FieldDirectory,base:string,request:typeof fetch=fetch){
  this.dir=dir;this.base=base;this.request=request;
 }
 static async open(base:string,pin:FieldIndexPin,request:typeof fetch=fetch,external?:AbortSignal){
  if(!globalThis.crypto?.subtle||!Number.isSafeInteger(pin.packedSize)||pin.packedSize<1||pin.packedSize>INDEX_CAP||
     !Number.isSafeInteger(pin.rawSize)||pin.rawSize<INDEX_HEADER||pin.rawSize>INDEX_CAP||
     !hex(pin.packedHash)||!hex(pin.rawHash))return;
  const abort=external?undefined:new AbortController();
  const signal=external??abort!.signal;
  const timer=abort?setTimeout(()=>abort.abort(),2500):undefined;
  try{
   const response=await request(base+'index.fcr.gz',{signal});
   if(response.status!==200)return reject(response);
   let raw=await readSized(response,Math.max(pin.rawSize,pin.packedSize));
   if(!raw||signal.aborted)return;
   if(zipped(raw)){
    if(raw.byteLength!==pin.packedSize||await digest(raw)!==pin.packedHash)return;
    raw=await inflate(raw,pin.rawSize);if(!raw)return;
   }
   if(signal.aborted||raw.byteLength!==pin.rawSize||await digest(raw)!==pin.rawHash)return;
   const dir=readFieldDirectory(raw);
   if(dir)return new FieldShardSource(dir,base,request);
  }catch{return;}
  finally{if(timer!==undefined)clearTimeout(timer);}
 }
 private async transfer(cell:FieldCell,signal:AbortSignal){
  const {pack,offset,size}=cell,expected=this.dir.packs[pack];
  const span=offset+'-'+(offset+size-1);
  const request=this.request;
  const res=await request(this.base+'crop-'+String(pack).padStart(2,'0')+'.pack',
   {signal,headers:{Range:'bytes='+span}});
  if(res.status===206){
   if(res.headers.get('content-range')!=='bytes '+span+'/'+expected.size)return reject(res);
   const bytes=await readSized(res,size);
   if(!bytes||signal.aborted||bytes.byteLength!==size||await digest(bytes)!==cell.packedHash)return;
   this.rangeReady.add(pack);
   return bytes;
  }
  if(res.status!==200)return reject(res);
  const bytes=await readSized(res,expected.size);
  if(!bytes||signal.aborted||bytes.byteLength!==expected.size||await digest(bytes)!==expected.hash)return;
  if(this.full.has(pack))this.full.delete(pack);
  while(this.full.size>=4)this.full.delete(this.full.keys().next().value!);
  this.full.set(pack,bytes);
  return bytes.slice(offset,offset+size);
 }
 private async wire(cell:FieldCell,signal:AbortSignal){
  const {pack,offset,size}=cell;
  const prior=this.probe.get(pack);
  if(prior){try{await prior;}catch{/* only a new valid transfer can enable a cell */}}
  if(signal.aborted)return;
  const full=this.full.get(pack);
  if(full){
   this.full.delete(pack);this.full.set(pack,full);
   return full.slice(offset,offset+size);
  }
  if(this.rangeReady.has(pack))return this.transfer(cell,signal);
  const trial=this.transfer(cell,signal);
  this.probe.set(pack,trial);
  try{return await trial;}finally{if(this.probe.get(pack)===trial)this.probe.delete(pack);}
 }
 async load(cell:FieldCell,external?:AbortSignal){
  const abort=external?undefined:new AbortController();
  const signal=external??abort!.signal;
  if(!globalThis.crypto?.subtle||signal.aborted||this.dir.cells.get(cell.key)!==cell)return;
  const timer=abort?setTimeout(()=>abort.abort(),2200):undefined;
  try{
   const wire=await this.wire(cell,signal);
   if(!wire||signal.aborted||wire.byteLength!==cell.size||await digest(wire)!==cell.packedHash)return;
   const raw=await inflate(wire,FIELD_SHARD_BYTES);
   if(signal.aborted||!raw||raw.byteLength!==FIELD_SHARD_BYTES||await digest(raw)!==cell.decodedHash)return;
   return new Uint8Array(raw);
  }catch{return;}
  finally{if(timer!==undefined)clearTimeout(timer);}
 }
}
