import * as THREE from 'three';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import {boundedPackedBody} from '../sim/packed-bytes.ts';
import {project} from '../sim/geo.ts';
import {BASIN_SCAN} from './basin-head-scan-pin.generated.ts';
import {BASIN_SAND} from './basin-head-sand-pin.generated.ts';

const [west,north,east,south]=BASIN_SAND.bounds;
const a=project(west,north),b=project(east,south);
// Outward-rounded envelope of every nonzero admitted texel. Demand only.
const BASIN_DEMAND=[83709.60,11681.17,85980.51,13719.14] as const;
export const BASIN_SAND_BOUNDS=[a.x,a.z,b.x,b.z] as const;
export function basinSandIntersects(x0:number,z0:number,x1:number,z1:number){
 return x0<b.x&&x1>a.x&&z0<b.z&&z1>a.z;
}
export async function loadBasinSand(base:string,fetcher:typeof fetch=fetch){
 const load=(stamp:typeof BASIN_SCAN|typeof BASIN_SAND)=>readCoastalPack(base+stamp.asset,fetcher,1800,stamp,b=>b);
 const [raw,scan]=await Promise.all([load(BASIN_SAND),load(BASIN_SCAN)]);
 if(!raw||!scan)return;
 return basinTextures(raw,scan);
}
function basinTextures(raw:ArrayBuffer,scan:ArrayBuffer){
 const data=new Uint8Array(raw);
 const map=new THREE.DataTexture(data,BASIN_SAND.width,BASIN_SAND.height,THREE.RGFormat);
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.needsUpdate=true;
 const detail=new THREE.DataTexture(new Uint8Array(scan),BASIN_SCAN.width,BASIN_SCAN.height,THREE.RGBAFormat);
 detail.magFilter=THREE.LinearFilter;detail.minFilter=THREE.LinearMipmapLinearFilter;
 detail.wrapS=detail.wrapT=THREE.RepeatWrapping;detail.generateMipmaps=true;detail.anisotropy=4;detail.needsUpdate=true;
 return {basinSandGain:{value:1},basinSandScan:{value:detail},basinSandMap:{value:map},basinSandBox:{value:new THREE.Vector4(a.x,a.z,1/(b.x-a.x),1/(b.z-a.z))}};
}
export type BasinSand=Awaited<ReturnType<typeof loadBasinSand>>;

const basinDigest=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),
 v=>v.toString(16).padStart(2,'0')).join('');
/** Ordinary signed inputs accept only the shipped wire or its exact HTTP
 * decoded form. Bound both response and decompression, even on failure. */
async function strictBasinBody(base:string,stamp:typeof BASIN_SCAN|typeof BASIN_SAND,get:typeof fetch,ms:number){
 if(!globalThis.crypto?.subtle)return;
 const ctl=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined;
 const read=async()=>{
  const r=await get(base+stamp.asset,{signal:ctl.signal,redirect:'error'});
  const count=r.headers.get('content-length');
  if(ctl.signal.aborted||r.status!==200||r.redirected||r.headers.has('content-range')||
     (count!==null&&count!==String(stamp.bytes)&&count!==String(stamp.decodedBytes))){
   void r.body?.cancel().catch(()=>{});return;
  }
  let body=await boundedPackedBody(r.body,stamp.decodedBytes);
  if(ctl.signal.aborted)return;
  if(body.byteLength===stamp.bytes){
   if(await basinDigest(body)!==stamp.compressedSha256||ctl.signal.aborted)return;
   body=await boundedPackedBody(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip')),stamp.decodedBytes);
  }
  if(body.byteLength!==stamp.decodedBytes||await basinDigest(body)!==stamp.sha256||ctl.signal.aborted)return;
  return body;
 };
 try{
  return await Promise.race([read(),new Promise<undefined>(done=>{
   timer=setTimeout(()=>{ctl.abort();done(undefined);},ms);
  })]);
 }catch{return;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
export async function loadStandardBasinSand(base:string,get:typeof fetch=fetch,ms=1800){
 const [raw,scan]=await Promise.all([strictBasinBody(base,BASIN_SAND,get,ms),strictBasinBody(base,BASIN_SCAN,get,ms)]);
 return raw&&scan?basinTextures(raw,scan):undefined;
}

/** The normal landscape has a zero-gain placeholder at just this existing
 * output scope. Authenticated late data changes uniforms, not terrain. */
export class StandardBasinSand {
 private mode:'cold'|'checking'|'qualified'|'loading'|'ready'|'stock'='cold';
 private verify?:()=>Promise<boolean>;
 private asset:NonNullable<BasinSand>|undefined;
 private inRange=false;private since=Infinity;private requests=0;
 private readonly empty=new THREE.DataTexture(new Uint8Array([0,0]),1,1,THREE.RGFormat);
 readonly uniforms:NonNullable<BasinSand>;
 private readonly base:string;private readonly get:typeof fetch;
 constructor(base:string,get:typeof fetch=fetch){
  this.base=base;this.get=get;
  this.empty.needsUpdate=true;
  this.uniforms={basinSandGain:{value:0},basinSandScan:{value:this.empty},basinSandMap:{value:this.empty},
   basinSandBox:{value:new THREE.Vector4(a.x,a.z,1/(b.x-a.x),1/(b.z-a.z))}};
 }
 permit(verify:()=>Promise<boolean>){if(this.mode==='cold'&&!this.verify)this.verify=verify;}
 get state(){return {proof:this.mode,requests:this.requests,active:this.uniforms.basinSandGain.value>0};}
 update(x:number,y:number,z:number,now=performance.now()){
  const [l,n,e,s]=BASIN_DEMAND,dx=Math.max(l-x,0,x-e),dz=Math.max(n-z,0,z-s),r=this.inRange?2130:1740;
  this.inRange=Number.isFinite(now)&&y> -8&&y<(this.inRange?410:360)&&dx*dx+dz*dz<r*r;
  if(!this.inRange){this.uniforms.basinSandGain.value=0;this.since=Infinity;return;}
  if(this.mode==='cold'&&this.verify){
   const prove=this.verify;this.verify=undefined;this.mode='checking';
   void Promise.resolve().then(prove).then(valid=>{this.mode=valid?'qualified':'stock';},()=>{this.mode='stock';});
   return;
  }
  if(this.mode==='qualified'){
   this.mode='loading';this.requests++;
   void loadStandardBasinSand(this.base,this.get).then(pack=>{
    this.asset=pack;this.mode=pack?'ready':'stock';
   },()=>{this.mode='stock';});
   return;
  }
  if(!this.asset)return;
  if(this.since===Infinity){
   this.since=now;
   this.uniforms.basinSandScan.value=this.asset.basinSandScan.value;
   this.uniforms.basinSandMap.value=this.asset.basinSandMap.value;
  }
  const t=Math.max(0,Math.min(1,(now-this.since)/390));
  const v=Math.max(0,Math.min(1,(395-y)/110));
  this.uniforms.basinSandGain.value=t*t*(3-2*t)*v*v*(3-2*v);
 }
}


export const basinSandGLSL=`
uniform sampler2D basinSandMap,basinSandScan;
uniform vec4 basinSandBox;uniform float basinSandGain;
vec3 basinSand(vec3 col,vec3 p,vec3 n,float coast,float d){
 if(basinSandGain<=0.)return col;
 vec2 uv=(p.xz-basinSandBox.xy)*basinSandBox.zw;
 vec2 dx=dFdx(uv),dy=dFdy(uv);
 mat2 orient=mat2(.830,-.557,.557,.830);
 vec2 sandUV=orient*(p.xz/30.);
 vec2 gdx=dFdx(sandUV),gdy=dFdy(sandUV);
 float px=max(length(dFdx(p.xz)),length(dFdy(p.xz)));
 float gate=smoothstep(.77,.94,n.y)*(1.-smoothstep(5.8,10.2,p.y))
   *(1.-smoothstep(29.,74.,coast))*(1.-smoothstep(600.,1450.,d));
 if(gate<=0.||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return col;
 // Mipmaps are for smooth strength only. Never promote another WorldCover
 // class/water into mapped exposed sand across a bilinear or mip footprint.
 vec2 dims=vec2(textureSize(basinSandMap,0)),cell=uv*dims;
 ivec2 pixel=ivec2(cell);
 vec2 attributeAt=texelFetch(basinSandMap,pixel,0).rg;
 if(attributeAt.r<=0.)return col;
 float valid=textureGrad(basinSandMap,uv,dx,dy).r;
 if(valid<.002)return col;
 int flags=int(attributeAt.g*255.+.5);
 vec2 metres=1./(dims*basinSandBox.zw),low=fract(cell)*metres,high=metres-low;
 float nearest=min(metres.x,metres.y);
 if((flags&1)!=0)nearest=min(nearest,low.y);
 if((flags&2)!=0)nearest=min(nearest,high.x);
 if((flags&4)!=0)nearest=min(nearest,high.y);
 if((flags&8)!=0)nearest=min(nearest,low.x);
 if((flags&16)!=0)nearest=min(nearest,length(vec2(high.x,low.y)));
 if((flags&32)!=0)nearest=min(nearest,length(high));
 if((flags&64)!=0)nearest=min(nearest,length(vec2(low.x,high.y)));
 if((flags&128)!=0)nearest=min(nearest,length(low));
 // Continuous feather to exact zero inside open loose-sand cells; no
 // painted 10m zig-zag or support spilling into adjacent grass/water.
 valid*=smoothstep(0.,min(6.1,min(metres.x,metres.y)),nearest);
 // Site documented as pale silica sand; these are original art values, not a BRDF survey.
 float dry=smoothstep(1.3,6.5,coast+.48*noise(p.xz*.091));
 float broad=noise(p.xz*.067);
 vec3 pale=mix(vec3(.282,.236,.173),vec3(.520,.478,.390),dry);
 float grain=mix(.5,noise(p.xz*3.8),1.-smoothstep(.10,.48,px));
 // Derivative-filtered scan relief and original fine grain, no displacement.
 // Change only the optical appearance of existing sandy land.
 vec4 scan=textureGrad(basinSandScan,sandUV,gdx,gdy);
 float relief=1.-smoothstep(.22,.95,px);
 vec2 slope=transpose(orient)*(scan.gb*2.-1.);
 vec3 micro=normalize(n+vec3(slope.x,0.,slope.y)*relief*.42);
 float light=max(0.,dot(micro,sun))-max(0.,dot(n,sun));
 pale*=.94+.10*broad+.075*(grain-.5)+.32*(scan.r-.50)+relief*(.34*light-.063*(1.-scan.a));
 return mix(col,pale,min(1.,valid*1.13)*gate*.90*basinSandGain);
}
`;
