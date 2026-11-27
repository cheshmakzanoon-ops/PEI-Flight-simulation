import A from 'node:assert/strict';
import {test} from 'node:test';
import * as T from 'three';
import {WebGLAttributes} from '../node_modules/three/src/renderers/webgl/WebGLAttributes.js';
import {ResidentAttributeProbe} from '../src/render/resident-attribute-probe.ts';

function engine(){
 const AB=1,ABE=2,E=3,EE=4,C=5,CE=6;
 const bound=new Map(),stores=new Map(),canvas=new EventTarget();
 let ready=false,deleted=0; const gl={
  ARRAY_BUFFER:AB,ARRAY_BUFFER_BINDING:ABE,ELEMENT_ARRAY_BUFFER:E,ELEMENT_ARRAY_BUFFER_BINDING:EE,
  COPY_READ_BUFFER:C,COPY_READ_BUFFER_BINDING:CE,BUFFER_SIZE:7,FLOAT:8,UNSIGNED_SHORT:9,canvas,
  SYNC_GPU_COMMANDS_COMPLETE:10,ALREADY_SIGNALED:11,CONDITION_SATISFIED:12,TIMEOUT_EXPIRED:13,WAIT_FAILED:14,
  fenceSync(condition,flags){A.equal(condition,10);A.equal(flags,0);return {};},
  clientWaitSync(f,flags,timeout){A.ok(f);A.equal(flags,0);A.equal(timeout,0);return ready?12:13;},
  deleteSync(f){A.ok(f);deleted++;},
  getParameter(key){return bound.get(key-1)??null;},
  isContextLost(){return false;},
  createBuffer(){const b={};stores.set(b,new Uint8Array());return b;},
  isBuffer(b){return stores.has(b);},
  bindBuffer(key,b){bound.set(key,b);},
  bufferData(key,a){stores.set(bound.get(key),new Uint8Array(a.buffer,a.byteOffset,a.byteLength).slice());},
  bufferSubData(key,off,a,start=0,n=a.length){
   stores.get(bound.get(key)).set(new Uint8Array(a.buffer,a.byteOffset+start*a.BYTES_PER_ELEMENT,n*a.BYTES_PER_ELEMENT),off);
  },
  getBufferParameter(key){return stores.get(bound.get(key)).length;},
  getBufferSubData(key,offset,a){a.set(stores.get(bound.get(key)).subarray(offset,offset+a.byteLength));},
 };
 return {gl,canvas,ready(on){ready=on;},deleted(){return deleted;}};
}
test('matches actually uploaded words and rejects CPU-only or partially unuploaded changes',()=>{
 const {gl,ready,deleted}=engine();
 const a=new T.InstancedBufferAttribute(new Float32Array([1,2,3,4,5,6]),3);
 const other=gl.createBuffer();gl.bindBuffer(gl.COPY_READ_BUFFER,other);
 const p=new ResidentAttributeProbe(gl,a,gl.ARRAY_BUFFER_BINDING);
 A(!p.matches(6));
 const driver=WebGLAttributes(gl);
 driver.update(a,gl.ARRAY_BUFFER);
 A(!p.matches(6));A(!p.matches(6));A.equal(p.diagnostics.reads,0);
 ready(true);A(p.matches(6));A.equal(p.diagnostics.reads,1);A(p.matches(6));
 A.equal(p.diagnostics.reads,1);
 A.equal(gl.getParameter(gl.COPY_READ_BUFFER_BINDING),other);
 a.setX(0,100);
 A(!p.matches(6));
 a.array[5]=22;
 a.addUpdateRange(0,1);a.needsUpdate=true;driver.update(a,gl.ARRAY_BUFFER);
 A(!p.matches(3));A(p.matches(3));A(!p.matches(6));
 a.addUpdateRange(5,1);a.needsUpdate=true;driver.update(a,gl.ARRAY_BUFFER);
 A(!p.matches(6));A(p.matches(6));
 p.dispose();A.equal(deleted(),3);A(!p.matches(6));A.equal(a.onUploadCallback,T.BufferAttribute.prototype.onUploadCallback);
});

test('replay context epoch requires a fresh actual upload, not an old cached seal',()=>{
 const {gl,canvas,ready}=engine(),a=new T.BufferAttribute(new Uint16Array([0,1,2]),1);
 const p=new ResidentAttributeProbe(gl,a,gl.ELEMENT_ARRAY_BUFFER_BINDING);
 WebGLAttributes(gl).update(a,gl.ELEMENT_ARRAY_BUFFER);A(!p.matches(3));ready(true);A(p.matches(3));
 canvas.dispatchEvent(new Event('webglcontextlost'));A(!p.matches(3));
 canvas.dispatchEvent(new Event('webglcontextrestored'));A(!p.matches(3));
 WebGLAttributes(gl).update(a,gl.ELEMENT_ARRAY_BUFFER);A(!p.matches(3));ready(true);A(p.matches(3));
 p.dispose();
});

test('a failed fence cannot authorize words or schedule endless retries',()=>{
 const {gl,deleted}=engine();const a=new T.BufferAttribute(new Uint16Array([0,1,2]),1);
 let observed=0;gl.clientWaitSync=()=>{observed++;return gl.WAIT_FAILED;};
 const probe=new ResidentAttributeProbe(gl,a,gl.ELEMENT_ARRAY_BUFFER_BINDING);
 WebGLAttributes(gl).update(a,gl.ELEMENT_ARRAY_BUFFER);
 A(!probe.matches(3));A(!probe.matches(3));A(!probe.matches(3));
 A.equal(observed,1);A.equal(probe.diagnostics.reads,0);probe.dispose();A.equal(deleted(),1);
});

test('regional dynamic uploads are ignored while outside the local gate',()=>{
 const {gl,ready}=engine(),a=new T.BufferAttribute(new Float32Array([1,2,3]),3);
 let active=false;
 const probe=new ResidentAttributeProbe(gl,a,gl.ARRAY_BUFFER_BINDING,()=>active);
 const driver=WebGLAttributes(gl);
 driver.update(a,gl.ARRAY_BUFFER);
 active=true;ready(true);
 A(!probe.matches(3));A.equal(probe.diagnostics.reads,0);
 a.needsUpdate=true;driver.update(a,gl.ARRAY_BUFFER);
 A(!probe.matches(3));A(probe.matches(3));
 active=false;
 a.needsUpdate=true;driver.update(a,gl.ARRAY_BUFFER);
 active=true;A(!probe.matches(3));probe.dispose();
});
