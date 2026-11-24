import * as T from 'three';
import type {BuildingShadows} from '../local-building-shadows.ts';
import {railPenumbraGLSL} from '../summerside-station/rail-penumbra.ts';
import {ST_DAVIDS as S} from './source.generated.ts';
import {ST_DAVIDS_ART as A} from './art.generated.ts';
import {stDavidsSha} from './admit.ts';

type Paint=(typeof A.parts)[number];
type Part={paint:Paint;xyz:Float32Array;normal:Float32Array;uv:Float32Array;color:Float32Array;ix:Uint16Array;texels?:Uint8Array};
type Receiver={uniforms:BuildingShadows['uniforms']};
export type StDavidsArt={group:T.Group;caster:T.Mesh;dispose:()=>void};

function material(p:Paint,pixels:Uint8Array|undefined,shadows:Receiver){
 const color=new T.Color().setRGB(p.rgb[0]/255,p.rgb[1]/255,p.rgb[2]/255,T.SRGBColorSpace);
 const m=new T.MeshStandardMaterial({color:pixels?0xffffff:color,vertexColors:true,roughness:p.rough,metalness:p.metal});
 m.name=p.name;
 if(pixels&&'repeat' in p){
  const t=new T.DataTexture(pixels,p.textureSize,p.textureSize,T.RGBAFormat);
  t.name='Original St. David’s painted/refinished surface: '+p.name;t.colorSpace=T.SRGBColorSpace;
  t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;t.repeat.set(p.repeat[0],p.repeat[1]);
  t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;m.map=t;
 }
 const glass=p.name==='glass'||p.name.endsWith('Glass');
 if(glass){m.emissive.setRGB(.006,.009,.010);m.emissiveIntensity=.48;}
 m.customProgramCacheKey=()=>glass?'st-davids-opaque-glazing-v1':'st-davids-original-exterior-v1';
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,shadows.uniforms);
  s.vertexShader='varying vec3 sdavWorld;\n'+s.vertexShader.replace('#include <worldpos_vertex>',
    '#include <worldpos_vertex>\nsdavWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  // Reuse the station's tested continuous tent. No shader/uniform changes on
  // any existing terrain, road, tree or standard building receiver material.
  s.fragmentShader=s.fragmentShader.replace('#include <common>',
    '#include <common>\nvarying vec3 sdavWorld;\n'+railPenumbraGLSL);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   vec3 sdavNormal=normalize(inverseTransformDirection(normal,viewMatrix));
   float sdavOcclusion=railBuildingShade(sdavWorld,sdavNormal,distance(sdavWorld,cameraPosition));
   reflectedLight.directDiffuse*=1.-sdavOcclusion;
   reflectedLight.directSpecular*=1.-sdavOcclusion;`);
  if(glass)s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    vec3 sdavRay=inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix);
    float sdavFresnel=.1+.90*pow(1.-max(dot(normal,normalize(vViewPosition)),0.),4.9);
    vec3 sdavSky=mix(vec3(.017,.021,.016),vec3(.15,.21,.27),smoothstep(-.08,.78,sdavRay.y));
    totalEmissiveRadiance+=.38*sdavFresnel*sdavSky;`);
 };
 return m;
}

/** Material groups are pre-baked from the exact owner-only asset. No
 * procedural geometry or image requests are on the approach/load path. */
export function decodeStDavids(raw:ArrayBuffer,shadows:Receiver):StDavidsArt|undefined{
 if(raw.byteLength!==A.raw||new Uint16Array(Uint8Array.of(1,0).buffer)[0]!==1)return;
 const v=new DataView(raw),parts:Part[]=[];
 if(v.getUint32(0,true)!==0x56414453||v.getUint16(4,true)!==1||v.getUint16(6,true)!==A.parts.length||
  v.getUint32(8,true)!==A.raw||v.getUint32(12,true))return;
 let pos=16,triangles=0,vertexN=0;
 for(const [i,p] of A.parts.entries()){
  if(pos+16>raw.byteLength||v.getUint16(pos,true)!==i||v.getUint16(pos+2,true)!==p.nv||v.getUint32(pos+4,true)!==p.ni||
     v.getUint32(pos+8,true)!==p.textureSize||v.getUint32(pos+12,true))return;
  pos+=16;
  const ip=4*Math.ceil(p.ni/2),sz=p.textureSize*p.textureSize*4;
  if(pos+44*p.nv+ip+sz>raw.byteLength)return;
  const slice=(n:number)=>{const a=new Float32Array(raw,pos,n);pos+=n*4;return a;};
  const xyz=slice(p.nv*3),normal=slice(p.nv*3),uv=slice(p.nv*2),color=slice(p.nv*3);
  const ix=new Uint16Array(raw,pos,p.ni);pos+=ip;
  const texels=sz?new Uint8Array(raw,pos,sz):undefined;pos+=sz;
  if(ix.some(i=>i>=p.nv)||normal.some(n=>!Number.isFinite(n)||Math.abs(n)>1.001)||
    uv.some(n=>!Number.isFinite(n)||Math.abs(n)>64)||color.some(n=>!(n>=0&&n<=1.001)))return;
  const b=S.localMinMaxXYZ;
  for(let j=0;j<xyz.length;j+=3)for(let k=0;k<3;k++)if(!(xyz[j+k]>=b[k]-.000001&&xyz[j+k]<=b[3+k]+.000001))return;
  parts.push({paint:p,xyz,normal,uv,color,ix,texels});triangles+=p.ni/3;vertexN+=p.nv;
 }
 if(pos!==A.raw||triangles!==A.triangles||vertexN>=65536)return;
 const g=new T.Group(),matrix=g.matrix,[x,z]=S.originXZ,[[ux,uz],[vx,vz]]=S.basisXZ;
 g.name='St. David’s United Church · bounded 2020 exterior';g.visible=false;g.matrixAutoUpdate=false;
 matrix.set(ux,0,vx,x,0,1,0,S.seatY,uz,0,vz,z,0,0,0,1);g.matrixWorldNeedsUpdate=true;
 const shadow=new Float32Array(vertexN*3),ind=new Uint16Array(triangles*3);let p0=0,i0=0;
 for(const p of parts){
  const b=new T.BufferGeometry();
  for(const [k,v,width] of [['position',p.xyz,3],['normal',p.normal,3],['uv',p.uv,2],['color',p.color,3]] as const)b.setAttribute(k,new T.BufferAttribute(v,width));
  b.setIndex(new T.BufferAttribute(p.ix,1));b.computeBoundingBox();b.computeBoundingSphere();
  const m=new T.Mesh(b,material(p.paint,p.texels,shadows));m.name=p.paint.name;g.add(m);
  // Flatten only the affine basis, not the positions/triangles. The production
  // shadow roster's transform contract is translation-only.
  for(let j=0;j<p.xyz.length;j+=3){
   const [a,h,c]=[p.xyz[j],p.xyz[j+1],p.xyz[j+2]];
   shadow[p0+j]=a*ux+c*vx;shadow[p0+j+1]=h;shadow[p0+j+2]=a*uz+c*vz;
  }
  for(let j=0;j<p.ix.length;j++)ind[i0+j]=p.ix[j]+p0/3;
  p0+=p.xyz.length;i0+=p.ix.length;
 }
 const casterGeo=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(shadow,3))
  .setAttribute('facadeStyle',new T.BufferAttribute(new Float32Array(vertexN),1)).setIndex(new T.BufferAttribute(ind,1));
 casterGeo.computeBoundingSphere();
 const caster=new T.Mesh(casterGeo,new T.MeshBasicMaterial({side:T.DoubleSide}));
 caster.name='Exact St. David’s opaque exterior caster';caster.position.set(x,S.seatY,z);caster.updateMatrixWorld(true);
 let released=false;
 return {group:g,caster,dispose(){
  if(released)return;
  released=true;g.removeFromParent();
  for(const q of g.children){const m=q as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;m.geometry.dispose();m.material.map?.dispose();m.material.dispose();}
  casterGeo.dispose();caster.material.dispose();
 }};
}

async function readBody(stream:ReadableStream<Uint8Array>|null,limit:number,signal:AbortSignal){
 if(!stream||signal.aborted)return;
 const r=stream.getReader(),out=new Uint8Array(limit);let n=0;
 const cancel=()=>{void r.cancel().catch(()=>undefined);};signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){
  const {done,value}=await r.read();if(signal.aborted)return;
  if(done)return n===limit?out.buffer:out.buffer.slice(0,n);
  if(value.byteLength>limit-n)return;
  out.set(value,n);n+=value.byteLength;
 }}finally{signal.removeEventListener('abort',cancel);cancel();r.releaseLock();}
}
export async function loadStDavids(base:string,shadows:Receiver,fetcher:typeof fetch=fetch,timeoutMs=1400){
 if(!globalThis.crypto?.subtle)return;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const signal=controller.signal;
 const exact=async()=>{
  const r=await fetcher(base+A.file,{signal});
  if(r.status!==200||signal.aborted){void r.body?.cancel().catch(()=>undefined);return;}
  let b=await readBody(r.body,A.raw,signal);
  if(!b||signal.aborted)return;
  if(b.byteLength===A.wire){
   if(await stDavidsSha(b)!==A.wireSha||signal.aborted)return;
   b=await readBody(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip')),A.raw,signal);
  }
  if(b?.byteLength===A.raw&&await stDavidsSha(b)===A.rawSha&&!signal.aborted)return b;
 };
 try{
  const data=await Promise.race([exact(),new Promise<undefined>(ok=>{timer=setTimeout(()=>{controller.abort();ok(undefined);},timeoutMs);})]);
  if(data&&!signal.aborted)return decodeStDavids(data,shadows);
 }catch{/** Never conceal the stock shell for missing, oversized or unverified optional art. */}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
