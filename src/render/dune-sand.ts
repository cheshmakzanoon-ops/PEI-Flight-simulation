import * as T from 'three';
import {DUNE_SAND_MASK as MASK,DUNE_SAND_PHOTO as PHOTO} from './dune-sand-pins.generated.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';

type Tile=typeof MASK.variants[number];
const folder='dune-sand/v1/',radius=218;
const key=(i:number,j:number)=>i+'-'+j;
const transparent=new T.DataTexture(new Uint8Array([0]),1,1,T.RedFormat);
transparent.needsUpdate=true;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(x,b));
const sha=(b:ArrayBuffer)=>crypto.subtle.digest('SHA-256',b).then(q=>Array.from(new Uint8Array(q),h=>h.toString(16).padStart(2,'0')).join(''));
export function duneSandAtlas(terrain?:string,cover?:string){
 const p=CANOPY_FENCE.pins;
 return terrain===p.terrain&&cover===p.cover;
}
export function duneSandSources(terrain?:string,cover?:string,coverDecoded?:string){
 return duneSandAtlas(terrain,cover)&&coverDecoded===CANOPY_FENCE.pins.coverDecoded;
}
export function duneSandOverlays(road?:string,building?:string,paths?:string,lots?:string){
 const p=CANOPY_FENCE.pins;
 return road===p.road&&building===p.buildings&&paths===p.sidewalk&&lots===p.parking;
}
async function exact(stream:ReadableStream<Uint8Array>|null,cap:number){
 if(!stream)return undefined;
 const r=stream.getReader(),data=new Uint8Array(cap);
 let n=0;
 try{
  for(;;){
   const a=await r.read();
   if(a.done)return data.buffer.slice(0,n);
   if(n+a.value.length>cap)return;
   data.set(a.value,n);n+=a.value.length;
  }
 }finally{void r.cancel().catch(()=>{});r.releaseLock();}
}
export async function duneMaskBytes(stamp:Tile,base:string,get:typeof fetch=fetch){
 if(!globalThis.crypto?.subtle||stamp.decoded>1_000_000)return;
 const signal=AbortSignal.timeout(2600);
 try{
  const res=await get(base+folder+stamp.file,{signal});
  if(res.status!==200){void res.body?.cancel().catch(()=>{});return;}
  let b=await exact(res.body,stamp.decoded);
  if(!b||signal.aborted)return;
  if(b.byteLength===stamp.wire){
   if(await sha(b)!==stamp.wireSha)return;
   b=await exact(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')),stamp.decoded);
  }
  if(!b||b.byteLength!==stamp.decoded||signal.aborted||await sha(b)!==stamp.decodedSha||signal.aborted)return;
  const d=new DataView(b);
  if(d.getUint32(0)!==0x534e4431||d.getInt32(4,true)!==stamp.offset[0]||d.getInt32(8,true)!==stamp.offset[1]||
     d.getUint16(12,true)!==stamp.size[0]||d.getUint16(14,true)!==stamp.size[1]||
     d.getUint16(16,true)!==stamp.tile[0]||d.getUint16(18,true)!==stamp.tile[1]||
     20+stamp.size[0]*stamp.size[1]!==b.byteLength)return;
  return new Uint8Array(b,20);
 }catch{return;}
}
async function photo(spec:typeof PHOTO[number],base:string,get:typeof fetch){
 if(!globalThis.createImageBitmap||!globalThis.crypto?.subtle)return;
 const signal=AbortSignal.timeout(2800);
 try{
  const r=await get(base+folder+spec.payload,{signal});
  if(r.status!==200){void r.body?.cancel().catch(()=>{});return;}
  const b=await exact(r.body,spec.size);
  if(!b||b.byteLength!==spec.size||signal.aborted||await sha(b)!==spec.sha||signal.aborted)return;
  const bitmap=await createImageBitmap(new Blob([b],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  if(bitmap.width!==spec.pixels||bitmap.height!==spec.pixels||signal.aborted){bitmap.close();return;}
  const t=new T.Texture(bitmap);t.name='Dry dune '+spec.style;
  t.colorSpace=T.NoColorSpace;t.flipY=false;t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;
  t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;t.needsUpdate=true;return t;
 }catch{return;}
}
type Row={stamp:Tile,live:boolean,loaded?:T.DataTexture,task?:Promise<void>,failed:boolean,
 uniforms:{duneMask:{value:T.Texture},duneBox:{value:T.Vector4},duneResident:{value:number},
 duneMicro:{value:T.Texture},duneMacro:{value:T.Texture}}};
export class DuneSand{
 readonly shader=duneSandGLSL;
 readonly rows=new Map<string,Row>();
 private base:string;private get:typeof fetch;
 private approved=false;private seenX=Infinity;private seenZ=Infinity;
 private proof?:()=>Promise<boolean>;
 private proofX=Infinity;private proofZ=Infinity;private proofStarted=false;
 private grain?:Promise<readonly [T.Texture,T.Texture]|undefined>;
 private frames=0;
 private current=new Set<Row>();
 constructor(base:string,get:typeof fetch=fetch){
  this.base=base;this.get=get;
  for(const s of MASK.variants){
   const u={duneBox:{value:new T.Vector4(s.outputOrigin[0],s.outputOrigin[1],s.size[0]*5,s.size[1]*5)},
    duneMask:{value:transparent as T.Texture},duneResident:{value:0},duneMicro:{value:transparent as T.Texture},duneMacro:{value:transparent as T.Texture}};
   this.rows.set(key(s.tile[0],s.tile[1]),{stamp:s,live:false,failed:false,uniforms:u});
  }
 }
 readonly allow=()=>{this.approved=true;};
 /** Qualify locally; no cover work or surface downloads at a distant start. */
 certifyNear(check:()=>Promise<boolean>){if(!this.approved&&!this.proofStarted&&!this.proof)this.proof=check;}
 uniforms(i:number,j:number){return this.rows.get(key(i,j))?.uniforms;}
 note(){
  return {approved:this.approved,active:Array.from(this.current).filter(r=>r.uniforms.duneResident.value===1).map(r=>r.stamp.tile),
   pending:Array.from(this.current).filter(r=>r.task).length,failed:Array.from(this.current).filter(r=>r.failed).length};
 }
 private async source(){
  const [a,b]=await Promise.all([photo(PHOTO[0],this.base,this.get),photo(PHOTO[1],this.base,this.get)]);
  if(a&&b)return [a,b] as const;
  for(const q of [a,b])if(q){q.dispose();(q.image as ImageBitmap).close();}
 }
 private load(r:Row){
  r.task=(async()=>{
   const [b,t]=await Promise.all([duneMaskBytes(r.stamp,this.base,this.get),this.grain??=this.source()]);
   if(!b||!t){r.failed=true;return;}
   // The camera may leave this atlas bounds while the blob is in flight.
   if(!r.live)return;
   const s=r.stamp,m=new T.DataTexture(b,s.size[0],s.size[1],T.RedFormat,T.UnsignedByteType);
   m.minFilter=m.magFilter=T.LinearFilter;m.generateMipmaps=false;m.unpackAlignment=1;m.needsUpdate=true;
   r.loaded=m;r.uniforms.duneMask.value=m;
   r.uniforms.duneMicro.value=t[0];r.uniforms.duneMacro.value=t[1];r.uniforms.duneResident.value=1;
  })().catch(()=>{r.failed=true;}).finally(()=>{r.task=undefined;});
 }
 update(x:number,z:number,agl:number){
  if(!this.approved){
   if(!this.proof||agl>215||Math.hypot(x-this.proofX,z-this.proofZ)<22)return;
   this.proofX=x;this.proofZ=z;
   for(const row of this.rows.values()){
    const b=row.uniforms.duneBox.value;
    if(Math.hypot(x-clamp(x,b.x,b.x+b.z),z-clamp(z,b.y,b.y+b.w))>=radius)continue;
    const check=this.proof;this.proofStarted=true;this.proof=undefined;
    void Promise.resolve().then(check).then(valid=>{if(valid)this.allow();}).catch(()=>{});
    break;
   }
   return;
  }
  if(agl>215) {
   for(const r of this.current){r.live=false;r.uniforms.duneResident.value=0;}
   this.seenX=Infinity;return;
  }
  if(Math.hypot(x-this.seenX,z-this.seenZ)<22&&this.frames++<45)return;
  this.frames=0;this.seenX=x;this.seenZ=z;
  const range=(r:Row)=>{
   const b=r.uniforms.duneBox.value;
   return Math.hypot(x-clamp(x,b.x,b.x+b.z),z-clamp(z,b.y,b.y+b.w));
  };
  const now=new Set(Array.from(this.rows.values()).map(r=>({r,d:range(r)}))
   .filter(a=>a.d<radius).sort((a,b)=>a.d-b.d).slice(0,3).map(a=>a.r));
  for(const old of this.current)if(!now.has(old)){
   old.live=false;old.loaded?.dispose();old.loaded=undefined;
   old.uniforms.duneMask.value=transparent;old.uniforms.duneResident.value=0;
  }
  this.current=now;
  for(const r of now){
   r.live=true;
   if(r.loaded)r.uniforms.duneResident.value=1;
   else if(!r.task&&!r.failed)this.load(r);
  }
 }
}

export const duneSandGLSL=`
 uniform sampler2D duneMask,duneMicro,duneMacro;
 uniform vec4 duneBox;
 uniform float duneResident;
 void paintDuneSand(inout vec3 col,inout vec3 n,vec3 p,float coast,float distanceM){
  if(duneResident<.5)return;
  vec2 local=p.xz-duneBox.xy;
  vec2 dX=dFdx(local),dY=dFdy(local);
  vec2 UV=local/duneBox.zw;
  if(distanceM>=105.||coast<27.||n.y<.72||p.y<.30||
     any(lessThanEqual(UV,vec2(0.)))||any(greaterThanEqual(UV,vec2(1.))))return;
  float authority=textureLod(duneMask,UV,0.).r;
  if(authority<.002)return;
  float scaleFade=(1.-smoothstep(34.,105.,distanceM))*smoothstep(27.,37.,coast)*smoothstep(.30,.8,p.y)*
                  smoothstep(.72,.91,n.y)*authority;
  if(scaleFade<.001)return;
  vec4 a=textureGrad(duneMacro,local/15.0,dX/15.0,dY/15.0);
  vec4 b=textureGrad(duneMicro,local*.5,dX*.5,dY*.5);
  float fine=(1.-smoothstep(12.,39.,distanceM))*(.57+.43*b.a);
  float detail=(a.b-.5)*.44+(b.b-.5)*fine*.34;
  vec3 oxide=mix(col,vec3(.24,.154,.089),.18*scaleFade);
  col=oxide*(1.+detail*scaleFade);
  vec2 slope=(a.rg-.5)*.30+(b.rg-.5)*fine*.22;
  n=normalize(n+vec3(-slope.x,0.,slope.y)*scaleFade);
 }`;
