import * as THREE from 'three';
import {GABLES_FAIRWAY as S} from './gables-fairway.generated.ts';
import {gablesGravelAtlasMatches,gablesGravelGeometryMatches} from './gables-gravel.ts';

export const fairwayAtlasMatches=gablesGravelAtlasMatches;
export const fairwayGeometryMatches=gablesGravelGeometryMatches;

export class GablesFairway{
 readonly map:THREE.DataTexture;
 readonly bytes:Uint8Array;
 readonly strength={value:0};
 readonly bounds=[S.left,S.top,S.left+S.width*S.step,S.top+S.height*S.step] as const;
 readonly rect={value:new THREE.Vector4(S.left,S.top,1/(S.width*S.step),1/(S.height*S.step))};
 constructor(bytes:Uint8Array){
  this.bytes=bytes;
  if(bytes.length!==S.rawBytes)throw Error('Invalid fairway footprint');
  for(let i=0;i<S.width;i++)if(bytes[i]||bytes[(S.height-1)*S.width+i])throw Error('Fairway leaves the horizontal reserve');
  for(let i=0;i<S.height;i++)if(bytes[i*S.width]||bytes[(i+1)*S.width-1])throw Error('Fairway leaves the vertical reserve');
  this.map=new THREE.DataTexture(bytes,S.width,S.height,THREE.RedFormat);
  this.map.minFilter=this.map.magFilter=THREE.LinearFilter;this.map.generateMipmaps=false;
  this.map.unpackAlignment=1;this.map.needsUpdate=true;
 }
 intersects(x:number,z:number,a:number,b:number){
  const [l,t,r,q]=this.bounds;
  return x<=r&&a>=l&&z<=q&&b>=t;
 }
 uniforms(){return {fairwaySource:{value:this.map},fairwayRect:this.rect,fairwayStrength:this.strength};}
}
async function small(stream:ReadableStream<Uint8Array>|null){
 if(!stream)return;
 const reader=stream.getReader(),buf=new Uint8Array(S.rawBytes);
 let at=0;
 try{
  for(;;){
   const r=await reader.read();
   if(r.done)return at===buf.length?buf.buffer:buf.buffer.slice(0,at);
   if(r.value.byteLength>buf.length-at)return;
   buf.set(r.value,at);at+=r.value.byteLength;
  }
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
const digest=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
export async function loadGablesFairway(base:string,request:typeof fetch=fetch,timeout=1300){
 if(!globalThis.crypto?.subtle)return;
 const ctrl=new AbortController(),signal=ctrl.signal;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const read=async()=>{
  const res=await request(base+S.file,{signal});
  if(res.status!==200||signal.aborted){void res.body?.cancel().catch(()=>{});return;}
  let bytes=await small(res.body);
  if(!bytes||signal.aborted)return;
  if(bytes.byteLength===S.wireBytes){
   if(await digest(bytes)!==S.wireSha||signal.aborted)return;
   bytes=await small(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  }
  if(!bytes||bytes.byteLength!==S.rawBytes||await digest(bytes)!==S.rawSha||signal.aborted)return;
  return new GablesFairway(new Uint8Array(bytes));
 };
 try{return await Promise.race([read(),new Promise<undefined>(done=>{
  timer=setTimeout(()=>{ctrl.abort();done(undefined);},timeout);
 })]);}
 catch{return undefined;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
export const gablesFairwayGLSL=/*glsl*/`
uniform sampler2D fairwaySource;
uniform vec4 fairwayRect;
uniform float fairwayStrength;
void paintGablesFairway(inout vec3 col,vec3 p,float d){
 if(fairwayStrength<=0.||d>460.)return;
 vec2 q=(p.xz-fairwayRect.xy)*fairwayRect.zw;
 if(any(lessThan(q,vec2(0.)))||any(greaterThanEqual(q,vec2(1.))))return;
 float allow=texture2D(fairwaySource,q).r*(1.-smoothstep(205.,460.,d));
 if(allow<.001)return;
 // Chroma from the repeated observed vegetation envelope. Visual grain
 // and wear are authored, never source images, mowing, or individual blades.
 const vec3 luma=vec3(.213,.715,.072);
 vec2 metres=p.xz-fairwayRect.xy;
 vec3 grass=vec3(.052,.078,.039);
 float base=dot(col,luma),meaning=dot(grass,luma);
 float outputLight=mix(base,meaning,.32);
 vec3 hue=normalize(grass)*outputLight/dot(normalize(grass),luma);
 float wear=noise(metres*.31+vec2(4.11,7.04));
 float small=(noise(metres*7.1)-.5)*(1.-smoothstep(54.,120.,d));
 hue*=mix(.94,1.056,wear);
 hue+=small*vec3(.015,.021,.012);
 col=mix(col,hue,allow*.68*fairwayStrength);
}
`;
