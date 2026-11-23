import * as T from 'three';
import {BEACON_REVIEW as S} from './beaconsfield-review-spec.ts';
import {BEACON_ASSET as A} from './beaconsfield-review-asset.ts';
import {beaconsfieldPaints,finishBeaconsfieldMaterial,type BeaconPaint} from './beaconsfield-review-material.ts';

export function disposeBeaconsfieldPreview(obj:T.Group){
 const mat=new Set<T.Material>();
 obj.traverse(m=>{if(m instanceof T.Mesh){m.geometry.dispose();mat.add(m.material);}});
 for(const v of mat)v.dispose();
}

/** Lossless typed views of original, offline owner-clipped triangles. No on-load
 * Raycaster, clipping, welding, or high-level model geometry generation. */
export function decodeBeaconsfieldPreview(raw:ArrayBuffer){
 if(raw.byteLength!==A.decodedBytes)return;
 const d=new DataView(raw);
 if(d.getUint32(0,true)!==0x31414542||d.getUint16(4,true)!==A.batches||d.getUint16(6,true)!==1||
 d.getUint32(8,true)!==raw.byteLength||d.getUint32(12,true)!==0)return;
 let at=16,tris=0,vertices=0;
 const geometry:{type:BeaconPaint;name:string;nv:number;indices:number;offset:number}[]=[];
 const seen=new Set<number>();
 for(let i=0;i<A.batches;i++){
  if(at+12>raw.byteLength)return;
  const material=d.getUint16(at,true),closure=d.getUint16(at+2,true),nv=d.getUint16(at+4,true),
        reserved=d.getUint16(at+6,true),indexCount=d.getUint32(at+8,true);
  const type=beaconsfieldPaints[material],id=material*2+closure;
  if(!type||closure>1||reserved||seen.has(id)||nv<3||indexCount<3||indexCount%3||indexCount>A.triangles*3)return;
  const offset=at+12;
  at=offset+32*nv+Math.ceil(indexCount*2/4)*4;
  if(at>raw.byteLength)return;
  geometry.push({type,name:closure?'inside-outline closure: '+type:type,nv,indices:indexCount,offset});
  seen.add(id);tris+=indexCount/3;vertices+=nv;
 }
 if(at!==raw.byteLength||tris!==A.triangles||vertices!==A.uniqueVertices)return;
 const model=new T.Group(),mat=new Map<BeaconPaint,T.MeshStandardMaterial>();
 for(const {type,name,nv,indices,offset} of geometry){
  let material=mat.get(type);if(!material){material=finishBeaconsfieldMaterial(type);mat.set(type,material);}
  const g=new T.BufferGeometry();let off=offset;
  for(const [attribute,arity] of [['position',3],['normal',3],['uv',2]] as const){
   g.setAttribute(attribute,new T.BufferAttribute(new Float32Array(raw,off,nv*arity),arity));off+=4*arity*nv;
  }
  g.setIndex(new T.BufferAttribute(new Uint16Array(raw,off,indices),1));
  // The offline audit records the entire payload in [-10,+9] × [-1.2,+16.8]
  // × [-19,+11]; pass a conservative sphere to prevent per-vertex frame work.
  g.boundingSphere=new T.Sphere(new T.Vector3(-.5,7.8,-4),25);
  const mesh=new T.Mesh(g,material);mesh.name=name;model.add(mesh);
 }
 const [a,b]=S.basisXZ,[x,z]=S.centroidXZ;
 model.matrixAutoUpdate=false;
 model.matrix.set(a[0],0,b[0],x,0,1,0,S.floorCGVD,a[1],0,b[1],z,0,0,0,1);
 model.name='Beaconsfield Historic House · bounded exterior preview';
 model.userData={beaconsfield:true,minimumPlanInsetM:A.minimumInsetMetres,vertices:vertices,triangles:tris,absoluteBase:S.floorCGVD};
 return model;
}

async function boundedBody(stream:ReadableStream<Uint8Array>|null,size:number){
 if(!stream)return;
 const reader=stream.getReader(),out=new Uint8Array(size);let at=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)return at===size?out.buffer:out.buffer.slice(0,at);
   if(at+value.byteLength>size)return;
   out.set(value,at);at+=value.byteLength;
  }
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function sha(b:ArrayBuffer){
 const d=new Uint8Array(await crypto.subtle.digest('SHA-256',b));
 return Array.from(d,x=>x.toString(16).padStart(2,'0')).join('');
}
/** Only a validated, version-pinned request can suppress the existing record.
 * Wire-compressed data is checked before decompression. Already HTTP-decoded
 * content is also exact-pinned. No late group is built after timeout. */
export async function loadBeaconsfieldPreview(base:string,request:typeof fetch=fetch,timeoutMs=1400){
 if(!globalThis.crypto?.subtle)return;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const verify=async()=>{
  const res=await request(base+A.file,{signal:controller.signal});
  if(!res.ok||res.status!==200){void res.body?.cancel().catch(()=>{});return;}
  const body=await boundedBody(res.body,A.decodedBytes);
  if(!body||controller.signal.aborted)return;
  let raw:ArrayBuffer|undefined;
  if(body.byteLength===A.decodedBytes){
   // Hosts may mark .gz as Content-Encoding: gzip. Fetch then gives the
   // already-inflated body. The same exact decoded asset digest is mandatory.
   raw=body;
  }else{
   if(body.byteLength!==A.compressedBytes||await sha(body)!==A.compressedSha256||controller.signal.aborted)return;
   raw=await boundedBody(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip')),A.decodedBytes);
  }
  if(!raw||raw.byteLength!==A.decodedBytes||await sha(raw)!==A.decodedSha256||controller.signal.aborted)return;
  return raw;
 };
 try{
  const data=await Promise.race([verify(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(undefined);},timeoutMs);})]);
  if(data)return decodeBeaconsfieldPreview(data);
 }catch{/** Optional asset failure preserves the source owner. */}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
