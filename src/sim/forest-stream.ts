import {clamp,project} from './geo.ts';
import {PackedBytes} from './packed-bytes.ts';
import {unpackGzip} from './compression.ts';

const bounds=[-64.47,45.94,-61.93,47.1] as const;
const [west,south,east,north]=bounds;
const nw=project(west,north), se=project(east,south);
const cols=32,rows=22,res=320,border=2,stored=res+2*border,rasterBytes=stored**2;
const dx=(se.x-nw.x)/cols,dz=(se.z-nw.z)/rows;
const maxMemoryTiles=26,maxInflight=2,prefetchRadius=13300;

interface Chunk {id:string;pack:number;offset:number;bytes:number;decodedBytes:number;sha256:string;}
interface PackPlan {file:string;bytes:number;}
interface Index {bounds:number[];cols:number;rows:number;tileInterior:number;tileBorder:number;bytes:number;packs:PackPlan[];tiles:Chunk[];}
type Tile = Chunk & {i:number;j:number;cx:number;cz:number;};

function validIndex(m:Index){
 if(!m||m.cols!==cols||m.rows!==rows||
    m.tileInterior!==res||m.tileBorder!==border||!Array.isArray(m.bounds)||m.bounds.length!==4||
    !m.bounds.every((v,i)=>v===bounds[i])||!Array.isArray(m.tiles)||
    !Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>12*1024*1024)return false;
 if(!Array.isArray(m.packs)||!m.packs.length||m.packs.length>24||
    m.packs.some((p,i)=>!p||p.file!=='heights-'+String(i).padStart(2,'0')+'.pack'||
        !Number.isSafeInteger(p.bytes)||p.bytes<=0||p.bytes>560000)||
    m.packs.reduce((sum,p)=>sum+p.bytes,0)!==m.bytes)return false;
 const offsets=m.packs.map(()=>0);const ids=new Set<string>();
 for(const v of m.tiles){
  if(!v||!/^[0-9]{1,2}-[0-9]{1,2}$/.test(v.id)||ids.has(v.id))return false;
  const [i,j]=v.id.split('-').map(Number);
  if(i>=cols||j>=rows||v.id!==i+'-'+j||!Number.isInteger(v.pack)||v.pack<0||v.pack>=m.packs.length||
     v.offset!==offsets[v.pack]||!Number.isSafeInteger(v.bytes)||v.bytes<=0||
     v.offset+v.bytes>m.packs[v.pack].bytes||
     v.decodedBytes!==rasterBytes||!/^[a-f0-9]{64}$/.test(v.sha256))return false;
  offsets[v.pack]+=v.bytes;ids.add(v.id);
 }
 return offsets.every((off,i)=>off===m.packs[i].bytes);
}
export class ForestStream {
 private packs:PackedBytes[]=[];
 private readonly tiles=new Map<string,Tile>();
 private readonly loaded=new Map<string,Uint8Array>();
 private readonly inflight=new Map<string,Promise<void>>();
 private readonly failed=new Set<string>();
 private missing=false;
 private readonly catalogue:Promise<void>;
 private x=Infinity;private z=Infinity;
 constructor(base:string,fetcher:typeof fetch=fetch){
  this.catalogue=(async()=>{
   try{
    const path=base+'world/woodland/stream-v1/';
    const req:typeof fetch=(url,init)=>fetcher(url,{...init,signal:AbortSignal.timeout(6500)});
    const r=await req(path+'index.json');
    if(!r.ok)throw Error('Stand-height catalogue unavailable');
    const m=await r.json() as Index;
    if(!validIndex(m))throw Error('Invalid stand-height catalogue');
    this.packs=m.packs.map(p=>new PackedBytes(path+p.file,p.bytes,req));
    for(const t of m.tiles){
     const [i,j]=t.id.split('-').map(Number);
     this.tiles.set(t.id,{...t,i,j,cx:nw.x+(i+.5)*dx,cz:nw.z+(j+.5)*dz});
    }
   }catch{this.missing=true;}
  })();
 }
 get state(){
  const active=Math.floor((this.x-nw.x)/dx)+'-'+Math.floor((this.z-nw.z)/dz);
  return {missing:this.missing,inflight:this.inflight.size,resident:this.loaded.size,failed:this.failed.size,
    active,activeReady:this.loaded.has(active)};
 }
 update(x:number,z:number){
  this.x=x;this.z=z;
  if(!this.packs.length||this.missing)return;
  this.schedule();
 }
 async warm(x:number,z:number,ms=1650){
  this.x=x;this.z=z;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([(async()=>{
   await this.catalogue;
   if(this.missing)return;
   this.schedule();
   const i=Math.floor((x-nw.x)/dx),j=Math.floor((z-nw.z)/dz);
   await this.inflight.get(i+'-'+j);
  })(),new Promise<void>(resolve=>timer=setTimeout(resolve,ms))]);}
  finally{if(timer!==undefined)clearTimeout(timer);}
 }
 private schedule(){
  const near=[...this.tiles.values()].map(t=>({t,d:Math.hypot(this.x-t.cx,this.z-t.cz)}))
    .filter(t=>t.d<prefetchRadius).sort((a,b)=>a.d-b.d).slice(0,maxMemoryTiles);
  const wanted=new Set(near.map(({t})=>t.id));
  for(const id of this.loaded.keys())if(!wanted.has(id))this.loaded.delete(id);
  for(const {t} of near){
   if(this.inflight.size>=maxInflight)break;
   if(this.loaded.has(t.id)||this.inflight.has(t.id)||this.failed.has(t.id))continue;
   const p=this.load(t).finally(()=>{this.inflight.delete(t.id);this.schedule();});
   this.inflight.set(t.id,p);
  }
 }
 private async load(t:Tile){
  try{
   const packed=await this.packs[t.pack].read(t.offset,t.bytes),raw=await unpackGzip(packed);
   if(raw.byteLength!==rasterBytes)throw Error('Bad woodland tile length');
   if(globalThis.crypto?.subtle){
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
    if(Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==t.sha256)throw Error('Bad woodland tile hash');
   }
   if(Math.hypot(this.x-t.cx,this.z-t.cz)<prefetchRadius)this.loaded.set(t.id,new Uint8Array(raw));
  }catch{this.failed.add(t.id);}
 }
 /** Keep undecoded, outside and unsupported parts on the original visual path. */
 height(x:number,z:number,fallback:number,variation:number){
  const u=(x-nw.x)/dx,v=(z-nw.z)/dz;
  if(u<0||v<0||u>=cols||v>=rows)return fallback;
  const i=Math.floor(u),j=Math.floor(v),a=this.loaded.get(i+'-'+j);
  if(!a)return fallback;
  const wx=border-.5+res*(u-i),wz=border-.5+res*(v-j);
  const bx=Math.floor(wx),bz=Math.floor(wz),f=wx-bx,g=wz-bz;
  const k=bz*stored+bx,p=a[k],q=a[k+1],r=a[k+stored],s=a[k+stored+1];
  if(!p||!q||!r||!s)return fallback;
  const stand=((1-g)*(p*(1-f)+q*f)+g*(r*(1-f)+s*f))*.5;
  return clamp(stand*(.84+.26*variation),2.6,30);
 }
}
