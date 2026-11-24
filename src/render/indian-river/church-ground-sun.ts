import {DataTexture,LinearFilter,RedFormat,UnsignedByteType,Vector4} from 'three';

export type ChurchSunMask=Readonly<{
 x0:number;z0:number;width:number;height:number;spacing:number;tile:readonly [number,number];
}>;

/** A bounded, original cast mask from the same opaque artwork. Sampling
 * the existing terrain makes placement exact even across interior facets. */
export function churchGroundSun(mask:ChurchSunMask,coverage:Uint8Array){
 const {x0,z0,width,height,spacing,tile}=mask;
 if(![x0,z0,spacing].every(Number.isFinite)||spacing<=0||spacing>.65||
   ![width,height].every(n=>Number.isInteger(n)&&n>=8&&n<=288)||coverage.length!==width*height)return;
 for(let x=0;x<width;x++)if(coverage[x]||coverage[x+(height-1)*width])return;
 for(let z=0;z<height;z++)if(coverage[z*width]||coverage[z*width+width-1])return;
 const texture=new DataTexture(coverage,width,height,RedFormat,UnsignedByteType);
 texture.minFilter=texture.magFilter=LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
 const live={value:0};
 return {tile,live,uniforms:{churchSunMask:{value:texture},churchSunLive:live,
   churchSunBox:{value:new Vector4(x0-.5*spacing,z0-.5*spacing,width*spacing,height*spacing)}}};
}
export type ChurchGroundSun=NonNullable<ReturnType<typeof churchGroundSun>>;
type ChurchSunAsset=ChurchSunMask & Readonly<{maskSha:string;wireSha:string;wireBytes:number;rawBytes:number;file:string}>;
async function readMask(stream:ReadableStream<Uint8Array>|null,bound:number){
 if(!stream)return;
 const reader=stream.getReader(),data=new Uint8Array(bound);
 let n=0;
 try{for(;;){
  const r=await reader.read();if(r.done)return data.buffer.slice(0,n);
  if(r.value.length>bound-n)return;
  data.set(r.value,n);n+=r.value.length;
 }}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
const sha=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
export async function loadChurchGroundSun(spec:ChurchSunAsset,base:string,get:typeof fetch=fetch){
 if(!globalThis.crypto?.subtle||spec.rawBytes!==spec.width*spec.height||spec.rawBytes>82944||
    spec.wireBytes<=0||spec.wireBytes>=spec.rawBytes)return;
 const signal=AbortSignal.timeout(1900);
 try{
  const r=await get(base+spec.file,{signal});
  if(r.status!==200){void r.body?.cancel().catch(()=>{});return;}
  let data=await readMask(r.body,spec.rawBytes);
  if(!data||signal.aborted)return;
  if(data.byteLength===spec.wireBytes){
   if(await sha(data)!==spec.wireSha||signal.aborted)return;
   data=await readMask(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')),spec.rawBytes);
  }
  if(!data||data.byteLength!==spec.rawBytes||await sha(data)!==spec.maskSha||signal.aborted)return;
  return churchGroundSun(spec,new Uint8Array(data));
 }catch{return;}
}
export const churchSunGLSL=`
 uniform sampler2D churchSunMask;uniform vec4 churchSunBox;uniform float churchSunLive;
 float churchDirectOcclusion(vec3 p,float distanceToEye,float dry){
  if(churchSunLive<.5||distanceToEye>900.||dry<180.)return 0.;
  vec2 q=(p.xz-churchSunBox.xy)/churchSunBox.zw;
  if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))return 0.;
  return texture2D(churchSunMask,q).r*(1.-smoothstep(525.,900.,distanceToEye));
 }
`;
