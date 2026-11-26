// The dated preview reuses just one member of the shipped NRCan overview.
import {validReliefPlan,type ReliefPins} from '../../sim/relief-pack.ts';
import {RELIEF_INDEX_SHA} from '../../sim/relief-index.generated.ts';
import {ReliefSeed} from '../../sim/relief-seed.ts';
import {unpackGzip} from '../../sim/compression.ts';

export const PRINCE_TERRAIN_SLOT='7-8';
export const PRINCE_OVERVIEW_CELLS=[
 [10,59],[11,59],[12,59],[13,59],
 [9,60],[10,60],[11,60],[12,60],[13,60],
 [8,61],[9,61],[10,61],[11,61],[12,61],[13,61],
 [10,62],[11,62],[12,62],[13,62],
 [10,63],[11,63],[12,63],[13,63],
] as const;
const PIN=Object.freeze({
 indexBytes:48378,hedgeBytes:33000,file:'relief-03.pack',packBytes:535813,
 start:248019,length:37205,sourceCells:52,pack:3,
 archive:'7bf726aff4293e328e5a0da0625fd3165afca32ff664338e447c8c2fbb2e5552',
 decoded:'a7cd3c73ef6063186366c4adabb02e8e275b6b393e10f043af150a010bd80484'
});
const hash=async(a:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),n=>n.toString(16).padStart(2,'0')).join('');
async function readExact(r:Response,n:number,signal:AbortSignal){
 const content=r.headers.get('content-length');
 if(!r.body||signal.aborted||content!==null&&(!/^\d+$/.test(content)||Number(content)!==n)){
  void r.body?.cancel().catch(()=>{});return;
 }
 const receive=r.body.getReader(),out=new Uint8Array(n);let used=0,ended=false;
 try{
  while(!signal.aborted){
   const q=await receive.read();
   if(q.done){ended=true;return used===n?out.buffer:undefined;}
   if(q.value.byteLength>n-used)return;
   out.set(q.value,used);used+=q.value.byteLength;
  }
 }finally{if(!ended)void receive.cancel().catch(()=>{});receive.releaseLock();}
}
export async function verifiedPrinceOverview(base:string,pins:Omit<ReliefPins,'hedges'>,request:typeof fetch=fetch,signal?:AbortSignal){
 if(!globalThis.crypto?.subtle)return;
 const budget=AbortSignal.timeout(7000),limit=signal?AbortSignal.any([signal,budget]):budget;
 if(limit.aborted)return;
 try{
  const root=base+'world/',here=root+'terrain-adaptive/v1/',opts={signal:limit};
  const [m,h]=await Promise.all([request(here+'index.json',opts),request(root+'woodland/hedgerows-v1/index.json',opts)]);
  if(m.status!==200||h.status!==200){void m.body?.cancel().catch(()=>{});void h.body?.cancel().catch(()=>{});return;}
  const [a,b]=await Promise.all([readExact(m,PIN.indexBytes,limit),readExact(h,PIN.hedgeBytes,limit)]);
  if(!a||!b||limit.aborted||await hash(a)!==RELIEF_INDEX_SHA)return;
  const plan=JSON.parse(new TextDecoder().decode(a)),hedges=await hash(b);
  if(!validReliefPlan(plan,{...pins,hedges})||limit.aborted)return;
  const entry=plan.tiles.find((q:{id:string})=>q.id===PRINCE_TERRAIN_SLOT),owner=plan.packs[PIN.pack];
  if(!entry||entry.pack!==PIN.pack||entry.offset!==PIN.start||entry.bytes!==PIN.length||entry.cells!==PIN.sourceCells||
     entry.archiveSha256!==PIN.archive||entry.sha256!==PIN.decoded||owner.file!==PIN.file||owner.bytes!==PIN.packBytes)return;
  const end=PIN.start+PIN.length-1,response=await request(here+PIN.file,{signal:limit,headers:{Range:'bytes='+PIN.start+'-'+end}});
  let part:ArrayBuffer|undefined;
  if(response.status===206&&response.headers.get('content-range')==='bytes '+PIN.start+'-'+end+'/'+PIN.packBytes)
   part=await readExact(response,PIN.length,limit);
  else if(response.status===200){
   const full=await readExact(response,PIN.packBytes,limit);
   // Portable static-host fallback uses a hard byte cap and authenticated
   // pack; it cannot allocate based on an untrusted content length.
   if(full&&!limit.aborted&&await hash(full)===owner.sha256)part=full.slice(PIN.start,end+1);
  }else{void response.body?.cancel().catch(()=>{});return;}
  if(!part||limit.aborted||await hash(part)!==PIN.archive)return;
  const decoded=await unpackGzip(part);
  if(limit.aborted||await hash(decoded)!==PIN.decoded)return;
  const seed=new ReliefSeed(decoded,true,PIN.sourceCells);
  if(limit.aborted||!PRINCE_OVERVIEW_CELLS.every(([x,z])=>seed.accepts(x,z)))return;
  return {cells:PRINCE_OVERVIEW_CELLS,survey:(u:number,v:number)=>seed.height(u,v)};
 }catch{return;}
}
