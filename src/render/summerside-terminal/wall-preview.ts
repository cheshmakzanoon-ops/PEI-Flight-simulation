import {
 BufferAttribute,DoubleSide,FloatType,Group,LessEqualDepth,Material,Mesh,NormalBlending,ShaderMaterial,StaticDrawUsage,
 type BufferGeometry,type Camera,type Object3D,type Scene,type WebGLRenderer,
} from 'three';
import {project} from '../../sim/geo.ts';
import {DOWNTOWN_TILES} from '../summerside-roof-source.ts';
import {olearyLinkPrograms,type OlearyLink,type OlearyProgramProof} from '../oleary-railway/program-gate.ts';
import {TERMINAL_WIDTH,TERMINAL_WIRE,terminalDrawAllows,terminalWireAllows,type TerminalAttr,type TerminalStream} from './terminal-wall-owner.ts';
import {terminalRooflessWallShader} from './terminal-wall-tone.ts';

const [w,s,e,n]=DOWNTOWN_TILES.q032001.bounds,nw=project(w,n),se=project(e,s);
const [X,Z]=[(nw.x+se.x)/2,(nw.z+se.z)/2];
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const expected=[...identity];expected[12]=X;expected[14]=Z;
const sameMatrix=(o:Object3D,a:readonly number[])=>o.matrixWorld.elements.every((x,i)=>x===a[i]);
const transform=(o:Object3D,x:number,z:number)=>o.matrixAutoUpdate&&o.matrixWorldAutoUpdate&&
 o.position.x===x&&o.position.y===0&&o.position.z===z&&o.quaternion.x===0&&o.quaternion.y===0&&o.quaternion.z===0&&
 o.quaternion.w===1&&o.scale.x===1&&o.scale.y===1&&o.scale.z===1;
const keys=Object.keys(TERMINAL_WIDTH) as TerminalAttr[];
const near=(c:Camera)=>{const {x,y,z}=c.position;return Number.isFinite(y)&&y<650&&(x+45207)**2+(z-12539)**2<1800**2;};
const mode=(m:ShaderMaterial,s:Scene)=>m.type==='ShaderMaterial'&&m.glslVersion===null&&m.side===DoubleSide&&m.vertexColors&&
 m.visible&&!m.transparent&&!m.wireframe&&m.colorWrite&&m.depthWrite&&m.depthTest&&m.depthFunc===LessEqualDepth&&
 m.blending===NormalBlending&&!m.stencilWrite&&!m.clippingPlanes&&!m.polygonOffset&&m.opacity===1&&m.alphaTest===0&&
 !m.alphaHash&&!m.fog&&!m.lights&&!m.clipping&&m.allowOverride&&m.toneMapped&&
 m.onBeforeRender===Material.prototype.onBeforeRender&&m.onBeforeCompile===Material.prototype.onBeforeCompile&&
 m.customProgramCacheKey===Material.prototype.customProgramCacheKey&&
 Object.keys(m.uniforms).length===1&&s.environment?.isTexture===true&&m.uniforms.waterStreetSky?.value===s.environment&&
 !Object.keys(m.defines).length;

const settings=['type','version','fragmentShader','vertexShader','glslVersion','visible','side','shadowSide',
 'vertexColors','opacity','transparent','alphaHash','alphaTest','alphaToCoverage','premultipliedAlpha','blending',
 'blendSrc','blendDst','blendEquation','blendSrcAlpha','blendDstAlpha','blendEquationAlpha','blendAlpha',
 'depthFunc','depthTest','depthWrite','colorWrite','stencilWrite','stencilWriteMask','stencilFunc','stencilRef',
 'stencilFuncMask','stencilFail','stencilZFail','stencilZPass','clipIntersection','clipShadows','precision',
 'polygonOffset','polygonOffsetFactor','polygonOffsetUnits','dithering','forceSinglePass','allowOverride','toneMapped',
 'linewidth','wireframe','wireframeLinewidth','fog','lights','clipping','index0AttributeName',
 'onBeforeRender','onBeforeCompile','customProgramCacheKey'] as const;
/** Raster state can change without touching Three's material version. Keep both actual materials scoped. */
function materialLease(m:ShaderMaterial){
 const scalars=settings.map(k=>m[k]), blend=m.blendColor,[r,g,b]=blend.toArray();
 const uniforms=m.uniforms,defines=m.defines,extensions=m.extensions;
 const us=Object.entries(uniforms),ds=Object.entries(defines),es=Object.entries(extensions);
 const groups=m.uniformsGroups,planes=m.clippingPlanes,basis=m.defaultAttributeValues;
 const entries=(Object.keys(basis) as (keyof typeof basis)[]).map(k=>[k,basis[k],basis[k].slice()] as const);
 const same=(ref:readonly (readonly [string,unknown])[],live:Record<string,unknown>)=>
  Object.keys(live).length===ref.length&&ref.every(([k,v])=>live[k]===v);
 return ()=>settings.every((k,i)=>m[k]===scalars[i])&&m.blendColor===blend&&blend.r===r&&blend.g===g&&blend.b===b&&
  m.uniformsGroups===groups&&!groups.length&&m.clippingPlanes===planes&&planes===null&&
  m.uniforms===uniforms&&m.defines===defines&&m.extensions===extensions&&same(us,uniforms)&&same(ds,defines)&&same(es,extensions)&&
  m.defaultAttributeValues===basis&&Object.keys(basis).length===entries.length&&
  entries.every(([k,a,b])=>basis[k]===a&&a.length===b.length&&b.every((v,i)=>v===a[i]));
}
function attrAllows(k:TerminalAttr,v:unknown):v is BufferAttribute{
 return v instanceof BufferAttribute&&v.itemSize===TERMINAL_WIDTH[k]&&v.count===TERMINAL_WIRE.total&&!v.normalized&&
  v.gpuType===FloatType&&v.usage===StaticDrawUsage&&!v.updateRanges.length&&v.array.length===v.count*v.itemSize&&
  (k==='facadeStyle'?v.array instanceof Uint8Array:v.array instanceof Float32Array);
}
const indexed=(a:BufferAttribute|null):a is BufferAttribute=>a instanceof BufferAttribute&&a.itemSize===1&&!a.normalized&&
 a.gpuType===FloatType&&a.usage===StaticDrawUsage&&!a.updateRanges.length&&a.array instanceof Uint32Array;
const baseDraw=(g:BufferGeometry)=>g.drawRange.start===0&&g.drawRange.count===Infinity&&!g.groups.length&&
 !g.morphTargetsRelative&&!Object.keys(g.morphAttributes).length&&Object.keys(g.attributes).length===keys.length;
type Before=Mesh['onBeforeRender'];
type After=Mesh['onAfterRender'];
type Program={readonly program:WebGLProgram};
const program=(r:WebGLRenderer,m:Material)=>(r.properties.get(m) as {currentProgram?:Program}).currentProgram;
type WallPipeline=Readonly<{renderer:WebGLRenderer;camera:Camera;trackDraw:boolean;link?:OlearyLink}>;

/** Optional owner-scoped material substitution: always one existing draw, no geometry mutation.
 * The probe is never mounted. Three uses the real submitting draw, not the compile proxy, to set gain. */
export class TerminalWallPreview{
 private readonly abort=new AbortController();
 private pending=false;
 private retired=false;
 private drawn=false;
 private release?:()=>void;
 private actor?:ShaderMaterial;
 private stock?:ShaderMaterial;
 private ready?:(m:ShaderMaterial)=>boolean;
 private callbacks?:{original:After;reported:After};
 private reset?:()=>void;
 readonly owner:Mesh;
 readonly scene:Scene;
 private readonly current:()=>boolean;
 private readonly p:WallPipeline;
 constructor(owner:Mesh,scene:Scene,current:()=>boolean,p:WallPipeline){
  this.owner=owner;this.scene=scene;this.current=current;this.p=p;
 }
 get active(){return !this.retired&&!!this.actor&&this.owner.material===this.actor;}
 get rendered(){return this.active&&this.drawn;}
 async verify(atlas:string|undefined,id:string,wire:ArrayBuffer,rows:readonly unknown[]){
  if(this.pending||this.retired)return;
  this.pending=true;
  const {owner:o,scene,p:{renderer,camera}}=this,signal=this.abort.signal;
  try{
   const stock=o.material,g=o.geometry;
   if(!(stock instanceof ShaderMaterial)||!mode(stock,scene)||g.index||!baseDraw(g))return;
   const skyBinding=stock.uniforms.waterStreetSky,sky=skyBinding.value;
   const report=this.p.trackDraw, stockLease=materialLease(stock);
   const streams=keys.map(name=>{const v=g.getAttribute(name);return attrAllows(name,v)?
    {name,v,array:v.array,version:v.version,local:v.array.slice(TERMINAL_WIRE.first*v.itemSize,TERMINAL_WIRE.last*v.itemSize)}:undefined;});
   if(streams.some(v=>!v))return;
   const before:Before=o.onBeforeRender, original:After=o.onAfterRender;
   const layer=o.layers.mask,order=o.renderOrder,cull=o.frustumCulled;
   if(layer!==1||o.castShadow||o.receiveShadow||o.customDepthMaterial||o.customDistanceMaterial)return;
   let checkIndex:BufferAttribute|null|undefined,checkArray:unknown,checkVersion=-2,indexPass=false;
   const state=(m:ShaderMaterial,after:After,actual?:BufferGeometry,submit=false)=>{
    if(signal.aborted||!this.current()||o.parent!==scene||scene.parent||scene.overrideMaterial||!o.visible||
      o.material!==m||o.onBeforeRender!==before||o.onAfterRender!==after||o.layers.mask!==layer||o.renderOrder!==order||
      o.frustumCulled!==cull||o.castShadow||o.receiveShadow||o.customDepthMaterial||o.customDistanceMaterial||
      !stockLease()||stock.uniforms.waterStreetSky!==skyBinding||skyBinding.value!==sky||scene.environment!==sky||
      !transform(o,X,Z)||!transform(scene,0,0))return false;
    const draw=o.geometry, i=draw.index;
    if(!baseDraw(draw)||(actual&&(actual!==draw||!sameMatrix(o,expected)||!sameMatrix(scene,identity))))return false;
    if(streams.some(a=>!a||draw.getAttribute(a.name)!==a.v||a.v.array!==a.array||a.v.version!==a.version||!attrAllows(a.name,a.v)))return false;
    if(i!==null&&!indexed(i))return false;
    const roles=g.getAttribute('topFlag').array as Float32Array;
    if(i!==checkIndex||i?.array!==checkArray||(i?.version??-1)!==checkVersion){
     checkIndex=i;checkArray=i?.array;checkVersion=i?.version??-1;
     // A full ordered scan occurs on an original/rail/wharf/composed draw transition only.
     indexPass=terminalDrawAllows(i?.array as Uint32Array??null,roles);
    }
    if(!indexPass)return false;
    // An index view is mutable even without a version tick. The optional one-draw
    // late hook checks its entire ordered content, not only the cached startup proof.
    if(submit&&i&&!terminalDrawAllows(i.array as Uint32Array,roles)){
     indexPass=false;
     return false;
    }
    // The submitted q68 indices precede every permitted neighbor hole. Reject corrupt
    // in-range edits even before those typed arrays are marked for upload.
    const {first,last}=TERMINAL_WIRE;
    if(i)for(let k=first;k<last;k++)if(i.array[k]!==k)return false;
    for(const a of streams)if(a){const firstWord=first*a.v.itemSize;
     for(let k=0;k<a.local.length;k++)if(!Object.is(a.local[k],a.array[firstWord+k]))return false;
    }
    return true;
   };
   const stockOK=()=>state(stock,original);
   const shader=terminalRooflessWallShader(stock.vertexShader,stock.fragmentShader);
   if(!shader||!stockOK())return;
   const wireStreams=Object.fromEntries(streams.map(a=>[a!.name,a!.array])) as Record<TerminalAttr,TerminalStream>;
   if(!await terminalWireAllows(atlas,id,wire,rows,X,wireStreams)||!stockOK())return;
   const live={value:0},m=stock.clone(),defaults=stock.defaultAttributeValues;
   m.vertexShader=shader.vertex;m.fragmentShader=shader.fragment;m.uniforms={waterStreetSky:skyBinding,terminalWallLive:live};
   m.defaultAttributeValues={color:[...defaults.color],uv:[...defaults.uv],uv1:[...defaults.uv1]};
   m.name='Summerside q68 documentary wall finish';
   let proof:OlearyProgramProof|undefined,programAtLink:Program|undefined,primed=false;
   const set=(value:number)=>{if(live.value!==value){live.value=value;m.uniformsNeedUpdate=true;}};
   this.reset=()=>{primed=false;set(0);};
   const checked=(owned:ShaderMaterial,after:After,actual?:BufferGeometry,submit=false)=>{
    try{return !!proof&&!!programAtLink&&near(camera)&&state(owned,after,actual,submit)&&cloneLease()&&proof();}
    catch{return false;}
   };
   m.onBeforeRender=(r,sc,c,geo,obj,group)=>{
    primed=r===renderer&&sc===scene&&c===camera&&obj===o&&group===null&&checked(m,reported,geo,true);
    set(Number(primed));
   };
   const reported:After=(r,sc,c,geo,material,group)=>{
    try{
     if(report&&primed&&live.value===1&&r===renderer&&sc===scene&&c===camera&&material===m&&group===null&&
       checked(m,reported,geo)&&program(r,m)===programAtLink){
      const gl=r.getContext();
      this.drawn=gl.getParameter(gl.CURRENT_PROGRAM)===programAtLink?.program;
     }
    }catch{this.drawn=false;}
    finally{primed=false;original.call(o,r,sc,c,geo,material,group);}
   };
   const cloneLease=materialLease(m);
   const probe=new Group(), question=new Mesh(o.geometry,m);
   question.position.copy(o.position);question.layers.mask=layer;
   probe.add(question);probe.updateMatrixWorld(true);
   this.release=()=>{probe.clear();m.dispose();};
   const link=this.p.link??olearyLinkPrograms(renderer,camera,scene,1);
   proof=await link(probe,signal);
   probe.clear();
   programAtLink=program(renderer,m);
   if(!proof||!proof()||!programAtLink?.program||!stockOK()||!cloneLease()){this.dispose();return;}
   this.stock=stock;this.actor=m;
   this.callbacks={original,reported};
   this.ready=owned=>checked(owned,owned===stock?original:reported);
  }catch{this.dispose();}
 }
 sync(){
  this.drawn=false;
  if(this.retired||!this.actor||!this.ready||!this.stock||!this.callbacks)return;
  const {owner,actor,stock,callbacks}=this;
  const m=owner.material;
  if((m!==actor&&m!==stock)||!this.ready(m===actor?actor:stock)){
   this.withdraw();
   return;
  }
  if(m===stock){
   owner.onAfterRender=callbacks.reported;
   owner.material=actor;
  }
 }
 private withdraw(){
  this.reset?.();
  if(this.actor&&this.owner.material===this.actor&&this.stock)this.owner.material=this.stock;
  if(this.callbacks&&this.owner.onAfterRender===this.callbacks.reported)this.owner.onAfterRender=this.callbacks.original;
  this.drawn=false;
 }
 dispose(){
  if(this.retired)return;
  this.retired=true;
  this.abort.abort();
  this.withdraw();
  try{this.release?.();}catch{/** Original draw is already restored. */}finally{
   this.release=undefined;this.ready=undefined;this.actor=undefined;this.reset=undefined;
  }
 }
}
