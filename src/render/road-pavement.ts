import * as THREE from 'three';
import {PAVEMENT_ASSETS} from './pavement.generated.ts';

type Maps=[THREE.Texture,THREE.Texture];
export const PAVE_PRELOAD_AGL=155;
const SHA=(b:ArrayBuffer)=>crypto.subtle.digest('SHA-256',b).then(h=>Array.from(new Uint8Array(h),v=>v.toString(16).padStart(2,'0')).join(''));
async function pavementTexture(base:string,asset:typeof PAVEMENT_ASSETS[number]){
 const response=await fetch(base+'art/pavement/'+asset.file,{signal:AbortSignal.timeout(24000)});
 if(!response.ok||Number(response.headers.get('Content-Length'))>asset.bytes)throw Error('Optional pavement map is unavailable');
 const data=await response.arrayBuffer();
 if(data.byteLength!==asset.bytes||await SHA(data)!==asset.sha256)throw Error('Optional pavement image did not match');
 const image=await createImageBitmap(new Blob([data],{type:'image/webp'}),
  {imageOrientation:'none',colorSpaceConversion:'none',premultiplyAlpha:'none'});
 if(image.width!==512||image.height!==512){image.close();throw Error('Unexpected pavement dimensions');}
 const map=new THREE.Texture(image);
 map.name=asset.file;map.flipY=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.colorSpace=THREE.NoColorSpace;map.anisotropy=8;map.needsUpdate=true;
 return map;
}
/** Lazy optional material. The inherited colored ribbons need no art download. */
export class RoadPavement {
 readonly uniforms={roadPaveA:{value:null as THREE.Texture|null},roadPaveB:{value:null as THREE.Texture|null},roadPaveBlend:{value:0}};
 private request:'idle'|'loading'|'ready'|'failed'='idle';
 private loadedAt=-Infinity;
 private failureAt=Infinity;
 private attempts=0;
 private readonly base:string;
 constructor(base:string){this.base=base;}
 update(agl:number,now=performance.now()){
  if(this.request==='ready'){
   this.uniforms.roadPaveBlend.value=Math.max(0,Math.min(1,(now-this.loadedAt)/650));
   return;
  }
  if(this.request==='failed'&&this.attempts<2&&now-this.failureAt>=45000)this.request='idle';
  if(this.request!=='idle'||!(agl<PAVE_PRELOAD_AGL)||!globalThis.crypto?.subtle||!globalThis.createImageBitmap)return;
  this.request='loading';this.attempts++;
  void Promise.allSettled(PAVEMENT_ASSETS.map(a=>pavementTexture(this.base,a))).then(rows=>{
   if(rows.some(x=>x.status==='rejected')){
    for(const x of rows)if(x.status==='fulfilled'){
     (x.value.image as ImageBitmap)?.close();x.value.dispose();
    }
    this.failureAt=performance.now();this.request='failed';return;
   }
   const maps=rows.map(a=>(a as PromiseFulfilledResult<THREE.Texture>).value) as Maps;
   this.uniforms.roadPaveA.value=maps[0];this.uniforms.roadPaveB.value=maps[1];
   this.loadedAt=performance.now();this.request='ready';
  });
 }
 get state(){return this.request;}
}
