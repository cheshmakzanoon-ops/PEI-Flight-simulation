import * as T from 'three';
import {OLEARY_PACKET as P} from './packet.generated.ts';
import {olearyFinish} from './finish.ts';
import {olearySha} from './authority.ts';
/** The signed packet is the exact five indexed authored draws; no CPU meshing at mount. */
export function decodeOleary(raw:ArrayBuffer){
 if(raw.byteLength!==P.raw||new Uint16Array(Uint8Array.of(1,0).buffer)[0]!==1)return;
 const view=new DataView(raw);
 if(view.getUint32(0,true)!==0x31584c4f||view.getUint32(4,true)!==1||view.getUint32(8,true)!==5||view.getUint32(12,true)!==raw.byteLength)return;
 let at=16;
 const lanes=[];
 for(const [i,q]of P.parts.entries()){
  if(view.getUint32(at,true)!==i||view.getUint32(at+4,true)!==q.vertices||view.getUint32(at+8,true)!==q.indices||view.getUint32(at+12,true)!==0)return;
  at+=16;
  const arrays=[3,3,3,2].map(k=>{const a=new Float32Array(raw,at,k*q.vertices);at+=k*q.vertices*4;return a;});
  const ix=new Uint16Array(raw,at,q.indices);at+=(q.indices+(q.indices%2))*2;
  lanes.push({id:q.id,arrays,ix});
 }
 if(at!==raw.byteLength)return;
 const group=new T.Group();group.name='O’Leary Railway Station · original documentary exterior';group.position.set(...P.origin);group.visible=false;
 const originalPosition=group.position.clone(),zero=new T.Vector3(),one=new T.Vector3(1,1,1),unit=new T.Quaternion();
 const owned=lanes.map(({id,arrays,ix})=>{
  const g=new T.BufferGeometry(),attrs=arrays.map((a,i)=>new T.BufferAttribute(a,i===3?2:3)),names=['position','normal','color','uv'];
  for(const [i,key]of names.entries())g.setAttribute(key,attrs[i]);
  const index=new T.BufferAttribute(ix,1);g.setIndex(index);
  g.boundingSphere=new T.Sphere(new T.Vector3(0,3.7,0),13.2);
  const m=olearyFinish(id),q=new T.Mesh(g,m);q.name=m.name;group.add(q);
  return {q,g,m,index,attrs,names,ix,arrays,compile:m.onBeforeCompile,key:m.customProgramCacheKey,roughness:m.roughness};
 });
 let dead=false;
 function intact(){
  if(dead||group.children.length!==5||!group.position.equals(originalPosition)||!group.scale.equals(one)||!group.quaternion.equals(unit)||
    !group.matrixAutoUpdate||group.layers.mask!==1||group.renderOrder!==0)return false;
  return owned.every(({q,g,m,attrs,names,index,ix,arrays,compile,key,roughness},i)=>
   group.children[i]===q&&q.parent===group&&q.material===m&&m.visible&&!m.transparent&&m.depthTest&&m.depthWrite&&m.opacity===1&&m.colorWrite&&m.vertexColors&&
   m.onBeforeCompile===compile&&m.customProgramCacheKey===key&&m.roughness===roughness&&m.metalness===0&&m.side===T.DoubleSide&&m.alphaTest===0&&
   !m.envMap&&!m.clippingPlanes&&!m.polygonOffset&&q.renderOrder===0&&!q.castShadow&&!q.receiveShadow&&
   q.geometry===g&&q.visible&&q.matrixAutoUpdate&&q.layers.mask===1&&q.position.equals(zero)&&q.scale.equals(one)&&q.quaternion.equals(unit)&&
   g.index===index&&index.array===ix&&index.version===0&&g.drawRange.start===0&&g.drawRange.count===Infinity&&!g.groups.length&&
   attrs.every((a,i)=>g.getAttribute(names[i])===a&&a.array===arrays[i]&&a.version===0));
 }
 return {group,intact,dispose(){if(dead)return;dead=true;group.visible=false;group.removeFromParent();for(const {g,m}of owned){g.dispose();m.dispose();}}};
}
/** Opaque suffix keeps the fetched bytes truly signed even on HTTP hosts that inflate .gz assets. */
async function sized(body:ReadableStream<Uint8Array>|null,n:number,signal:AbortSignal){
 if(!body||signal.aborted)return;
 const r=body.getReader(),out=new Uint8Array(n),cancel=()=>void r.cancel().catch(()=>undefined);
 let at=0;signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){const q=await r.read();if(signal.aborted)return;if(q.done)return at===n?out.buffer:undefined;
  if(q.value.byteLength>n-at)return;out.set(q.value,at);at+=q.value.byteLength;
 }}finally{signal.removeEventListener('abort',cancel);cancel();r.releaseLock();}
}
export async function loadOleary(base:string,signal:AbortSignal,transport:typeof fetch=fetch){
 try{
  if(signal.aborted)return;
  const res=await transport(base+P.file,{signal});
  if(res.status!==200||signal.aborted){void res.body?.cancel().catch(()=>undefined);return;}
  const wire=await sized(res.body,P.bytes,signal);
  if(!wire||await olearySha(wire)!==P.packedSHA256||signal.aborted)return;
  const raw=await sized(new Blob([wire]).stream().pipeThrough(new DecompressionStream('gzip')),P.raw,signal);
  return raw&&await olearySha(raw)===P.rawSHA256&&!signal.aborted?decodeOleary(raw):undefined;
 }catch{return;}
}
