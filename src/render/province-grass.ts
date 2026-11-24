import type {Texture} from 'three';
import {FieldShardSource} from '../sim/field-shards.ts';
import {FieldStream,fieldStreamBlendGLSL} from './field-stream.ts';
import {GRASS_DIRECTORY_PIN,GRASS_SOURCE_PINS as S} from './province-grass.generated.ts';
import {originalGrassGrain,provinceGrassArtGLSL} from './province-grass-art.ts';

export function fetchGrassStudy(base:string){return FieldShardSource.open(base+'grass-study/',GRASS_DIRECTORY_PIN);}
export function grassSourceAllows(terrain:string|undefined,cover:string|undefined,raw:string|undefined){
 return terrain===S.terrain&&cover===S.cover&&raw===S.coverRaw;
}
export function provinceGrass(source:FieldShardSource){
 const stream=new FieldStream(source),art={value:null as Texture|null};
 return {
  stream,art,admitted:false,
  start(){if(this.admitted)return;art.value=originalGrassGrain();this.admitted=true;},
  dispose(){this.admitted=false;art.value?.dispose();art.value=null;stream.dispose();},
 };
}
export type ProvinceGrassStudy=ReturnType<typeof provinceGrass>;
export const provinceGrassGLSL=fieldStreamBlendGLSL+provinceGrassArtGLSL+`
 float matureGrassCoverage(vec2 world){
  for(int n=0;n<4;n++){
   vec4 box=fieldShardAreas[n];
   if(box.w<.5)continue;
   vec2 p=(world-box.xy)*.25;
   if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,vec2(256.))))continue;
   float raw=textureLod(fieldShardArray,vec3((p+2.)/260.,float(n)),0.).g;
   return raw*boundaryFieldArrival(fieldShardNeighbors[n],p,box.xy,smoothstep(0.,.85,fieldShardClock-box.z));
  }
  return 0.;
 }
 void shadeSourceGrass(inout vec3 color,inout vec3 normal,vec3 p,float d,float coast){
  vec2 dx=dFdx(p.xz),dy=dFdy(p.xz);
  if(d>320.||coast<67.||normal.y<.70)return;
  float q=matureGrassCoverage(p.xz)*smoothstep(67.,91.,coast)*(1.-smoothstep(145.,320.,d))*smoothstep(.70,.91,normal.y);
  if(q<.001)return;
  sourceGrassArt(color,normal,p,d,q,dx,dy);
 }
`;
