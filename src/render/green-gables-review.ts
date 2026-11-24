import * as T from 'three';
import {greenPaint,paints,type GreenPaint} from './green-gables-materials.ts';
import {GREEN_GABLES_ASSET as A} from './green-gables-review-asset.ts';
import {GREEN_GABLES_REVIEW as S} from './green-gables-review-spec.ts';

export function disposeGreenGablesPreview(g:T.Group){
 const mats=new Set<T.Material>();
 for(const obj of g.children)if(obj instanceof T.Mesh){obj.geometry.dispose();mats.add(obj.material);}
 for(const m of mats)m.dispose();
}
export function decodeGreenGablesPreview(raw:ArrayBuffer){
 if(raw.byteLength!==A.decodedBytes)return;
 const b=new DataView(raw),len=b.getUint16(4,true),g=new T.Group();
 if(b.getUint32(0,true)!==0x32424747||len!==A.materials.length||b.getUint16(6,true)!==2||
  b.getUint32(8,true)!==raw.byteLength||b.getUint32(12,true)!==0)return;
 type Section={k:GreenPaint;n:number;elements:number;at:number};
 const sections:Section[]=[],pa=Object.keys(paints) as GreenPaint[];
 let offset=16,triangles=0,vertices=0;
 for(let j=0;j<len;j++){
  if(offset+12>raw.byteLength)return;
  const paint=pa[b.getUint16(offset,true)],id=b.getUint16(offset+2,true),n=b.getUint16(offset+4,true),elements=b.getUint32(offset+8,true);
  const at=offset+12;
  if(id!==j||!paint||A.materials[j]!==paint||b.getUint16(offset+6,true)||n<3||elements<3||elements>A.triangles*3||elements%3)return;
  offset=at+n*32+4*Math.ceil(elements/2);
  if(offset>raw.byteLength)return;
  sections.push({k:paint,n,elements,at});vertices+=n;triangles+=elements/3;
 }
 if(offset!==raw.byteLength||triangles!==A.triangles||vertices!==A.vertices)return;
 for(const {k,n,elements,at} of sections){
  const m=greenPaint(k);
  const s=new T.BufferGeometry();let a=at;
  for(const [key,dim] of [['position',3],['normal',3],['uv',2]] as const){
   s.setAttribute(key,new T.BufferAttribute(new Float32Array(raw,a,n*dim),dim));a+=4*n*dim;
  }
  s.setIndex(new T.BufferAttribute(new Uint16Array(raw,a,elements),1));
  s.boundingSphere=new T.Sphere(new T.Vector3(3.5,3.5,1.2),14.6);
  const o=new T.Mesh(s,m);o.name=k;g.add(o);
 }
 const [[xx,xz],[zx,zz]]=S.basisXZ,[x,z]=S.centroidXZ;
 g.matrixAutoUpdate=false;g.matrix.set(xx,0,zx,x,0,1,0,S.modelSeatY,xz,0,zz,z,0,0,0,1);
 g.name='Green Gables House · source-bounded exterior preview';
 g.userData={greenGables:true,triangles,vertices,seatY:S.modelSeatY,relativeTerrainOffset:S.modelSeatY-S.sourceCGVD};
 return g;
}

function hex(d:ArrayBuffer){return Array.from(new Uint8Array(d),v=>v.toString(16).padStart(2,'0')).join('');}
async function body(stream:ReadableStream<Uint8Array>|null,bound:number){
 if(!stream)return;
 const r=stream.getReader(),q=new Uint8Array(bound);let offset=0;
 try{for(;;){const {done,value}=await r.read();if(done)return offset===bound?q.buffer:q.buffer.slice(0,offset);
  if(offset+value.byteLength>bound)return;
  q.set(value,offset);offset+=value.byteLength;
 }}finally{void r.cancel().catch(()=>{});r.releaseLock();}
}
/** Same immutable art through gzip passthrough or an HTTP-decoding static host. */
export async function loadGreenGablesPreview(base:string,request:typeof fetch=fetch,timeout=1400){
 if(!globalThis.crypto?.subtle)return;
 const ctl=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const verify=async()=>{
  const r=await request(base+A.asset,{signal:ctl.signal});
  if(r.status!==200||!r.ok){void r.body?.cancel().catch(()=>{});return;}
  let raw=await body(r.body,A.decodedBytes);
  if(!raw||ctl.signal.aborted)return;
  if(raw.byteLength===A.wireBytes){
   if(hex(await crypto.subtle.digest('SHA-256',raw))!==A.wireSha||ctl.signal.aborted)return;
   raw=await body(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip')),A.decodedBytes);
  }
  if(!raw||raw.byteLength!==A.decodedBytes||hex(await crypto.subtle.digest('SHA-256',raw))!==A.sha||ctl.signal.aborted)return;
  return raw;
 };
 try{
  const raw=await Promise.race([verify(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{ctl.abort();resolve(undefined);},timeout);})]);
  if(raw)return decodeGreenGablesPreview(raw);
 }catch{/** Any optional response failure keeps every stock building. */}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
