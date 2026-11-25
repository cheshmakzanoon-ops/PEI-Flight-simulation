import * as T from 'three';
import {MarshRootField} from './marsh-root-field.ts';
import {marshPatches} from './marsh-patches.generated.ts';
import {CONFEDERATION_TRAIL} from './confederation-trail.generated.ts';
import {DUNE_GRASS_AUTHORITY} from './dune-grass-authority.generated.ts';
import {DUNE_SAND_MASK} from './dune-sand-pins.generated.ts';
import {verifyDecodedCover} from '../sim/cover-proof.ts';
import {unpackGzip} from '../sim/compression.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';
import type {Cover} from '../sim/cover.ts';

type Mask=typeof marshPatches[number];
const zero=new T.DataTexture(new Uint8Array([0]),1,1,T.RedFormat);zero.needsUpdate=true;
const sha=(a:ArrayBuffer)=>crypto.subtle.digest('SHA-256',a).then(v=>
 Array.from(new Uint8Array(v),n=>n.toString(16).padStart(2,'0')).join(''));
async function protectedReceiversMatch(){
 const grass:string=DUNE_GRASS_AUTHORITY.sha256,trail:string=CONFEDERATION_TRAIL.sha256;
 if(grass!=='a359c8410a93846f57188084b362bccdd8cbaae9143bcf19b4084284ccc1b1aa'||
    trail!=='2848f6ba638caaaa7bcd9d355289aa6712e05148a433f57335eaa4d3639da1ab')return false;
 const sand=DUNE_SAND_MASK.variants.map(v=>v.tile.join('-')+':'+v.decodedSha).join('\n');
 return await sha(new TextEncoder().encode(sand).buffer)==='8bcdf2f51961ced437bb4beda7d63e1e9fe22ffa5cdd2d96eac26fe3d9ad3db0';
}
async function read(base:string,s:Mask){
 const signal=AbortSignal.timeout(6000);
 const res=await fetch(base+'world/coastal-marsh/'+s.id+'.red.gz',{signal});
 if(!res.ok||!res.body||Number(res.headers.get('Content-Length'))>Math.max(s.compressed,s.decoded))throw Error('Missing marsh mask');
 const wire=new Uint8Array(Math.max(s.compressed,s.decoded));const reader=res.body.getReader();let n=0;
 try{for(;;){const q=await reader.read();if(q.done)break;
  if(n+q.value.length>wire.length)throw Error('Marsh mask exceeds expected length');
  wire.set(q.value,n);n+=q.value.length;}}
 finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
 const body=wire.buffer.slice(0,n),compressed=wire[0]===0x1f&&wire[1]===0x8b;
 if(compressed&&(n!==s.compressed||await sha(body)!==s.sha256))throw Error('Unknown marsh mask wire');
 const raw=compressed?await unpackGzip(body):body;
 if(raw.byteLength!==s.decoded||await sha(raw)!==s.decodedSha||signal.aborted)throw Error('Unknown marsh mask cells');
 const t=new T.DataTexture(new Uint8Array(raw),s.width,s.height,T.RedFormat,T.UnsignedByteType);
 t.minFilter=t.magFilter=T.LinearFilter;
 t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.name=s.id+' classified marsh footprint';t.needsUpdate=true;
 return t;
}
export class MarshStream{
 private proof?:Promise<boolean>;
 private since=-Infinity;
 private admitted=false;
 private readonly rows=marshPatches.map(s=>{
  const [x,z]=s.origin;return {s,u:{marshMap:{value:zero},marshGain:{value:0},
    marshBounds:{value:new T.Vector4(x,z,x+s.step*s.width,z+s.step*s.height)}},
    state:'idle' as 'idle'|'loading'|'ready'|'failed',fade:-Infinity,field:undefined as MarshRootField|undefined};
 });
 constructor(private base:string,private cover:Cover){}
 permit(ok:boolean){this.admitted=ok;}
 uniforms(x0:number,z0:number,x1:number,z1:number){
  return this.rows.find(a=>{const b=a.u.marshBounds.value;return b.x<x1&&b.z>x0&&b.y<z1&&b.w>z0;})?.u;
 }
 update(pos:T.Vector3,aboveGround:()=>number,clock:number){
  let agl:number|undefined;
  for(const r of this.rows){
   if(r.state==='ready'){
    r.u.marshGain.value=Math.min(1,Math.max(0,(clock-r.fade)/.30));continue;
   }
   if(r.state!=='idle'||!this.admitted)continue;
   const b=r.u.marshBounds.value;
   if(Math.hypot(Math.max(0,b.x-pos.x,pos.x-b.z),Math.max(0,b.y-pos.z,pos.z-b.w))>275)continue;
   agl??=aboveGround();
   if(!Number.isFinite(agl)||agl>=145)continue;
   r.state='loading';
   this.proof??=Promise.all([verifyDecodedCover(this.cover),protectedReceiversMatch()]).then(([s,other])=>other&&s===CANOPY_FENCE.pins.coverDecoded).catch(()=>false);
   void this.proof.then(async ok=>{
    if(!ok)throw Error('Marsh provenance changed');
    const art=await read(this.base,r.s);
    try{
     const field=new MarshRootField(r.s,art.image.data as Uint8Array);
     r.field=field;r.u.marshMap.value=art;r.fade=this.since;r.state='ready';
    }catch(e){art.dispose();throw e;}

   }).catch(()=>{r.state='failed';});
  }
  this.since=clock;
 }
 nearestField(x:number,z:number,range=110){
  let best=range;
  let result:{id:string;field:MarshRootField}|undefined;
  for(const r of this.rows){
   if(!r.field||r.state!=='ready')continue;
   const b=r.u.marshBounds.value,d=Math.hypot(Math.max(0,b.x-x,x-b.z),Math.max(0,b.y-z,z-b.w));
   if(d<best){best=d;result={id:r.s.id,field:r.field};}
  }return result;
 }
 diagnostics(){return this.rows.map(r=>({id:r.s.id,state:r.state,gain:r.u.marshGain.value}));}
}
