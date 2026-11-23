import { COASTAL_SPECS } from './coastal-surveys.generated.ts';
import { unpackGzip } from './compression.ts';

export const SURVEY_LOD=112, WORLD_COLS=32, WORLD_ROWS=22, GROUND_LIFT=.12;
export type CoastalSpec=(typeof COASTAL_SPECS)[number];
export type CoastalSource={spec:CoastalSpec;samples:Int16Array};
type Extent={left:number;right:number;top:number;bottom:number};
type Sampler=(x:number,z:number)=>number;
const clamp01=(a:number)=>Math.max(0,Math.min(1,a));
export function facet(u:number,v:number,nw:number,ne:number,sw:number,se:number){
 return u+v<=1?nw+(ne-nw)*u+(sw-nw)*v:se+(sw-se)*(1-u)+(ne-se)*(1-v);
}

/** One exact piece of the province mesh. Heights have no land/water semantics. */
export class CoastalGrid {
 readonly spec:CoastalSpec;readonly nx:number;readonly nz:number;readonly x0:number;readonly z0:number;
 readonly x1:number;readonly z1:number;readonly stepX:number;readonly stepZ:number;readonly heights:Float32Array;
 private readonly coarseX:number;private readonly coarseZ:number;private readonly tileX0:number;private readonly tileZ0:number;
 private readonly atlas:Sampler;
 constructor(ext:Extent,source:CoastalSource,atlas:Sampler){
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
  if(source.samples.length!==this.nx*this.nz)throw Error('Survey dimensions do not match the grid');
  this.heights=Float32Array.from(source.samples,h=>h*.01);
  // A centimetre-quantized value can differ from the inherited edge; share its unsnapped height.
  for(let j=0;j<this.nz;j++)for(let i=0;i<this.nx;i++)if(i===0||j===0||i===this.nx-1||j===this.nz-1)
   this.heights[j*this.nx+i]=this.originalFacet(this.x0+i*this.stepX,this.z0+j*this.stepZ);
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
 /** Interpolates the rendered NE–SW triangles, not the four samples bilinearly. */
 height(x:number,z:number):number|undefined{
  if(!this.near(x,z))return;
  if(this.inside(x,z)){
   const a=(x-this.x0)/this.stepX,b=(z-this.z0)/this.stepZ;
   const i=Math.max(0,Math.min(this.nx-2,Math.floor(a))),j=Math.max(0,Math.min(this.nz-2,Math.floor(b)));
   return facet(a-i,b-j,this.indexHeight(i,j),this.indexHeight(i+1,j),this.indexHeight(i,j+1),this.indexHeight(i+1,j+1));
  }
  // One existing cell of exact parent geometry; only collision needs a second
  // cell to return continuously to the province's usual bilinear gameplay height.
  const distance=Math.max(this.x0-x,x-this.x1,0)/this.coarseX;
  const dz=Math.max(this.z0-z,z-this.z1,0)/this.coarseZ;
  const f=clamp01(Math.max(distance,dz)-1),back=f*f*(3-2*f);
  return this.originalFacet(x,z)*(1-back)+(back?this.atlas(x,z)*back:0);
 }
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b:Uint8Array){let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return ((~c)>>>0).toString(16).padStart(8,'0');}

/** Failed, missing, corrupt or slow sources are optional: a flight keeps the province base surface for that site. */
export async function loadCoastalSurveys(base:string,fetcher:typeof fetch=fetch,timeoutMs=1600):Promise<CoastalSource[]>{
 const sources=await Promise.all(COASTAL_SPECS.map(async spec=>{
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const read=async():Promise<CoastalSource|undefined>=>{
   const r=await fetcher(base+'coastal/v1/'+spec.id+'.i16.gz',{signal:controller.signal});if(!r.ok)return;
   const buffer=await unpackGzip(await r.arrayBuffer()), bytes=new Uint8Array(buffer);
   if(bytes.length!==2*(spec.cellsX*spec.sub+1)*(spec.cellsZ*spec.sub+1)||crc32(bytes)!==spec.crc32)return;
   if(globalThis.crypto?.subtle){
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',buffer));
    if(Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==spec.sha256)return;
   }
   const data=new DataView(buffer),samples=new Int16Array(bytes.length/2);
   for(let i=0;i<samples.length;i++)samples[i]=data.getInt16(i*2,true);
   return {spec,samples};
  };
  try{return await Promise.race([read(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(undefined);},timeoutMs);})]);}
  catch{return undefined;}
  finally{if(timer!==undefined)clearTimeout(timer);}
 }));
 return sources.filter((v):v is CoastalSource=>v!==undefined);
}
