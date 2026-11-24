import type {Texture} from 'three';
import {FieldShardSource} from '../sim/field-shards.ts';
import {FieldStream,fieldStreamBlendGLSL} from './field-stream.ts';
import {GRASS_DIRECTORY_PIN,GRASS_SOURCE_PINS as S} from './province-grass.generated.ts';
import {shortGrassNapSteps} from './source-grass-nap.ts';
import {originalGrassGrain,provinceGrassArtGLSL} from './province-grass-art.ts';

export function fetchGrassStudy(base:string){return FieldShardSource.open(base+'grass-study/',GRASS_DIRECTORY_PIN);}
export function grassSourceAllows(terrain:string|undefined,cover:string|undefined,raw:string|undefined){
 return terrain===S.terrain&&cover===S.cover&&raw===S.coverRaw;
}
export function provinceGrass(source:FieldShardSource,nearNap=false){
 const stream=new FieldStream(source),art={value:null as Texture|null};
 const nap=nearNap?{map:{value:null as Texture|null},mix:{value:0},wanted:false,pending:false,failed:false,readyAt:Infinity}:undefined;
 let disposed=false;
 return {
  stream,art,nap,admitted:false,
  uniforms:{
   grassShardArray:stream.uniforms.fieldShardArray,grassShardAreas:stream.uniforms.fieldShardAreas,
   grassShardClock:stream.uniforms.fieldShardClock,grassShardNeighbors:stream.uniforms.fieldShardNeighbors,
   sourceGrassArtMap:art,
   ...(nap?{shortGrassNapMap:nap.map,shortGrassNapMix:nap.mix}:{}),
  },
  start(){if(this.admitted)return;art.value=originalGrassGrain();this.admitted=true;},
  prepareNap(){
   if(!nap||nap.failed||nap.pending||nap.map.value||disposed)return;
   nap.pending=true;
   const steps=shortGrassNapSteps();
   const schedule=(f:()=>void)=>{
    if(typeof globalThis.requestIdleCallback==='function')globalThis.requestIdleCallback(f,{timeout:110});
    else setTimeout(f,0);
   };
   const build=()=>{
    if(disposed||!nap.wanted||!this.admitted){nap.pending=false;steps.return(undefined as never);return;}
    try{
     const start=performance.now();
     do{
      const next=steps.next();
      if(next.done){nap.map.value=next.value;nap.readyAt=performance.now();nap.pending=false;return;}
     }while(performance.now()-start<3.8);
     schedule(build);
    }catch{nap.failed=true;nap.pending=false;}
   };
   schedule(build);
  },
  dispose(){disposed=true;this.admitted=false;art.value?.dispose();art.value=null;nap?.map.value?.dispose();if(nap){nap.mix.value=0;nap.map.value=null;}stream.dispose();},
 };
}
export type ProvinceGrassStudy=ReturnType<typeof provinceGrass>;
// The two independent streams share blend code, not live texture uniforms.
const grassBlendGLSL=fieldStreamBlendGLSL
 .replace(/\bfieldShard(Array|Areas|Clock|Neighbors)\b/g,'grassShard$1')
 .replace(/\bfieldArrival\b/g,'grassArrival')
 .replace(/\bboundaryFieldArrival\b/g,'boundaryGrassArrival');
export const provinceGrassGLSL=grassBlendGLSL+provinceGrassArtGLSL+`
 float matureGrassCoverage(vec2 world){
  for(int n=0;n<4;n++){
   vec4 box=grassShardAreas[n];
   if(box.w<.5)continue;
   vec2 p=(world-box.xy)*.25;
   if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,vec2(256.))))continue;
   float raw=textureLod(grassShardArray,vec3((p+2.)/260.,float(n)),0.).g;
   return raw*boundaryGrassArrival(grassShardNeighbors[n],p,box.xy,smoothstep(0.,.85,grassShardClock-box.z));
  }
  return 0.;
 }
 void shadeSourceGrass(inout vec3 color,inout vec3 normal,vec3 p,float d,float coast,float farmInfluence){
  vec2 dx=dFdx(p.xz),dy=dFdy(p.xz);
  if(d>320.||coast<67.||normal.y<.70)return;
  float q=matureGrassCoverage(p.xz)*smoothstep(67.,91.,coast)*(1.-smoothstep(145.,320.,d))*smoothstep(.70,.91,normal.y);
  // Where the historic covers disagree, explicitly researched row
  // material takes precedence without a hard change during shard arrival.
  q*=1.-smoothstep(0.,.50,farmInfluence);
  if(q<.001)return;
  sourceGrassArt(color,normal,p,d,q,dx,dy);
 }
`;
