import {LinearFilter,LinearMipmapLinearFilter,NoColorSpace,Texture,Vector2,Vector4} from 'three';
import {HOG_PHOTO_PINS} from './hog-photo-pins.generated.ts';
import {WEST_DUNE_OPTICS} from './hog-west-optics.generated.ts';
type PhotoPins=(typeof HOG_PHOTO_PINS)[number]|typeof WEST_DUNE_OPTICS;
const land={
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 cover:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 coverRaw:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 road:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557'
} as const;
export function hogInfrastructureMatches(road?:string,atlas?:string){return road===land.road&&atlas===land.atlas;}
export function matchesHogPhoto(terrain?:string,cover?:string,coverRaw?:string){
 return terrain===land.terrain&&cover===land.cover&&coverRaw===land.coverRaw;
}
async function exactBody(stream:ReadableStream<Uint8Array>|null,bytes:number){
 if(!stream)return;
 const r=stream.getReader(),data=new Uint8Array(bytes);
 let off=0;
 try{for(;;){
  const q=await r.read();if(q.done)return off===bytes?data.buffer:undefined;
  if(q.value.length>bytes-off)return;
  data.set(q.value,off);off+=q.value.length;
 }}finally{void r.cancel().catch(()=>{});r.releaseLock();}
}
async function loadPiece(stamp:PhotoPins,base:string,opacity:{value:number},fetchIt:typeof fetch){
 if(!globalThis.crypto?.subtle||!globalThis.createImageBitmap)return;
 try{
  const res=await fetchIt(base+stamp.file,{signal:AbortSignal.timeout(4200)});
  if(res.status!==200){void res.body?.cancel().catch(()=>{});return;}
  const raw=await exactBody(res.body,stamp.size);if(!raw)return;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==stamp.sha)return;
  const source=await createImageBitmap(new Blob([raw],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  if(source.width!==stamp.width||source.height!==stamp.height){source.close();return;}
  const texture=new Texture(source);texture.flipY=false;texture.colorSpace=NoColorSpace;
  texture.generateMipmaps=true;texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.needsUpdate=true;
  const [x,z,ex,ez,sx,sz]=stamp.domain,det=ex*sz-ez*sx;
  return {texture,tile:stamp.tile,uniforms:{hogPhotoOpacity:opacity,hogPhoto:{value:texture},hogPhotoOrigin:{value:new Vector2(x,z)},
    hogPhotoBasis:{value:new Vector4(sz/det,-sx/det,-ez/det,ex/det)},hogProtect:{value:new Vector4(...stamp.qGuard)}}};
 }catch{return;}
}
export async function loadHogPhoto(base:string,fetchIt:typeof fetch=fetch){
 const opacity={value:0};
 const pieces=await Promise.all(HOG_PHOTO_PINS.map(p=>loadPiece(p,base,opacity,fetchIt)));
 if(pieces.some(p=>!p)){
  for(const piece of pieces)if(piece){piece.texture.dispose();(piece.texture.image as ImageBitmap).close();}
  return;
 }
 return {opacity,pieces:pieces.filter(p=>p!==undefined)};
}
export type HogPhoto=NonNullable<Awaited<ReturnType<typeof loadHogPhoto>>>;
export const hogPhotoGLSL=`
 uniform vec2 hogPhotoOrigin;uniform vec4 hogPhotoBasis,hogProtect;uniform sampler2D hogPhoto;uniform float hogPhotoOpacity;
 void paintHogPhoto(inout vec3 col,vec3 p,float d,float dry){
  vec2 local=p.xz-hogPhotoOrigin;
  vec2 uv=vec2(dot(local,hogPhotoBasis.xy),dot(local,hogPhotoBasis.zw));
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  if(hogPhotoOpacity<.5||dry<52.||d>560.||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return;
  vec2 border=min(uv,1.-uv);
  float weight=smoothstep(0.,.16,border.x)*smoothstep(0.,.20,border.y)*
   smoothstep(52.,60.,dry)*(1.-smoothstep(190.,560.,d));
  vec2 guard=hogProtect.zw-hogProtect.xy;
  float denom=dot(guard,guard);
  if(denom>1.){
   vec2 a=p.xz-hogProtect.xy;
   float support=length(a-guard*clamp(dot(a,guard)/denom,0.,1.));
   weight*=smoothstep(13.5,21.5,support);
  }
  vec4 photo=textureGrad(hogPhoto,uv,dx,dy);
  weight*=photo.a;
  if(weight<.001)return;
  vec3 delta=(photo.rgb-(128./255.))*.21;
  col=max(vec3(.003),col+delta*weight);
 }
`;

export async function loadWestDuneOptics(base:string,get:typeof fetch=fetch){
 const p=await loadPiece(WEST_DUNE_OPTICS,base,{value:1},get);
 if(!p)return;
 const gain={value:0};
 return {
  texture:p.texture, tile:p.tile, gain, uniforms:{duneAerialGain:gain,
   duneAerial:{value:p.texture},duneAerialOrigin:p.uniforms.hogPhotoOrigin,duneAerialBasis:p.uniforms.hogPhotoBasis,
  }, dispose(){p.texture.dispose();(p.texture.image as ImageBitmap).close();},
 };
}
export type WestDuneOptics=NonNullable<Awaited<ReturnType<typeof loadWestDuneOptics>>>;

export const westDuneAerialGLSL=`
 uniform sampler2D duneAerial;
 uniform float duneAerialGain;
 uniform vec2 duneAerialOrigin;
 uniform vec4 duneAerialBasis;
 void paintWestDuneAerial(inout vec3 col,vec3 world,float coast){
  vec2 p=world.xz-duneAerialOrigin;
  vec2 uv=vec2(dot(p,duneAerialBasis.xy),dot(p,duneAerialBasis.zw));
  vec2 dx=dFdx(uv),dy=dFdy(uv);
  float distanceM=distance(cameraPosition,world);
  if(duneAerialGain<.5||distanceM>360.||coast<36.||any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return;
  vec4 img=textureGrad(duneAerial,uv,dx,dy);
  // RGB may use mipmaps, but only native signed alpha grants authority.
  float authority=min(img.a,textureLod(duneAerial,uv,0.).a);
  float strength=.71*authority*smoothstep(36.,43.,coast)*(1.-smoothstep(125.,360.,distanceM));
  col=mix(col,.25*img.rgb,strength);
 }`;
