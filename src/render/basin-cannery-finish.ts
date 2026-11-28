import * as T from 'three';
import {project,RAD} from '../sim/geo.ts';
import {BASIN_CANNERY_ROUTE} from '../app/basin-cannery-option.ts';
import {BASIN_CANNERY} from './basin-cannery.generated.ts';
import {BASIN_CHANNEL} from '../sim/basin-head-channel.generated.ts';
import {BASIN_GROUND} from '../sim/basin-bank-relief.generated.ts';
import {FRONT_FINISH,patchCanneryWood,type FrontRole} from '../../tools/art/basin-head-cannery-finish/basin-waterfront-finish.ts';
import type {OlearyProgramProof,OlearyLink} from './oleary-railway/program-gate.ts';
import type {Cover} from '../sim/cover.ts';
import type {Terrain} from '../sim/terrain.ts';

const names=['cladding','trim','roof','harbourRoof','timber','door','glass','gallery'] as const;
const counts=[204,1938,84,12,1908,30,168,36] as const;
const roles=Object.keys(FRONT_FINISH) as FrontRole[],streams=['position','normal','uv'] as const;
const programs={
 cladding:['dfb9296793b350b5a617d503b668f8d9a2fb1c183589dc0526033c0904d0a588','aad66f9b6f43ebd5b316dc145fec62aa90db9e50cd0ba07d72df2ab12ec0403c'],
 door:['d2378f9a348cf009dd4237e223d90224d1d65aba640ffb586cfefbf3bc46d642','d92ccd4b15f91e557a3bd96a6c908e049fe8b9e238e1ccd84e6f0e46602be635'],
 gallery:['46ff9833aa42372788205e8aa1b0e1ee1966bd5d4b243b8783c2723fb56b12bf','15dbecde46c55331d3432cf3feb08fc81f86b075e4c520a3f078dcb6fae268f6'],
} as const;
const routeOrigin=project(-62.10574,46.37296),course=338*RAD;
const points=BASIN_CANNERY.worldFrameLonLat.map(([x,z])=>project(x,z));
const center=[points.reduce((a,b)=>a+b.x,0)*.25,0,points.reduce((a,b)=>a+b.z,0)*.25] as const;
const identity=new T.Matrix4().elements,actorMatrix=new T.Matrix4().makeTranslation(...center).elements;
const defaultBefore=T.Object3D.prototype.onBeforeRender,defaultAfter=T.Object3D.prototype.onAfterRender;
const maps=['map','normalMap','bumpMap','alphaMap','envMap','roughnessMap','metalnessMap','aoMap','lightMap','emissiveMap','displacementMap'] as const;
const properties=['side','shadowSide','depthTest','depthWrite','depthFunc','colorWrite','transparent','opacity',
 'alphaHash','alphaTest','alphaToCoverage','blending','blendSrc','blendDst','blendEquation','blendSrcAlpha','blendDstAlpha',
 'blendEquationAlpha','premultipliedAlpha','polygonOffset','polygonOffsetFactor','polygonOffsetUnits',
 'dithering','stencilWrite','stencilWriteMask','stencilFunc','stencilRef','stencilFuncMask','stencilFail','stencilZFail','stencilZPass',
 'vertexColors','flatShading','wireframe','toneMapped','visible','fog','metalness','roughness','envMapIntensity','emissiveIntensity',
 'forceSinglePass','clippingPlanes','clipIntersection','clipShadows','onBeforeCompile','customProgramCacheKey',...maps] as const;
const eq=<Q>(a:ArrayLike<Q>,b:ArrayLike<Q>)=>a.length===b.length&&Array.prototype.every.call(a,(q:Q,i:number)=>q===b[i]);
const digest=async(b:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
const bytes=(a:T.BufferAttribute)=>new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength).slice().buffer;
const ordinary=(o:T.Object3D)=>o.layers.mask===1&&o.renderOrder===0&&o.onBeforeRender===defaultBefore&&o.onAfterRender===defaultAfter;
const noRot=(o:T.Object3D)=>o.quaternion.x===0&&o.quaternion.y===0&&o.quaternion.z===0&&o.quaternion.w===1&&
 o.scale.x===1&&o.scale.y===1&&o.scale.z===1;
const gShape=(g:T.BufferGeometry)=>g.index===null&&g.groups.length===0&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
 Object.keys(g.morphAttributes).length===0&&Object.keys(g.attributes).length===3;
const opaque=(m:T.MeshStandardMaterial)=>m.constructor===T.MeshStandardMaterial&&m.side===T.DoubleSide&&
 m.depthTest&&m.depthWrite&&m.colorWrite&&m.depthFunc===T.LessEqualDepth&&m.blending===T.NormalBlending&&
 m.visible&&!m.transparent&&m.opacity===1&&!m.alphaHash&&!m.alphaToCoverage&&m.alphaTest===0&&!m.vertexColors&&
 !m.flatShading&&!m.wireframe&&!m.polygonOffset&&!m.stencilWrite&&m.toneMapped&&!m.forceSinglePass&&
 m.clippingPlanes===null&&!m.premultipliedAlpha&&!m.dithering&&m.metalness===0&&m.roughness===.83&&
 m.emissive.getHex()===0&&maps.every(k=>m[k]===null);
type Mesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
type Original={role:FrontRole; mesh:Mesh; geo:T.BufferGeometry; material:T.MeshStandardMaterial;
 props:readonly unknown[]; attrs:T.BufferAttribute[]; arrays:T.TypedArray[]; versions:number[]; materialVersion:number;
 color:readonly number[]; emissive:readonly number[]; defines:T.MeshStandardMaterial['defines']};
type Part=Original&{finish:T.MeshStandardMaterial;patched:()=>boolean;finishVersion:number};
type Lighting={env:T.Texture;source:T.Texture['source'];image:unknown;environmentVersion:number;lamps:T.Light[]};
type Prep={parts:Part[];program:OlearyProgramProof;bank:T.Mesh;lighting:Lighting};
type Direct=T.WebGLRenderer['renderBufferDirect'];
type Source=Readonly<{terrain:Terrain;terrainSha:string|undefined;cover:Cover;
 bank:undefined|{terrain:{spec:{id:string;sha256:string}}};
 actor:T.Group|undefined;bridge:T.Group|undefined;hasWharf:boolean}>;
export type BasinFinishFrame=Readonly<{
 route:string;selected:boolean;mode:string;view:number;flight:object;
 x:number;y:number;z:number;heading:number;time:number;status:string;
}>;
type Phase='waiting'|'ready'|'active'|'held'|'inactive';
const target=(f:BasinFinishFrame)=>f.route===BASIN_CANNERY_ROUTE&&f.selected;
// A signed ready departure is independent of the current camera; the
// optional finish is still only submitted during Chase presentation.
const launch=(f:BasinFinishFrame)=>target(f)&&f.mode==='dispatch'&&f.status==='flying'&&f.time===0&&
 f.x===routeOrigin.x&&f.z===routeOrigin.z&&f.heading===course;
const flying=(f:BasinFinishFrame)=>f.view===0&&(f.mode==='flight'||f.mode==='paused');
export function basinCannerySources(s:Source){
 const {terrain,terrainSha,cover,bank,actor,bridge,hasWharf}=s;
 return T.REVISION==='187'&&!!globalThis.crypto?.subtle&&!!actor&&!!bridge&&!hasWharf&&!cover.wharfToe&&
  terrainSha===BASIN_GROUND.pinTerrainSha256&&
  terrain.spec.width===4096&&terrain.spec.height===2720&&eq(terrain.spec.bounds,[-64.47,45.94,-61.93,47.1])&&
  cover.width===4096&&cover.height===2720&&cover.sourceSha===BASIN_CHANNEL.pinCoverSha256&&
  cover.sourceDecodedSha===BASIN_CHANNEL.pinCoverDecodedSha256&&cover.basin?.plan===BASIN_CHANNEL&&bank?.terrain.spec===BASIN_GROUND;
}

/** An explicit local child of the existing inlet preview. No extra scenery assets,
 * no live material assignment, and no graphics state changes outside this call. */
export class BasinCanneryFinish {
 private readonly raw:Direct;
 private readonly gl:WebGL2RenderingContext;
 private readonly logical=new T.Vector2();
 private readonly viewport=new T.Vector4();
 private readonly physical=new T.Vector2();
 private phase:Phase='waiting';
 private reason='';
 private submitted=0;
 private pending:AbortController|undefined;
 private prep:Prep|undefined;
 private flight:object|undefined;
 private retired=false;
 private readonly gain={value:0};
 private readonly r:T.WebGLRenderer;
 private readonly scene:T.Scene;
 private readonly cam:T.PerspectiveCamera;
 private readonly src:Source;
 private readonly link:OlearyLink;
 private readonly now:()=>BasinFinishFrame;
 constructor(r:T.WebGLRenderer,scene:T.Scene,cam:T.PerspectiveCamera,src:Source,link:OlearyLink,now:()=>BasinFinishFrame){
  this.r=r;this.scene=scene;this.cam=cam;this.src=src;this.link=link;this.now=now;
  this.raw=r.renderBufferDirect;this.gl=r.getContext() as WebGL2RenderingContext;
 }
 get state(){return {phase:this.phase,submitted:this.submitted,reason:this.reason};}
 get phaseForDispatch(){return this.phase==='ready'&&(!this.prep||!this.raster()||!this.ready(this.prep))?'held':this.phase;}
 private clear(phase:Phase,reason=''){
  this.gain.value=0;this.submitted=0;this.flight=undefined;
  this.pending?.abort();this.pending=undefined;
  const old=this.prep;this.prep=undefined;
  this.phase=phase;this.reason=reason;
  if(old)for(const p of old.parts)p.finish.dispose();
 }
 reset(){if(!this.retired)this.clear('waiting');}
 dispose(){this.retired=true;this.clear('inactive');}
 private raster(){
  try{
   const {r,scene:s,cam:c,gl:g}=this,a=g.getContextAttributes(),d=r.getPixelRatio(),
    l=r.getSize(this.logical),p=r.getViewport(this.viewport),w=r.getDrawingBufferSize(this.physical);
   return r.getContext()===g&&!g.isContextLost()&&r.getRenderTarget()===null&&r.capabilities.isWebGL2&&r.capabilities.logarithmicDepthBuffer&&
    !r.capabilities.reversedDepthBuffer&&a?.antialias===true&&a.alpha&&a.depth&&g.getParameter(g.SAMPLES)===4&&
    g.getParameter(g.ALPHA_BITS)===8&&g.getParameter(g.DEPTH_BITS)===24&&
    g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)===null&&g.getParameter(g.READ_FRAMEBUFFER_BINDING)===null&&
    d>0&&d<=1.5&&w.x>=800&&w.x<=4096&&w.y>=480&&w.y<=2160&&l.x>0&&l.y>0&&
    w.x===Math.floor(l.x*d)&&w.y===Math.floor(l.y*d)&&g.drawingBufferWidth===w.x&&g.drawingBufferHeight===w.y&&
    p.x===0&&p.y===0&&p.z===l.x&&p.w===l.y&&eq(g.getParameter(g.VIEWPORT),[0,0,Math.round(l.x*d),Math.round(l.y*d)])&&
    !r.xr.isPresenting&&!r.xr.enabled&&!r.getScissorTest()&&!g.isEnabled(g.SCISSOR_TEST)&&
    !g.isEnabled(g.SAMPLE_COVERAGE)&&
    !r.shadowMap.enabled&&!r.clippingPlanes.length&&!r.localClippingEnabled&&r.sortObjects&&
    r.autoClear&&r.autoClearDepth&&r.autoClearColor&&r.autoClearStencil&&r.info.autoReset&&
    r.outputColorSpace===T.SRGBColorSpace&&r.toneMapping===T.ACESFilmicToneMapping&&r.toneMappingExposure===1&&
    s.overrideMaterial===null&&!s.fog&&ordinary(s)&&eq(s.matrix.elements,identity)&&eq(s.matrixWorld.elements,identity)&&
    c.constructor===T.PerspectiveCamera&&c.parent===null&&c.layers.mask===1&&!c.reversedDepth&&c.fov===53&&c.zoom===1&&
    c.near===.08&&c.far===350000&&c.aspect===l.x/l.y&&c.view===null&&c.filmOffset===0&&
    c.projectionMatrix.elements.every(Number.isFinite)&&c.matrixWorld.elements.every(Number.isFinite)&&c.matrixWorldInverse.elements.every(Number.isFinite);
  }catch{return false;}
 }
 private drawViewport(){
  try{
   const g=this.gl,r=this.r,view=r.getCurrentViewport(this.viewport);
   return r.getRenderTarget()===null&&g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)===null&&
    !g.isEnabled(g.SCISSOR_TEST)&&!g.isEnabled(g.SAMPLE_COVERAGE)&&
    view.x===0&&view.y===0&&eq(g.getParameter(g.VIEWPORT),[view.x,view.y,view.z,view.w])&&
    view.z===Math.round(this.logical.x*r.getPixelRatio())&&view.w===Math.round(this.logical.y*r.getPixelRatio());
  }catch{return false;}
 }
 private site(){
  const s=this.scene,{actor,bridge}=this.src;
  return !!actor&&!!bridge&&basinCannerySources(this.src)&&actor.parent===s&&bridge.parent===s&&
   actor.name==='Historic Cannery at Basin Head'&&ordinary(actor)&&actor.visible&&bridge.visible&&
   actor.position.x===center[0]&&actor.position.y===0&&actor.position.z===center[2]&&noRot(actor)&&
   eq(actor.matrix.elements,actorMatrix)&&eq(actor.matrixWorld.elements,actorMatrix)&&actor.children.length===8&&
   actor.children.every((o,i)=>o.name==='Cannery '+names[i]&&o instanceof T.Mesh&&o.parent===actor&&o.geometry.attributes.position?.count===counts[i]);
 }
 private lampBasis():Lighting|undefined{
  const env=this.scene.environment,lamps=this.scene.children.filter((o):o is T.Light=>(o as T.Light).isLight===true);
  if(!env||env.mapping!==T.EquirectangularReflectionMapping||lamps.length!==2||
    lamps[0].constructor!==T.HemisphereLight||lamps[1].constructor!==T.DirectionalLight)return;
  return {env,source:env.source,image:env.image,environmentVersion:env.version,lamps};
 }
 private lights(l:Lighting){
  const s=this.scene,e=s.environment,a=s.environmentRotation;
  return !!e&&e===l.env&&e.source===l.source&&e.image===l.image&&e.version===l.environmentVersion&&
   // Match the ordinary World panorama; zero yaw is an unconfigured studio scene.
   e.mapping===T.EquirectangularReflectionMapping&&s.environmentIntensity===.77&&a.x===0&&
   a.y===-.512*Math.PI*2&&a.z===0&&a.order==='XYZ'&&
   l.lamps.every(x=>x.parent===this.scene&&x.visible&&x.layers.mask===1&&!x.castShadow);
 }
 private sourcePart(role:FrontRole):Original|undefined{
  const o=this.src.actor?.children[names.indexOf(role)],spec=FRONT_FINISH[role];
  if(!(o instanceof T.Mesh)||o.constructor!==T.Mesh||!ordinary(o)||o.castShadow||o.receiveShadow||
   !noRot(o)||o.position.lengthSq()!==0||!eq(o.matrix.elements,identity)||!eq(o.matrixWorld.elements,actorMatrix))return;
  const m=o.material as T.MeshStandardMaterial,g=o.geometry;
  if(!m||!opaque(m)||m.customProgramCacheKey()!=='basin-cannery-v1-'+role||!m.color.equals(new T.Color(spec.rgb))||!gShape(g))return;
  const a=streams.map(k=>g.getAttribute(k));
  if(!a.every((x,i)=>x instanceof T.BufferAttribute&&x.array instanceof Float32Array&&!x.normalized&&
   x.itemSize===(i===2?2:3)&&x.count===spec.count&&x.usage===T.StaticDrawUsage))return;
  const attrs=a as T.BufferAttribute[];
  return {role,mesh:o as Mesh,geo:g,material:m,attrs,arrays:attrs.map(a=>a.array),versions:attrs.map(a=>a.version),
    props:properties.map(k=>m[k]),color:m.color.toArray(),emissive:m.emissive.toArray(),materialVersion:m.version,defines:m.defines};
 }
 private intact(p:Original){
  const {mesh:o,geo:g,material:m}=p;
  return o.parent===this.src.actor&&o.geometry===g&&o.material===m&&ordinary(o)&&!o.castShadow&&!o.receiveShadow&&
   noRot(o)&&o.position.lengthSq()===0&&eq(o.matrix.elements,identity)&&eq(o.matrixWorld.elements,actorMatrix)&&gShape(g)&&
   m.version===p.materialVersion&&m.defines===p.defines&&m.defines?.STANDARD===''&&Object.keys(m.defines).length===1&&
   m.color.r===p.color[0]&&m.color.g===p.color[1]&&m.color.b===p.color[2]&&
   m.emissive.r===p.emissive[0]&&m.emissive.g===p.emissive[1]&&m.emissive.b===p.emissive[2]&&
   properties.every((k,i)=>m[k]===p.props[i])&&p.attrs.every((a,i)=>a===g.attributes[streams[i]]&&a.version===p.versions[i]&&a.array===p.arrays[i]);
 }
 private bank(o:T.Mesh){return o.parent===this.scene&&o.visible&&o.name==='seated Basin Head shore';}
 private ready(q:Prep){
  try{return this.site()&&this.bank(q.bank)&&this.lights(q.lighting)&&q.program()&&
    q.parts.every(p=>this.intact(p)&&p.patched()&&p.finish.version===p.finishVersion);}catch{return false;}
 }
 private programBytes(parts:Part[]){
  const g=this.gl,r=this.r,encoder=new TextEncoder();
  return Promise.all(parts.map(async p=>{
   const program=(r.properties.get(p.finish) as {currentProgram?:{program?:WebGLProgram}}).currentProgram?.program,
    shaders=program&&g.getAttachedShaders(program);
   if(!program||!g.isProgram(program)||!shaders||shaders.length!==2||!g.getUniformLocation(program,'dfgLUT')||
    !g.getUniformLocation(program,'canneryWoodGain'))return false;
   const text=[g.VERTEX_SHADER,g.FRAGMENT_SHADER].map(kind=>{
    const sh=shaders.find(x=>g.getShaderParameter(x,g.SHADER_TYPE)===kind);return sh&&g.getShaderSource(sh);
   });
   if(text.some(s=>!s))return false;
   return eq(await Promise.all(text.map(s=>digest(encoder.encode(s!).buffer))),programs[p.role]);
  })).then(x=>x.every(Boolean));
 }
 private inspect(f:BasinFinishFrame){
  if(this.retired||this.phase!=='waiting'||this.pending||!launch(f)||this.r.renderBufferDirect!==this.raw||
    !this.site()||!this.raster())return;
  const lighting=this.lampBasis(),bank=this.scene.getObjectByName('seated Basin Head shore');
  if(!lighting||!this.lights(lighting)||!(bank instanceof T.Mesh)||!this.bank(bank))return;
  const src=roles.map(q=>this.sourcePart(q));
  if(!src.every((p):p is Original=>!!p)){this.clear('held','original stock actor');return;}
  const ticket=this.pending=new AbortController(),parts:Part[]=[];
  const valid=()=>this.pending===ticket&&!ticket.signal.aborted&&!this.retired&&launch(this.now())&&
   this.r.renderBufferDirect===this.raw&&this.raster()&&this.site()&&this.bank(bank)&&this.lights(lighting)&&src.every(x=>this.intact(x));
  void(async()=>{
   let kept=false,reason='exact typed stock actor';
   try{
    const hashes=await Promise.all(src.map(q=>Promise.all(q.attrs.map(a=>digest(bytes(a))))));
    if(!valid()||hashes.some((h,i)=>!eq(h,streams.map(k=>FRONT_FINISH[src[i].role][k]))))return;
    const group=new T.Group(),gain=this.gain;
    for(const q of src){
     // Exact original materials are textureless; only the scene supplies
     // its existing environment and r187's DFG. No cloned borrowed textures.
     const finish=q.material.clone(),before=q.material.onBeforeCompile;let patched=false;
     finish.onBeforeCompile=function(shader,engine){before.call(this,shader,engine);patched=patchCanneryWood(shader,q.role,gain);};
     finish.customProgramCacheKey=()=> 'private-cannery-finish-v1/'+q.role;
     parts.push({...q,finish,patched:()=>patched,finishVersion:finish.version});group.add(new T.Mesh(q.geo,finish));
    }
    reason='linked r187 finish ABI';
    const proof=await this.link(group,ticket.signal);
    if(!proof||!valid()||!parts.every(q=>q.patched())||!await this.programBytes(parts)||!valid()||!proof())return;
    this.prep={parts,program:proof,bank,lighting};this.phase='ready';kept=true;
   }catch{/* Keep stock optional inlet. */}
   finally{
    if(!kept)for(const p of parts)p.finish.dispose();
    if(this.pending===ticket){this.pending=undefined;if(!kept)this.clear('held',reason);}
   }
  })();
 }
 begin(f:BasinFinishFrame,trustedDispatch:boolean){
  const q=this.prep;if(this.retired)return;
  if(!trustedDispatch||this.phase!=='ready'||!launch(f)||!q||this.r.renderBufferDirect!==this.raw||!this.raster()||!this.ready(q)){
   this.clear('held','Begin before valid ready Dispatch');return;
  }
  this.flight=f.flight;this.phase='active';this.reason='';
 }
 render(f:BasinFinishFrame,stock:()=>void){
  this.submitted=0;
  if(this.retired){stock();return;}
  if(f.mode==='dispatch'){
   stock();try{this.inspect(f);}catch{this.clear('held','source preparation refused');}return;
  }
  const q=this.prep,r=this.r,raw=this.raw,c=this.cam;
  if(!this.flight){stock();return;}
  if(!q||f.flight!==this.flight||!target(f)||f.status!=='flying'){
   this.clear('held','expired Dispatch flight');stock();return;
  }
  if(!flying(f)||Math.hypot(c.position.x-center[0],c.position.z-center[2])>=480||c.position.y>=230){
   stock();return;
  }
  if(r.renderBufferDirect!==raw||!this.raster()||!this.ready(q)){
   this.clear('held','expired render or source');stock();return;
  }
  let done=0,open=true,bad=false;
  const shim:Direct=(...args)=>{
   const [c,s,g,m,o,group]=args,i=q.parts.findIndex(p=>p.mesh===o);
   if(i<0||!open||bad)return raw.call(r,...args);
   const p=q.parts[i];
   if(this.prep!==q||r.renderBufferDirect!==shim||g!==p.geo||m!==p.material||group!==null||
    c!==this.cam||s!==this.scene||!o.visible||(done&(1<<i))!==0||!this.drawViewport()||!this.intact(p)||!q.program()){
    bad=true;return raw.call(r,...args);
   }
   raw.call(r,c,s,g,p.finish,o,group);done|=1<<i;
   // Three chooses the actual current program during submission. A
   // mismatched handle invalidates this entire frame, not only one part.
   if(!q.program())bad=true;
  };
  this.gain.value=1;r.renderBufferDirect=shim;
  try{stock();}
  finally{open=false;this.gain.value=0;if(r.renderBufferDirect===shim)r.renderBufferDirect=raw;}
  if(bad){
   // Do not display the subset if a later tuple is refused.
   this.clear('held','unexpected stock draw tuple');if(done)stock();
  }else this.submitted=(done&1)+((done>>1)&1)+((done>>2)&1);
 }
}
