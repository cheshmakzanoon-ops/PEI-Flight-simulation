import * as T from 'three';
import {paint,paints,type Paint} from './green-gables-barn-materials.ts';
import {GREEN_GABLES_BARN as S} from './green-gables-barn-spec.ts';
import {GREEN_GABLES_BARN_ASSET as A} from './green-gables-barn-asset.ts';

export function disposeBarnReview(g:T.Group){
 for(const m of g.children)if(m instanceof T.Mesh){m.geometry.dispose();m.material.dispose();}
}
export function decodeBarnReview(data:ArrayBuffer){
 if(data.byteLength!==A.decodedBytes)return;
 const b=new DataView(data);
 if(b.getUint32(0,true)!==0x4e424747||b.getUint16(4,true)!==A.materials.length||
    b.getUint16(6,true)!==1||b.getUint32(8,true)!==data.byteLength||b.getUint32(12,true))return;
 const keys=Object.keys(paints) as Paint[];
 type Part={key:Paint;positions:Float32Array;normal:Float32Array;uv:Float32Array;index:Uint16Array};
 const parts:Part[]=[];let offset=16,tris=0,vertices=0;
 for(let j=0;j<A.materials.length;j++){
  if(offset+12>data.byteLength)return;
  const key=keys[b.getUint16(offset,true)],n=b.getUint16(offset+4,true),indices=b.getUint32(offset+8,true);
  if(key!==A.materials[j]||b.getUint16(offset+2,true)!==j||b.getUint16(offset+6,true)||
   n<3||indices<3||indices%3||indices>A.triangles*3)return;
  const at=offset+12;offset=at+32*n+4*Math.ceil(indices/2);
  if(offset>data.byteLength)return;
  const positions=new Float32Array(data,at,n*3),normal=new Float32Array(data,at+12*n,3*n),
   uv=new Float32Array(data,at+24*n,n*2),index=new Uint16Array(data,at+32*n,indices);
  const [x0,x1,z0,z1]=A.localXZ;
  if(index.some(x=>x>=n)||normal.some(x=>!Number.isFinite(x))||uv.some(x=>!Number.isFinite(x)))return;
  for(let i=0;i<positions.length;i+=3)
   if(!(positions[i]>=x0&&positions[i]<=x1&&positions[i+1]>=-2&&positions[i+1]<=9.29&&positions[i+2]>=z0&&positions[i+2]<=z1))return;
  parts.push({key,positions,normal,uv,index});tris+=indices/3;vertices+=n;
 }
 if(offset!==data.byteLength||tris!==A.triangles||vertices!==A.vertices)return;
 const group=new T.Group();
 for(const p of parts){
  const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(p.positions,3))
   .setAttribute('normal',new T.BufferAttribute(p.normal,3)).setAttribute('uv',new T.BufferAttribute(p.uv,2));
  g.setIndex(new T.BufferAttribute(p.index,1));g.computeBoundingSphere();
  const m=new T.Mesh(g,paint(p.key));m.name=p.key;group.add(m);
 }
 const [[xx,xz],[zx,zz]]=S.gameBasis,[x,z]=S.gameXZ;
 group.matrixAutoUpdate=false;group.matrix.set(xx,0,zx,x,0,1,0,S.modelSeatY,xz,0,zz,z,0,0,0,1);
 group.name='Green Gables Barn · regular N112 exterior preview';
 group.userData={barnReview:true,triangles:tris,vertices,seatY:S.modelSeatY};
 return group;
}
function hex(b:ArrayBuffer){return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
async function read(stream:ReadableStream<Uint8Array>|null){
 if(!stream)return;
 const r=stream.getReader(),buffer=new Uint8Array(A.decodedBytes);let at=0;
 try{
  for(;;){
   const {done,value}=await r.read();if(done)return at===buffer.length?buffer.buffer:buffer.buffer.slice(0,at);
   if(at+value.byteLength>buffer.length)return;
   buffer.set(value,at);at+=value.byteLength;
  }
 }finally{void r.cancel().catch(()=>{});r.releaseLock();}
}
/** A static host may return the gzip body as-is or decode transport gzip.
 * Only the exact explicit-flag art can replace the already submitted stock. */
export async function loadBarnReview(base:string,request:typeof fetch=fetch,wait=1400){
 if(!globalThis.crypto?.subtle)return;
 const ctl=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const verify=async()=>{
  const r=await request(base+A.asset,{signal:ctl.signal});
  if(r.status!==200||!r.ok||ctl.signal.aborted){void r.body?.cancel().catch(()=>{});return;}
  let data=await read(r.body);
  if(!data||ctl.signal.aborted)return;
  if(data.byteLength===A.wireBytes){
   if(hex(await crypto.subtle.digest('SHA-256',data))!==A.wireSha||ctl.signal.aborted)return;
   data=await read(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')));
  }
  return data?.byteLength===A.decodedBytes&&hex(await crypto.subtle.digest('SHA-256',data))===A.sha&&!ctl.signal.aborted?data:undefined;
 };
 try{
  const data=await Promise.race([verify(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{ctl.abort();resolve(undefined);},wait);})]);
  if(data&&!ctl.signal.aborted)return decodeBarnReview(data);
 }catch{/** Stock q72 and the independent House are retained. */}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
