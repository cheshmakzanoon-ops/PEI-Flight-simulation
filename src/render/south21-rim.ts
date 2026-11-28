/** One sealed stock two-owner raster transaction. No installation in main. */
import * as T from 'three';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import {GROUND_LIFT,WORLD_COLS,WORLD_ROWS} from '../sim/coastal-terrain.ts';
import {verifyDecodedCover} from '../sim/cover-proof.ts';
import {CANOPY_FENCE} from './canopy-fence.generated.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';
import {STOCK_TERRAIN_VERTEX} from './regular-z-rim-clip-v2.ts';
import {regularNorthRimSampleProfile} from './regular-z-rim-raster-profile.ts';

export const SOUTH21=Object.freeze({donor:'24-20',actor:'24-21',first:37,last:40,
 localZ:-2930.6103515625,fromZ:56388.98828125,toZ:56388.984375,gain:'peiSouth21RimActive'} as const);
const N=112,S=113,F=Math.fround;
const move=`if(${SOUTH21.gain} == 1.0 && gl_VertexID >= ${SOUTH21.first} && gl_VertexID <= ${SOUTH21.last} && position.z == ${SOUTH21.localZ})\n  w.z=${SOUTH21.toZ};\n `;
const anchor='gl_Position=projectionMatrix*viewMatrix*w;';
export const SOUTH21_VERTEX=`uniform highp float ${SOUTH21.gain};\n`+STOCK_TERRAIN_VERTEX.replace(anchor,move+anchor);
export function south21ClipWorldZ(localZ:number,id:number,worldZ:number,active:number){
 return active===1&&Number.isSafeInteger(id)&&id>=SOUTH21.first&&id<=SOUTH21.last&&localZ===SOUTH21.localZ?SOUTH21.toZ:worldZ;
}
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as const;
const same=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((q,i)=>Object.is(q,b[i]));
const positioned=(m:T.Matrix4,x=0,z=0)=>m.elements.every((v,i)=>v===(i===12?x:i===14?z:identity[i]));
const stockHooks=[T.Object3D.prototype.onBeforeRender,T.Object3D.prototype.onAfterRender] as const;
const plain=(o:T.Object3D)=>o.onBeforeRender===stockHooks[0]&&o.onAfterRender===stockHooks[1];
const px=(w:number,k:number)=>F(k*(w/N)-w/2);
const pz=(d:number,k:number)=>F(k*(d/N)-d/2);
function domain(t:Terrain){
 const w=(t.right-t.left)/WORLD_COLS,d=(t.bottom-t.top)/WORLD_ROWS,x=t.left+24*w,
   north=t.top+20*d,south=t.top+21*d;
 if(F(w/2)!==3046.515380859375||F(-d/2)!==SOUTH21.localZ||F(south)!==SOUTH21.toZ||
  F(F(north+d/2)-SOUTH21.localZ)!==SOUTH21.toZ||F(F(south+d/2)+SOUTH21.localZ)!==SOUTH21.fromZ)return;
 return {w,d,x,north,south};
}
type Domain=NonNullable<ReturnType<typeof domain>>;
/** Original signed bilinear taps for the entire tessellation star on both
 * banks, with 0.01m beyond the absolute Float32 geometry. Only this box. */
export function south21DryTaps(t:Terrain,c:Cover){
 const d=domain(t);if(!d||c.width!==4096||c.height!==2720||t.spec.width!==c.width||t.spec.height!==c.height)return;
 const x=F(d.x+d.w/2),a=F(F(d.north+d.d/2)+pz(d.d,N-1))-.01,b=F(F(d.south+d.d/2)+pz(d.d,1))+.01;
 const west=F(x+px(d.w,SOUTH21.first-1))-.01,east=F(x+px(d.w,SOUTH21.last+1))+.01;
 const u=t.uv(west,a),v=t.uv(east,b);
 if(Math.floor(u[0]*c.width-.5)!==3112||Math.floor(v[0]*c.width-.5)+1!==3119||
    Math.floor(u[1]*c.height-.5)!==2594||Math.floor(v[1]*c.height-.5)+1!==2597)return;
 for(let j=2594;j<=2597;j++)for(let i=3112;i<=3119;i++){
  const k=j*c.width+i;if(t.samples[k]===-32768||c.bytes[k*2+1]!==255)return;
 }
 return {box:[west,a,east,b],cols:[3112,3119],rows:[2594,2597],cells:32,signedCover:254};
}

type Tile={id:string;i:number;j:number;lod:number;seams?:string;relief?:unknown;
 x0:number;z0:number;w:number;d:number;local:T.ShaderMaterial;coarse:T.Mesh;fine?:T.Mesh};
type Inputs={scene:T.Scene;renderer:T.WebGLRenderer;terrain:Terrain;cover:Cover;terrainSha:string;
 tile:(key:string)=>Tile|undefined;grade:(key:string)=>boolean};
type Source='cold'|'checking'|'verified'|'stock';
export type South21RimDraw={begin:(camera:T.PerspectiveCamera)=>undefined|(()=>void);
 diagnostics:()=>{source:Source;drawnFine:string[]}};
const layout=(p:Tile,side:0|2)=>{
 const k=p.seams;
 return p.lod===N&&!p.relief&&!p.coarse.visible&&p.fine?.visible===true&&k!==undefined&&
   /^112:(?:8|56|112),(?:8|56|112),(?:8|56|112),(?:8|56|112)$/.test(k)&&Number(k.slice(4).split(',')[side])===N;
};
const protectedUniforms=new Set(['projectionMatrix','viewMatrix','modelViewMatrix','modelMatrix','cameraPosition','isOrthographic','logDepthBufFC',SOUTH21.gain]);
const materialState=(m:T.ShaderMaterial)=>[
 m.fragmentShader,m.defines,...Object.entries(m.defines).flat(),...Object.entries(m.extensions).flat(),m.uniforms,
 ...Object.entries(m.uniforms).flat(),m.uniformsGroups,...m.uniformsGroups,
 m.onBeforeRender,m.onBeforeCompile,m.customProgramCacheKey,m.precision,m.glslVersion,
 m.visible,m.side,m.transparent,m.colorWrite,m.depthTest,m.depthWrite,m.depthFunc,
 m.blending,m.blendEquation,m.blendSrc,m.blendDst,m.blendEquationAlpha,m.blendSrcAlpha,m.blendDstAlpha,
 m.blendAlpha,m.blendColor.r,m.blendColor.g,m.blendColor.b,m.opacity,m.alphaHash,m.alphaTest,m.alphaToCoverage,
 m.stencilWrite,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.wireframe,m.clipping,m.clippingPlanes,
 m.clipIntersection,m.clipShadows,m.forceSinglePass,m.allowOverride,m.premultipliedAlpha,m.dithering,m.toneMapped,m.vertexColors,m.fog,m.lights,
];
function materialPin(m:T.ShaderMaterial){
 if(m.constructor!==T.ShaderMaterial||m.vertexShader!==STOCK_TERRAIN_VERTEX||Object.keys(m.defines).length||m.uniformsGroups.length||
  [...protectedUniforms].some(k=>k in m.uniforms)||Object.values(m.extensions).some(Boolean)||
  !m.visible||m.transparent||m.side!==T.FrontSide||!m.colorWrite||!m.depthTest||!m.depthWrite||m.depthFunc!==T.LessEqualDepth||
  m.blending!==T.NormalBlending||m.alphaHash||m.alphaTest||m.alphaToCoverage||m.opacity!==1||m.stencilWrite||
  m.polygonOffset||m.wireframe||m.clipping||m.clippingPlanes?.length||m.lights||m.glslVersion!==null||
  m.onBeforeRender!==T.Material.prototype.onBeforeRender||m.onBeforeCompile!==T.Material.prototype.onBeforeCompile||
  m.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey)return;
 const stamp=materialState(m);let version=m.version;
 return {m,stock:()=>m.version===version&&m.vertexShader===STOCK_TERRAIN_VERTEX&&same(materialState(m),stamp),
  renew:()=>{version=m.version;}};
}
function plane(t:Tile,d:Domain,j:20|21,scene:T.Scene){
 const mesh=t.fine,z0=j===20?d.north:d.south,x=d.x+d.w/2,z=z0+d.d/2;
 if(!mesh||mesh.constructor!==T.Mesh||t.id!==(j===20?SOUTH21.donor:SOUTH21.actor)||t.i!==24||t.j!==j||
  t.x0!==d.x||t.z0!==z0||t.w!==d.w||t.d!==d.d||mesh.parent!==scene||mesh.material!==t.local||mesh.layers.mask!==1||
  !mesh.matrixAutoUpdate||!mesh.matrixWorldAutoUpdate||!mesh.frustumCulled||mesh.castShadow||mesh.receiveShadow||mesh.renderOrder!==0||
  mesh.position.x!==x||mesh.position.y!==0||mesh.position.z!==z||mesh.quaternion.x!==0||mesh.quaternion.y!==0||mesh.quaternion.z!==0||
  mesh.quaternion.w!==1||mesh.scale.x!==1||mesh.scale.y!==1||mesh.scale.z!==1||!positioned(mesh.matrixWorld,x,z)||
  mesh.userData.subdiv!==N||Object.keys(mesh.userData).length!==1)return;
 const g=mesh.geometry;
 if(!(g instanceof T.PlaneGeometry)||g.type!=='PlaneGeometry'||g.indirect!=null||g.groups.length||Object.keys(g.morphAttributes).length||
  g.drawRange.start!==0||g.drawRange.count!==Infinity||g.parameters.width!==d.w||g.parameters.height!==d.d||
  g.parameters.widthSegments!==N||g.parameters.heightSegments!==N||Object.keys(g.attributes).length!==3)return;
 const attr=(v:unknown,integer:boolean,size:number,count:number)=>
  v instanceof T.BufferAttribute&&v.array instanceof (integer?Uint16Array:Float32Array)&&v.itemSize===size&&
   v.count===count&&v.array.length===size*count&&!v.normalized&&v.gpuType===T.FloatType&&v.usage===T.StaticDrawUsage&&
   v.onUploadCallback===T.BufferAttribute.prototype.onUploadCallback?v:undefined;
 const i=attr(g.index,true,1,N*N*6),p=attr(g.attributes.position,false,3,S*S),
       u=attr(g.attributes.uv,false,2,S*S),n=attr(g.attributes.normal,false,3,S*S);
 if(!i||i.version!==0||!p||!u||!n)return;
 return {mesh,g,i,p,u,n,stamp:[mesh,g,t.seams,...[i,p,u,n].flatMap(e=>[e,e.array,e.version])]};
}
type Plane=NonNullable<ReturnType<typeof plane>>;
function authorship(t:Terrain,o:Tile,s:Plane,donor:boolean){
 // Absolute owner topology, not merely five good quads: no other EBO
 // entry may reference any adjusted north-row ID.
 for(let j=0,k=0;j<N;j++)for(let i=0;i<N;i++,k+=6){
  const a=j*S+i,b=a+S,v=s.i.array;
  if(v[k]!==a||v[k+1]!==b||v[k+2]!==a+1||v[k+3]!==b||v[k+4]!==b+1||v[k+5]!==a+1)return false;
 }
 for(const row of (donor?[N-1,N]:[0,1]))for(let q=SOUTH21.first-1;q<=SOUTH21.last+1;q++){
  const k=row*S+q,x=px(o.w,q),z=pz(o.d,row);
  const wx=x+o.x0+o.w/2,wz=z+o.z0+o.d/2,rim=donor?row===N:row===0;
  const y=t.atlasElevation(rim?o.x0+o.w*(q/N):wx,rim?o.z0+(donor?o.d:0):wz)+GROUND_LIFT;
  const [u,v]=t.uv(wx,wz);
  if(s.p.getX(k)!==x||s.p.getY(k)!==F(y)||s.p.getZ(k)!==z||s.u.getX(k)!==F(u)||s.u.getY(k)!==F(v)||
   s.n.getX(k)!==0||s.n.getY(k)!==1||s.n.getZ(k)!==6.123234262925839e-17)return false;
 }
 return true;
}

export function prepareSouth21Rim(q:Inputs):South21RimDraw|undefined{
 const {scene,renderer:r,terrain,cover}=q,d=domain(terrain),bytes=cover.bytes,gl=r.getContext();
 if(T.REVISION!=='187'||!d||!standardLandAtlasMatches(terrain,q.terrainSha,cover)||!('createVertexArray' in gl)||
  (cover.sourceDecodedSha&&cover.sourceDecodedSha!==CANOPY_FENCE.pins.coverDecoded))return;
 const north=q.tile(SOUTH21.donor),south=q.tile(SOUTH21.actor);
 if(!north||!south||north.local===south.local)return;
 const np=materialPin(north.local),sp=materialPin(south.local);
 if(!np||!sp)return;
 const size=new T.Vector2(),port=new T.Vector4();
 let phase:Source='cold',drawn=false,painting=false,caps:T.WebGLRenderer['capabilities']|undefined,rgba4=false;
 let cache:{stamp:readonly unknown[];valid:boolean}|undefined;
 const near=(c:T.PerspectiveCamera)=>{
  if(!(c instanceof T.PerspectiveCamera)||c.parent||c.layers.mask!==1||c.reversedDepth||
   c.coordinateSystem!==T.WebGLCoordinateSystem||c.view?.enabled||c.fov!==53||c.near!==.08||c.far!==350000||
   c.zoom!==1||c.filmOffset!==0||!Number.isFinite(c.aspect)||!(c.aspect>0)||
   c.scale.x!==1||c.scale.y!==1||c.scale.z!==1)return false;
  const {x,y,z}=c.position,m=c.matrixWorld.elements;
  return (x-50838.724609375)**2+(y-24)**2+(z-SOUTH21.toZ)**2<1000**2&&m[12]===x&&m[13]===y&&m[14]===z&&
   m.every(Number.isFinite)&&c.matrixWorldInverse.elements.every(Number.isFinite)&&c.projectionMatrix.elements.every(Number.isFinite);
 };
 const raster=()=>{
  if(r.getContext()!==gl||gl.isContextLost()||scene.parent||!scene.visible||!plain(scene)||scene.overrideMaterial!==null||
   r.getRenderTarget()!==null||r.xr.isPresenting||!r.autoClear||!r.autoClearColor||!r.autoClearDepth||!r.sortObjects||
   r.shadowMap.enabled||r.localClippingEnabled||r.clippingPlanes.length||r.getScissorTest()||
   !r.capabilities.logarithmicDepthBuffer||r.capabilities.reversedDepthBuffer)return false;
  const {x:w,y:h}=r.getSize(size),ratio=r.getPixelRatio();
  if(!(Number.isSafeInteger(w)&&Number.isSafeInteger(h)&&w>0&&h>0&&Number.isFinite(ratio)&&ratio>0)||
   gl.drawingBufferWidth!==Math.floor(w*ratio)||gl.drawingBufferHeight!==Math.floor(h*ratio))return false;
  r.getViewport(port);if(port.x||port.y||port.z!==w||port.w!==h)return false;
  r.getCurrentViewport(port);return port.x===0&&port.y===0&&port.z===Math.round(w*ratio)&&port.w===Math.round(h*ratio);
 };
 const resident=()=>q.tile(SOUTH21.donor)===north&&q.tile(SOUTH21.actor)===south&&north.local===np.m&&south.local===sp.m&&
  layout(north,2)&&layout(south,0)&&!q.grade(north.id)&&!q.grade(south.id)&&bytes===cover.bytes&&positioned(scene.matrixWorld);
 const begin:South21RimDraw['begin']=camera=>{
  if(painting)return;drawn=false;
  if(gl.isContextLost()){caps=undefined;cache=undefined;return;}
  if(phase==='stock'||!near(camera)||!raster()||!resident()||!np.stock()||!sp.stock())return;
  const epoch=r.capabilities;
  if(caps!==epoch){
   caps=epoch;cache=undefined;
   const a=gl.getContextAttributes();
   rgba4=a?.stencil===false&&regularNorthRimSampleProfile(a,()=>gl.getParameter(gl.SAMPLES))==='rgba4'&&
    gl.getParameter(gl.ALPHA_BITS)===8&&gl.getParameter(gl.DEPTH_BITS)===24;
  }
  if(!rgba4)return;
  if(phase==='cold'){
   phase='checking';const buffer=bytes.buffer;
   void verifyDecodedCover(cover).then(sha=>{
    phase=sha===CANOPY_FENCE.pins.coverDecoded&&bytes===cover.bytes&&bytes.buffer===buffer&&south21DryTaps(terrain,cover)?'verified':'stock';
   },()=>{phase='stock';});
  }
  if(phase!=='verified')return;
  scene.updateWorldMatrix(false,false);north.fine!.updateWorldMatrix(false,false);south.fine!.updateWorldMatrix(false,false);
  const a=plane(north,d,20,scene),b=plane(south,d,21,scene);
  if(!a||!b||!plain(a.mesh)||!plain(b.mesh))return;
  const stamp=[...a.stamp,...b.stamp],frame=r.info.render.frame+1;
  if(!Number.isSafeInteger(frame))return;
  if(!cache||!same(stamp,cache.stamp)){
   let valid=authorship(terrain,north,a,true)&&authorship(terrain,south,b,false);
   for(let i=SOUTH21.first-1;valid&&i<=SOUTH21.last+1;i++){
    const k=N*S+i;
    valid=a.p.getX(k)===b.p.getX(i)&&a.p.getY(k)===b.p.getY(i)&&a.u.getX(k)===b.u.getX(i)&&a.u.getY(k)===b.u.getY(i)&&
     F(F(a.mesh.position.z)+a.p.getZ(k))===SOUTH21.toZ&&F(F(b.mesh.position.z)+b.p.getZ(i))===SOUTH21.fromZ;
   }
   cache={stamp,valid};
  }
  if(!cache.valid)return;
  const m=sp.m,dict=m.uniforms,gain={value:0};
  let linked:number|undefined,upload=false,disposed=false,closed=false,finished=false;
  const dead=()=>{disposed=true;cache=undefined;};
  const neutralize=()=>{
   gain.value=0;if(linked===undefined)return;
   const ours=dict[SOUTH21.gain]===gain;
   if(ours)delete dict[SOUTH21.gain];
   if(m.vertexShader===SOUTH21_VERTEX){
    const unchanged=m.version===linked&&m.uniforms===dict&&ours;
    m.vertexShader=STOCK_TERRAIN_VERTEX;m.needsUpdate=true;
    if(unchanged){sp.renew();m.uniformsNeedUpdate=upload;}
   }
   linked=undefined;
  };
  const current=(renderer:T.WebGLRenderer,sc:T.Scene,c:T.Camera,g:T.BufferGeometry,mat:T.Material,group:T.Group)=>
   !closed&&!disposed&&painting&&renderer===r&&sc===scene&&c===camera&&g===b.g&&mat===m&&group==null&&
   r.info.render.frame===frame&&r.capabilities===epoch&&near(camera)&&raster()&&resident()&&plain(a.mesh)&&
   b.mesh.onBeforeRender===before&&b.mesh.onAfterRender===after;
  const before:T.Object3D['onBeforeRender']=(renderer,sc,c,g,mat,group)=>{
   neutralize();if(finished||!current(renderer,sc,c,g,mat,group)||!np.stock()||!sp.stock())return;
   const an=plane(north,d,20,scene),bs=plane(south,d,21,scene);
   if(!an||!bs||!same(an.stamp,a.stamp)||!same(bs.stamp,b.stamp))return;
   let donor=0,actor=0;
   for(const item of r.renderLists.get(scene,0).opaque){
    if(item.object===a.mesh){if(item.geometry!==a.g||item.material!==np.m||item.group!=null)return;donor++;}
    if(item.object===b.mesh){if(item.geometry!==b.g||item.material!==m||item.group!=null)return;actor++;}
   }
   if(donor!==1||actor!==1)return;
   upload=m.uniformsNeedUpdate;dict[SOUTH21.gain]=gain;gain.value=1;
   m.vertexShader=SOUTH21_VERTEX;m.needsUpdate=true;linked=m.version;m.uniformsNeedUpdate=true;
  };
  const after:T.Object3D['onAfterRender']=(renderer,sc,c,g,mat,group)=>{
   if(linked!==undefined&&m.version===linked&&m.uniforms===dict&&dict[SOUTH21.gain]===gain&&gain.value===1&&
    m.vertexShader===SOUTH21_VERTEX&&current(renderer,sc,c,g,mat,group)){drawn=true;finished=true;}
   neutralize();
  };
  const close=()=>{
   if(closed)return;closed=true;
   try{neutralize();}finally{
    painting=false;a.g.removeEventListener('dispose',dead);b.g.removeEventListener('dispose',dead);
    if(b.mesh.onBeforeRender===before)b.mesh.onBeforeRender=stockHooks[0];
    if(b.mesh.onAfterRender===after)b.mesh.onAfterRender=stockHooks[1];
   }
  };
  painting=true;
  try{
   a.g.addEventListener('dispose',dead);b.g.addEventListener('dispose',dead);
   b.mesh.onBeforeRender=before;b.mesh.onAfterRender=after;
   return close;
  }catch{close();return;}
 };
 return {begin,diagnostics:()=>({source:phase,drawnFine:drawn?[SOUTH21.actor]:[]})};
}
