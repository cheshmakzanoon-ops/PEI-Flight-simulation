import * as THREE from 'three';
export interface DetailEntry{pack:number;offset:number;bytes:number;sha256:string;}
interface Index {columns:number;rows:number;packs:{file:string;bytes:number;sha256:string}[];tiles:Record<string,DetailEntry>;}
/** HTTP Range when supported; hosts returning 200 are deduplicated to one cached full response per pack. */
export class DetailImagery{
 private index?:Index;private full=new Map<number,ArrayBuffer>();private probe=new Map<number,Promise<void>>();
 private base=import.meta.env.BASE_URL+'world/detail/';private ready:Promise<void>;
 constructor(){this.ready=fetch(this.base+'index.json').then(async r=>{if(!r.ok)throw Error('Detail index unavailable');this.index=await r.json() as Index;});}
 private async bytes(a:DetailEntry){
  const pack=this.index!.packs[a.pack],end=a.offset+a.bytes-1;
  const slice=()=>this.full.get(a.pack)!.slice(a.offset,end+1);
  if(this.full.has(a.pack))return slice();
  // Do not issue a second range until it is known whether this host sends the whole file.
  if(this.probe.has(a.pack)){await this.probe.get(a.pack);if(this.full.has(a.pack))return slice();}
  let release!:()=>void;
  if(!this.probe.has(a.pack))this.probe.set(a.pack,new Promise<void>(r=>release=r));
  try{
   const r=await fetch(this.base+pack.file,{headers:{Range:'bytes='+a.offset+'-'+end}});
   if(!r.ok)throw Error('Unavailable detail tile: '+r.status);
   const b=await r.arrayBuffer();
   if(r.status===200&&b.byteLength===pack.bytes){this.full.set(a.pack,b);return slice();}
   if(r.status===206&&b.byteLength===a.bytes&&r.headers.get('content-range')==='bytes '+a.offset+'-'+end+'/'+pack.bytes)return b;
   throw Error('Invalid detail pack response');
  }finally{release?.();}
 }
 async load(id:string){
  await this.ready;const a=this.index?.tiles[id];if(!a)return null;
  const data=await this.bytes(a);
  if(crypto.subtle&&a.sha256){
    const h=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),i=>i.toString(16).padStart(2,'0')).join('');
    if(h!==a.sha256)throw Error('Detail tile checksum mismatch');
  }
  const blob=new Blob([data],{type:'image/webp'});let t:THREE.Texture;
  if('createImageBitmap'in globalThis){const im=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none'});t=new THREE.Texture(im);t.flipY=false;}
  else{const u=URL.createObjectURL(blob);try{t=await new THREE.TextureLoader().loadAsync(u);}finally{URL.revokeObjectURL(u);}}
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;return t;
 }
}
