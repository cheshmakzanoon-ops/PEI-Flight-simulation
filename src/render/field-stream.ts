import {DataArrayTexture,LinearFilter,RGFormat,Vector4} from 'three';
import {fieldCandidates,FIELD_SHARD_BYTES,FIELD_SHARD_LAYERS,FIELD_SHARD_SIDE,FIELD_SHARD_SPAN,
 type FieldCell,type FieldShardSource} from '../sim/field-shards.ts';
type Slot={cell:FieldCell;ready:boolean;tries:number;retryAt:number;abort?:AbortController};
type Reader=Pick<FieldShardSource,'dir'|'load'>;

/** One stable four-layer working set. An obsolete or failed request cannot paint a recycled layer. */
export class FieldStream {
 private readonly list:(Slot|undefined)[]=Array(FIELD_SHARD_LAYERS);
 private readonly buffer=new Uint8Array(FIELD_SHARD_BYTES*FIELD_SHARD_LAYERS);
 private readonly expected=new Int32Array(FIELD_SHARD_LAYERS);
 private readonly areas=Array.from({length:FIELD_SHARD_LAYERS},()=>new Vector4(0,0,0,0));
 private until=0;
 private on=false;
 private closed=false;
 private pending=0;
 private qx=Infinity;private qz=Infinity;
 readonly texture=new DataArrayTexture(this.buffer,FIELD_SHARD_SIDE,FIELD_SHARD_SIDE,FIELD_SHARD_LAYERS);
 readonly uniforms={fieldShardArray:{value:this.texture},fieldShardAreas:{value:this.areas},fieldShardNeighbors:{value:this.expected},fieldShardClock:{value:0}};
 constructor(privateReader:Reader,privateNow:()=>number=()=>performance.now(),allowed?:ReadonlySet<string>){
  this.reader=privateReader;this.now=privateNow;this.allowed=allowed;
  this.texture.format=RGFormat;this.texture.minFilter=this.texture.magFilter=LinearFilter;
  this.texture.generateMipmaps=false;this.texture.needsUpdate=true;
 }
 private readonly allowed?:ReadonlySet<string>;
 private readonly reader:Reader;
 private readonly now:()=>number;
 intersects(left:number,top:number,right:number,bottom:number){
  const C=FIELD_SHARD_SPAN;
  for(let x=Math.floor(left/C);x<=Math.floor(right/C);x++)for(let z=Math.floor(top/C);z<=Math.floor(bottom/C);z++){
   if(this.reader.dir.cells.has(x+':'+z))return true;
  }
  return false;
 }
 get state(){return {active:this.on,ready:this.list.filter(v=>v?.ready).length,pending:this.pending,slots:FIELD_SHARD_LAYERS};}
 update(x:number,z:number,above:number){
  if(this.closed)return;
  const clock=this.now();
  this.uniforms.fieldShardClock.value=clock*.001;
  const wanted=Number.isFinite(above)&&(this.on?above<535:above<415);
  if(wanted!==this.on||Math.hypot(x-this.qx,z-this.qz)>=22||clock>=this.until){
   this.on=wanted;this.qx=x;this.qz=z;this.until=clock+270;
   const desired=wanted?fieldCandidates(x,z,this.reader.dir).filter(cell=>!this.allowed||this.allowed.has(cell.key)):[];
   const keys=new Set(desired.map(cell=>cell.key));
   for(let i=0;i<this.list.length;++i){
    const item=this.list[i];if(item&&!keys.has(item.cell.key))this.clear(i);
   }
   for(const cell of desired){
    if(this.list.some(x=>x?.cell.key===cell.key))continue;
    const idx=this.list.findIndex(x=>x===undefined);if(idx>=0)this.list[idx]={cell,ready:false,tries:0,retryAt:0};
   }
   // Preserve the distance order after retaining resident layers.
   for(const d of desired){
    if(this.pending>=2)break;
    const i=this.list.findIndex(s=>s?.cell.key===d.key),v=this.list[i];
    if(i>=0&&v&&!v.ready&&!v.abort&&v.tries<2&&clock>=v.retryAt)this.start(i,v);
   }
  }
 }
 private clear(i:number){
  this.list[i]?.abort?.abort();this.list[i]=undefined;this.areas[i].w=0;
 }
 private start(idx:number,slot:Slot){
  slot.tries++;const controller=new AbortController();slot.abort=controller;this.pending++;
  const end=setTimeout(()=>controller.abort(),2100);
  const finish=(value?:Uint8Array)=>{
   if(this.closed||this.list[idx]!==slot||controller.signal.aborted||
      !value||value.length!==FIELD_SHARD_BYTES)return;
   this.buffer.set(value,idx*FIELD_SHARD_BYTES);
   this.texture.addLayerUpdate(idx);this.texture.needsUpdate=true;
   const {x,z}=slot.cell;
   this.expected[idx]=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]
    .reduce((bits,[dx,dz],n)=>this.reader.dir.cells.has((x+dx)+':'+(z+dz))?bits|(1<<n):bits,0);
   this.areas[idx].set(slot.cell.x*FIELD_SHARD_SPAN,slot.cell.z*FIELD_SHARD_SPAN,this.now()*.001,1);
   slot.ready=true;
  };
  void this.reader.load(slot.cell,controller.signal).then(finish,()=>{}).finally(()=>{
   clearTimeout(end);this.pending--;slot.abort=undefined;slot.retryAt=this.now()+1300;
  });
 }
 dispose(){
  this.closed=true;for(let i=0;i<this.list.length;++i)this.clear(i);this.texture.dispose();
 }
}

/** Interpolate only coverage. The axis always comes from an admitted contributing texel. */
export const fieldStreamBlendGLSL=`
 uniform highp sampler2DArray fieldShardArray;
 uniform vec4 fieldShardAreas[4];
 uniform float fieldShardClock;
 uniform int fieldShardNeighbors[4];
 float fieldArrival(vec2 origin){
  for(int i=0;i<4;i++){
   vec4 neighbor=fieldShardAreas[i];
   if(neighbor.w>.5&&all(equal(neighbor.xy,origin)))return smoothstep(0.,.85,fieldShardClock-neighbor.z);
  }
  return 0.;
 }
 float boundaryFieldArrival(int bits,vec2 p,vec2 origin,float here){
  const float C=1024., fade=4.;
  bool left=p.x<128., top=p.y<128.;
  vec2 edge=min(p,256.-p);
  float blendX=1.-smoothstep(0.,fade,edge.x), blendZ=1.-smoothstep(0.,fade,edge.y);
  if(blendX<=0.&&blendZ<=0.)return here;
  float sx=left?-C:C,sz=top?-C:C;
  int bx=left?1:2,bz=top?4:8,bd=left?(top?16:64):(top?32:128);
  float nx=blendX>0.&&(bits&bx)!=0?fieldArrival(origin+vec2(sx,0.)):1.;
  float nz=blendZ>0.&&(bits&bz)!=0?fieldArrival(origin+vec2(0.,sz)):1.;
  float nd=blendX>0.&&blendZ>0.&&(bits&bd)!=0?fieldArrival(origin+vec2(sx,sz)):1.;
  float xEdge=min(here,nx),zEdge=min(here,nz),corner=min(min(xEdge,zEdge),nd);
  // On either shared edge its two control gains are identical, including
  // the four-shard corner with any combination of pending arrivals.
  return mix(mix(here,xEdge,blendX),mix(zEdge,corner,blendX),blendZ);
 }
`;
export const fieldStreamMaskGLSL=fieldStreamBlendGLSL+`
 vec3 fieldShaderMask(vec2 world){
  for(int n=0;n<4;++n){
   vec4 box=fieldShardAreas[n];
   if(box.w<.5)continue;
   vec2 p=(world-box.xy)*.25;
   if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,vec2(256.))))continue;
   vec2 c=p+2.;
   float weight=textureLod(fieldShardArray,vec3(c/260.,float(n)),0.).g;
   if(weight<.002)return vec3(0.);
   vec2 picked=texelFetch(fieldShardArray,ivec3(ivec2(c),n),0).rg;
   if(picked.g<=0.){
    ivec2 b=ivec2(floor(c-.5));
    for(int z=0;z<2;z++)for(int x=0;x<2;x++){
     vec2 nearby=texelFetch(fieldShardArray,ivec3(b+ivec2(x,z),n),0).rg;
     if(nearby.g>picked.g)picked=nearby;
    }
   }
   float angle=(floor(picked.r*255.+.5)+.5)*.012271846303;
   float arrived=smoothstep(0.,.85,fieldShardClock-box.z);
   arrived=boundaryFieldArrival(fieldShardNeighbors[n],p,box.xy,arrived);
   return vec3(cos(angle),sin(angle),weight*arrived);
  }
  return vec3(0.);
 }
`;
