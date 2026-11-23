import {clamp,project} from './geo.ts';
import {PackedBytes} from './packed-bytes.ts';
import {unpackGzip} from './compression.ts';

const bounds=[-64.47,45.94,-61.93,47.1] as const;
const [west,south,east,north]=bounds,nw=project(west,north),se=project(east,south);
const cols=32,rows=22,dx=(se.x-nw.x)/cols,dz=(se.z-nw.z)/rows,record=6;
const radius=1820,prefetch=3600,maxDecoded=9,maxInflight=2;
const coastSHA='46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863';
const roadSHA='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1';
const buildingSHA='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557';
const nativeHeightSHA='aff898586dc11d42394b7866651a92d3f95ca1635dc2e8ebb58bf56737ec8b96';
const westCoverSHA='a9ecfc04b044d75d68f5144af3240fa32792c3dcc77e7b429595935c610a80b0';
const eastCoverSHA='54369b33af4459a37ad7eb6529da8fdf0bf7f102337ac760a200076f236cf941';
const cluiSHA='2403859043b620003c9954df37ddaf61296cd1f1f92a8ce9647474ab3621c699';
const isHash=(s:string)=>/^[a-f0-9]{64}$/.test(s);
interface Chunk{ id:string;pack:number;offset:number;bytes:number;count:number;sha256:string }
interface Catalogue{
 version:number; bounds:number[];cols:number;rows:number;recordBytes:number;bytes:number;cluiIDs:string;
 coverSHA256:string;roadsSHA256:string;buildingSHA256:string;
 forestNativeSHA256:string;forestNativeEPSG:number;
 localCoverSHA256:Record<string,string>;
 packs:{file:string;bytes:number;sha256:string}[];tiles:Chunk[];
}
type Tile=Chunk&{x:number;z:number};

export function validHedgeCatalogue(m:Catalogue){
 if(!m||m.version!==1||m.cols!==cols||m.rows!==rows||m.recordBytes!==record||
    !Array.isArray(m.bounds)||m.bounds.length!==4||m.bounds.some((v,i)=>v!==bounds[i])||
    m.coverSHA256!==coastSHA||m.roadsSHA256!==roadSHA||m.buildingSHA256!==buildingSHA||m.cluiIDs!==cluiSHA||
    m.forestNativeSHA256!==nativeHeightSHA||m.forestNativeEPSG!==2954||!m.localCoverSHA256||
    m.localCoverSHA256['N45W066.tif']!==westCoverSHA||m.localCoverSHA256['N45W063.tif']!==eastCoverSHA||
    !Array.isArray(m.packs)||!m.packs.length||m.packs.length>12||
    !Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>5200000||
    !Array.isArray(m.tiles)||!m.tiles.length||m.tiles.length>cols*rows)return false;
 if(m.packs.some((p,i)=>!p||p.file!=='hedge-'+String(i).padStart(2,'0')+'.pack'||!Number.isSafeInteger(p.bytes)||
    p.bytes<=0||p.bytes>535000||!isHash(p.sha256))||m.packs.reduce((n,p)=>n+p.bytes,0)!==m.bytes)return false;
 const positions=m.packs.map(()=>0),ids=new Set<string>();
 for(const t of m.tiles){
  if(!t||!/^\d{1,2}-\d{1,2}$/.test(t.id)||ids.has(t.id))return false;
  const [i,j]=t.id.split('-').map(Number);
  if(i>=cols||j>=rows||t.id!==i+'-'+j||!Number.isInteger(t.pack)||t.pack<0||t.pack>=positions.length||
     t.offset!==positions[t.pack]||!Number.isSafeInteger(t.count)||t.count<=0||t.count>18000||
     !Number.isSafeInteger(t.bytes)||t.bytes<=0||t.bytes+t.offset>m.packs[t.pack].bytes||!isHash(t.sha256))return false;
  positions[t.pack]+=t.bytes;ids.add(t.id);
 }
 return positions.every((n,i)=>m.packs[i].bytes===n);
}
export function decodeHedgeChunk(raw:ArrayBuffer,count:number,ox:number,oz:number){
 if(raw.byteLength!==record*count)throw Error('Invalid hedgerow count');
 const buffer=new DataView(raw),positions=new Float32Array(count*4);
 let last=-1;
 for(let i=0;i<count;i++){
  const u=i*record,qx=buffer.getUint16(u,true),qz=buffer.getUint16(u+2,true),h=buffer.getUint8(u+4),style=buffer.getUint8(u+5),key=qz*65536+qx;
  if(qx>Math.floor(dx*8)||qz>Math.floor(dz*8)||h<8||h>64||style<1||style>3||key<=last)throw Error('Invalid hedgerow support');
  last=key;const j=i*4;
  positions[j]=ox+qx/8;positions[j+1]=oz+qz/8;positions[j+2]=h/4;positions[j+3]=style;
 }
 return positions;
}
export class HedgeStream {
 private readonly loaded=new Map<Tile,Float32Array>();
 private readonly inflight=new Set<Tile>();
 private readonly failed=new Set<Tile>();
 private packs:PackedBytes[]=[]; private tiles:Tile[]=[];
 private x=Infinity;private z=Infinity;
 private version=0;private unavailable=false;
 private hold=Promise.resolve();
 constructor(base:string,fetcher:typeof fetch=fetch){
  this.hold=(async()=>{
   const path=base+'world/woodland/hedgerows-v1/';
   const req:typeof fetch=async(url,init)=>{
    try{return await fetcher(url,{...init,signal:AbortSignal.timeout(8000)});}
    catch(e){
     if(e instanceof DOMException&&(e.name==='TimeoutError'||e.name==='AbortError')){
      throw new TypeError('Optional hedgerow request interrupted',{cause:e});
     }
     throw e;
    }
   };
   try{
    // Decline outdated derived exclusions after replacing any shipped
    // source layer, rather than putting woody art through new roads/roofs.
    const root=base+'world/';
    const read=async(url:string)=>{const r=await req(url);if(!r.ok)throw Error('No hedgerow source');return await r.json();};
    const [m,c,r,b]=await Promise.all([read(path+'index.json'),read(root+'cover.json'),
      read(root+'roads.json'),read(root+'buildings/index.json')]) as [Catalogue,{compressedSha256?:string},{sha256?:string},{sha256?:string}];
    if(!validHedgeCatalogue(m)||c.compressedSha256!==coastSHA||r.sha256!==roadSHA||b.sha256!==buildingSHA)throw Error('Invalid hedgerow source');
    this.packs=m.packs.map(a=>new PackedBytes(path+a.file,a.bytes,req));
    this.tiles=m.tiles.map(t=>{const [i,j]=t.id.split('-').map(Number);return {...t,x:nw.x+i*dx,z:nw.z+j*dz};});
    this.schedule();
   }catch{this.unavailable=true;}
  })();
 }
 get state(){return {revision:this.version,loaded:this.loaded.size,loading:this.inflight.size,failed:this.failed.size,missing:this.unavailable};}
 move(x:number,z:number){
  this.x=x;this.z=z;this.schedule();
 }
 get revision(){return this.version;}
 async settleCatalogue(){await this.hold;}
 draw(x:number,z:number,render:(x:number,z:number,h:number,type:number)=>boolean){
  for(const [a,rows] of this.loaded){
   if(this.distance(a,x,z)>radius)continue;
   for(let j=0;j<rows.length;j+=4){
    const bx=rows[j],bz=rows[j+1];
    if((bx-x)**2+(bz-z)**2<=radius**2&&!render(bx,bz,rows[j+2],rows[j+3]))return;
   }
  }
 }
 private distance(a:Tile,x:number,z:number){
  return Math.hypot(x-clamp(x,a.x,a.x+dx),z-clamp(z,a.z,a.z+dz));
 }
 private schedule(){
  if(!this.packs.length||!Number.isFinite(this.x)||!Number.isFinite(this.z))return;
  const targets=this.tiles.map(a=>({a,d:this.distance(a,this.x,this.z)})).filter(n=>n.d<=prefetch)
   .sort((a,b)=>a.d-b.d).slice(0,maxDecoded);
  const keep=new Set(targets.map(n=>n.a));
  for(const t of this.loaded.keys())if(!keep.has(t)){this.loaded.delete(t);this.version++;}
  for(const {a} of targets){
   if(this.inflight.size>=maxInflight)break;
   if(this.loaded.has(a)||this.inflight.has(a)||this.failed.has(a))continue;
   this.inflight.add(a);void this.load(a).finally(()=>{this.inflight.delete(a);this.schedule();});
  }
 }
 private async load(q:Tile){
  try{
   let bytes:ArrayBuffer;
   try{bytes=await this.packs[q.pack].read(q.offset,q.bytes);}
   catch(e){
    // A timeout while consuming a 206 body can occur after headers; redo
    // that one read once. Invalid bytes, hashes or catalogues remain failures.
    if(!(e instanceof DOMException)||!(e.name==='TimeoutError'||e.name==='AbortError'))throw e;
    bytes=await this.packs[q.pack].read(q.offset,q.bytes);
   }
   const raw=await unpackGzip(bytes);
   if(raw.byteLength!==record*q.count)throw Error('Damaged hedgerow support');
   if(globalThis.crypto?.subtle){
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
    if(Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==q.sha256)throw Error('Hedgerow support checksum failure');
   }
   if(this.distance(q,this.x,this.z)<=prefetch){
    this.loaded.set(q,decodeHedgeChunk(raw,q.count,q.x,q.z));this.version++;
   }
  }catch{this.failed.add(q);}
 }
}
