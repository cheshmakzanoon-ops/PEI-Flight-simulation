import {CoastalGrid,GROUND_LIFT,facet,type MeshSurveySpec} from './coastal-terrain.ts';

type Extent=Readonly<{left:number;right:number;top:number;bottom:number}>;
type Sampler=(x:number,z:number)=>number;

/** A precisely fenced relative grade inset, independent of streamed city terrain.
 * The boundary and protected holes remain inherited. The submission and collider
 * use one actual triangle in the measured core, with a conservative collar
 * easing into the legacy interpolated contact. */
export class BoundedGrade{
 readonly grid:CoastalGrid;
 private readonly weights:Uint8Array;
 private readonly contactBounds?:readonly [number,number,number,number];
 constructor(ext:Extent,spec:MeshSurveySpec,deltaCm:Int16Array,weights:Uint8Array,atlas:Sampler){
  const w=spec.cellsX*spec.sub+1,h=spec.cellsZ*spec.sub+1;
  if(!spec.relativeToParent||w<3||h<3||w>260||h>260||deltaCm.length!==w*h||weights.length!==w*h)throw Error('Unbounded grade inset');
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const k=y*w+x,eastFence=x===0||x===w-1,southFence=y===0||y===h-1;
   if((eastFence||southFence)&&(deltaCm[k]||weights[k]))throw Error('Grade inset crosses outer reserve');
   if(!weights[k]&&deltaCm[k])throw Error('Grade inset changes unsupported ground');
   if(Math.abs(deltaCm[k])>220)throw Error('Grade inset delta exceeds validated ceiling');
  }
  this.grid=new CoastalGrid(ext,{spec,samples:deltaCm},atlas);
  this.weights=weights;
  let left=w,top=h,right=-1,bottom=-1;
  for(let i=0;i<weights.length;i++)if(weights[i]){
   const x=i%w,z=Math.floor(i/w);
   left=Math.min(left,x);top=Math.min(top,z);right=Math.max(right,x);bottom=Math.max(bottom,z);
  }
  if(right>=left){
   const a=this.grid,g=.002;
   // A moved vertex influences every adjacent triangle, not just its
   // projected location. Keep an extra floating-point reserve too.
   this.contactBounds=[a.x0+(left-1)*a.stepX-g,a.z0+(top-1)*a.stepZ-g,
    a.x0+(right+1)*a.stepX+g,a.z0+(bottom+1)*a.stepZ+g];
  }
 }
 affectsBounds(b:readonly [number,number,number,number]){
  const q=this.contactBounds;
  return !!q&&b[0]<=q[2]&&b[2]>=q[0]&&b[1]<=q[3]&&b[3]>=q[1];
 }
 /** Uses the exact same triangle split as the authored grade surface. */
 weight(x:number,z:number){
  const a=this.grid;if(!a.inside(x,z))return 0;
  const u=Math.min(a.nx-1,(x-a.x0)/a.stepX),v=Math.min(a.nz-1,(z-a.z0)/a.stepZ);
  const i=Math.min(a.nx-2,Math.floor(u)),j=Math.min(a.nz-2,Math.floor(v)),k=j*a.nx+i;
  const q=this.weights;
  return facet(u-i,v-j,q[k],q[k+1],q[k+a.nx],q[k+a.nx+1])/255;
 }
 visualY(x:number,z:number){
  if(!this.grid.inside(x,z))return undefined;
  return this.grid.height(x,z)!+GROUND_LIFT;
 }
 contactY(x:number,z:number,stock:number){
  const w=this.weight(x,z);
  if(w===0)return stock;
  const oldFacet=this.grid.parentHeight(x,z)+GROUND_LIFT;
  const y=this.visualY(x,z)!;
  return stock+(y-oldFacet)+w*(oldFacet-stock);
 }
}

export type GradeStamp=MeshSurveySpec&Readonly<{file:string;wireBytes:number;wireSha:string;decodedBytes:number;
 terrainSha256:string;coverCompressedSha256:string;coverDecodedSha256:string}>;
export function gradeAtlasMatches(s:GradeStamp,terrain:string|undefined,cover:string|undefined,coverDecoded:string|undefined){
 return s.terrainSha256===terrain&&s.coverCompressedSha256===cover&&s.coverDecodedSha256===coverDecoded;
}
const digest=(b:ArrayBuffer)=>crypto.subtle.digest('SHA-256',b).then(h=>Array.from(new Uint8Array(h),p=>p.toString(16).padStart(2,'0')).join(''));
async function bounded(stream:ReadableStream<Uint8Array>|null,limit:number){
 if(!stream)return;
 const reader=stream.getReader(),buffer=new Uint8Array(limit);
 let at=0;
 try{
  for(;;){
   const entry=await reader.read();
   if(entry.done)return at===limit?buffer.buffer:buffer.buffer.slice(0,at);
   if(entry.value.length>limit-at)return;
   buffer.set(entry.value,at);at+=entry.value.length;
  }
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function loadBoundedGrade(s:GradeStamp,base:string,get:typeof fetch=fetch,ms=1300){
 if(!globalThis.crypto?.subtle||s.decodedBytes>202800||s.wireBytes>=s.decodedBytes)return;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const ctl=new AbortController(),aborted=()=>ctl.signal.aborted;
 const read=async()=>{
  const r=await get(base+s.file,{signal:ctl.signal});
  if(r.status!==200||aborted()){void r.body?.cancel().catch(()=>{});return;}
  let b=await bounded(r.body,s.decodedBytes);
  if(!b||aborted())return;
  if(b.byteLength===s.wireBytes){
   if(await digest(b)!==s.wireSha||aborted())return;
   b=await bounded(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')),s.decodedBytes);
  }
  if(!b||b.byteLength!==s.decodedBytes||await digest(b)!==s.sha256||aborted())return;
  const count=(s.cellsX*s.sub+1)*(s.cellsZ*s.sub+1);
  if(count*3!==b.byteLength)return;
  const offsets=new Int16Array(count),v=new DataView(b);
  for(let i=0;i<count;i++)offsets[i]=v.getInt16(i*2,true);
  const clip=new Uint8Array(b,count*2,count);
  return (ext:Extent,atlas:Sampler)=>new BoundedGrade(ext,s,offsets,clip,atlas);
 };
 try{return await Promise.race([read(),new Promise<undefined>(done=>{
  timer=setTimeout(()=>{ctl.abort();done(undefined);},ms);
 })]);}
 catch{return undefined;}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
