import {readCoastalPack} from '../sim/coastal-packs.ts';
import {SOUTH_LAKE} from './south-lake.generated.ts';

export type SouthLakeMask=Readonly<{values:Uint8Array;plan:typeof SOUTH_LAKE}>;
export function loadSouthLake(base:string,fetcher:typeof fetch=fetch,timeoutMs=1600){
 return readCoastalPack(base+SOUTH_LAKE.asset,fetcher,timeoutMs,SOUTH_LAKE,b=>({
  values:new Uint8Array(b),plan:SOUTH_LAKE
 }));
}

/** This footprint changes optics, not depth, shoreline, terrain or wave physics. */
export const southLakeGLSL=/*glsl*/`
 uniform sampler2D southLakeMask;
 uniform vec4 southLakeAABB;   // X/Z west/north/east/south
 uniform vec4 southLakeFrame;  // X/Z origin, cos/sin of local axes
 uniform vec4 southLakeRect;   // rotated X/Z origin and inverse size
 float southLakeShelter(vec2 q){
  if(any(lessThanEqual(q,southLakeAABB.xy))||any(greaterThanEqual(q,southLakeAABB.zw)))return 0.;
  vec2 p=q-southLakeFrame.xy;
  vec2 b=southLakeFrame.zw;
  vec2 uv=(vec2(dot(p,vec2(b.x,-b.y)),dot(p,b.yx))-southLakeRect.xy)*southLakeRect.zw;
  if(any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return 0.;
  return texture2D(southLakeMask,uv).r;
 }
 vec3 southLakeTint(vec2 q,float shore){
  // Photo-guided water colour variation, not a reconstruction of a shallow
  // bed. Keep it soft, irregular and close to the already rendered banks.
  vec2 p=q-southLakeFrame.xy;
  float banks=1.-smoothstep(15.,137.,-shore);
  float stain=.69*noise(p*.009)+.31*noise(p*.019+vec2(3.4,19.));
  float mud=smoothstep(.26,.78,stain)*banks;
  return mix(vec3(.031,.062,.088),vec3(.121,.082,.064),mud*.78);
 }
`;
