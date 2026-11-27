import * as T from 'three';
type Words=Float32Array|Uint16Array;
type Seal={buffer:WebGLBuffer;version:number;sync?:WebGLSync;pollFailed?:boolean;bytes?:Uint8Array};
const readLimit=16_384;

/** Proven from the exact r187 upload callback, not inferred from the CPU
 * roster. The first check after each upload warms a zero-wait GPU fence.
 * A later frame may read the bounded prefix only after that fence signals. */
export class ResidentAttributeProbe{
 private readonly attr:T.BufferAttribute;
 private readonly active:()=>boolean;
 private readonly source:Words;
 private readonly cb:()=>void;
 private readonly previous:()=>void;
 private readonly gl:WebGL2RenderingContext;
 private readonly deadContext=()=>{this.resident=undefined;this.epoch++;};
 private readonly canvas:HTMLCanvasElement|OffscreenCanvas;
 private resident?:Seal;
 private epoch=0;
 private done=false;
 private reads=0;
 constructor(gl:WebGL2RenderingContext,a:T.BufferAttribute,binding:number,
  active:()=>boolean=()=>true){
  this.active=active;
  if(T.REVISION!=='187'||!(a.array instanceof Float32Array||a.array instanceof Uint16Array)||a.normalized||
     (binding!==gl.ARRAY_BUFFER_BINDING&&binding!==gl.ELEMENT_ARRAY_BUFFER_BINDING)||
     a.onUploadCallback!==T.BufferAttribute.prototype.onUploadCallback)
   throw new TypeError('unrecognized resident source attribute');
  this.attr=a;this.source=a.array;this.previous=a.onUploadCallback;
  this.gl=gl;this.canvas=gl.canvas;
  this.cb=()=>{
   this.releaseSeal();
   if(this.done||!this.active()||gl.isContextLost()||a.array!==this.source)return;
   const buffer=gl.getParameter(binding) as WebGLBuffer|null;
   if(buffer&&gl.isBuffer(buffer)){
    this.epoch++;this.resident={buffer,version:a.version};
   }
  };
  a.onUpload(this.cb);
  this.canvas.addEventListener('webglcontextlost',this.deadContext);
  this.canvas.addEventListener('webglcontextrestored',this.deadContext);
 }
 private releaseSeal(){
  const sync=this.resident?.sync;this.resident=undefined;
  if(sync&&!this.gl.isContextLost())this.gl.deleteSync(sync);
 }
 get diagnostics(){return {epoch:this.epoch,reads:this.reads,cachedBytes:this.resident?.bytes?.length??0};}
 matches(words:number){
  const {gl,attr,source,resident:r}=this;
  if(this.done||!this.active()||!Number.isInteger(words)||words<0||words>source.length||gl.isContextLost()||
     !r||r.version!==attr.version||attr.array!==source||attr.onUploadCallback!==this.cb||
     !gl.isBuffer(r.buffer))return false;
  const count=words*source.BYTES_PER_ELEMENT;
  if(count>readLimit)return false;
  const cpu=new Uint8Array(source.buffer,source.byteOffset,count);
  if(!r.bytes||r.bytes.length<count){
   if(r.pollFailed)return false;
   if(!r.sync){
    r.sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0)??undefined;
    if(!r.sync)r.pollFailed=true;
    return false;
   }
   const outcome=gl.clientWaitSync(r.sync,0,0);
   if(outcome===gl.TIMEOUT_EXPIRED)return false;
   if(outcome!==gl.ALREADY_SIGNALED&&outcome!==gl.CONDITION_SATISFIED){r.pollFailed=true;return false;}
   // Keep the signaled fence until a new upload. It covers a later longer
   // prefix too, without queuing a second fence or reading early.
   const prev=gl.getParameter(gl.COPY_READ_BUFFER_BINDING) as WebGLBuffer|null;
   try{
    gl.bindBuffer(gl.COPY_READ_BUFFER,r.buffer);
    if(gl.getBufferParameter(gl.COPY_READ_BUFFER,gl.BUFFER_SIZE)!==source.byteLength)return false;
    // Finite coordinates and small signed indices cannot be an all-ones
    // suffix. A silently failed native copy must not authenticate.
    const bytes=new Uint8Array(count);bytes.fill(255);
    gl.getBufferSubData(gl.COPY_READ_BUFFER,0,bytes);
    if(gl.isContextLost())return false;
    this.reads++;
    if(count&&bytes.every(v=>v===255))return false;
    r.bytes=bytes;
   }catch{return false;}
   finally{gl.bindBuffer(gl.COPY_READ_BUFFER,prev);}
  }
  for(let k=0;k<count;k++)if(r.bytes[k]!==cpu[k])return false;
  return true;
 }
 dispose(){
  if(this.done)return;
  this.done=true;this.releaseSeal();
  if(this.attr.onUploadCallback===this.cb)this.attr.onUpload(this.previous);
  this.canvas.removeEventListener('webglcontextlost',this.deadContext);
  this.canvas.removeEventListener('webglcontextrestored',this.deadContext);
 }
}
