/**
 * QA fixture only. Copy to candidate's src/qa-field-corner-probe.ts.
 * Reuses the application's WebGL2 renderer/context; never changes the flight
 * scene, layer ages, texture buffer, cameras, or world. Reads exact four
 * neighboring source shards into a separate offscreen atlas.
 */
import {
  DataArrayTexture, DataTexture, FloatType, LinearFilter, NearestFilter, RGFormat, RGBAFormat,
  GLSL3, RawShaderMaterial, NoBlending, Scene, Mesh, OrthographicCamera, PlaneGeometry,
  Vector4, WebGLRenderTarget, UnsignedByteType, type WebGLRenderer
} from 'three';
import {fieldStreamMaskGLSL} from './render/field-stream.ts';
import {FIELD_SHARD_BYTES,FIELD_SHARD_SIDE,FIELD_SHARD_SPAN,fieldKey,type FieldShardSource} from './sim/field-shards.ts';

type Pair=readonly [number,number];
type Arrival=readonly [number|null,number|null,number|null,number|null];
const PROBE_CLOCK=16;
const COHORT_EDGES=[
  {a:0,b:1,normal:[1,0],along:[0,-1]},
  {a:2,b:3,normal:[1,0],along:[0,1]},
  {a:0,b:2,normal:[0,1],along:[-1,0]},
  {a:1,b:3,normal:[0,1],along:[1,0]}
] as const;
const DIRECTION=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]] as const;
const MATCH_LIMIT=2e-5, WORLD_LIMIT=2e-3, ORDINARY_UNIT=1/16;
// Our documents pin real fields on both sides of this world point. Do not
// change to arbitrary homogeneous developer geometry for release evidence.
export const CENTRAL_PROBE_XZ=[-7168,7168] as const;
const FRACTIONS=16777215;
const to01=(q:number)=>Math.max(0,Math.min(1,q));
const smooth=(t:number)=>to01(t)**2*(3-2*to01(t));
const arrival=(age:number|null)=>age===null?0:smooth(age/.85);
const require=(b:boolean,s:string)=>{if(!b)throw Error('Province field sampler: '+s);};
const vertex=`
in vec3 position;
void main(){gl_Position=vec4(position.xy,0.,1.);}
`;
const fragment=`
precision highp float;
precision highp int;
uniform highp sampler2D probeInputs;
out vec4 probeOut;
`+fieldStreamMaskGLSL+`
void main(){
 vec4 q=texelFetch(probeInputs,ivec2(int(gl_FragCoord.x),0),0);
 float v=0.;
 if(q.w<.5){
  int n=int(q.z);
  vec4 box=fieldShardAreas[n];
  v=box.w<.5?0.:boundaryFieldArrival(fieldShardNeighbors[n],(q.xy-box.xy)*.25,box.xy,fieldArrival(box.xy));
 }else{
  vec3 m=fieldShaderMask(q.xy);
  v=q.w<1.5?m.z:(m.z>.002?atan(m.y,m.x)/3.141592653589793:0.);
 }
 uint a=uint(clamp(v,0.,1.)*16777215.);
 probeOut=vec4(float(a&255u),float((a>>8u)&255u),float((a>>16u)&255u),255.)/255.;
}
`;

export async function runFieldCornerProbe(
 renderer:WebGLRenderer, source:Pick<FieldShardSource,'dir'|'load'>,
 corner:Pair=CENTRAL_PROBE_XZ, payloads?:ReadonlyMap<string,Uint8Array>
){
 const [x,z]=corner;require(x%FIELD_SHARD_SPAN===0&&z%FIELD_SHARD_SPAN===0,'corner must be at a four-shard lattice vertex');
 const tx=Math.round(x/FIELD_SHARD_SPAN),tz=Math.round(z/FIELD_SHARD_SPAN);
 const coords:Pair[]=[[tx-1,tz-1],[tx,tz-1],[tx-1,tz],[tx,tz]];
 const bytes=new Uint8Array(FIELD_SHARD_BYTES*4);
 const data:Uint8Array[]=[];
 for(const key of coords.map(([u,v])=>fieldKey(u,v))){
  const cell=source.dir.cells.get(key);if(!cell)throw Error('Absent QA cohort '+key);
  const exact=payloads?.get(key)??await source.load(cell);
  if(!exact||exact.byteLength!==FIELD_SHARD_BYTES)throw Error('Unavailable QA cohort '+key);
  data.push(exact);
 }
 const texture=new DataArrayTexture(bytes,FIELD_SHARD_SIDE,FIELD_SHARD_SIDE,4);
 texture.format=RGFormat;texture.minFilter=texture.magFilter=LinearFilter;texture.generateMipmaps=false;
 const points: number[]=[];
 const add=(u:number,v:number,owner:number,mode:number)=>{
  const i=points.length/4;points.push(u,v,owner,mode);return i;
 };
 type EdgeRead={a:number;b:number;distance:number;direct:Pair;closeLeft:Pair;closeRight:Pair;angle:Pair};
 const edgeReads:EdgeRead[]=[];
 for(const e of COHORT_EDGES)for(let d=0;d<=32;d++){
  const u=x+e.along[0]*d,v=z+e.along[1]*d;
  const probe=(side:number,es:number,mode=1)=>add(u+side*e.normal[0]*es,v+side*e.normal[1]*es,0,mode);
  const direct:Pair=[add(u,v,e.a,0),add(u,v,e.b,0)];
  const closeLeft:Pair=[probe(-1,ORDINARY_UNIT),probe(-1,ORDINARY_UNIT/2)];
  const closeRight:Pair=[probe(1,ORDINARY_UNIT),probe(1,ORDINARY_UNIT/2)];
  const angle:Pair=[probe(-1,ORDINARY_UNIT/2,2),probe(1,ORDINARY_UNIT/2,2)];
  edgeReads.push({a:e.a,b:e.b,distance:d,direct,closeLeft,closeRight,angle});
 }
 const centres=coords.map(([u,v],i)=>{
  const qx=u*FIELD_SHARD_SPAN+(i===0||i===2?1004:20);
  const qz=v*FIELD_SHARD_SPAN+(i<2?1004:20);
  return add(qx,qz,i,1);
 });
 const pairs=points.length/4, array=new Float32Array(points);
 require(pairs<=renderer.capabilities.maxTextureSize,'insufficient offscreen texture width');
 const query=new DataTexture(array,pairs,1,RGBAFormat,FloatType);
 query.minFilter=query.magFilter=NearestFilter;query.needsUpdate=true;
 const target=new WebGLRenderTarget(pairs,1,{format:RGBAFormat,type:UnsignedByteType,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false,stencilBuffer:false});
 const areas=Array.from({length:4},()=>new Vector4(0,0,0,0));
 const expected=new Int32Array(4);
 const material=new RawShaderMaterial({name:'field-corner-exact-sampler-QA',glslVersion:GLSL3,vertexShader:vertex,
   fragmentShader:fragment,depthTest:false,depthWrite:false,blending:NoBlending,
   uniforms:{fieldShardArray:{value:texture},fieldShardAreas:{value:areas},fieldShardNeighbors:{value:expected},
             fieldShardClock:{value:PROBE_CLOCK},probeInputs:{value:query}}});
 const scene=new Scene(), geometry=new PlaneGeometry(2,2), screen=new Mesh(geometry,material);scene.add(screen);
 screen.frustumCulled=false;
 const camera=new OrthographicCamera(-1,1,1,-1,0,1);
 const pixels=new Uint8Array(4*pairs),prev=renderer.getRenderTarget(),viewport=new Vector4(),scissor=new Vector4();
 renderer.getViewport(viewport);renderer.getScissor(scissor);
 const beforeScissor=renderer.getScissorTest();
 const states:readonly {label:string;ages:Arrival;order?:readonly number[]}[]=[
  {label:'all-ready',ages:[1.18,1.31,1.26,1.83]},
  {label:'staggered-arrival-A',ages:[.08,.72,.38,.59]},
  {label:'staggered-arrival-B',ages:[.8,.19,.33,.67]},
  {label:'one-pending-with-stale-texels',ages:[1.22,1.78,1.29,null]},
  {label:'diagonal-pending',ages:[null,1.45,1.32,null]},
  {label:'single-resident',ages:[1.42,null,null,null]},
  {label:'none-resident',ages:[null,null,null,null]},
  {label:'slot-permutation',ages:[.8,.19,.33,.67],order:[3,1,0,2]}
 ];
 const results=[];
 try{
  renderer.setRenderTarget(target);
  renderer.setScissorTest(false);
  for(const s of states){
   const order=s.order??[0,1,2,3],ids=Array.from({length:4},(_,i)=>order.indexOf(i));
   for(let layer=0;layer<4;layer++){
    const n=order[layer],[u,v]=coords[n],age=s.ages[n];
    bytes.set(data[n],layer*FIELD_SHARD_BYTES);
    expected[layer]=DIRECTION.reduce((mask,[du,dv],j)=>source.dir.cells.has(fieldKey(u+du,v+dv))?mask|(1<<j):mask,0);
    areas[layer].set(u*FIELD_SHARD_SPAN,v*FIELD_SHARD_SPAN,PROBE_CLOCK-(age??1.0),age===null?0:1);
    texture.addLayerUpdate(layer);
   }
   // Direct helper probes name logical owners. Rebind their numeric layer without
   // altering world-space queries. Failed slots retain real old texels deliberately.
   for(const e of edgeReads){array[e.direct[0]*4+2]=ids[e.a];array[e.direct[1]*4+2]=ids[e.b];}
   texture.needsUpdate=true;query.needsUpdate=true;
   renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,pairs,1,pixels);
   const result=(i:number)=>(pixels[i*4]+256*pixels[i*4+1]+65536*pixels[i*4+2])/FRACTIONS;
   let exactGap=0,gainOracle=0,approachGap=0,axisGap=0,baselineMax=0,activeQueries=0;
   const all=s.ages.map(arrival),cornerGain=Math.min(...all);
   for(const e of edgeReads){
    const [left,right]=e.direct.map(result),pairGain=Math.min(all[e.a],all[e.b]);
    const expect=cornerGain+(pairGain-cornerGain)*smooth(e.distance/16);
    exactGap=Math.max(exactGap,Math.abs(left-right));
    gainOracle=Math.max(gainOracle,Math.abs(left-expect),Math.abs(right-expect));
    const l=2*result(e.closeLeft[1])-result(e.closeLeft[0]),r=2*result(e.closeRight[1])-result(e.closeRight[0]);
    approachGap=Math.max(approachGap,Math.abs(l-r));
    if(Math.min(result(e.closeLeft[1]),result(e.closeRight[1]))>.01){
     activeQueries++;
     axisGap=Math.max(axisGap,Math.abs(result(e.angle[0])-result(e.angle[1])));
    }
   }
   const core=centres.map(result);baselineMax=Math.max(...core);
   require(exactGap<=MATCH_LIMIT&&gainOracle<=MATCH_LIMIT,s.label+' exact gain residual '+exactGap+'/'+gainOracle);
   require(approachGap<=WORLD_LIMIT,s.label+' source seam residual '+approachGap);
   require(axisGap<=MATCH_LIMIT,s.label+' orientation switched '+axisGap);
   if(s.label==='all-ready')require(activeQueries>=120&&baselineMax>.9,'blank or wrong GPU mask; no meaningful sampler witness');
   require(core.every((v,i)=>s.ages[i]!==null||v===0),s.label+' inactive/recycled slot sampled old texture');
   results.push({test:s.label,maxSamePositionArrivalDifference:exactGap,maxArrivalAgainstOracle:gainOracle,
     maxWorldSeamExtrapolatedWeightDelta:approachGap,maxActiveAxisDelta:axisGap,activeQueries,core});
  }
  const first=results[2],permuted=results.at(-1)!;
  require(permuted.core.every((v,i)=>Math.abs(v-first.core[i])<=MATCH_LIMIT),'GPU output changed on layer permutation');
 }finally{
  renderer.setRenderTarget(prev);renderer.setViewport(viewport);
  renderer.setScissor(scissor);renderer.setScissorTest(beforeScissor);
  texture.dispose();query.dispose();target.dispose();geometry.dispose();material.dispose();
 }
 return {corner,addresses:coords,scenarios:results,samplesPerScenario:pairs,fragmentBytes:4*pairs,
   note:'Actual GLSL/WebGL normalized texture sampler only; not a replacement for post-lighting projected frame and live flight checks.'};
}
