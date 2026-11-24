/** The only stock AEB tile that overlaps the crown's guarded envelope. */
export const KINGS_CROWN_BUILDINGS={
 atlasSha:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 indexBytes:56569,indexSha:'fcc2bb4d890eafd08ac41136a3bff7bebeafe2f9c25a066fdcf756ed39badce0',
 tile:'q12303',offset:2983836,bytes:23754,count:548,packBytes:3844984,
 sha:'605150e5c17d15be8f863a6dee96226fe863ca4c5bc0e28b37968932f659f53e',
} as const;
const digest=async(data:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),p=>p.toString(16).padStart(2,'0')).join('');

/** Move the one normal owner range earlier, never buffer an ignored Range or
 * let a later valid response make a fail-closed startup become live. */
export async function readKingsCrownBuildings<T>(base:string,decode:(b:ArrayBuffer)=>Promise<T[]>,get:typeof fetch=fetch,ms=1450){
 const p=KINGS_CROWN_BUILDINGS;
 if(!globalThis.crypto?.subtle)return;
 const controller=new AbortController(),signal=controller.signal;
 let timer:ReturnType<typeof setTimeout>|undefined;
 async function bounded(response:Response,limit:number,status:number){
  if(response.status!==status||signal.aborted){void response.body?.cancel().catch(()=>{});return;}
  if(!response.body)return;
  const reader=response.body.getReader(),buffer=new Uint8Array(limit);
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  let wrote=0;
  try{
   for(;;){
    const {done,value}=await reader.read();if(signal.aborted)return;
    if(done)return wrote===limit?buffer.buffer:undefined;
    if(value.byteLength>limit-wrote)return;
    buffer.set(value,wrote);wrote+=value.byteLength;
   }
  }finally{signal.removeEventListener('abort',cancel);cancel();reader.releaseLock();}
 }
 const prepare=async()=>{
  const index=await bounded(await get(base+'index.json',{signal}),p.indexBytes,200);
  if(!index||await digest(index)!==p.indexSha||signal.aborted)return;
  const spec=JSON.parse(new TextDecoder().decode(index)) as {
   file:string;bytes:number;sha256:string;tiles:{id:string;bounds:[number,number,number,number];offset:number;bytes:number;count:number}[];
  };
  if(spec.file!=='tiles.pack'||spec.bytes!==p.packBytes||spec.sha256!==p.atlasSha)return;
  const candidates=spec.tiles.filter(t=>t.id===p.tile);
  if(candidates.length!==1||candidates[0].offset!==p.offset||candidates[0].bytes!==p.bytes||candidates[0].count!==p.count)return;
  const span=p.offset+'-'+(p.offset+p.bytes-1),file=base+spec.file;
  const response=await get(file,{signal,headers:{Range:'bytes='+span}});
  if(response.headers.get('content-range')!=='bytes '+span+'/'+p.packBytes){void response.body?.cancel().catch(()=>{});return;}
  const body=await bounded(response,p.bytes,206);
  if(!body||await digest(body)!==p.sha||signal.aborted)return;
  const rows=await decode(body);
  if(signal.aborted||!Array.isArray(rows)||rows.length!==p.count)return;
  return {spec,rows,file};
 };
 try{return await Promise.race([prepare(),new Promise<undefined>(done=>timer=setTimeout(()=>{controller.abort();done(undefined);},ms))]);}
 catch{return undefined;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
