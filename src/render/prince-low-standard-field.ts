/** One unchanged Prince departure, one stock terrain draw, two v2 mask ranges. */
import * as T from 'three';
import {FIELD_SHARD_BYTES,FIELD_SHARD_LAYERS,FIELD_SHARD_SIDE,FIELD_SHARD_SPAN,FieldShardSource} from '../sim/field-shards.ts';
import {FIELD_DIRECTORY_PIN,FIELD_SITE_PINS} from './province-fields.generated.ts';
import {checkedFieldOwners} from './province-field-owners.ts';
import {loadFieldRelief} from './fields-pilot.ts';
import {kingsFieldShader,mappedFieldMaterial,type FieldOwner} from './kings-field-pass.ts';
import {PRINCE_LOW_FIELD_TILE,PRINCE_LOW_FIELD_KEYS as KEYS} from './prince-low-field-scope.ts';
import {olearyLinkPrograms} from './oleary-railway/program-gate.ts';
import {cavendishOpaqueOrder} from './cavendish-water-seat.ts';
import {supportsOpaqueCoverage} from './opaque-coverage-alpha.ts';

const N=112;
const RANGES=[[28186,1257],[26755,1431]] as const;
const PACK='e66bc3ed85cbc7c301ede67346c4ecbac8c2a59dfeae4a2d5415eae8d15904d2';
const sides=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]] as const;
type Context={base:string;renderer:T.WebGLRenderer;camera:T.PerspectiveCamera;scene:T.Scene;
 owner:()=>FieldOwner|undefined;preparing:()=>boolean};
export type PrinceLowFieldView=Readonly<{ready:()=>boolean;begin:()=>undefined|(()=>void);dispose:()=>void}>;

/** Three r187 floors the buffer and rounds its full default viewport.
 * Authenticate both exact formulas rather than accepting a pixel tolerance. */
export function princeLowFieldRaster(r:T.WebGLRenderer,camera:T.PerspectiveCamera,scene:T.Scene){
 const gl=r.getContext(),buffer=new T.Vector2(),size=new T.Vector2(),logical=new T.Vector4(),physical=new T.Vector4();
 return ()=>{
  if(T.REVISION!=='187'||r.getContext()!==gl||gl.isContextLost()||r.getRenderTarget()!==null||r.getScissorTest()||
     !r.sortObjects||r.xr.isPresenting||r.shadowMap.enabled||scene.overrideMaterial||r.clippingPlanes.length||r.localClippingEnabled||
     !r.capabilities.logarithmicDepthBuffer||!camera.isPerspectiveCamera||camera.reversedDepth||camera.layers.mask!==1||
     !camera.matrixWorld.elements.every(Number.isFinite)||!camera.projectionMatrix.elements.every(Number.isFinite)||
     gl.getContextAttributes()?.depth!==true||!supportsOpaqueCoverage(gl)||gl.getParameter(gl.SAMPLES)!==4)return false;
  const s=r.getSize(size),q=r.getViewport(logical),p=r.getCurrentViewport(physical),b=r.getDrawingBufferSize(buffer),d=r.getPixelRatio();
  return Number.isFinite(d)&&d>0&&d<=1.5&&s.x>0&&s.y>0&&Number.isInteger(s.x)&&Number.isInteger(s.y)&&
   p.x===0&&p.y===0&&q.x===0&&q.y===0&&q.z===s.x&&q.w===s.y&&b.x>0&&b.y>0&&
   b.x===Math.floor(s.x*d)&&b.y===Math.floor(s.y*d)&&p.z===Math.round(s.x*d)&&p.w===Math.round(s.y*d)&&
   gl.drawingBufferWidth===b.x&&gl.drawingBufferHeight===b.y;
 };
}

function nativeMaterial(m:T.ShaderMaterial){
 return m.visible&&m.side===T.FrontSide&&m.opacity===1&&m.depthTest&&m.depthWrite&&m.depthFunc===T.LessEqualDepth&&m.colorWrite&&
  !m.transparent&&!m.alphaTest&&!m.alphaHash&&!m.alphaToCoverage&&!m.lights&&!m.stencilWrite&&!m.wireframe&&!m.polygonOffset&&
  !m.clipping&&!m.clippingPlanes?.length&&!m.uniformsGroups.length&&!m.fog&&!m.premultipliedAlpha&&m.blending===T.NormalBlending&&
  m.onBeforeCompile===T.ShaderMaterial.prototype.onBeforeCompile&&m.customProgramCacheKey===T.ShaderMaterial.prototype.customProgramCacheKey;
}
const attribute=(a:T.BufferAttribute)=>({a,array:a.array,size:a.itemSize,count:a.count,normalized:a.normalized,version:a.version});
function equalAttribute(p:ReturnType<typeof attribute>,a:unknown){
 return a instanceof T.BufferAttribute&&a===p.a&&a.array===p.array&&a.itemSize===p.size&&a.count===p.count&&
  a.normalized===p.normalized&&a.version===p.version;
}
const id=(m:T.ShaderMaterial)=>Object.getOwnPropertyDescriptor(m,'id')?.value as unknown;
function currentGpuTexture(renderer:T.WebGLRenderer,tex:T.Texture){
 const p=renderer.properties.get(tex) as {__version?:number;__webglTexture?:WebGLTexture};
 return p.__version===tex.version&&p.__webglTexture&&renderer.getContext().isTexture(p.__webglTexture)?p.__webglTexture:undefined;
}

export async function preparePrinceLowField(o:Context,signal:AbortSignal):Promise<PrinceLowFieldView|undefined>{
 const {renderer:r,camera,scene}=o;
 const raster=princeLowFieldRaster(r,camera,scene);
 const eligible=()=>!signal.aborted&&o.preparing()&&raster();
 let scan:Awaited<ReturnType<typeof loadFieldRelief>>,map:T.DataArrayTexture|undefined,authored:T.ShaderMaterial|undefined;
 let released=false,painting=false,leasedRestore:(()=>void)|undefined;
 const dispose=()=>{
  if(released)return;
  released=true;
  try{leasedRestore?.();}finally{
   try{authored?.dispose();}finally{try{map?.dispose();}finally{scan?.discard();}}
  }
 };
 let handed=false;
 try{
  if(!eligible())return;
  const q=o.owner(),m=q?.stock,mesh=q?.mesh,g=mesh?.geometry;
  if(!q||q.id!==PRINCE_LOW_FIELD_TILE||!m||!mesh||!g||!m.isShaderMaterial||!nativeMaterial(m)||
     mesh.material!==m||mesh.parent!==scene||!mesh.visible||!mesh.matrixAutoUpdate||!mesh.matrixWorldAutoUpdate||
     mesh.layers.mask!==1||g.groups.length||Object.keys(g.morphAttributes).length||g.drawRange.start!==0||g.drawRange.count!==Infinity)return;
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv'),index=g.index;
  if(!(pos instanceof T.BufferAttribute)||!(uv instanceof T.BufferAttribute)||!index||
     pos.itemSize!==3||uv.itemSize!==2||index.itemSize!==1||pos.count!==(N+1)**2||uv.count!==pos.count||index.count!==N*N*6||
     !(pos.array instanceof Float32Array)||!(uv.array instanceof Float32Array)||!(index.array instanceof Uint16Array)||
     pos.normalized||uv.normalized||index.normalized)return;
  const patch=kingsFieldShader(m.fragmentShader);if(!patch)return;
  const mark=[attribute(pos),attribute(uv),attribute(index)];
  const originalUniforms=m.uniforms,original=Object.entries(originalUniforms),x=mesh.position.clone(),
   rotation=mesh.quaternion.clone(),scale=mesh.scale.clone(),vertex=m.vertexShader,fragment=m.fragmentShader,version=m.version,
   define=JSON.stringify(m.defines??{}),extensions=JSON.stringify(m.extensions??{}),tone=m.toneMapped,language=m.glslVersion,stockId=id(m);
  const stockStill=()=>{
   const n=o.owner();
   return !released&&!painting&&!signal.aborted&&raster()&&n?.id===PRINCE_LOW_FIELD_TILE&&n.stock===m&&n.mesh===mesh&&
    mesh.geometry===g&&mesh.material===m&&mesh.parent===scene&&mesh.visible&&mesh.matrixAutoUpdate&&mesh.matrixWorldAutoUpdate&&
    mesh.layers.mask===1&&mesh.position.equals(x)&&mesh.quaternion.equals(rotation)&&mesh.scale.equals(scale)&&
    !g.groups.length&&!Object.keys(g.morphAttributes).length&&g.drawRange.start===0&&g.drawRange.count===Infinity&&
    equalAttribute(mark[0],g.getAttribute('position'))&&equalAttribute(mark[1],g.getAttribute('uv'))&&equalAttribute(mark[2],g.index)&&
    nativeMaterial(m)&&m.version===version&&m.vertexShader===vertex&&m.fragmentShader===fragment&&JSON.stringify(m.defines??{})===define&&
    JSON.stringify(m.extensions??{})===extensions&&m.toneMapped===tone&&m.glslVersion===language&&
    m.uniforms===originalUniforms&&Object.keys(m.uniforms).length===original.length&&original.every(([k,v])=>m.uniforms[k]===v);
  };
  const sourceJob=FieldShardSource.open(o.base+'fields-province/v2/',FIELD_DIRECTORY_PIN,fetch,signal);
  const scanJob=loadFieldRelief(o.base,signal).then(art=>scan=art);
  const [source,,owners]=await Promise.all([sourceJob,scanJob,checkedFieldOwners(FIELD_SITE_PINS.owners)]);
  if(!source||!scan||!owners||!eligible()||!stockStill()||source.dir.packs[12]?.size!==43801||source.dir.packs[12].hash!==PACK)return;
  const cells=KEYS.map(key=>source.dir.cells.get(key));
  if(!cells.every((b,i)=>b&&b.pack===12&&b.offset===RANGES[i][0]&&b.size===RANGES[i][1]))return;
  const data=new Uint8Array(FIELD_SHARD_BYTES*FIELD_SHARD_LAYERS),nearby=new Int32Array(FIELD_SHARD_LAYERS);
  const boxes=Array.from({length:FIELD_SHARD_LAYERS},()=>new T.Vector4(0,0,0,0));
  for(let i=0;i<cells.length;i++){
   const cell=cells[i]!,bytes=await source.load(cell,signal);
   if(!bytes||!eligible()||!stockStill())return;
   data.set(bytes,i*FIELD_SHARD_BYTES);
   nearby[i]=sides.reduce((bits,[dx,dz],n)=>source.dir.cells.has((cell.x+dx)+':'+(cell.z+dz))?bits|(1<<n):bits,0);
   boxes[i].set(cell.x*FIELD_SHARD_SPAN,cell.z*FIELD_SHARD_SPAN,0,1);
  }
  // With both selected tiles loaded, this is the existing conservative
  // neighbour arrival blend at its settled limit. No time or ranges in flight.
  const mask=map=new T.DataArrayTexture(data,FIELD_SHARD_SIDE,FIELD_SHARD_SIDE,FIELD_SHARD_LAYERS),relief=scan.scan.value;
  mask.format=T.RGFormat;mask.minFilter=mask.magFilter=T.LinearFilter;mask.generateMipmaps=false;mask.unpackAlignment=1;mask.needsUpdate=true;
  const extra={fieldShardArray:{value:mask},fieldShardAreas:{value:boxes},fieldShardNeighbors:{value:nearby},fieldShardClock:{value:1},
   provinceFurrowScan:scan.scan,provinceFieldStrength:{value:1}};
  if(Object.keys(extra).some(k=>k in m.uniforms)||typeof stockId!=='number'||!Number.isSafeInteger(stockId))return;
  const candidate=authored=mappedFieldMaterial(m,patch,extra),newId=id(candidate);
  if(typeof newId!=='number'||!Number.isSafeInteger(newId)||newId===stockId||!nativeMaterial(candidate))return;
  const aliased=cavendishOpaqueOrder(stockId,newId) as Parameters<T.WebGLRenderer['setOpaqueSort']>[0];
  const uniforms=candidate.uniforms,sourceVersions=[mask.source.version,relief.source.version],
   versions=[mask.version,relief.version],authoredVersion=candidate.version,reliefImage=relief.image;
  const neighborBits=nearby.slice(),boxSignatures=boxes.map(box=>box.clone());
  const textureInputs=()=>mask.image.data===data&&mask.image.width===FIELD_SHARD_SIDE&&mask.image.height===FIELD_SHARD_SIDE&&
   mask.image.depth===FIELD_SHARD_LAYERS&&mask.format===T.RGFormat&&mask.type===T.UnsignedByteType&&mask.colorSpace===T.NoColorSpace&&
   mask.wrapS===T.ClampToEdgeWrapping&&mask.wrapT===T.ClampToEdgeWrapping&&Number(mask.wrapR)===T.ClampToEdgeWrapping&&
   mask.minFilter===T.LinearFilter&&mask.magFilter===T.LinearFilter&&!mask.flipY&&!mask.generateMipmaps&&!mask.premultiplyAlpha&&mask.unpackAlignment===1&&
   relief.image===reliefImage&&relief.image?.width===512&&relief.image?.height===512&&!relief.flipY&&relief.generateMipmaps&&
   relief.wrapS===T.RepeatWrapping&&relief.wrapT===T.RepeatWrapping&&relief.minFilter===T.LinearMipmapLinearFilter&&relief.magFilter===T.LinearFilter&&
   relief.anisotropy===4&&relief.colorSpace===T.NoColorSpace&&!relief.premultiplyAlpha&&
   mask.source.version===sourceVersions[0]&&relief.source.version===sourceVersions[1]&&mask.version===versions[0]&&relief.version===versions[1]&&
   extra.fieldShardArray.value===mask&&extra.provinceFurrowScan.value===relief&&extra.fieldShardClock.value===1&&extra.provinceFieldStrength.value===1&&
   extra.fieldShardAreas.value===boxes&&boxes.length===boxSignatures.length&&boxes.every((box,i)=>box.equals(boxSignatures[i]))&&
   extra.fieldShardNeighbors.value===nearby&&nearby.every((n,i)=>n===neighborBits[i]);
  r.initTexture(mask);r.initTexture(relief);
  const boundMask=currentGpuTexture(r,mask),boundRelief=currentGpuTexture(r,relief);
  if(!boundMask||!boundRelief||!eligible()||!stockStill()||!textureInputs())return;
  const group=new T.Group(),test=new T.Mesh(g,candidate);group.visible=false;
  test.receiveShadow=mesh.receiveShadow;test.castShadow=mesh.castShadow;group.add(test);
  const proof=await olearyLinkPrograms(r,camera,scene,1,true,4900)(group,signal);
  group.remove(test);
  const ready=()=>{
   try{
    return !!proof?.()&&stockStill()&&textureInputs()&&currentGpuTexture(r,mask)===boundMask&&currentGpuTexture(r,relief)===boundRelief&&
     nativeMaterial(candidate)&&candidate.uniforms===uniforms&&candidate.version===authoredVersion&&candidate.vertexShader===vertex&&
     candidate.fragmentShader===patch&&JSON.stringify(candidate.defines??{})===define&&
     JSON.stringify(candidate.extensions??{})===extensions&&candidate.toneMapped===tone&&candidate.glslVersion===language&&
     Object.keys(uniforms).length===original.length+Object.keys(extra).length&&
     original.every(([k,v])=>uniforms[k]===v)&&Object.entries(extra).every(([k,v])=>uniforms[k]===v);
   }catch{return false;}
  };
  if(!eligible()||!ready())return;
  const begin=()=>{
   if(!ready())return;
   painting=true;
   const end=leasedRestore=()=>{
    if(!painting)return;
    painting=false;leasedRestore=undefined;
    try{if(mesh.material===candidate)mesh.material=m;}finally{r.setOpaqueSort(null);}
   };
   try{mesh.material=candidate;r.setOpaqueSort(aliased);return end;}
   catch{end();return;}
  };
  handed=true;
  return {ready,begin,dispose};
 }catch{return;}
 finally{if(!handed)dispose();}
}
