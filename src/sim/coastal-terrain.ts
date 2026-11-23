import { COASTAL_SPECS } from './coastal-surveys.generated.ts';
import {readCoastalPack} from './coastal-packs.ts';
import {CLIFF_SPLIT,decodeEastCliff,EastCliff,type CliffSource} from './east-cliff.ts';
import {EAST_CLIFF} from './east-cliff.generated.ts';

export const SURVEY_LOD=112, WORLD_COLS=32, WORLD_ROWS=22, GROUND_LIFT=.12;
export type CoastalSpec=(typeof COASTAL_SPECS)[number];
export type CoastalSource={spec:CoastalSpec;samples:Int16Array;cliff?:CliffSource};
export interface MeshSurveySpec {
 readonly id:string; readonly tileX:number; readonly tileZ:number;
 readonly firstX:number; readonly firstZ:number; readonly cellsX:number; readonly cellsZ:number;
 readonly sub:number; readonly sha256:string;readonly kind?:'inland';
 readonly relativeToParent?:boolean;
 readonly nativeCorners?:readonly (readonly number[])[];readonly nativeShape?:readonly number[];
}
export type MeshSurveySource={spec:MeshSurveySpec;samples:Int16Array;cliff?:CliffSource;renderWeights?:Uint8Array};
type Extent={left:number;right:number;top:number;bottom:number};
type Sampler=(x:number,z:number)=>number;
const clamp01=(a:number)=>Math.max(0,Math.min(1,a));
export function facet(u:number,v:number,nw:number,ne:number,sw:number,se:number){
 return u+v<=1?nw+(ne-nw)*u+(sw-nw)*v:se+(sw-se)*(1-u)+(ne-se)*(1-v);
}

/** One exact piece of the province mesh. Heights have no land/water semantics. */
export class CoastalGrid {
 readonly spec:MeshSurveySpec;readonly nx:number;readonly nz:number;readonly x0:number;readonly z0:number;
 readonly x1:number;readonly z1:number;readonly stepX:number;readonly stepZ:number;readonly heights:Float32Array;
 private readonly coarseX:number;private readonly coarseZ:number;private readonly tileX0:number;private readonly tileZ0:number;
 readonly cliff:EastCliff|undefined;readonly renderWeights?:Uint8Array;
 private readonly atlas:Sampler;
 constructor(ext:Extent,source:MeshSurveySource,atlas:Sampler){
  this.atlas=atlas;
  const s=this.spec=source.spec;
  this.coarseX=(ext.right-ext.left)/(WORLD_COLS*SURVEY_LOD);
  this.coarseZ=(ext.bottom-ext.top)/(WORLD_ROWS*SURVEY_LOD);
  this.stepX=this.coarseX/s.sub;this.stepZ=this.coarseZ/s.sub;
  this.tileX0=ext.left+s.tileX*this.coarseX*SURVEY_LOD;
  this.tileZ0=ext.top+s.tileZ*this.coarseZ*SURVEY_LOD;
  this.x0=this.tileX0+s.firstX*this.coarseX;this.z0=this.tileZ0+s.firstZ*this.coarseZ;
  this.nx=s.cellsX*s.sub+1;this.nz=s.cellsZ*s.sub+1;
  this.x1=this.x0+(this.nx-1)*this.stepX;this.z1=this.z0+(this.nz-1)*this.stepZ;
  if(source.samples.length!==this.nx*this.nz||source.renderWeights&&source.renderWeights.length!==source.samples.length)throw Error('Survey dimensions do not match the grid');
  this.renderWeights=source.renderWeights;
  this.heights=Float32Array.from(source.samples,(h,k)=>{
   if(!s.relativeToParent)return h*.01;
   const i=k%this.nx,j=Math.floor(k/this.nx);
   return this.originalFacet(this.x0+i*this.stepX,this.z0+j*this.stepZ)+h*.01;
  });
  // A centimetre-quantized value can differ from the inherited edge; share its unsnapped height.
  for(let j=0;j<this.nz;j++)for(let i=0;i<this.nx;i++)if(i===0||j===0||i===this.nx-1||j===this.nz-1)
   this.heights[j*this.nx+i]=this.originalFacet(this.x0+i*this.stepX,this.z0+j*this.stepZ);
  if(s.id==='east-point'&&source.cliff)this.cliff=new EastCliff(this.nx-1,this.nz-1,source.cliff,(i,j)=>this.referenceHeight(i,j));
 }
 indexHeight(i:number,j:number){return this.heights[j*this.nx+i];}
 inside(x:number,z:number){return x>=this.x0&&x<=this.x1&&z>=this.z0&&z<=this.z1;}
 near(x:number,z:number){return x>=this.x0-2*this.coarseX&&x<=this.x1+2*this.coarseX&&z>=this.z0-2*this.coarseZ&&z<=this.z1+2*this.coarseZ;}
 /** Triangle in the existing province near mesh beneath/around the replacement. */
 private originalFacet(x:number,z:number){
  const fx=(x-this.tileX0)/this.coarseX,fz=(z-this.tileZ0)/this.coarseZ,i=Math.floor(fx),j=Math.floor(fz);
  const at=(a:number,b:number)=>this.atlas(this.tileX0+(i+a)*this.coarseX,this.tileZ0+(j+b)*this.coarseZ);
  return facet(fx-i,fz-j,at(0,0),at(1,0),at(0,1),at(1,1));
 }
 /** Exact regular near terrain used before a refinement replaces the facets. */
 parentHeight(x:number,z:number){return this.originalFacet(x,z);}
 /** Atlas-relative coordinates use the published ~3.3 m base grid, in both LODs. */
 localHeight(a:number,b:number){return this.relativeHeight(a,b,true);}
 referenceHeight(a:number,b:number){return this.relativeHeight(a,b,false);}
 private relativeHeight(a:number,b:number,refined:boolean){
  a=Math.max(0,Math.min(this.nx-1,a));b=Math.max(0,Math.min(this.nz-1,b));
  const i=Math.min(this.nx-2,Math.floor(a)),j=Math.min(this.nz-2,Math.floor(b)),u=a-i,v=b-j;
  if(refined){
   const fine=this.cliff?.samples(i,j,u*CLIFF_SPLIT,v*CLIFF_SPLIT);if(fine!==undefined)return fine;
  }
  return facet(u,v,this.indexHeight(i,j),this.indexHeight(i+1,j),this.indexHeight(i,j+1),this.indexHeight(i+1,j+1));
 }
 /** Exact near mesh triangle, regardless of optional asset or camera history. */
 height(x:number,z:number):number|undefined{
  if(!this.near(x,z))return;
  if(this.inside(x,z))return this.localHeight((x-this.x0)/this.stepX,(z-this.z0)/this.stepZ);
  // One existing cell of exact parent geometry; only collision needs a second
  // cell to return continuously to the province's usual bilinear gameplay height.
  const distance=Math.max(this.x0-x,x-this.x1,0)/this.coarseX;
  const dz=Math.max(this.z0-z,z-this.z1,0)/this.coarseZ;
  const f=clamp01(Math.max(distance,dz)-1),back=f*f*(3-2*f);
  return this.originalFacet(x,z)*(1-back)+(back?this.atlas(x,z)*back:0);
 }
}
/** Each optional pack can fail without affecting the other site or the base province. */
export async function loadCoastalSurveys(base:string,fetcher:typeof fetch=fetch,timeoutMs=1600):Promise<CoastalSource[]>{
 const east=COASTAL_SPECS[0];
 const refinement=readCoastalPack(base+'coastal/v2/east-point-cliff.i16.gz',fetcher,timeoutMs,EAST_CLIFF,
    b=>decodeEastCliff(b,east.cellsX*east.sub,east.cellsZ*east.sub));
 const installed=await Promise.all(COASTAL_SPECS.map(async (spec):Promise<CoastalSource|undefined>=>{
  const decodedBytes=2*(spec.cellsX*spec.sub+1)*(spec.cellsZ*spec.sub+1);
  const samples=await readCoastalPack(base+'coastal/v1/'+spec.id+'.i16.gz',fetcher,timeoutMs,{...spec,decodedBytes},buffer=>{
   const data=new DataView(buffer),planes=new Int16Array(buffer.byteLength/2);
   for(let i=0;i<planes.length;i++)planes[i]=data.getInt16(i*2,true);
   return planes;
  });
  if(samples)return {spec,samples,cliff:spec.sha256===EAST_CLIFF.baseSha256?await refinement:undefined};
 }));
 return installed.filter((v):v is CoastalSource=>v!==undefined);
}
