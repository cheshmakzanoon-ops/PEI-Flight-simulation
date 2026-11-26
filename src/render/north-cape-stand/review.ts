import * as T from 'three';
import type {World} from '../world.ts';
import type {Vegetation} from '../vegetation.ts';
import {olearyLinkPrograms,type OlearyProgramProof} from '../oleary-railway/program-gate.ts';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import {northCapeAtlas,NORTH_CAPE_COVER_DECODED_SHA} from '../north-cape-stream.ts';
import {NORTH_CAPE_STAND_ROUTE} from '../../app/north-cape-stand-option.ts';
import {capeCardGain,capeTilt,capeCrownShaders,CAPE_DISPLAY,CAPE_LIVE} from './appearance.ts';
import {CAPE_ROWS,CAPE_TYPED_ROWS_SHA,CAPE_CHECKPOINT} from './roles.private.ts';

const CAPE_SHADER=[
 '7cdc5727c9ddd750358ff213f6f2f6c9e07cfb3f927eb0ac2744d799795f0176',
 '0b87f025c69132184c76a824fe86163d202cce3b3f0f50d54c0350f1ad2fc2d8',
 '1f0a1ec8670b21e67d24f6847bfa427b25ea0f0dbdeefb17a0f79afafad8f481',
 'db2362b1e5d3b32f487bd66f0dc30ad0755845b6d3188f35af80d3e43a93b293',
];
const CAPE_LIVE_ATLAS='4d23a6943d7beb0108d264ae111ff658da2eae7f9395fd71b8c526afb373e45b';
const MAX=45000, ACTIVATION_MS=550, LINK_MS=3000, IMAGE_MS=5000;
const EMPTY=Object3DNoop();
function Object3DNoop(){return {before:T.Object3D.prototype.onBeforeRender,after:T.Object3D.prototype.onAfterRender};}
const plane=[-.5,.5,0,.5,.5,0,-.5,-.5,0,.5,-.5,0],uvs=[0,1,1,1,0,0,1,0],order=[0,2,1,2,3,1];
const keys=['position','uv','stem','shape','hedgeGround'] as const;
type Key=typeof keys[number];
type TypedRow=typeof CAPE_ROWS[number];
type GeoRows=ReadonlyArray<{i:number; row:TypedRow; y:number; h:number; w:number;}>;
type StockRoster=ReturnType<Vegetation['beaconsfieldShadowRoster']>;
type Receiver=ReturnType<World['rollingCanopyOwner']>;
type Frame={readonly site:string;readonly mode:string;readonly view:number;readonly now:number};
type G=T.InstancedBufferGeometry;
type CanvasTex=T.Texture&{image:HTMLImageElement};
const values=(x:ArrayLike<number>,y:readonly number[])=>x.length===y.length&&y.every((v,i)=>Object.is(x[i],v));
const same=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const sha=async (x:ArrayBuffer|Uint8Array<ArrayBuffer>)=>{
 const b=await crypto.subtle.digest('SHA-256',x);
 return [...new Uint8Array(b)].map(t=>t.toString(16).padStart(2,'0')).join('');
};
const txt=(x:string)=>new TextEncoder().encode(x);
const id=(x:number,z:number)=>x+':'+z;
const rowsByXZ=new Map(CAPE_ROWS.map(q=>[id(q[0],q[2]),q] as const));
const radius=(h:number,w:number)=>.5*Math.hypot(w,Math.max(1.04*h,w));
const inset = CAPE_ROWS.map(a=>[a[0],a[2],Math.max(radius(a[5],a[6]),radius(a[7],a[8]))+4] as const);
const sightBounds=[
 Math.min(...inset.map(a=>a[0]-a[2])),Math.min(...inset.map(a=>a[1]-a[2])),
 Math.max(...inset.map(a=>a[0]+a[2])),Math.max(...inset.map(a=>a[1]+a[2])),
] as const;
function near(pos:T.Vector3){
 const [l,t,r,b]=sightBounds;
 return [pos.x,pos.y,pos.z].every(Number.isFinite)&&
  Math.hypot(Math.max(l-pos.x,0,pos.x-r),Math.max(t-pos.z,0,pos.z-b))<=810;
}

function texturePath(texture:T.Texture,url:URL):texture is CanvasTex{
 if(!(texture.image instanceof HTMLImageElement))return false;
 const p=texture.image;
 return !!p.complete&&p.naturalWidth===1024&&p.naturalHeight===512&&p.currentSrc===url.href&&
  texture.flipY&&texture.colorSpace===T.SRGBColorSpace&&texture.anisotropy===2&&
  texture.minFilter===T.LinearMipmapLinearFilter&&texture.magFilter===T.LinearFilter&&
  texture.wrapS===T.ClampToEdgeWrapping&&texture.wrapT===T.ClampToEdgeWrapping&&
  texture.generateMipmaps&&!texture.premultiplyAlpha&&texture.unpackAlignment===4&&texture.type===T.UnsignedByteType&&
  texture.format===T.RGBAFormat&&texture.mapping===T.UVMapping&&texture.mipmaps.length===0;
}

function orientation(m:T.Object3D){
 return m.matrixAutoUpdate&&m.position.lengthSq()===0&&m.quaternion.x===0&&m.quaternion.y===0&&
  m.quaternion.z===0&&m.quaternion.w===1&&m.scale.x===1&&m.scale.y===1&&m.scale.z===1&&
  m.matrixWorld.elements.every((v,i)=>v===(i%5===0?1:0));
}
function drawOK(m:T.Mesh,s:T.Scene){
 return m.parent===s&&m.visible&&m.name==='Mixed woodland canopies'&&!m.frustumCulled&&m.layers.mask===1&&
  !m.castShadow&&!m.receiveShadow&&m.renderOrder===0&&orientation(m);
}
function rasterSemantics(m:T.ShaderMaterial){
 return [m.onBeforeCompile,m.customProgramCacheKey,m.onBeforeRender,
  m.visible,m.side,m.shadowSide,m.colorWrite,m.depthWrite,m.depthTest,m.depthFunc,m.transparent,m.opacity,m.alphaToCoverage,
  m.alphaTest,m.alphaHash,m.blending,m.blendSrc,m.blendDst,m.blendEquation,m.blendSrcAlpha,m.blendDstAlpha,m.blendEquationAlpha,
  m.stencilWrite,m.stencilWriteMask,m.stencilFunc,m.stencilRef,m.stencilFuncMask,m.stencilFail,m.stencilZFail,m.stencilZPass,
  m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.forceSinglePass,m.dithering,m.premultipliedAlpha,m.toneMapped,
  m.fog,m.lights,m.clipping,m.wireframe,m.vertexColors,m.glslVersion,
  m.clippingPlanes,m.clippingPlanes?.length,m.clipIntersection,m.clipShadows,
  JSON.stringify(m.defaultAttributeValues),JSON.stringify(m.defines),m.extensions.clipCullDistance,m.extensions.multiDraw,
  m.uniformsGroups.length,m.index0AttributeName] as const;
}
function rasterStamp(m:T.ShaderMaterial){
 return [m.version,m.vertexShader,m.fragmentShader,m.defaultAttributeValues,m.defines,m.uniformsGroups,...rasterSemantics(m)] as const;
}
/** ShaderMaterial.clone/copy clones uniform Textures, which increments the
 * actual shared r187 Texture.source.version. Construct only the known exact
 * supported stock ABI and share the real uniform wrappers with zero writes. */
export function newCapeCrownMaterial(base:T.ShaderMaterial,patched:{vertexShader:string;fragmentShader:string},live:{value:number}){
 const out=new T.ShaderMaterial({...patched,uniforms:{...base.uniforms,[CAPE_LIVE]:live},
  side:T.DoubleSide,alphaToCoverage:true});
 if(!same(rasterSemantics(base),rasterSemantics(out))){out.dispose();return;}
 return out;
}
function worldAttrs(g:G){
 const a=g.attributes as Record<Key,T.BufferAttribute>;
 if(!g.isInstancedBufferGeometry||Object.keys(a).length!==keys.length||keys.some(k=>!(a[k] instanceof T.BufferAttribute))||
  g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||
  !g.index||!(g.index.array instanceof Uint16Array)||g.index.normalized||g.index.itemSize!==1||!values(g.index.array,order))return;
 const attrs=keys.map(key=>{
  const k=fixed(key,a[key]);
  return {key,ok:k,a:a[key],value:a[key].array,version:a[key].version};
 });
 if(attrs.some(a=>!a.ok))return;
 return {g,attrs,index:g.index,indexArray:g.index.array,indexVersion:g.index.version};
}
function fixed(k:Key,a:T.BufferAttribute){
 if(a.normalized||!(a.array instanceof Float32Array))return false;
 if(k==='position')return a.itemSize===3&&a.count===4&&values(a.array,plane);
 if(k==='uv')return a.itemSize===2&&a.count===4&&values(a.array,uvs);
 return a instanceof T.InstancedBufferAttribute&&a.meshPerAttribute===1&&a.count===MAX&&
  a.itemSize===(k==='stem'?3:4);
}
type Attrs=NonNullable<ReturnType<typeof worldAttrs>>;
function compatible(p:Attrs,armed:boolean){
 const {g,index,attrs}=p;
 return g.index===index&&index.version===p.indexVersion&&index.array===p.indexArray&&values(index.array,order)&&
  Object.keys(g.attributes).length===keys.length+Number(armed)&&g.drawRange.start===0&&g.drawRange.count===Infinity&&!g.groups.length&&
  attrs.every(a=>g.getAttribute(a.key)===a.a&&a.a.array===a.value&&
   (a.key==='position'||a.key==='uv'?a.version===a.a.version:true)&&fixed(a.key,a.a));
}

/** No changes to stock arrays. Refuse unknown/duplicate/wrong-prefix rows
 * atomically. A later stock reissue requires revalidation before next draw. */
export function markPublishedCapeRows(roster:StockRoster,hedge:Float32Array,marks:Uint8Array){
 const {stems,shapes,total,original}=roster;
 if(marks.length!==MAX||stems.length!==MAX*3||shapes.length!==MAX*4||hedge.length!==MAX*4||
  !Number.isInteger(total)||!Number.isInteger(original)||total<original||original<1||total>MAX)return;
 marks.fill(0);
 const rows:GeoRows[number][]=[], found=new Set<TypedRow>();
 for(let i=0;i<total;i++){
  const k=3*i,h=4*i,x=stems[k],y=stems[k+1],z=stems[k+2];
  if(x<sightBounds[0]||x>sightBounds[2]||z<sightBounds[1]||z>sightBounds[3])continue;
  const row=rowsByXZ.get(id(x,z));if(!row)continue;
  const H=shapes[h],W=shapes[h+1];
  if(i>=original||found.has(row)||!agree(row,roster,hedge,i))return;
  found.add(row);marks[i]=row[4];rows.push({i,row,y,h:H,w:W});
 }
 if(found.size!==CAPE_ROWS.length)return;
 return rows;
}
function agree(row:TypedRow,r:StockRoster,hedge:Float32Array,i:number){
 const j=3*i,k=4*i;
 const {stems,shapes}=r,h=shapes[k],w=shapes[k+1];
 return i<r.original&&stems[j]===row[0]&&stems[j+1]===row[1]&&stems[j+2]===row[2]&&shapes[k+2]===row[3]&&
  shapes[k+3]===row[9]&&
  ((h===row[5]&&w===row[6])||(h===row[7]&&w===row[8]))&&
  hedge[k]===0&&hedge[k+1]===0&&hedge[k+2]===0&&hedge[k+3]===0;
}

export class NorthCapeStandReview {
 private readonly r:T.WebGLRenderer;
 private readonly scene:T.Scene;
 private readonly camera:T.PerspectiveCamera;
 private readonly w:World;
 private readonly veg:Vegetation;
 private readonly url:URL;
 private readonly abort=new AbortController();
 private readonly marker=new T.InstancedBufferAttribute(new Uint8Array(MAX),1).setUsage(T.DynamicDrawUsage);
 private readonly frustum=new T.Frustum();
 private readonly mat=new T.Matrix4();
 private readonly ball=new T.Sphere();
 private readonly live={value:0};
 private readonly markArray=this.marker.array as Uint8Array;
 private result:'idle'|'waiting'|'loading'|'linked'|'held'='idle';
 private acquiredAt=NaN;
 private beginWaiting=NaN;
 private rows?:GeoRows;
 private rosterSeal?:readonly number[];
 private arm?:{restore:()=>void;};
 private links?:{current:()=>boolean;probe:OlearyProgramProof;owner:T.Mesh<G,T.ShaderMaterial>;
  shade:T.Mesh<G,T.ShaderMaterial>;stock:T.ShaderMaterial;active:T.ShaderMaterial;attributes:Attrs;gver:()=>boolean;};
 private draw=false;private drawGain=0;
 constructor(r:T.WebGLRenderer,s:T.Scene,c:T.PerspectiveCamera,w:World,v:Vegetation,base:string,readonly terrainSHA:string){
  this.r=r;this.scene=s;this.camera=c;this.w=w;this.veg=v;
  this.url=new URL(base+'art/canopy.webp',document.baseURI);
 }
 get status(){return {kind:'dated 2020 interpretation',checkpoint:CAPE_CHECKPOINT,phase:this.result,
  linked:this.result==='linked',visible:this.draw,drawn:this.draw,gain:this.drawGain,roles:this.rows?.length??0};}
 private basic(){
  const {r,scene,camera}=this, gl=r.getContext();
  return !this.abort.signal.aborted&&T.REVISION==='187'&&typeof WebGL2RenderingContext!=='undefined'&&
   gl instanceof WebGL2RenderingContext&&!gl.isContextLost()&&gl.getParameter(gl.SAMPLES)===4&&
   !!gl.getContextAttributes()?.antialias&&!r.getRenderTarget()&&!r.xr.isPresenting&&
   !r.shadowMap.enabled&&!r.localClippingEnabled&&r.clippingPlanes.length===0&&
   r.outputColorSpace===T.SRGBColorSpace&&r.toneMapping===T.ACESFilmicToneMapping&&r.toneMappingExposure===1&&
   r.capabilities.logarithmicDepthBuffer&&!r.capabilities.reversedDepthBuffer&&
   !scene.overrideMaterial&&!scene.fog&&camera.layers.mask===1&&camera.fov===53&&
   camera.aspect>=1.30&&camera.aspect<=1.78&&Number.isFinite(camera.aspect)&&camera.near===.08&&camera.far===350000;
 }
 private whileArmedValid(){
  const p=this.links;
  return !!p&&p.current()&&p.probe()&&p.gver();
 }
 private async prepare(){
  const {scene,r,camera,w,veg}=this;
  const stock=veg.crownFillMaterial();
  // Resolve against both real Vegetation material and existing stock shade
  // geometry, not newly searched public IDs or an independent mock renderer.
  const raw=veg.beaconsfieldShadowRoster(), shadow=raw.stock;
  const owners=scene.children.filter(o=>o instanceof T.Mesh&&o.material===stock&&o.geometry===shadow.geometry&&
   drawOK(o,scene)) as T.Mesh<G,T.ShaderMaterial>[];
  if(!(shadow instanceof T.Mesh)||!(shadow.material instanceof T.ShaderMaterial)||shadow.parent!==scene||
     shadow.name!=='Canopy ground shadows'||!shadow.visible||owners.length!==1||!this.basic()||
     !stock.isShaderMaterial||stock.transparent||!stock.alphaToCoverage||!stock.depthWrite||!stock.colorWrite||
     stock.side!==T.DoubleSide||!stock.depthTest||Object.keys(stock.uniforms).join()!=='canopy,canopySun')return this.hold();
  const owner=owners[0],attributes=worldAttrs(owner.geometry);
  if(!attributes||attributes.g.hasAttribute(CAPE_DISPLAY)||
    owner.onBeforeRender!==EMPTY.before||owner.onAfterRender!==EMPTY.after||
    scene.onBeforeRender!==EMPTY.before||scene.onAfterRender!==EMPTY.after)return this.hold();
  const glass=stock.uniforms.canopy,sun=stock.uniforms.canopySun,tex=glass.value as T.Texture;
  if(!(tex instanceof T.Texture)||shadow.material.uniforms.canopy!==glass||shadow.material.uniforms.canopySun!==sun||
     !texturePath(tex,this.url)||this.url.origin!==location.origin||sun.value!==w.sun)return this.hold();
  const image=tex.image,source=tex.source,texVersion=tex.version,sourceVersion=source.version;
  const shade=shadow as T.Mesh<G,T.ShaderMaterial>,sm=shade.material,vers=r.getContext(),environment=scene.environment;
  const s0=rasterStamp(stock),s1=rasterStamp(sm);
  const originalUniforms=stock.uniforms,shadowUniforms=sm.uniforms,liveCover=w.cover.bytes;
  const current=()=>this.basic()&&r.getContext()===vers&&scene.environment===environment&&
   scene.onBeforeRender===EMPTY.before&&scene.onAfterRender===EMPTY.after&&drawOK(owner,scene)&&
   shade.visible&&shade.parent===scene&&shade.material===sm&&shade.geometry===owner.geometry&&
   !shade.frustumCulled&&!shade.castShadow&&!shade.receiveShadow&&shade.layers.mask===1&&shade.renderOrder===0&&orientation(shade)&&
   owner.geometry===attributes.g&&same(rasterStamp(stock),s0)&&same(rasterStamp(sm),s1)&&
   stock.uniforms===originalUniforms&&sm.uniforms===shadowUniforms&&stock.uniforms.canopy===glass&&
   sm.uniforms.canopy===glass&&stock.uniforms.canopySun===sun&&sm.uniforms.canopySun===sun&&sun.value===w.sun&&
   glass.value===tex&&tex.source===source&&tex.version===texVersion&&source.version===sourceVersion&&
   tex.image===image&&texturePath(tex,this.url)&&w.cover.bytes===liveCover;
  if(!current())return this.hold();
  try{
   const verifyCanvas=document.createElement('canvas');verifyCanvas.width=1024;verifyCanvas.height=512;
   const context=verifyCanvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});
   if(!context)return this.hold();
   context.drawImage(image,0,0);
   const {data}=context.getImageData(0,0,1024,512,{colorSpace:'srgb'});
   const pixels=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
   verifyCanvas.width=1;verifyCanvas.height=1;
   const assets=await Promise.all([
    sha(pixels),sha(txt(JSON.stringify(CAPE_ROWS))),verifyDecodedCover(w.cover),
    ...[stock.vertexShader,stock.fragmentShader,sm.vertexShader,sm.fragmentShader].map(t=>sha(txt(t)))]);
   if(assets[0]!==CAPE_LIVE_ATLAS||assets[1]!==CAPE_TYPED_ROWS_SHA||assets[2]!==NORTH_CAPE_COVER_DECODED_SHA||
     !same(assets.slice(3),CAPE_SHADER)||!current()||!compatible(attributes,false)||owner.material!==stock)return this.hold();
   const patched=capeCrownShaders(stock.vertexShader,stock.fragmentShader);
   if(!patched)return this.hold();
   const active=newCapeCrownMaterial(stock,patched,this.live);
   if(!active)return this.hold();
   // Three preflight looks only at shader parameters; stock carrier stays
   // detached from this probe and is never uploaded/altered here.
   const a=rasterStamp(active),aUniforms=active.uniforms;
   const group=new T.Group();group.add(new T.Mesh(attributes.g,active));
   let keep=false;
   try{
    const check=await olearyLinkPrograms(r,camera,scene,1,true,LINK_MS)(group,this.abort.signal);
    const gver=()=>same(rasterStamp(active),a)&&active.uniforms===aUniforms&&
     active.uniforms.canopy===glass&&active.uniforms.canopySun===sun&&active.uniforms[CAPE_LIVE]===this.live;
    if(!check?.()||!current()||!gver()||!compatible(attributes,false)||owner.material!==stock)return this.hold();
    this.links={current,probe:check,owner,shade,stock,active,attributes,gver};this.result='linked';keep=true;
   }finally{if(!keep)active.dispose();}
  }catch{this.hold();}
 }
 private hold(){
  this.abort.abort();this.live.value=0;this.arm?.restore();this.arm=undefined;
  this.links?.active.dispose();this.links=undefined;this.result='held';
 }
 dispose(){this.hold();}
 /** Before render-list construction; caller must use the returned restoration
  * in finally. Sky/terrain/road/shade or any camera other than the accepted
  * player Chase renderer keep their original material for the entire frame. */
 beforeFrame(f:Frame):undefined|(()=>void){
  this.arm?.restore();this.arm=undefined;this.draw=false;this.drawGain=0;
  const {camera,r,scene,veg,w}=this;
  const stateOK=f.site===NORTH_CAPE_STAND_ROUTE&&near(camera.position)&&
   f.view===0&&(f.mode==='flight'||f.mode==='paused'||f.mode==='dispatch');
  if(!stateOK||!Number.isFinite(f.now)){
   this.acquiredAt=NaN;
   // A mode or departure change cannot settle an unfinished art program.
   // WebCrypto already in progress may finish, but no late link/mark/mount.
   if(this.result==='loading')this.hold();
   if(this.result==='waiting'){this.result='idle';this.beginWaiting=NaN;}
   return;
  }
  if(this.result==='idle'||this.result==='waiting'){
   if(!this.basic()||!northCapeAtlas({...w.terrain.spec,sha:this.terrainSHA},w.cover)){this.hold();return;}
   if(!Number.isFinite(this.beginWaiting))this.beginWaiting=f.now;
   if(f.now-this.beginWaiting>IMAGE_MS){this.hold();return;}
   const t=veg.crownFillMaterial().uniforms.canopy?.value;
   if(!(t instanceof T.Texture)||!t.image){this.result='waiting';return;}
   if(!texturePath(t,this.url)){this.hold();return;}
   this.result='loading';void this.prepare();return;
  }
  const p=this.links;
  if(!p||f.mode==='dispatch'){this.acquiredAt=NaN;return;}
  const {owner,shade,attributes:g,stock,active}=p;
  if(!this.whileArmedValid()||owner.material!==stock||owner.onBeforeRender!==EMPTY.before||
   owner.onAfterRender!==EMPTY.after||!compatible(g,false)){this.hold();return;}
  // Need unmodified near receiver and both live owners. Any different relief
  // or grade yields stock even if source canopy art still authentic.
  const ground:Receiver=w.rollingCanopyOwner(sightBounds);
  if(ground?.key!=='5-0'){this.acquiredAt=NaN;return;}
  const forest=veg.beaconsfieldShadowRoster(),h=g.g.getAttribute('hedgeGround') as T.BufferAttribute,
   st=g.g.getAttribute('stem') as T.BufferAttribute,sh=g.g.getAttribute('shape') as T.BufferAttribute;
  if(forest.stock!==shade||forest.stems!==st.array||forest.shapes!==sh.array||forest.total!==g.g.instanceCount){
   this.hold();return;
  }
  const ro=[forest.revision,forest.total,forest.original,st.version,sh.version,h.version];
  if(!this.rosterSeal||!same(ro,this.rosterSeal)){
   this.rows=markPublishedCapeRows(forest,h.array as Float32Array,this.markArray);
   this.rosterSeal=ro;this.marker.needsUpdate=true;
  }
  if(!this.rows?.length||!this.rows.every(a=>agree(a.row,forest,h.array as Float32Array,a.i)))return;
  this.frustum.setFromProjectionMatrix(this.mat.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  let max=0;
  for(const {row,y,h,w}of this.rows){
   const [x,,z]=row,dx=camera.position.x-x,dy=camera.position.y-y-h*.5,dz=camera.position.z-z,d=Math.hypot(dx,dy,dz);
   if(!(d>0))continue;
   const ry=dy/d, f=capeCardGain(d,ry);
   if(f<=max)continue;
   this.ball.center.set(x,y+h*(.47+.18*capeTilt(ry)),z);this.ball.radius=radius(h,w)+.15;
   if(this.frustum.intersectsSphere(this.ball))max=f;
  }
  if(!max){this.acquiredAt=NaN;return;}
  if(!Number.isFinite(this.acquiredAt))this.acquiredAt=f.now;
  const s=Math.max(0,Math.min(1,(f.now-this.acquiredAt)/ACTIVATION_MS)),global=s*s*(3-2*s);
  if(global<=0)return;
  const lifetime=()=>{
   const live=veg.beaconsfieldShadowRoster();
   return live.revision===forest.revision&&live.stock===shade&&live.total===forest.total&&live.original===forest.original&&
    st.version===ro[3]&&sh.version===ro[4]&&h.version===ro[5]&&this.rows?.every(a=>agree(a.row,live,h.array as Float32Array,a.i))&&
    w.rollingCanopyStill(ground.key,ground.geometry);
  };
  const before:typeof owner.onBeforeRender=(rr,ss,cc,gg,m)=>{
   this.live.value=rr===r&&ss===scene&&cc===camera&&gg===g.g&&m===active&&
    owner.material===active&&g.g.getAttribute(CAPE_DISPLAY)===this.marker&&
    this.whileArmedValid()&&compatible(g,true)&&lifetime()?global:0;
   active.uniformsNeedUpdate=true;
  };
  const after:typeof owner.onAfterRender=(rr,ss,cc,gg,mm)=>{
   if(rr!==r||ss!==scene||cc!==camera||gg!==g.g||mm!==active||this.live.value<=0||!p.probe())return;
   this.draw=true;this.drawGain=this.live.value*max;
  };
  const restore=()=>{
   this.live.value=0;
   if(owner.material===active)owner.material=stock;
   if(owner.onBeforeRender===before)owner.onBeforeRender=EMPTY.before;
   if(owner.onAfterRender===after)owner.onAfterRender=EMPTY.after;
   if(g.g.getAttribute(CAPE_DISPLAY)===this.marker)g.g.deleteAttribute(CAPE_DISPLAY);
   this.arm=undefined;
  };
  this.arm={restore};
  g.g.setAttribute(CAPE_DISPLAY,this.marker);
  owner.onBeforeRender=before;owner.onAfterRender=after;owner.material=active;
  return restore;
 }
}
