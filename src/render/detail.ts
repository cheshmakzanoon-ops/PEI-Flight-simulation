import * as THREE from 'three';
import {DetailTemporaryError,detailHttpTemporary} from './detail-retry.ts';
export interface DetailEntry{pack:number;offset:number;bytes:number;sha256:string;}
interface Index {version?:number;bounds?:number[];tilePixels?:number;columns:number;rows:number;packs:{file:string;bytes:number;sha256:string}[];tiles:Record<string,DetailEntry>;}
/** HTTP Range when supported; hosts returning 200 are deduplicated to one cached full response per pack. */
export class DetailImagery{
 private readonly receipt?: (id:string,sha:string,texture:THREE.Texture)=>void;
 constructor(receipt?: (id:string,sha:string,texture:THREE.Texture)=>void){this.receipt=receipt;}
 private index?:Index;private full=new Map<number,ArrayBuffer>();private probe=new Map<number,Promise<void>>();
 private base=import.meta.env.BASE_URL+'world/detail/';private pending?:Promise<Index>;
 private async fetchBody<T>(name:string, decode:(r:Response)=>Promise<T>,headers?:HeadersInit) {
  let res:Response;
  try {res=await fetch(this.base+name,{headers,signal:AbortSignal.timeout(6500)});}
  catch(cause){throw new DetailTemporaryError('Detail connection interrupted',{cause});}
  if(!res.ok){
   const message='Unavailable detail data: '+res.status;
   throw detailHttpTemporary(res.status)?new DetailTemporaryError(message):new Error(message);
  }
  try{return {res,body:await decode(res)};}
  catch(cause){
   if(cause instanceof TypeError||(cause instanceof DOMException&&(cause.name==='TimeoutError'||cause.name==='AbortError'))){
    throw new DetailTemporaryError('Detail response interrupted',{cause});
   }
   throw cause;
  }
 }
 private catalog(){
  if(this.index)return Promise.resolve(this.index);
  if(!this.pending)this.pending=this.fetchBody('index.json',r=>r.json() as Promise<Index>)
   .then(({body})=>this.index=body).finally(()=>{this.pending=undefined;});
  return this.pending;
 }
 private async bytes(a:DetailEntry){
  const pack=this.index!.packs[a.pack],end=a.offset+a.bytes-1;
  const slice=()=>this.full.get(a.pack)!.slice(a.offset,end+1);
  if(this.full.has(a.pack))return slice();
  // Do not issue a second range until it is known whether this host sends the whole file.
  if(this.probe.has(a.pack)){await this.probe.get(a.pack);if(this.full.has(a.pack))return slice();}
  let release!:()=>void;
  if(!this.probe.has(a.pack))this.probe.set(a.pack,new Promise<void>(r=>release=r));
  try{
   const {res:r,body:b}=await this.fetchBody(pack.file,r=>r.arrayBuffer(),{Range:'bytes='+a.offset+'-'+end});
   if(r.status===200&&b.byteLength===pack.bytes){this.full.set(a.pack,b);return slice();}
   if(r.status===206&&b.byteLength===a.bytes&&r.headers.get('content-range')==='bytes '+a.offset+'-'+end+'/'+pack.bytes)return b;
   throw Error('Invalid detail pack response');
  }finally{release?.();}
 }
 async load(id:string){
  const catalog=await this.catalog();
  const a=catalog.tiles[id];if(!a)return null;
  const data=await this.bytes(a);
  let verified:string|undefined;
  if(crypto.subtle&&a.sha256){
    const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),i=>i.toString(16).padStart(2,'0')).join('');
    if(h!==a.sha256)throw Error('Detail tile checksum mismatch');
    verified=h;
  }
  const blob=new Blob([data],{type:'image/webp'});let t:THREE.Texture;
  if('createImageBitmap'in globalThis){const im=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});t=new THREE.Texture(im);t.flipY=false;}
  else{const u=URL.createObjectURL(blob);try{t=await new THREE.TextureLoader().loadAsync(u);}finally{URL.revokeObjectURL(u);}}
  // This atlas stores scaled linear TCI values, not sRGB albedo.
  t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;t.needsUpdate=true;
  if(this.receipt&&verified&&catalog.version===1&&catalog.columns===32&&catalog.rows===22&&catalog.tilePixels===640&&
     catalog.bounds?.length===4&&[-64.47,45.94,-61.93,47.10].every((v,i)=>catalog.bounds?.[i]===v))this.receipt(id,verified,t);
  return t;
 }
}
