import * as T from 'three';
import {DALVAY_PACKET as A} from './dalvay-manor.generated.ts';
import {dalvayDigest} from './dalvay-exterior-seat.ts';import {dalvayFinish,type DalvayFinish} from './dalvay-exterior-material.ts';
/** Input is authenticated before this structural reader constructs even one material. */
export function decodeDalvay(raw:ArrayBuffer){
 if(raw.byteLength!==A.raw||new Uint16Array(Uint8Array.of(1,0).buffer)[0]!==1)return;
 const d=new DataView(raw);
 if(d.getUint32(0,true)!==0x31585644||d.getUint32(4,true)!==1||d.getUint32(8,true)!==5||d.getUint32(12,true)!==raw.byteLength)return;
 let at=16;const lanes:{p:DalvayFinish;arrays:Float32Array[];ix:Uint16Array}[]=[];
 for(const [i,s]of A.parts.entries()){
  const n=s.vertices,k=s.indices;if(d.getUint32(at,true)!==i||d.getUint32(at+4,true)!==n||d.getUint32(at+8,true)!==k||d.getUint32(at+12,true)!==0)return;at+=16;
  const arrays=[3,3,3,2].map(width=>{const a=new Float32Array(raw,at,width*n);at+=width*n*4;return a;});
  const ix=new Uint16Array(raw,at,k);at+=4*Math.ceil(k/2);lanes.push({p:s.material,arrays,ix});
 }
 if(at!==raw.byteLength)return;
 const group=new T.Group();group.name='Dalvay-by-the-Sea · documentary exterior';group.position.set(...A.origin);group.visible=false;
 const owned=lanes.map(p=>{
  const g=new T.BufferGeometry();for(const [i,name]of ['position','normal','color','uv'].entries())g.setAttribute(name,new T.BufferAttribute(p.arrays[i],i===3?2:3));
  g.setIndex(new T.BufferAttribute(p.ix,1));
  // All original registered positions fit this regular local bound. No vertex scan or triangulation in a render tick.
  g.boundingSphere=new T.Sphere(new T.Vector3(0,7.2,0),35);
  const m=dalvayFinish(p.p),q=new T.Mesh(g,m);q.name=m.name;group.add(q);
  return {q,g,m,ind:g.index,pos:g.getAttribute('position'),norm:g.getAttribute('normal'),rgb:g.getAttribute('color'),uv:g.getAttribute('uv')};
 });
 const original=group.position.clone(),zero=new T.Vector3(),one=new T.Vector3(1,1,1),unit=new T.Quaternion();let retired=false;
 const intact=()=>{
  if(retired||group.children.length!==5||!group.matrixAutoUpdate||!group.position.equals(original)||!group.quaternion.equals(unit)||!group.scale.equals(one)||group.layers.mask!==1)return false;
  for(let i=0;i<owned.length;i++){const {q,g,m,ind,pos,norm,rgb,uv}=owned[i];if(group.children[i]!==q||q.parent!==group||!q.visible||q.material!==m||!m.visible||
   q.geometry!==g||g.index!==ind||g.getAttribute('position')!==pos||g.getAttribute('normal')!==norm||g.getAttribute('color')!==rgb||g.getAttribute('uv')!==uv||
   g.drawRange.start!==0||g.drawRange.count!==Infinity||g.groups.length!==0||q.layers.mask!==1||!q.matrixAutoUpdate||!q.position.equals(zero)||!q.quaternion.equals(unit)||!q.scale.equals(one))return false;}
  return true;
 };
 return {group,intact,dispose(){if(retired)return;retired=true;group.visible=false;for(const g of owned){g.g.dispose();g.m.dispose();}group.removeFromParent();}};
}
async function body(stream:ReadableStream<Uint8Array>|null,limit:number,signal:AbortSignal){
 if(!stream||signal.aborted)return;const r=stream.getReader(),out=new Uint8Array(limit);let n=0;
 const cancel=()=>{void r.cancel().catch(()=>undefined);};signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){const {done,value}=await r.read();if(signal.aborted)return;
  if(done)return n===limit?out.buffer:undefined;if(value.byteLength>limit-n)return;out.set(value,n);n+=value.byteLength;}
 }finally{signal.removeEventListener('abort',cancel);cancel();r.releaseLock();}
}
export async function loadDalvay(base:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
 try{
  // Deliberately opaque suffix: Fetch sees the exact signed internal-gzip bytes, even behind a static CDN.
  const res=await fetcher(base+A.file,{signal});
  if(res.status!==200||signal.aborted){void res.body?.cancel().catch(()=>undefined);return;}
  const wire=await body(res.body,A.wire,signal);if(!wire||await dalvayDigest(wire)!==A.wireHash||signal.aborted)return;
  const raw=await body(new Blob([wire]).stream().pipeThrough(new DecompressionStream('gzip')),A.raw,signal);
  return raw&&await dalvayDigest(raw)===A.rawHash&&!signal.aborted?decodeDalvay(raw):undefined;
 }catch{return;}
}
