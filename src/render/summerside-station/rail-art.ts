import * as T from 'three';
import type {BuildingShadows} from '../local-building-shadows.ts';
import {SUMMERSIDE_STATION as S} from './source.generated.ts';
import {RAIL_ART as A} from './art.generated.ts';
import {sha} from './admit.ts';
import {railPenumbraGLSL} from './rail-penumbra.ts';

type Paint=(typeof A.parts)[number];
type Part={type:Paint;vertices:Float32Array;normals:Float32Array;uv:Float32Array;colour:Float32Array;faces:Uint16Array;pixels?:Uint8Array;};
type RailRenderer={uniforms:BuildingShadows['uniforms']};
export type RailwayArtwork={group:T.Group;caster:T.Mesh;dispose:()=>void};

function authoredMaterial(type:Paint,pixels:Uint8Array|undefined,casts:RailRenderer){
 const rgb=new T.Color().setRGB(type.rgb[0]/255,type.rgb[1]/255,type.rgb[2]/255,T.SRGBColorSpace);
 const material=new T.MeshStandardMaterial({color:pixels?0xffffff:rgb,vertexColors:true,roughness:type.rough,metalness:type.metal});
 const glass=type.name==='glass';
 material.name=type.name;
 if(pixels&&'repeat' in type){
  const tile=new T.DataTexture(pixels,type.textureSize,type.textureSize,T.RGBAFormat);
  tile.name='original rail station '+type.name;tile.colorSpace=T.SRGBColorSpace;
  tile.wrapS=tile.wrapT=T.RepeatWrapping;tile.repeat.set(type.repeat[0],type.repeat[1]);tile.anisotropy=4;
  tile.minFilter=T.LinearMipmapLinearFilter;tile.magFilter=T.LinearFilter;
  tile.generateMipmaps=true;tile.needsUpdate=true;material.map=tile;
 }
 if(glass){material.emissive.setRGB(.021,.037,.044);material.emissiveIntensity=.65;}
 material.customProgramCacheKey=()=>glass?'summ-rail-shadow-receiver-v2-glass':'summ-rail-shadow-receiver-v2';
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,casts.uniforms);
  s.vertexShader='varying vec3 railWorldPoint;\n'+s.vertexShader.replace('#include <worldpos_vertex>',
   '#include <worldpos_vertex>\nrailWorldPoint=(modelMatrix*vec4(transformed,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',
   '#include <common>\nvarying vec3 railWorldPoint;\n'+railPenumbraGLSL);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n'+
   `vec3 railReceiverNormal=normalize(inverseTransformDirection(normal,viewMatrix));
    float railOcclusion=railBuildingShade(railWorldPoint,railReceiverNormal,distance(railWorldPoint,cameraPosition));
    reflectedLight.directDiffuse*=1.-railOcclusion;
    reflectedLight.directSpecular*=1.-railOcclusion;`);
  if(glass)s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 railI=reflect(-normalize(vViewPosition),normal);
   vec3 railW=inverseTransformDirection(railI,viewMatrix);
   float railF=.11+.89*pow(1.-max(dot(normal,normalize(vViewPosition)),0.),5.);
   vec3 railViewLight=mix(vec3(.05,.054,.045),vec3(.19,.27,.33),smoothstep(-.12,.78,railW.y));
   totalEmissiveRadiance+=railF*.44*railViewLight;`);
 };
 return material;
}

/** Only pre-baked exact, indexed positions and authored numerical RGBA are
 * decoded. No on-load procedural modeling or image requests. */
export function decodeRailArtwork(raw:ArrayBuffer,casts:RailRenderer):RailwayArtwork|undefined{
 if(raw.byteLength!==A.raw)return;
 const v=new DataView(raw),parts:Part[]=[];
 if(v.getUint32(0,true)!==0x4c494152||v.getUint16(4,true)!==1||v.getUint16(6,true)!==A.parts.length||
  v.getUint32(8,true)!==A.raw||v.getUint32(12,true))return;
 let off=16,triangles=0,verticesN=0;
 for(let i=0;i<A.parts.length;i++){
  const p=A.parts[i];
  if(off+16>raw.byteLength||v.getUint16(off,true)!==i||v.getUint16(off+2,true)!==p.nv||
   v.getUint32(off+4,true)!==p.ni||v.getUint32(off+8,true)!==p.textureSize||v.getUint32(off+12,true))return;
  off+=16;
  if(off+44*p.nv+4*Math.ceil(p.ni/2)+4*p.textureSize**2>raw.byteLength)return;
  const take=(n:number)=>{const a=new Float32Array(raw,off,n);off+=4*n;return a;};
  const vertices=take(3*p.nv),normals=take(3*p.nv),uv=take(2*p.nv),colour=take(3*p.nv);
  const faces=new Uint16Array(raw,off,p.ni);off+=4*Math.ceil(p.ni/2);
  const pixels=p.textureSize?new Uint8Array(raw,off,p.textureSize**2*4):undefined;
  off+=p.textureSize**2*4;
  if(faces.some(q=>q>=p.nv)||normals.some(q=>!Number.isFinite(q)||Math.abs(q)>1.001)||
    uv.some(q=>!Number.isFinite(q)||Math.abs(q)>64)||colour.some(q=>!(q>=0&&q<=1.001)))return;
  for(let j=0;j<vertices.length;j+=3)if(!(vertices[j]>=-18.11&&vertices[j]<=27.36&&vertices[j+1]>=-.443&&
    vertices[j+1]<=9.34&&Math.abs(vertices[j+2])<=10))return;
  parts.push({type:p,vertices,normals,uv,colour,faces,pixels});triangles+=p.ni/3;verticesN+=p.nv;
 }
 if(off!==A.raw||triangles!==A.triangles||verticesN>=65536)return;
 const group=new T.Group(), [x,z]=S.originXZ,[[ux,uz],[vx,vz]]=S.basisXZ;
 group.name='Summerside Railway Station · bounded 2020 exterior preview';
 group.matrixAutoUpdate=false;group.matrix.set(ux,0,vx,x,0,1,0,S.seatY,uz,0,vz,z,0,0,0,1);
 group.matrixWorldNeedsUpdate=true;group.visible=false;
 const shadow=new Float32Array(verticesN*3),idx=new Uint16Array(triangles*3);
 let vo=0,io=0;
 for(const p of parts){
  const g=new T.BufferGeometry();
  for(const [name,array,arity] of [['position',p.vertices,3],['normal',p.normals,3],['uv',p.uv,2],['color',p.colour,3]] as const)
   g.setAttribute(name,new T.BufferAttribute(array,arity));
  g.setIndex(new T.BufferAttribute(p.faces,1));g.computeBoundingSphere();
  const mesh=new T.Mesh(g,authoredMaterial(p.type,p.pixels,casts));mesh.name=p.type.name;group.add(mesh);
  // This exact opaque caster is the same material-batched indexed surface,
  // re-based on the production shadow renderer's translation-only contract.
  for(let i=0;i<p.vertices.length;i+=3){
   const [a,b,c]=[p.vertices[i],p.vertices[i+1],p.vertices[i+2]];
   shadow[vo+i]=a*ux+c*vx;shadow[vo+i+1]=b;shadow[vo+i+2]=a*uz+c*vz;
  }
  for(let i=0;i<p.faces.length;i++)idx[io+i]=p.faces[i]+vo/3;
  vo+=p.vertices.length;io+=p.faces.length;
 }
 const shadowGeo=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(shadow,3))
  .setAttribute('facadeStyle',new T.BufferAttribute(new Float32Array(verticesN),1));
 shadowGeo.setIndex(new T.BufferAttribute(idx,1));shadowGeo.computeBoundingSphere();
 const caster=new T.Mesh(shadowGeo,new T.MeshBasicMaterial({side:T.DoubleSide}));
 caster.position.set(x,S.seatY,z);caster.name='Exact Summerside Railway Station opaque shadow caster';caster.updateMatrixWorld(true);
 let freed=false;
 return {group,caster,dispose(){
  if(freed)return;
  freed=true;group.removeFromParent();
  for(const q of group.children){
   const mesh=q as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
   mesh.geometry.dispose();mesh.material.map?.dispose();mesh.material.dispose();
  }
  shadowGeo.dispose();caster.material.dispose();
 }};
}
async function body(stream:ReadableStream<Uint8Array>|null,limit:number,signal:AbortSignal){
 if(!stream||signal.aborted)return;
 const read=stream.getReader(),out=new Uint8Array(limit);let at=0;
 const cancel=()=>{void read.cancel().catch(()=>{});};
 signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){
  const {done,value}=await read.read();
  if(signal.aborted)return;
  if(done)return at===limit?out.buffer:out.buffer.slice(0,at);
  if(value.byteLength>limit-at)return;
  out.set(value,at);at+=value.byteLength;
 }}finally{signal.removeEventListener('abort',cancel);cancel();read.releaseLock();}
}
/** Preserve the original owner until both exact SHA checks succeed. A host
 * that transparently decodes gzip is admitted only by the same raw SHA.
 */
export async function loadRailArtwork(base:string,casts:RailRenderer,fetcher:typeof fetch=fetch,timeoutMs=1400){
 if(!globalThis.crypto?.subtle)return;
 const control=new AbortController(),signal=control.signal;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const verify=async()=>{
  const reply=await fetcher(base+A.file,{signal});
  if(reply.status!==200||signal.aborted){void reply.body?.cancel().catch(()=>{});return;}
  let data=await body(reply.body,A.raw,signal);
  if(!data||signal.aborted)return;
  if(data.byteLength===A.wire){
   if(await sha(data)!==A.wireSha||signal.aborted)return;
   data=await body(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')),A.raw,signal);
  }
  if(data?.byteLength===A.raw&&await sha(data)===A.rawSha&&!signal.aborted)return data;
 };
 try{
  const data=await Promise.race([verify(),new Promise<undefined>(resolve=>{timer=setTimeout(()=>{control.abort();resolve(undefined);},timeoutMs);})]);
  if(data&&!signal.aborted)return decodeRailArtwork(data,casts);
 }catch{/** Unavailable/unverified optional art leaves the complete stock owner. */}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
