import {DataTexture,RGBAFormat,RepeatWrapping,LinearFilter,LinearMipmapLinearFilter} from 'three';
import {boundedPackedBody} from '../sim/packed-bytes.ts';
import {unpackGzip} from '../sim/compression.ts';

const shape=256,sourceBytes=259534,bodyBytes=shape*shape*4;
const sourceHash='60a0e48670c10350c70270682182841155fa10bf4829a040501b3ea0be0ba76f',bodyHash='36bdcec18705bb080f7532293b0141df76f1142fbf749e120937a726b38a90a7';
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async (a:ArrayBuffer)=>hex(await crypto.subtle.digest('SHA-256',a));
/** A generic, calibrated appearance reference. No per-tree location or species enters this texture. */
export async function loadWoodlandBark(base:string,request:typeof fetch=fetch){
 try{
  if(!globalThis.crypto?.subtle)return;
  const r=await request(base+'art/bark/wood-v1.rgba.gz',{signal:AbortSignal.timeout(4500)});
  if(r.status!==200){void r.body?.cancel().catch(()=>{});return;}
  const data=await boundedPackedBody(r.body,Math.max(sourceBytes,bodyBytes));
  if(data.byteLength!==sourceBytes&&data.byteLength!==bodyBytes)return;
  const decoded=data.byteLength===bodyBytes?data:await sha(data)===sourceHash?await unpackGzip(data):undefined;
  if(!decoded||decoded.byteLength!==bodyBytes||await sha(decoded)!==bodyHash)return;
  const t=new DataTexture(new Uint8Array(decoded),shape,shape,RGBAFormat);
  t.wrapS=t.wrapT=RepeatWrapping;t.magFilter=LinearFilter;t.minFilter=LinearMipmapLinearFilter;
  t.generateMipmaps=true;t.needsUpdate=true;
  return t;
 }catch{/* An optional fitted surface never blocks flight or the original bark shader. */}
}
