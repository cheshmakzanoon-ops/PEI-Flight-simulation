import * as T from 'three';
import type {Cover} from '../sim/cover.ts';
import {OCEAN_Y,type Terrain} from '../sim/terrain.ts';
import {strictArc,type Quad} from '../sim/strict-shore-arc.ts';
import {appendStockCurtain} from './legacy-shore-curtains.ts';
import {STOCK_TERRAIN_VERTEX} from './regular-z-rim-clip-v2.ts';

export const BORDEN_CURTAIN_NAME='Borden signed coast arc';
export const BORDEN_CELL=Object.freeze([1231,1992] as const);
const Q:Quad=Object.freeze([-4,13,0,-4] as const);
const W=4096,H=2720,N=112,S=N+1,OWNER='9-16',CHORD_FROM=1272,CHORD_COUNT=2118;
const PINS=Object.freeze({
 cover:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 coverDecoded:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 index:'33871cac1ee31a2c5e4cb22b35de67f6cf10e53758d3c0784b83790caee5fffa',
 localGround:'3dbb68895fa9332c04a529323d039641f807805b9140acc3824c67c00d0f0c0a',
 stockShore:'99a9818d332940a94d9f3ebf5ea4c323b147956e5a721c3af459ea6850d78d60',
 stockShoreUV:'ddf4561f1fbb01d93b55eb9713452a6d156c5084ecb5bb62c3443b3edb38f0a7',
 cliff:'0310018adbfc058c02372e855ed5b5e36b6aaa7b56aebd268b9cce89a1a0ee4b',
 // Exact labAerialFragment applied to the literal q351 cliff above, not an approximation or artist variant.
 aerialCliff:'0e92b2fc24304ed5f47942b9581459391582224ee0dc96400a2caa1d98b92c66',
});
const territory=[-64.47,45.94,-61.93,47.10] as const;
const expectedBox=[-38866.87246486078,27761.663306623333,-38819.27066147455,27809.070239400728] as const;
// ±1.5 cm on the measured render-plane ends only. Does not move or enlarge the XY authority.
const overlap=.015,EPS=1e-8;
const rows=[68,72,11,15] as const; // x vertex min/max, z vertex min/max, 25 guard vertices.
type XZ=readonly [number,number];
type Box=readonly [number,number,number,number];
export type BordenGround={ readonly id:string; readonly i:number; readonly j:number; readonly lod:number;
 readonly seams?:string; readonly x0:number; readonly z0:number; readonly w:number; readonly d:number;
 readonly relief?:unknown; readonly local:T.ShaderMaterial; readonly fine?:T.Mesh;
 readonly coarse:T.Mesh };
export type BordenAtmosphericGain=Readonly<{value:number}>;
export type BordenCoastInputs={readonly scene:T.Scene;readonly renderer:T.WebGLRenderer;
 readonly terrain:Terrain;readonly cover:Cover;readonly terrainSha:string;readonly ground:()=>BordenGround|undefined;
 /** The construction-born normal stock cliff batch containing the witness chord; not an alternate material. */
 readonly stockShore:T.Mesh;readonly ocean:T.Mesh;
 /** Supply the exact accepted World constructor's `air?.gain` pointer, never infer it from one material.
  * A literal stock World supplies undefined; partially transformed or unarmed graphs remain stock.
  */
 readonly stockAtmosphericGain?:BordenAtmosphericGain};
export type BordenCoastReceipt={box:Box;oldChordErrorM:number;boundedCurveErrorM:number;
 arcBaseSegments:number;drawTriangles:number;knotGroundMin:number;knotGroundMax:number;
 maxSlopePerAxis:number;relativeSeatOverlapM:number};
type Cell={box:Box;w:number;d:number;q:Quad};

const F=Math.fround;
const close=(a:number,b:number)=>Number.isFinite(a)&&Math.abs(a-b)<EPS;
const equal=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((z,i)=>z===b[i]);
const frozenIdentity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as const;
const matHooks=[T.Material.prototype.onBeforeCompile,T.Material.prototype.customProgramCacheKey,T.Material.prototype.onBeforeRender];
const objHooks=[T.Object3D.prototype.onBeforeRender,T.Object3D.prototype.onAfterRender];
const coasts=new WeakMap<Cover,{bytes:Uint8Array;promise:Promise<string|undefined>}>();
async function hash(input:ArrayBufferView){
 try{
  if(!globalThis.crypto?.subtle||!(input.buffer instanceof ArrayBuffer))return;
  const raw=await globalThis.crypto.subtle.digest('SHA-256',new Uint8Array(input.buffer,input.byteOffset,input.byteLength));
  return Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,'0')).join('');
 }catch{return;}
}
export const hashBordenCoastShader=(s:string)=>hash(new TextEncoder().encode(s));
const AIR='atmosphericLabGain';
export function bordenCoastAirUniform(m:T.ShaderMaterial,expected?:BordenAtmosphericGain){
 return expected===undefined?!(AIR in m.uniforms):
  expected.value===1&&Object.hasOwn(m.uniforms,AIR)&&m.uniforms[AIR]===expected;
}
function bordenCoastAirSurface(m:T.ShaderMaterial,expected?:BordenAtmosphericGain){
 // Water and land have existing unrelated feature variants. Require them to be in the same
 // original program family and own the same construction-born scalar, then pin their exact live sources.
 const fragment=m.fragmentShader;
 return bordenCoastAirUniform(m,expected)&&(expected===undefined?
  !fragment.includes('peiairSurface(')&&!fragment.includes('peiairSky('):
  fragment.includes('uniform float '+AIR+';')&&fragment.includes('vec4(peiairSurface(mist('));
}
function coverHash(c:Cover){
 const a=c.bytes,prior=coasts.get(c);
 if(prior?.bytes===a)return prior.promise;
 // Re-authenticate the already-present immutable bytes, once on actual local
 // acquisition. Never use a metadata-only SHA or a second asset download.
 const promise=hash(a);coasts.set(c,{bytes:a,promise});
 return promise;
}
function cell(c:Cover,t:Terrain,terrainSha:string):Cell|undefined{
 if(terrainSha!==PINS.terrain||c.width!==W||c.height!==H||c.bytes.length!==W*H*2||
    t.spec.width!==W||t.spec.height!==H||c.sourceSha!==PINS.cover||
    (c.sourceDecodedSha!==undefined&&c.sourceDecodedSha!==PINS.coverDecoded)||
    !equal(t.spec.bounds,territory))return;
 const [i,j]=BORDEN_CELL,w=(t.right-t.left)/W,d=(t.bottom-t.top)/H;
 const x=t.left+(i+.5)*w,z=t.top+(j+.5)*d;
 const box:Box=Object.freeze([x,z,x+w,z+d]);
 if(!box.every((n,k)=>close(n,expectedBox[k]))||w<=0||d<=0||t.surveyGrids.some(g=>g.spec.tileX===9&&g.spec.tileZ===16)
    ||c.waterInsets.some(p=>p.intersects(...box))||c.baywalk?.intersects(...box))return;
 const k=(j*W+i)*2+1,b=c.bytes;
 const q:Quad=[b[k]-128,b[k+2]-128,b[k+2*W+2]-128,b[k+2*W]-128];
 if(!equal(q,Q))return;
 return {box,w,d,q};
}
function basis(g:BordenGround,t:Terrain,s:T.Scene){
 const w=(t.right-t.left)/32,d=(t.bottom-t.top)/22;
 if(g.id!==OWNER||g.i!==9||g.j!==16||g.w!==w||g.d!==d||g.x0!==t.left+9*w||g.z0!==t.top+16*d||
    g.lod!==N||g.relief||g.coarse.visible||!g.seams||
    !/^112:(?:8|56|112),(?:8|56|112),(?:8|56|112),(?:8|56|112)$/.test(g.seams))return;
 const fine=g.fine,x=g.x0+w*.5,z=g.z0+d*.5;
 if(!fine||!sameObject(fine,s)||fine.material!==g.local||g.local.vertexShader!==STOCK_TERRAIN_VERTEX||
    !raster(g.local,T.FrontSide)||fine.userData.subdiv!==N||!equal(Object.keys(fine.userData),['subdiv'])||
    !matrix(fine.matrixWorld.elements,x,0,z)||fine.scale.x!==1||fine.scale.y!==1||fine.scale.z!==1||
    fine.position.x!==x||fine.position.y!==0||fine.position.z!==z||
    fine.quaternion.x||fine.quaternion.y||fine.quaternion.z||fine.quaternion.w!==1)return;
 const shape=fine.geometry as T.PlaneGeometry;
 if(!standardGeometry(shape,0,Infinity)||shape.type!=='PlaneGeometry'||shape.parameters.width!==w||shape.parameters.height!==d||
    shape.parameters.widthSegments!==N||shape.parameters.heightSegments!==N||!equal(Object.keys(shape.attributes).sort(),['normal','position','uv']))return;
 const p=attr(shape,'position',3,S*S),u=attr(shape,'uv',2,S*S),n=attr(shape,'normal',3,S*S),idx=shape.index;
 if(!p||!u||!n||!(idx instanceof T.BufferAttribute)||!(idx.array instanceof Uint16Array)||
    idx.count!==N*N*6||idx.itemSize!==1||idx.normalized)return;
 return {fine,shape,p,u,n,idx,x,z};
}
function attr(g:T.BufferGeometry,name:string,size:number,count:number){
 const a=g.getAttribute(name);
 return a instanceof T.BufferAttribute&&a.array instanceof Float32Array&&a.itemSize===size&&
    a.count===count&&!a.normalized?a:undefined;
}
function standardGeometry(g:T.BufferGeometry,start:number,count:number){
 return g.groups.length===0&&g.indirect===null&&Object.keys(g.morphAttributes).length===0&&g.drawRange.start===start&&g.drawRange.count===count;
}
function matrix(a:readonly number[],x=0,y=0,z=0){
 return a.length===16&&a.every((v,k)=>v===(k===12?x:k===13?y:k===14?z:frozenIdentity[k]));
}
function sameObject(m:T.Mesh,scene:T.Scene){
 return m.isMesh&&m.visible&&m.parent===scene&&m.layers.mask===1&&m.renderOrder===0&&m.frustumCulled&&m.matrixAutoUpdate&&m.matrixWorldAutoUpdate&&
  m.onBeforeRender===objHooks[0]&&m.onAfterRender===objHooks[1];
}
function raster(m:unknown,side:T.Side):m is T.ShaderMaterial{
 if(!(m instanceof T.ShaderMaterial))return false;
 return m.visible&&m.side===side&&m.depthTest&&m.depthWrite&&m.colorWrite&&m.depthFunc===T.LessEqualDepth&&!m.transparent&&
  m.opacity===1&&m.blending===T.NormalBlending&&!m.alphaTest&&!m.alphaHash&&!m.alphaToCoverage&&!m.polygonOffset&&
  !m.stencilWrite&&!m.wireframe&&!m.clippingPlanes&&!m.clipping&&m.forceSinglePass&&
  m.onBeforeCompile===matHooks[0]&&m.customProgramCacheKey===matHooks[1]&&m.onBeforeRender===matHooks[2];
}
function oceanSeat(m:T.Mesh,scene:T.Scene){
 if(!sameObject(m,scene)||!raster(m.material,T.FrontSide)||m.position.x||m.position.y!==OCEAN_Y||m.position.z||
    m.rotation.x!==-Math.PI/2||m.rotation.y||m.rotation.z||m.scale.x!==1||m.scale.y!==1||m.scale.z!==1||
    m.material.vertexShader!==STOCK_TERRAIN_VERTEX)return;
 const g=m.geometry as T.PlaneGeometry;
 if(!standardGeometry(g,0,Infinity)||g.type!=='PlaneGeometry'||g.parameters.width!==650000||g.parameters.height!==650000||
    g.parameters.widthSegments!==160||g.parameters.heightSegments!==160||g.index?.count!==160*160*6||
    !attr(g,'position',3,161*161)||!attr(g,'uv',2,161*161)||!attr(g,'normal',3,161*161))return;
 return m.material;
}
function mapStatus(m:T.ShaderMaterial,c:Cover){
 const s=m.uniforms.coverMap,texture=s?.value;
 if(!(texture instanceof T.DataTexture)||texture.image.data!==c.bytes||
    texture.image.width!==W||texture.image.height!==H||texture.format!==T.RGFormat||texture.type!==T.UnsignedByteType||
    texture.magFilter!==T.LinearFilter||texture.minFilter!==T.LinearFilter||texture.anisotropy!==1||
    texture.wrapS!==T.ClampToEdgeWrapping||texture.wrapT!==T.ClampToEdgeWrapping||texture.flipY||
    texture.premultiplyAlpha||texture.colorSpace!==T.NoColorSpace||texture.generateMipmaps)return;
 return [s,texture,texture.source,texture.image,texture.version,texture.source.version] as const;
}
function lay(m:T.Mesh,scene:T.Scene,b:Cell,t:Terrain){
 if(!sameObject(m,scene)||!matrix(m.matrixWorld.elements)||!raster(m.material,T.DoubleSide)||
    m.material.vertexShader!==STOCK_TERRAIN_VERTEX||Object.keys(m.material.defines??{}).length)return;
 const g=m.geometry,p=attr(g,'position',3,CHORD_COUNT),u=attr(g,'uv',2,CHORD_COUNT);
 if(!standardGeometry(g,0,Infinity)||g.index||!p||!u||!equal(Object.keys(g.attributes).sort(),['position','uv']))return;
 const [x,z]=b.box,old:number[]=[];
 appendStockCurtain({ax:x+b.w*4/17,az:z,bx:b.box[2],bz:b.box[3]},t,old);
 if(!old.every((n,i)=>F(n)===p.array[CHORD_FROM*3+i]))return;
 return {geometry:g,p,u,material:m.material};
}
export const pinBordenCoastMaterial=(m:T.ShaderMaterial)=>[m,m.version,m.vertexShader,m.fragmentShader,m.uniforms,m.defines,
 ...Object.entries(m.defines??{}).flat(),...Object.entries(m.uniforms).flat(),m.side,m.transparent,m.depthTest,m.depthWrite,m.colorWrite,
 m.depthFunc,m.opacity,m.blending,m.alphaTest,m.alphaHash,m.alphaToCoverage,m.stencilWrite,m.polygonOffset,
 m.polygonOffsetFactor,m.polygonOffsetUnits,m.wireframe,m.glslVersion,m.precision,m.clipping,m.clippingPlanes,
 m.clipIntersection,m.clipShadows,m.fog,m.lights,m.toneMapped,m.dithering,m.onBeforeCompile,m.onBeforeRender,m.customProgramCacheKey];
function attrStamp(a:T.BufferAttribute){return [a,a.array,a.version,a.count,a.itemSize,a.normalized,a.array.byteLength];}
type Basis=NonNullable<ReturnType<typeof basis>>;
function basisStamp(g:BordenGround,b:Basis){
 return [g,g.seams,b.fine,b.shape,...attrStamp(b.p),...attrStamp(b.u),...attrStamp(b.n),...attrStamp(b.idx),...pinBordenCoastMaterial(g.local)];
}
function basisBytes(b:Basis){
 const p:number[]=[];
 for(let j=rows[2];j<=rows[3];j++)for(let i=rows[0];i<=rows[1];i++){
  const k=j*S+i;p.push(b.p.getX(k),b.p.getY(k),b.p.getZ(k));
 }
 return Float32Array.from(p);
}
const fWords=new Uint32Array(1),fValues=new Float32Array(fWords.buffer);
function nextFloat(v:number,direction:1|-1){
 fValues[0]=v;
 if(!fWords[0]||fWords[0]===0x80000000){fWords[0]=direction>0?1:0x80000001;return fValues[0];}
 fWords[0]+=direction*(v<0?-1:1);
 return fValues[0];
}
function insideF32(x:number,a:number,b:number){
 const z=F(x);
 return z<a?nextFloat(z,1):z>b?nextFloat(z,-1):z;
}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
/** Exact rendered local VBO facet sampling and breakpoints. Ground XZ uses the
 * stock vertex's model-matrix binary32 additions, not separate atlas heights. */
function facets(b:Basis){
 const xs:number[]=[],zs:number[]=[];
 for(let i=rows[0];i<=rows[1];i++)xs.push(F(F(b.x)+b.p.getX(i)));
 for(let j=rows[2];j<=rows[3];j++)zs.push(F(F(b.z)+b.p.getZ(j*S)));
 const inCell=(q:number,axis:number[])=>axis.findIndex((v,k)=>k<axis.length-1&&q>=v&&q<=axis[k+1]);
 function support(x:number,z:number){
  const i=inCell(x,xs),j=inCell(z,zs);if(i<0||j<0)return;
  return {i,j,a:xs[i],c:zs[j],w:xs[i+1]-xs[i],h:zs[j+1]-zs[j]};
 }
 const cells:number[][]=[];
 let maxSlope=0;
 for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const gi=i+rows[0],gj=j+rows[2],a=gj*S+gi,data=[a,a+S,a+1,a+S,a+S+1,a+1],
   offset=(gj*N+gi)*6;
  if(!data.every((q,k)=>b.idx.getX(offset+k)===q))return;
  const y0=b.p.getY(a),y1=b.p.getY(a+1),y2=b.p.getY(a+S),y3=b.p.getY(a+S+1);
  if(![y0,y1,y2,y3].every(y=>Number.isFinite(y)&&y>=0&&y<12))return;
  const w=xs[i+1]-xs[i],h=zs[j+1]-zs[j];if(w<=0||h<=0)return;
  maxSlope=Math.max(maxSlope,Math.abs(y1-y0)/w,Math.abs(y3-y2)/w,Math.abs(y2-y0)/h,Math.abs(y3-y1)/h);
  cells.push([y0,y1,y2,y3]);
 }
 if(maxSlope>.20||xs.length!==5||zs.length!==5)return;
 const y=(x:number,z:number)=>{
  const s=support(x,z);if(!s)return NaN;
  // Exact 2-plane regular face with the signed convention above.
  const u=(x-s.a)/s.w,v=(z-s.c)/s.h,[a,b,c,d]=cells[s.j*(xs.length-1)+s.i];
  return u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u);
 };
 function cuts(A:XZ,B:XZ){
  const t=[0,1],dx=B[0]-A[0],dz=B[1]-A[1];
  const scan=(start:number,len:number,axis:number[])=>{
   if(!len)return;
   for(const r of axis){const q=(r-start)/len;if(q>1e-9&&q<1-1e-9)t.push(q);}
  };
  scan(A[0],dx,xs);scan(A[1],dz,zs);t.sort((a,b)=>a-b);
  const out=[0];
  for(let k=1;k<t.length;k++){
   const a=t[k-1],b=t[k],d=(a+b)*.5; if(b-a<1e-9)continue;
   const f=support(mix(A[0],B[0],d),mix(A[1],B[1],d));if(!f)return;
   const fn=(t:number)=>(mix(A[0],B[0],t)-f.a)/f.w+(mix(A[1],B[1],t)-f.c)/f.h-1;
   const y0=fn(a),y1=fn(b);
   if(y0*y1<0){const c=a+(b-a)*y0/(y0-y1);if(c-a>1e-9&&b-c>1e-9)out.push(c);}
   out.push(b);
  }
  return out;
 }
 return {y,cuts,maxSlope};
}
function build(b:Cell,patch:Basis){
 const arc=strictArc(b.q,b.w,b.d,.047,96,1.40,true);
 if(arc.mode!=='exact'||arc.points.length!==26||arc.boundM>.047||
    !arc.oldChordErrorM||Math.abs(arc.oldChordErrorM-10.010938255977274)>EPS||
    !equal(arc.points[0],[4/17,0])||!equal(arc.points[25],[1,1]))return;
 const p=facets(patch);if(!p)return;
 const [x,z,h,j]=b.box,knots:XZ[]=[];
 const clamped=(a:number,q:number):XZ=>[insideF32(a,x,h),insideF32(q,z,j)];
 const toM=([u,v]:XZ)=>clamped(x+b.w*u,z+b.d*v);
 for(let k=1;k<arc.points.length;k++){
  const a=toM(arc.points[k-1]),d=toM(arc.points[k]),ts=p.cuts(a,d);if(!ts)return;
  if(k===1)knots.push(a);
  for(const t of ts.slice(1)){
   const q=clamped(mix(a[0],d[0],t),mix(a[1],d[1],t)),prev=knots.at(-1)!;
   if(Math.hypot(q[0]-prev[0],q[1]-prev[1])>.001)knots.push(q);
  }
 }
 if(knots.length<26||knots.length>34)return;
 const ys=knots.map(q=>p.y(...q)),lo=F(OCEAN_Y-overlap);
 if(!ys.every(v=>Number.isFinite(v)&&v>OCEAN_Y+1&&v<11))return;
 const pos:number[]=[];
 for(let k=1;k<knots.length;k++){
  const [a,c]=knots[k-1],[d,f]=knots[k],u=F(ys[k-1]+overlap),v=F(ys[k]+overlap);
  pos.push(a,lo,c,d,lo,f,a,u,c,a,u,c,d,lo,f,d,v,f);
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(pos.length/3*2),2));
 geometry.computeBoundingSphere();geometry.computeBoundingBox();
 const diag:Readonly<BordenCoastReceipt>=Object.freeze({box:b.box,oldChordErrorM:arc.oldChordErrorM,
  // Exact strictArc error + conservative global Float32 endpoint/split quantization allowance.
  boundedCurveErrorM:arc.boundM+.0075,arcBaseSegments:25,drawTriangles:pos.length/9,
  knotGroundMin:Math.min(...ys),knotGroundMax:Math.max(...ys),maxSlopePerAxis:p.maxSlope,relativeSeatOverlapM:overlap});
 return {geometry,diag};
}
export type BordenCoastAuthority={
 readonly geometry:T.BufferGeometry; readonly diag:Readonly<BordenCoastReceipt>;
 readonly material:T.ShaderMaterial; readonly ground:T.Mesh;readonly waterMaterial:T.ShaderMaterial;
 readonly still:()=>boolean;
};
export async function authorizeBordenCoast(inputs:BordenCoastInputs,eligible:()=>boolean):Promise<BordenCoastAuthority|undefined>{
 try{
  const {scene,terrain,cover,terrainSha,stockShore,ocean,stockAtmosphericGain:air}=inputs;
  if(!eligible())return;
  const b=cell(cover,terrain,terrainSha),t=inputs.ground();if(!b||!t)return;
  // The captured caller owns actual normal render objects. Refreshing pure
  // stock matrices is benign on first local acquisition, not an art mutation.
  t.fine?.updateWorldMatrix(false,false); stockShore.updateWorldMatrix(false,false); ocean.updateWorldMatrix(false,false);
  const ground=basis(t,terrain,scene),shore=lay(stockShore,scene,b,terrain),sea=oceanSeat(ocean,scene);
  if(!ground||!shore||!sea)return;
  const m=shore.material,cap=cover.bytes;
  if(!bordenCoastAirSurface(m,air)||!bordenCoastAirSurface(t.local,air)||!bordenCoastAirSurface(sea,air))return;
  const mask=mapStatus(t.local,cover),wet=mapStatus(sea,cover);
  if(!mask||!wet||mask[1]!==wet[1])return;
  const oldGround=basisStamp(t,ground),oldSea=pinBordenCoastMaterial(sea),oldCliff=pinBordenCoastMaterial(m);
  const oldShore=[shore.geometry,...attrStamp(shore.p),...attrStamp(shore.u)];
  const seaGeometry=ocean.geometry as T.PlaneGeometry,seaPOS=seaGeometry.getAttribute('position') as T.BufferAttribute,
   seaN=seaGeometry.getAttribute('normal') as T.BufferAttribute,seaUV=seaGeometry.getAttribute('uv') as T.BufferAttribute,seaI=seaGeometry.index!,
   waterStamp=[seaGeometry,seaI,...attrStamp(seaPOS),...attrStamp(seaN),...attrStamp(seaUV),...attrStamp(seaI),...ocean.matrixWorld.elements];
  const exact=()=>{
   if(!eligible()||inputs.stockAtmosphericGain!==air||(air!==undefined&&air.value!==1)||
      inputs.ground()!==t||cover.bytes!==cap||!cell(cover,terrain,terrainSha))return false;
   const k=basis(t,terrain,scene);
   if(!k||!equal(basisStamp(t,k),oldGround)||!equal(mapStatus(t.local,cover)??[],mask))return false;
   const l=lay(stockShore,scene,b,terrain);
   if(!l||l.material!==m||!equal([l.geometry,...attrStamp(l.p),...attrStamp(l.u)],oldShore)||
      !equal(pinBordenCoastMaterial(m),oldCliff)||oceanSeat(ocean,scene)!==sea||!equal(pinBordenCoastMaterial(sea),oldSea)||
      !equal(mapStatus(sea,cover)??[],wet))return false;
   return ocean.geometry===seaGeometry&&equal([ocean.geometry,ocean.geometry.index,
     ...attrStamp(ocean.geometry.getAttribute('position') as T.BufferAttribute),
     ...attrStamp(ocean.geometry.getAttribute('normal') as T.BufferAttribute),
     ...attrStamp(ocean.geometry.getAttribute('uv') as T.BufferAttribute),
     ...attrStamp(ocean.geometry.index!),...ocean.matrixWorld.elements],waterStamp);
  };
  const checks=await Promise.all([coverHash(cover),hash(ground.idx.array),hash(basisBytes(ground)),
   hash(shore.p.array),hash(shore.u.array),hashBordenCoastShader(m.fragmentShader)]);
  if(!equal(checks,[PINS.coverDecoded,PINS.index,PINS.localGround,PINS.stockShore,PINS.stockShoreUV,
   air===undefined?PINS.cliff:PINS.aerialCliff])||!exact())return;
  const stage=build(b,ground);if(!stage)return;
  return {geometry:stage.geometry,diag:stage.diag,material:m,ground:ground.fine,waterMaterial:sea,still:exact};
 }catch{return;}
}
