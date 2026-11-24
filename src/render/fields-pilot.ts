import {DataTexture,RGBAFormat,LinearFilter,LinearMipmapLinearFilter,RepeatWrapping,Texture,Vector4} from 'three';
import {FIELD_PILOT as M} from './fields-pilot.generated.ts';

async function sha(bytes:ArrayBuffer){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
async function bounded(stream:ReadableStream<Uint8Array>|null,limit:number){
 if(!stream)return;
 const reader=stream.getReader(),out=new Uint8Array(limit);let at=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)return at===limit?out.buffer:out.buffer.slice(0,at);
   if(at+value.byteLength>limit)return;
   out.set(value,at);at+=value.byteLength;
  }
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function exactResponse(request:typeof fetch,path:string,limit:number,signal:AbortSignal){
 const r=await request(path,{signal});
 if(r.status!==200){void r.body?.cancel().catch(()=>{});return;}
 const contentLength=r.headers.get('content-length');
 if(contentLength&&Number(contentLength)>limit){void r.body?.cancel().catch(()=>{});return;}
 return bounded(r.body,limit);
}
async function loadCohort(base:string,request:typeof fetch,signal:AbortSignal){
 const [mask,scan]=await Promise.all([
  exactResponse(request,base+'fields-pilot.rgba.gz',M.decodedBytes,signal),
  exactResponse(request,base+'furrow-relief.webp',M.scanBytes,signal)]);
 if(signal.aborted||!mask||!scan||scan.byteLength!==M.scanBytes||await sha(scan)!==M.scanSha)return;
 let bytes=mask;
 if(mask.byteLength!==M.decodedBytes){
  if(mask.byteLength!==M.packedBytes||await sha(mask)!==M.sha256||signal.aborted)return;
  const raw=await bounded(new Blob([mask]).stream().pipeThrough(new DecompressionStream('gzip')),M.decodedBytes);
  if(!raw)return;
  bytes=raw;
 }
 if(signal.aborted||bytes.byteLength!==M.decodedBytes||await sha(bytes)!==M.decodedSha)return;
 return {bytes,scan};
}
export function cropFieldAtlasMatches(terrain?:string,cover?:string,decoded?:string){
 return terrain===M.terrainSha&&cover===M.coverSha&&decoded===M.coverDecodedSha;
}
/** Only the exact compressed cohort or identical host-decoded payload enables the preview. */
export async function checkedFieldPilot(base:string,request:typeof fetch=fetch,ms=1900){
 if(!globalThis.crypto?.subtle)return;
 const control=new AbortController();let deadline:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([loadCohort(base,request,control.signal),
   new Promise<undefined>(resolve=>{deadline=setTimeout(()=>{control.abort();resolve(undefined);},ms);})]);
 }catch{return;}
 finally{control.abort();if(deadline!==undefined)clearTimeout(deadline);}
}
export async function loadFieldPilot(base:string){
 try{
  const asset=await checkedFieldPilot(base);if(!asset)return;
  const image=await createImageBitmap(new Blob([asset.scan],{type:'image/webp'}),{colorSpaceConversion:'none',imageOrientation:'none'});
  if(image.width!==512||image.height!==512){image.close();return;}
  const texture=new Texture(image);texture.wrapS=texture.wrapT=RepeatWrapping;texture.flipY=false;
  texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.generateMipmaps=true;
  texture.anisotropy=4;texture.needsUpdate=true;
  const map=new DataTexture(new Uint8Array(asset.bytes),M.side,M.side*M.regions.length,RGBAFormat);
  map.generateMipmaps=false;map.minFilter=map.magFilter=LinearFilter;map.needsUpdate=true;
  return {strength:{value:1},map:{value:map},scan:{value:texture},
   boxes:{value:M.regions.map(p=>new Vector4(...p.originXZ,1/p.spanMetres,1))},
   discard:()=>{map.dispose();texture.dispose();image.close();},
   covers:(x:number,z:number,a:number,b:number)=>M.regions.some(({originXZ:[left,top],spanMetres:s})=>x<left+s&&z<top+s&&a>left&&b>top)};
 }catch{return;}
}
export type FieldPilot=NonNullable<Awaited<ReturnType<typeof loadFieldPilot>>>;
export const fieldPilotGLSL=`
 uniform sampler2D cropPilotMap,farmlandScan;
 uniform vec4 cropPilotBoxes[3];
 uniform float cropPilotStrength;
 void paintDatedFields(inout vec3 col,inout vec3 normal,vec3 p,float eye,float coast){
  vec2 dx=dFdx(p.xz),dy=dFdy(p.xz);
  if(abs(cropPilotStrength)<.0001||eye>330.||coast<175.||normal.y<.75)return;
  vec2 here=vec2(-2.);float region=0.;
  for(int i=0;i<3;++i){
   here=(p.xz-cropPilotBoxes[i].xy)*cropPilotBoxes[i].z;
   if(all(greaterThan(here,vec2(0.)))&&all(lessThan(here,vec2(1.)))){region=float(i+1);break;}
  }
  if(region<.5)return;
  float window=smoothstep(.005,.048,min(min(here.x,here.y),min(1.-here.x,1.-here.y)));
  vec2 st=clamp(here,vec2(.002),vec2(.998));
  st.y=(st.y+region-1.)/3.;
  vec4 witness=texture2D(cropPilotMap,st);
  if(witness.a<.78)return;
  vec2 across=(witness.rg/witness.a-.501961)*2.;
  across/=max(.001,length(across));
  float local=witness.b*window*abs(cropPilotStrength)*(1.-smoothstep(165.,330.,eye))*smoothstep(175.,240.,coast)*smoothstep(.75,.93,normal.y);
  if(local<.002)return;
  if(cropPilotStrength<0.){col=vec3(4.,0.,4.);return;}
  // The field's long boundary direction only supplies an authored orientation.
  // Plant spacing, foliage state and red-soil exposure are not survey attributes.
  vec2 along=vec2(-across.y,across.x);
  vec2 coords=vec2(dot(p.xz,along),dot(p.xz,across))/6.55;
  vec2 mdx=vec2(dot(dx,along),dot(dx,across))/6.55;
  vec2 mdy=vec2(dot(dy,along),dot(dy,across))/6.55;
  coords.x+=(noise(p.xz*.038+13.)-.5)*1.35;
  coords.y+=(noise(p.xz*.026+vec2(19.,-12.))-.5)*.043;
  vec3 scan=textureGrad(farmlandScan,coords,mdx,mdy).rgb;
  vec3 other=textureGrad(farmlandScan,coords+vec2(.465,0.),mdx,mdy).rgb;
  scan=mix(scan,other,smoothstep(.30,.70,noise(p.xz*.104+43.)));
  float pix=max(length(mdx),length(mdy))*6.55;
  float hi=1.-smoothstep(.22,1.05,pix);
  float luma=(.46+scan.r*1.08);
  float offset=noise(p.xz*.086+110.)-.5;
  float gain=clamp(1.+(luma-1.)*(.38+.30*hi)+.08*offset,.74,1.23);
  float Y=dot(col,vec3(.2126,.7152,.0722));
  float seenGreen=smoothstep(.035,.235,(col.g-col.r)/max(.022,Y));
  vec3 furrow=col*gain*mix(vec3(1.01,.97,.93),vec3(.98,1.04,.95),seenGreen);
  col=mix(col,furrow,local);
  vec2 perturb=(scan.gb-.5)*(.30*local*hi);
  vec2 horizontal=along*perturb.x-across*perturb.y;
  vec3 nudged=vec3(horizontal.x,0.,horizontal.y);
  normal=normalize(normal+nudged-dot(normal,nudged)*normal);
 }
`;
