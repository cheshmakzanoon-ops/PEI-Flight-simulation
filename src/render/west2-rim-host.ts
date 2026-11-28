import * as THREE from 'three';
import type {Cover} from '../sim/cover.ts';
import type {Terrain} from '../sim/terrain.ts';
import {verifyDecodedCover} from '../sim/cover-proof.ts';
import {GROUND_LIFT,WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';
import {STOCK_TERRAIN_VERTEX} from './regular-z-rim-clip-v2.ts';
import {regularNorthRimSampleProfile} from './regular-z-rim-raster-profile.ts';

// One independently observed, stock dry raster slit. The north tile owns the
// shifted south lip. 67..70 close the three observed segments; their two
// neighboring cells are partial tapers. Everything else, including the entire
// south owner and both atlas corners, remains literal stock.
export const WEST2_RIM=Object.freeze({
 north:'5-1',south:'5-2',first:67,last:70,oldZ:-54974.2109375,donorZ:-54974.20703125,
 localZ:2930.6103515625,gain:'peiWest2RimActive',
} as const);
// World-space midpoint of the packed k66..71 affected star, and a local
// draw-eligibility sphere only (not a change to ground limits or to LOD).
const viewX=-63296.798828125,viewY=20,viewRadius=1000;
const n=112,step=113,rowStart=n*step,F=Math.fround;
const anchor='gl_Position=projectionMatrix*viewMatrix*w;';
export const WEST2_RIM_VERTEX=`uniform highp float ${WEST2_RIM.gain};\n`+STOCK_TERRAIN_VERTEX.replace(anchor,
 `if(${WEST2_RIM.gain} == 1.0 && gl_VertexID >= ${rowStart+WEST2_RIM.first} && gl_VertexID <= ${rowStart+WEST2_RIM.last} && position.z == ${WEST2_RIM.localZ})\n  w.z=${WEST2_RIM.donorZ};\n `+anchor);
export function west2ClipWorldZ(localZ:number,id:number,worldZ:number,gain:number){
 return gain===1&&id>=rowStart+WEST2_RIM.first&&id<=rowStart+WEST2_RIM.last&&localZ===WEST2_RIM.localZ?WEST2_RIM.donorZ:worldZ;
}

type GroundTile={id:string;i:number;j:number;lod:number;seams?:string;relief?:unknown;
 x0:number;z0:number;w:number;d:number;coarse:THREE.Mesh;fine?:THREE.Mesh;local:THREE.ShaderMaterial};
type Config={scene:THREE.Scene;renderer:THREE.WebGLRenderer;terrain:Terrain;cover:Cover;
 terrainSha:string;tile:(id:string)=>GroundTile|undefined;protectedGrade:(id:string)=>boolean};
type Phase='cold'|'checking'|'verified'|'stock';
type Range={w:number;d:number;x:number;northZ:number;southZ:number};
type Shape={mesh:THREE.Mesh;g:THREE.PlaneGeometry;index:THREE.BufferAttribute;
 pos:THREE.BufferAttribute;uv:THREE.BufferAttribute;normal:THREE.BufferAttribute};
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const same=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as const;
const exactMatrix=(m:THREE.Matrix4,x=0,z=0)=>m.elements.every((v,i)=>v===(i===12?x:i===14?z:identity[i]));
const xLocal=(w:number,k:number)=>F(k*(w/n)-w/2);
const zLocal=(d:number,row:number)=>F(row*(d/n)-d/2);
const wrap=(m:THREE.ShaderMaterial)=>[
 m.fragmentShader,m.uniforms,m.defines,...Object.entries(m.defines??{}).flat(),
 m.onBeforeRender,m.onBeforeCompile,m.customProgramCacheKey,m.precision,m.glslVersion,
 m.visible,m.side,m.transparent,m.colorWrite,m.depthTest,m.depthWrite,m.depthFunc,
 m.blending,m.blendEquation,m.blendSrc,m.blendDst,m.blendEquationAlpha,m.blendSrcAlpha,m.blendDstAlpha,
 m.blendAlpha,m.blendColor.r,m.blendColor.g,m.blendColor.b,m.opacity,m.alphaHash,m.alphaTest,m.alphaToCoverage,
 m.stencilWrite,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.wireframe,
 m.clipping,m.clippingPlanes,m.clipIntersection,m.clipShadows,m.forceSinglePass,m.allowOverride,
 m.premultipliedAlpha,m.dithering,m.toneMapped,m.vertexColors,m.fog,m.lights,
];
function pinMaterial(m:THREE.ShaderMaterial){
 if(!m.isShaderMaterial||m.vertexShader!==STOCK_TERRAIN_VERTEX||own(m.uniforms,WEST2_RIM.gain)||
    own(m.defines??{},'SURVEY_LIGHT')||own(m.defines??{},'SOURCE_GRASS_NAP_METRIC')||
    !m.visible||m.side!==THREE.FrontSide||m.transparent||!m.colorWrite||!m.depthTest||!m.depthWrite||
    m.depthFunc!==THREE.LessEqualDepth||m.blending!==THREE.NormalBlending||m.opacity!==1||m.alphaHash||m.alphaTest||
    m.alphaToCoverage||m.stencilWrite||m.polygonOffset||m.wireframe||m.clippingPlanes?.length||
    m.onBeforeRender!==THREE.Material.prototype.onBeforeRender||m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||
    m.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey)return;
 return {m,settings:wrap(m),version:m.version};
}
type MaterialPin=NonNullable<ReturnType<typeof pinMaterial>>;

function frame(T:Terrain):Range|undefined{
 const w=(T.right-T.left)/WORLD_COLS,d=(T.bottom-T.top)/WORLD_ROWS,x=T.left+5*w;
 const northZ=T.top+d,southZ=T.top+2*d;
 if(F(w/2)!==3046.515380859375||F(d/2)!==WEST2_RIM.localZ||
    F(F(northZ+d/2)+WEST2_RIM.localZ)!==WEST2_RIM.oldZ||
    F(F(southZ+d/2)-WEST2_RIM.localZ)!==WEST2_RIM.donorZ||F(southZ)!==WEST2_RIM.donorZ)return;
 return {w,d,x,northZ,southZ};
}
/** All bilinear taps through the complete five-quad star on both banks, with
 * .01m beyond stock Float32 edges. This is signed atlas dry, not a new survey. */
export function west2DryTapProof(T:Terrain,C:Cover){
 const p=frame(T);
 if(!p||T.spec.width!==C.width||T.spec.height!==C.height)return;
 const cx=F(p.x+p.w/2);
 const x0=F(cx+xLocal(p.w,WEST2_RIM.first-1))-.01,x1=F(cx+xLocal(p.w,WEST2_RIM.last+1))+.01;
 const z0=F(F(p.northZ+p.d/2)+zLocal(p.d,n-1))-.01,z1=F(F(p.southZ+p.d/2)+zLocal(p.d,1))+.01;
 const [u0,v0]=T.uv(x0,z0),[u1,v1]=T.uv(x1,z1);
 const i0=Math.floor(u0*C.width-.5),i1=Math.floor(u1*C.width-.5)+1,
       j0=Math.floor(v0*C.height-.5),j1=Math.floor(v1*C.height-.5)+1;
 if(i0<0||j0<0||i1>=C.width||j1>=C.height)return;
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  const k=j*C.width+i;
  if(T.samples[k]===-32768||C.bytes[2*k+1]!==255)return;
 }
 return {x0,x1,z0,z1,i0,i1,j0,j1,cells:(i1-i0+1)*(j1-j0+1),minSignedCover:254};
}
const layout=(t:GroundTile,edge:0|2)=>{
 const s=t.seams;
 return t.lod===n&&!t.relief&&s!==undefined&&/^112:(?:8|56|112),(?:8|56|112),(?:8|56|112),(?:8|56|112)$/.test(s)&&
   Number(s.substring(4).split(',')[edge])===n&&!t.coarse.visible&&t.fine?.visible===true;
};
function shape(scene:THREE.Scene,t:GroundTile,r:Range,j:1|2):Shape|undefined{
 const mesh=t.fine,expectedZ=j===1?r.northZ:r.southZ,x=r.x+r.w/2,z=expectedZ+r.d/2;
 if(!mesh||t.id!==(j===1?WEST2_RIM.north:WEST2_RIM.south)||t.i!==5||t.j!==j||t.w!==r.w||t.d!==r.d||
    t.x0!==r.x||t.z0!==expectedZ||mesh.parent!==scene||mesh.material!==t.local||!mesh.visible||mesh.layers.mask!==1||
    mesh.position.x!==x||mesh.position.y!==0||mesh.position.z!==z||mesh.quaternion.x!==0||mesh.quaternion.y!==0||
    mesh.quaternion.z!==0||mesh.quaternion.w!==1||mesh.scale.x!==1||mesh.scale.y!==1||mesh.scale.z!==1||
    !exactMatrix(mesh.matrixWorld,x,z)||mesh.userData.subdiv!==n||Object.keys(mesh.userData).length!==1)return;
 const g=mesh.geometry;
 if(!(g instanceof THREE.PlaneGeometry)||g.type!=='PlaneGeometry'||g.indirect!=null||g.groups.length||
    g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==3||
    Object.keys(g.morphAttributes).length!==0||
    g.parameters.width!==r.w||g.parameters.height!==r.d||g.parameters.widthSegments!==n||g.parameters.heightSegments!==n)return;
 const index=g.index,pos=g.getAttribute('position'),uv=g.getAttribute('uv'),normal=g.getAttribute('normal');
 if(!(index instanceof THREE.BufferAttribute)||!(index.array instanceof Uint16Array)||index.itemSize!==1||
    index.version!==0||index.normalized||index.count!==n*n*6||index.array.length!==index.count||
    !(pos instanceof THREE.BufferAttribute)||!(uv instanceof THREE.BufferAttribute)||!(normal instanceof THREE.BufferAttribute)||
    ![pos,uv,normal].every((a,i)=>a.array instanceof Float32Array&&a.count===step*step&&a.itemSize===(i===1?2:3)&&
     a.array.length===a.count*a.itemSize&&!a.normalized))return;
 return {mesh,g,index,pos,uv,normal};
}
function ownerKey(a:Shape,t:GroundTile){
 return [a.mesh,a.g,t.seams,...[a.index,a.pos,a.uv,a.normal].flatMap(b=>[b,b.array,b.version])];
}
function exactStar(T:Terrain,t:GroundTile,p:Shape,edge:0|2){
 // Regular whole EBO guarantees no unexpected primitive elsewhere can use
 // any of the four VertexIDs. This scan is on custody changes, never a frame loop.
 const idx=p.index.array;
 for(let row=0,i=0;row<n;row++)for(let k=0;k<n;k++,i+=6){
  const a=row*step+k,b=a+step;
  if(idx[i]!==a||idx[i+1]!==b||idx[i+2]!==a+1||idx[i+3]!==b||idx[i+4]!==b+1||idx[i+5]!==a+1)return false;
 }
 for(const row of (edge===2?[n-1,n]:[0,1]))for(let k=WEST2_RIM.first-1;k<=WEST2_RIM.last+1;k++){
  const i=row*step+k,x=xLocal(t.w,k),z=zLocal(t.d,row);
  const wx=x+t.x0+t.w/2,wz=z+t.z0+t.d/2;
  const rim=edge===2?row===n:row===0;
  const y=T.atlasElevation(rim?t.x0+t.w*(k/n):wx,rim?t.z0+(edge===2?t.d:0):wz)+GROUND_LIFT;
  const [u,v]=T.uv(wx,wz);
  if(p.pos.getX(i)!==x||p.pos.getZ(i)!==z||p.pos.getY(i)!==F(y)||
     p.uv.getX(i)!==F(u)||p.uv.getY(i)!==F(v)||
     p.normal.getX(i)!==0||p.normal.getY(i)!==1||p.normal.getZ(i)!==6.123234262925839e-17)return false;
 }
 return true;
}
const stockBefore=THREE.Object3D.prototype.onBeforeRender,stockAfter=THREE.Object3D.prototype.onAfterRender;
const stockHooks=(m:THREE.Object3D)=>m.onBeforeRender===stockBefore&&m.onAfterRender===stockAfter;

/** A renderer-only r187 draw lease. No actor, buffers, source, scene ordering,
 * contact or other terrain material is changed. Main integration is separate. */
export class West2RimDraw {
 private readonly c:Config;
 private readonly r?:Range;
 private readonly n?:GroundTile;
 private readonly s?:GroundTile;
 private readonly north?:MaterialPin;
 private readonly south?:MaterialPin;
 private readonly gl:ReturnType<THREE.WebGLRenderer['getContext']>;
 private readonly coverBytes:Uint8Array;
 private readonly viewport=new THREE.Vector4();
 private readonly canvasSize=new THREE.Vector2();
 private caps?:THREE.WebGLRenderer['capabilities'];
 private rgba4=false;
 private phase:Phase='stock';
 private cached?:{key:readonly unknown[];good:boolean};
 private active=false;
 private drawn=false;
 constructor(c:Config){
  this.c=c;this.gl=c.renderer.getContext();this.coverBytes=c.cover.bytes;
  if(THREE.REVISION!=='187'||!standardLandAtlasMatches(c.terrain,c.terrainSha,c.cover)||
     !('createVertexArray' in this.gl)||c.cover.sourceDecodedSha&&c.cover.sourceDecodedSha!==CANOPY_FENCE.pins.coverDecoded)return;
  const n=c.tile(WEST2_RIM.north),s=c.tile(WEST2_RIM.south),r=frame(c.terrain);
  if(!r||!n||!s||n.local===s.local)return;
  const north=pinMaterial(n.local),south=pinMaterial(s.local);
  if(!north||!south)return;
  this.r=r;this.n=n;this.s=s;this.north=north;this.south=south;this.phase='cold';
 }
 diagnostics(){return {source:this.phase,drawnFine:this.drawn?[WEST2_RIM.north]:[]};}
 private canvas(r:THREE.WebGLRenderer=this.c.renderer,scene:THREE.Scene=this.c.scene){
  const g=this.gl;
  return r===this.c.renderer&&scene===this.c.scene&&scene.parent===null&&scene.visible&&
   scene.onBeforeRender===stockBefore&&scene.onAfterRender===stockAfter&&scene.overrideMaterial===null&&
   r.getContext()===g&&!g.isContextLost()&&r.getRenderTarget()===null&&!r.xr.isPresenting&&r.autoClear&&
   r.autoClearDepth&&r.autoClearColor&&r.sortObjects&&!r.shadowMap.enabled&&!r.localClippingEnabled&&!r.clippingPlanes.length&&
   !r.getScissorTest()&&g.drawingBufferWidth>0&&g.drawingBufferHeight>0&&
   r.capabilities.logarithmicDepthBuffer&&!r.capabilities.reversedDepthBuffer&&this.fullViewport(r);
 }
 private fullViewport(r:THREE.WebGLRenderer){
  // r187 canvas dimensions use floor; setViewport's native transform uses
  // round. Accept the exact same whole canvas even for fractional stock DPR.
  const {x:w,y:h}=r.getSize(this.canvasSize),d=r.getPixelRatio(),g=this.gl;
  if(!(Number.isFinite(d)&&d>0&&Number.isSafeInteger(w)&&Number.isSafeInteger(h)&&w>0&&h>0)||
     g.drawingBufferWidth!==Math.floor(w*d)||g.drawingBufferHeight!==Math.floor(h*d))return false;
  const v=r.getViewport(this.viewport);
  if(v.x!==0||v.y!==0||v.z!==w||v.w!==h)return false;
  r.getCurrentViewport(v);
  return v.x===0&&v.y===0&&v.z===Math.round(w*d)&&v.w===Math.round(h*d);
 }
 private nearStockView(camera:THREE.PerspectiveCamera){
  if(!(camera instanceof THREE.PerspectiveCamera)||camera.parent!==null||camera.layers.mask!==1||
     camera.reversedDepth||camera.coordinateSystem!==THREE.WebGLCoordinateSystem||camera.view?.enabled===true||
     camera.fov!==53||camera.near!==.08||camera.far!==350000||camera.zoom!==1||camera.filmOffset!==0||
     !(Number.isFinite(camera.aspect)&&camera.aspect>0)||camera.scale.x!==1||camera.scale.y!==1||camera.scale.z!==1)return false;
  const {x,y,z}=camera.position,e=camera.matrixWorld.elements;
  const dx=x-viewX,dy=y-viewY,dz=z-WEST2_RIM.donorZ;
  return dx*dx+dy*dy+dz*dz<viewRadius*viewRadius&&
   e[12]===x&&e[13]===y&&e[14]===z&&e.every(Number.isFinite)&&
   camera.matrixWorldInverse.elements.every(Number.isFinite)&&camera.projectionMatrix.elements.every(Number.isFinite);
 }
 private regular(){
  const c=this.c,n=this.n!,s=this.s!;
  return c.tile(WEST2_RIM.north)===n&&c.tile(WEST2_RIM.south)===s&&layout(n,2)&&layout(s,0)&&
   !c.protectedGrade(n.id)&&!c.protectedGrade(s.id)&&c.cover.bytes===this.coverBytes&&
   exactMatrix(c.scene.matrixWorld);
 }
 private materials(){
  const match=(p:MaterialPin,t:GroundTile)=>t.local===p.m&&p.m.version===p.version&&
    p.m.vertexShader===STOCK_TERRAIN_VERTEX&&!own(p.m.uniforms,WEST2_RIM.gain)&&same(wrap(p.m),p.settings);
  return match(this.north!,this.n!)&&match(this.south!,this.s!);
 }
 begin(camera:THREE.PerspectiveCamera):undefined|(()=>void){
  if(this.active)return;
  this.drawn=false;
  const c=this.c,r=c.renderer,g=this.gl;
  if(this.phase==='stock'||!this.r||!this.nearStockView(camera)||!this.canvas()||!this.regular()||!this.materials()){
   if(g.isContextLost()){this.caps=undefined;this.cached=undefined;}
   return;
  }
  const caps=r.capabilities;
  if(this.caps!==caps){
   this.caps=caps;this.cached=undefined;
   const a=g.getContextAttributes();
   this.rgba4=a?.stencil===false&&regularNorthRimSampleProfile(a,()=>g.getParameter(g.SAMPLES))==='rgba4'&&
    g.getParameter(g.ALPHA_BITS)===8&&g.getParameter(g.DEPTH_BITS)===24;
  }
  if(!this.rgba4)return;
  if(this.phase==='cold'){
   this.phase='checking';const buffer=this.coverBytes.buffer;
   void verifyDecodedCover(c.cover).then(sha=>{
    this.phase=sha===CANOPY_FENCE.pins.coverDecoded&&c.cover.bytes===this.coverBytes&&
     this.coverBytes.buffer===buffer&&west2DryTapProof(c.terrain,c.cover)?'verified':'stock';
   },()=>{this.phase='stock';});
  }
  if(this.phase!=='verified')return;
  const north=this.n!,south=this.s!,extent=this.r,mat=this.north!.m,pin=this.north!;
  c.scene.updateWorldMatrix(false,false);
  north.fine!.updateWorldMatrix(false,false);south.fine!.updateWorldMatrix(false,false);
  const a=shape(c.scene,north,extent,1),b=shape(c.scene,south,extent,2);
  if(!a||!b||!stockHooks(a.mesh)||!stockHooks(b.mesh))return;
  const ka=ownerKey(a,north),kb=ownerKey(b,south),key=[...ka,...kb];
  if(!this.cached||!same(this.cached.key,key)){
   let good=exactStar(c.terrain,north,a,2)&&exactStar(c.terrain,south,b,0);
   for(let k=WEST2_RIM.first-1;good&&k<=WEST2_RIM.last+1;k++){
    good=a.pos.getX(rowStart+k)===b.pos.getX(k)&&a.pos.getY(rowStart+k)===b.pos.getY(k)&&
      F(F(a.mesh.position.z)+a.pos.getZ(rowStart+k))===WEST2_RIM.oldZ&&
      F(F(b.mesh.position.z)+b.pos.getZ(k))===WEST2_RIM.donorZ;
   }
   this.cached={key,good};
  }
  if(!this.cached.good)return;
  const renderFrame=r.info.render.frame+1;
  if(!Number.isSafeInteger(renderFrame))return;
  const gain={value:0},uniforms=mat.uniforms;
  let closed=false,linkedVersion:number|undefined,finished=false,oldUpload=false,disposed=false;
  const onDispose=()=>{disposed=true;this.cached=undefined;};
  const unbind=()=>{
   gain.value=0;
   if(linkedVersion===undefined)return;
   const ownGain=uniforms[WEST2_RIM.gain]===gain;
   if(ownGain)delete uniforms[WEST2_RIM.gain];
   if(mat.vertexShader===WEST2_RIM_VERTEX){
    const owned=mat.version===linkedVersion&&mat.uniforms===uniforms&&ownGain;
    mat.vertexShader=STOCK_TERRAIN_VERTEX;mat.needsUpdate=true;
    if(owned){pin.version=mat.version;mat.uniformsNeedUpdate=oldUpload;}
   }
   linkedVersion=undefined;
  };
  const matches=(rr:THREE.WebGLRenderer,sc:THREE.Scene,cam:THREE.Camera,geo:THREE.BufferGeometry,m:THREE.Material,group:THREE.Group)=>
   !closed&&!disposed&&this.active&&rr===r&&sc===c.scene&&cam===camera&&geo===a.g&&m===mat&&group==null&&
   r.info.render.frame===renderFrame&&r.capabilities===caps&&this.nearStockView(camera)&&
   this.canvas(rr,sc)&&this.regular()&&a.mesh.onBeforeRender===before&&a.mesh.onAfterRender===after&&stockHooks(b.mesh);
  const before:THREE.Object3D['onBeforeRender']=(rr,sc,cam,geo,m,group)=>{
   unbind();
   if(finished||!matches(rr,sc,cam,geo,m,group)||!this.materials())return;
   const na=shape(sc,north,extent,1),sb=shape(sc,south,extent,2);
   if(!na||!sb||!same(ka,ownerKey(na,north))||!same(kb,ownerKey(sb,south)))return;
   // This r187 list is filled only after frame increment. The donor has to
   // be an actual current opaque submission, not simply a visible peer.
   let ownDraw=0,donorDraw=0;
   for(const q of r.renderLists.get(sc,0).opaque){
    if(q.object===a.mesh){if(q.geometry!==a.g||q.material!==mat||q.group!=null)return;ownDraw++;}
    if(q.object===b.mesh){if(q.geometry!==b.g||q.material!==this.south!.m||q.group!=null)return;donorDraw++;}
   }
   if(ownDraw!==1||donorDraw!==1)return;
   oldUpload=mat.uniformsNeedUpdate;
   gain.value=1;uniforms[WEST2_RIM.gain]=gain;mat.vertexShader=WEST2_RIM_VERTEX;
   mat.needsUpdate=true;linkedVersion=mat.version;mat.uniformsNeedUpdate=true;
  };
  const after:THREE.Object3D['onAfterRender']=(rr,sc,cam,geo,m,group)=>{
   if(linkedVersion!==undefined&&gain.value===1&&mat.version===linkedVersion&&mat.vertexShader===WEST2_RIM_VERTEX&&
      mat.uniforms===uniforms&&uniforms[WEST2_RIM.gain]===gain&&matches(rr,sc,cam,geo,m,group)){
    this.drawn=true;finished=true;
   }
   unbind();
  };
  const close=()=>{
   if(closed)return;closed=true;
   try{unbind();}finally{
    this.active=false;
    a.g.removeEventListener('dispose',onDispose);b.g.removeEventListener('dispose',onDispose);
    if(a.mesh.onBeforeRender===before)a.mesh.onBeforeRender=stockBefore;
    if(a.mesh.onAfterRender===after)a.mesh.onAfterRender=stockAfter;
   }
  };
  this.active=true;
  try{
   a.g.addEventListener('dispose',onDispose);b.g.addEventListener('dispose',onDispose);
   a.mesh.onBeforeRender=before;a.mesh.onAfterRender=after;
   return close;
  }catch{close();return;}
 }
}
