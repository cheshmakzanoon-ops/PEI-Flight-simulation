import {PackedBytes} from './packed-bytes.ts';
import {unpackGzip} from './compression.ts';
import {RELIEF_INDEX_SHA} from './relief-index.generated.ts';
import {HRDEM_INTERVALS,PARENT_INTERVALS,ReliefSeed} from './relief-seed.ts';

const COLS=32,ROWS=22,MAX_PACKS=32,BYTES_CAP=15_000_000;
const EXPECTED_BOUNDS=[-64.47,45.94,-61.93,47.1];
const hex=(x:string)=>/^[a-f0-9]{64}$/.test(x);
export type ReliefPins={terrain:string;cover:string;road:string;buildings:string;hedges:string};
type Entry={id:string;pack:number;offset:number;bytes:number;cells:number;sha256:string;archiveSha256:string};
type Pack={file:string;bytes:number;sha256:string};
type Plan={version:number;encoding:string;cols:number;rows:number;intervals:number;parentIntervals:number;
 bounds:number[];pins:ReliefPins;bytes:number;packs:Pack[];tiles:Entry[]};
const rules=['terrain','cover','road','buildings','hedges'] as const;

async function hash(raw:BufferSource){
 const value=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
 return Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
}
export function validReliefPlan(m:Plan,pins:ReliefPins){
 if(!m||m.version!==1||m.encoding!=='guard-bitset-i16le-row-delta-dm'||m.cols!==COLS||m.rows!==ROWS||
    m.intervals!==HRDEM_INTERVALS||m.parentIntervals!==PARENT_INTERVALS||!Array.isArray(m.bounds)||
    m.bounds.length!==4||m.bounds.some((a,i)=>a!==EXPECTED_BOUNDS[i])||!m.pins||
    !rules.every(p=>hex(pins[p])&&m.pins[p]===pins[p])||
    !Array.isArray(m.packs)||m.packs.length<1||m.packs.length>MAX_PACKS||!Array.isArray(m.tiles)||
    !m.tiles.length||m.tiles.length>COLS*ROWS||!Number.isSafeInteger(m.bytes)||m.bytes<1||m.bytes>BYTES_CAP)return false;
 if(m.packs.some((p,i)=>!p||p.file!=='relief-'+String(i).padStart(2,'0')+'.pack'||!hex(p.sha256)||
    !Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>540_000)||m.packs.reduce((n,p)=>n+p.bytes,0)!==m.bytes)return false;
 const ends=m.packs.map(()=>0),seen=new Set<string>();
 for(const t of m.tiles){
  if(!t||!/^\d{1,2}-\d{1,2}$/.test(t.id)||seen.has(t.id)||!Number.isSafeInteger(t.pack)||t.pack<0||t.pack>=m.packs.length||
     t.offset!==ends[t.pack]||!Number.isSafeInteger(t.bytes)||t.bytes<1||t.offset+t.bytes>m.packs[t.pack].bytes||
     !Number.isSafeInteger(t.cells)||t.cells<1||t.cells>(PARENT_INTERVALS-2)**2||!hex(t.sha256)||!hex(t.archiveSha256))return false;
  const [i,j]=t.id.split('-').map(Number);
  if(i>=COLS||j>=ROWS||t.id!==i+'-'+j)return false;
  ends[t.pack]+=t.bytes;seen.add(t.id);
 }
 return ends.every((n,i)=>n===m.packs[i].bytes);
}

export class ReliefPacks {
 private readonly packs:PackedBytes[];
 private readonly entries:Map<string,Entry>;
 private constructor(base:string,plan:Plan,request:typeof fetch){
  this.packs=plan.packs.map(p=>new PackedBytes(base+p.file,p.bytes,request));
  this.entries=new Map(plan.tiles.map(q=>[q.id,q]));
 }
 static async open(base:string,source:Omit<ReliefPins,'hedges'>,fetcher:typeof fetch=fetch,deadline=24000,indexHash=RELIEF_INDEX_SHA){
  if(!globalThis.crypto?.subtle)return;
  const root=base+'world/',here=root+'terrain-adaptive/v1/';
  const request:typeof fetch=async(url,init)=>{
   try{return await fetcher(url,{...init,signal:AbortSignal.timeout(deadline)});}
   catch(e){if(e instanceof DOMException&&(e.name==='AbortError'||e.name==='TimeoutError'))throw new TypeError('Terrain stream interrupted',{cause:e});throw e;}
  };
  try{
   const [m,g]=await Promise.all([request(here+'index.json'),request(root+'woodland/hedgerows-v1/index.json')]);
   if(!m.ok||!g.ok||Number(m.headers.get('content-length'))>196_608||
      Number(g.headers.get('content-length'))>196_608)return;
   const [body,hedgeBody]=await Promise.all([m.arrayBuffer(),g.arrayBuffer()]);
   if(body.byteLength>196_608||hedgeBody.byteLength>196_608||await hash(body)!==indexHash)return;
   const raw=JSON.parse(new TextDecoder().decode(body)) as Plan,hedges=await hash(hedgeBody);
   if(!validReliefPlan(raw,{...source,hedges}))return;
   return new ReliefPacks(here,raw,request);
  }catch{return;}
 }
 has(id:string){return this.entries.has(id);}
 async load(id:string){
  const e=this.entries.get(id);if(!e)return;
  const zip=await this.packs[e.pack].read(e.offset,e.bytes);
  if(await hash(zip)!==e.archiveSha256)throw Error('Terrain seed archive checksum failed');
  const raw=await unpackGzip(zip);
  if(await hash(raw)!==e.sha256)throw Error('Terrain seed checksum failed');
  return new ReliefSeed(raw,true,e.cells);
 }
}
