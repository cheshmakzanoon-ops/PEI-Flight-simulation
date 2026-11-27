/** Scoped Standard render comparison. No auto mounting, camera, render, network, or terrain edits. */
import {BufferAttribute,ShaderMaterial,Mesh,DoubleSide,LessEqualDepth,NormalBlending,REVISION,
 type BufferGeometry,type Object3D,type Scene} from 'three';
import {authenticatedOwnerCohort} from '../authenticated-owner-cohort.ts';
import {verifyDecodedCover} from '../../sim/cover-proof.ts';
import type {Terrain}from'../../sim/terrain.ts';
import type {Cover}from'../../sim/cover.ts';
import {CANOPY_FENCE}from'../canopy-fence.generated.ts';
import {OLEARY,OLEARY_INDUSTRIAL,olearyAtlasOwner,olearySiteAllows,olearySha,olearyDrawCenter,olearyGradeCenter,olearyNativeGrade,
 type OlearyNativeSurface}from'./authority.ts';
import {olearyIndustrialSeat,olearyIndustrialDry}from'./industrial-seat.ts';
import type {OlearyLink}from'./program-gate.ts';
import {buildDetachedIndustrial192}from'./industrial-envelope.ts';
import {FORM}from'./q192-form.generated.ts';
import {PREVIEW}from'./industrial-standard-custody.generated.ts';

type Tile=Parameters<typeof olearyAtlasOwner>[1];
type Input={
 scene:Scene;owner:Mesh;atlasHash:string;tile:Tile;wire:ArrayBuffer;rows:number;row192:unknown;
 terrain:Terrain;terrainSha:string;cover:Cover;
 /** Actual exact Standard owner residence; never legacy / QA or a placement override. */
 permit:()=>boolean;
 ground:()=>OlearyNativeSurface|undefined;
 /** Native callers must pass the real two-program detached WebGL link witness. */
 link:OlearyLink;
 signal:AbortSignal;
};
const [start,end]=PREVIEW.target;
const n=PREVIEW.vertices, enc=new TextEncoder();
const isByte=(v:BufferAttribute)=>(v.array.buffer instanceof ArrayBuffer)&&
 (v.array instanceof Uint8Array||v.array instanceof Float32Array);
const bytes=(a:BufferAttribute)=>new Uint8Array(a.array.buffer as ArrayBuffer,a.array.byteOffset,a.array.byteLength);
const layout=(g:BufferGeometry)=>
 !g.groups.length&&g.drawRange.start===0&&g.drawRange.count===Infinity&&!Object.keys(g.morphAttributes).length;
const sameSpan=(span:unknown)=>Array.isArray(span)&&span.length===2&&span[0]===start&&span[1]===end;
const identity=(object:Object3D,origin:readonly[number,number,number])=>
 object.matrixAutoUpdate&&object.matrixWorldAutoUpdate&&object.layers.mask===1&&object.renderOrder===0&&
 object.position.x===origin[0]&&object.position.y===origin[1]&&object.position.z===origin[2]&&
 object.quaternion.x===0&&object.quaternion.y===0&&object.quaternion.z===0&&object.quaternion.w===1&&
 object.scale.x===1&&object.scale.y===1&&object.scale.z===1;
const phaseSafe=(f:()=>boolean)=>{try{return f()===true;}catch{return false;}};
type Model=ReturnType<typeof buildDetachedIndustrial192>;

/** A valid mask differs from the fully composed original draw by exactly 19
 * triangles. Callers prove source, timing, actual GL state and pixel effects
 * separately. Index comparisons are intentionally strict in this QA helper. */
export async function prepareQ192StandardComparison(o:Input){
 let model:Model|undefined;
 const {owner,scene,ground,terrain,cover,signal}=o, stock=owner.geometry, stockMaterial=owner.material;
 const span=owner.userData.olearyIndustrialTriangles;
 try {
  if(REVISION!=='187'||!olearyAtlasOwner(o.atlasHash,o.tile)||o.rows!==OLEARY.rows||o.wire.byteLength!==OLEARY.bytes||
   !olearySiteAllows(terrain,o.terrainSha,cover)||!olearyIndustrialDry(terrain,cover)||
   !sameSpan(span)||owner.userData.olearyAccessRoofTone!==true||!(stockMaterial instanceof ShaderMaterial))return;
  const vertex=stockMaterial.vertexShader,frag=stockMaterial.fragmentShader,materialVersion=stockMaterial.version,
   uniforms=stockMaterial.uniforms,defines=stockMaterial.defines,cacheKey=stockMaterial.customProgramCacheKey,
   compile=stockMaterial.onBeforeCompile,before=owner.onBeforeRender,after=owner.onAfterRender,
   worldBound=stock.boundingSphere,box=stock.boundingBox;
  if(compile!==ShaderMaterial.prototype.onBeforeCompile||cacheKey!==ShaderMaterial.prototype.customProgramCacheKey)return;
  const attrs=Object.entries(PREVIEW.stock).map(([name,[size,hash]])=>{
   const a=stock.getAttribute(name);
   if(!(a instanceof BufferAttribute)||!isByte(a)||!(name==='facadeStyle'?a.array instanceof Uint8Array:a.array instanceof Float32Array)||
      a.count!==n||a.array.length!==n*size||a.itemSize!==size||a.normalized)throw Error('q192 lost original Standard input');
   return {name,size,hash,a,buffer:a.array,version:a.version,usage:a.usage,gpuType:a.gpuType};
  });
  const exactAttributes=(g:BufferGeometry)=>layout(g)&&g.boundingSphere===worldBound&&g.boundingBox===box&&
   Object.keys(g.attributes).length===attrs.length&&attrs.every(({name,a,version,size,buffer,usage,gpuType})=>
    g.getAttribute(name)===a&&a.itemSize===size&&a.count===n&&!a.normalized&&a.array===buffer&&a.version===version&&
    a.usage===usage&&a.gpuType===gpuType&&isByte(a));
  const c=olearyDrawCenter(),projectedOrigin=[c.x,0,c.z] as const;
  const base=()=>!signal.aborted&&phaseSafe(o.permit)&&owner.parent===scene&&owner.visible&&scene.visible&&!scene.overrideMaterial&&
   identity(owner,projectedOrigin)&&identity(scene,[0,0,0])&&owner.material===stockMaterial&&owner.frustumCulled&&
   owner.onBeforeRender===before&&owner.onAfterRender===after&&!owner.castShadow&&!owner.receiveShadow&&
   owner.userData.olearyAccessRoofTone===true&&owner.userData.olearyIndustrialTriangles===span&&sameSpan(span)&&
   stockMaterial.visible&&stockMaterial.vertexColors&&!stockMaterial.transparent&&stockMaterial.opacity===1&&
   stockMaterial.side===DoubleSide&&stockMaterial.depthWrite&&stockMaterial.colorWrite&&stockMaterial.depthTest&&
   stockMaterial.depthFunc===LessEqualDepth&&stockMaterial.blending===NormalBlending&&!stockMaterial.alphaToCoverage&&
   !stockMaterial.polygonOffset&&!stockMaterial.wireframe&&!stockMaterial.stencilWrite&&stockMaterial.alphaTest===0&&
   stockMaterial.version===materialVersion&&stockMaterial.uniforms===uniforms&&!Object.keys(uniforms).length&&
   stockMaterial.defines===defines&&!Object.keys(defines??{}).length&&
   stockMaterial.vertexShader===vertex&&stockMaterial.fragmentShader===frag&&stockMaterial.onBeforeCompile===compile&&
   stockMaterial.customProgramCacheKey===cacheKey&&!stock.index&&exactAttributes(stock);
  const initial=()=>base()&&owner.geometry===stock;
  if(!initial())return;
  const g=ground(),groundOwner=g?.fine,seams=g?.seams;
  if(!groundOwner||!seams||groundOwner.parent!==scene||!groundOwner.visible)return;
  const nativeGrade=await olearyNativeGrade(groundOwner,olearyGradeCenter(terrain),seams);
  if(!nativeGrade)return;
  const liveGround=()=>phaseSafe(()=>{
   const now=ground();return now?.fine===groundOwner&&now.seams===seams&&groundOwner.parent===scene&&
    groundOwner.visible&&nativeGrade()&&olearySiteAllows(terrain,o.terrainSha,cover)&&olearyIndustrialDry(terrain,cover);
  });
  const encoded=JSON.stringify(o.row192);
  if(!encoded||encoded.length>1400||!initial()||!liveGround())return;
  const [wire,row,v,f,decoded,...streams]=await Promise.all([
   olearySha(o.wire),olearySha(enc.encode(encoded)),olearySha(enc.encode(vertex)),olearySha(enc.encode(frag)),
   verifyDecodedCover(cover),...attrs.map(x=>olearySha(bytes(x.a)))
  ]);
  if(!initial()||!liveGround()||wire!==OLEARY.chunk||row!==OLEARY_INDUSTRIAL.row||
   v!==PREVIEW.shader.vertex||f!==PREVIEW.shader.fragment||decoded!==CANOPY_FENCE.pins.coverDecoded||
   streams.some((h,i)=>h!==attrs[i].hash&&!(attrs[i].name==='uv'&&h===PREVIEW.chromiumStandardUV)))return;
  const sample=olearyIndustrialSeat(groundOwner);
  if(!sample)return;
  const art=model=buildDetachedIndustrial192(sample);
  const [sx,sz]=FORM.frame.originXZ,[ux,uz]=FORM.frame.uXZ,[vx,vz]=FORM.frame.vXZ;
  // Use the same signed native facet, even if host arithmetic differs by
  // one bit. Every submitted art stream is independently byte-certified.
  const anchor=sample(sx+(-3*ux+5*vx),sz+(-3*uz+5*vz));
  const artOrigin=[sx,anchor,sz] as const;
  const exactArt=()=>art.intact()&&identity(art.group,artOrigin)&&
   art.group.children.every(x=>x.isObject3D&&x.visible);
  if(!exactArt())return;
  const parts=Object.entries(PREVIEW.historical);
  const baked=await Promise.all(parts.map(async([draw,[count,pin]],i)=>{
   const m=art.group.children[i], names=Object.keys(pin) as (keyof typeof pin)[];
   if(!(m instanceof Mesh)||m.name!=='q192 '+draw)return false;
   return (await Promise.all(names.map(async k=>{
    const p=m.geometry.getAttribute(k);
    return p instanceof BufferAttribute&&p.array instanceof Float32Array&&p.count===count&&p.itemSize===3&&
     !p.normalized&&(await olearySha(bytes(p)))===pin[k];
   }))).every(Boolean);
  }));
  if(!baked.every(Boolean)||!initial()||!liveGround()||!exactArt())return;
  const link=await o.link(art.group,signal);
  if(!link||!initial()||!liveGround()||!exactArt()||art.group.parent||!phaseSafe(link))return;
  // No geometry is exchanged at prepare time. Share the original position,
  // normal, colour, uv, roof role and facade role. The existing cohort helper
  // also avoids deleting stock VBOs when retiring an alternate.
  const mask=authenticatedOwnerCohort(owner,stock),lane=mask?.add(art.group,[start,end],{vertices:n,start,end});
  if(!mask||!lane)return;
  let closed=false,busy=false;
  const intact=()=>!closed&&initial()&&liveGround()&&exactArt()&&!art.group.parent&&phaseSafe(link);
  const matchingResidual=()=>{
   const geo=owner.geometry,index=geo.index;
   if(geo===stock||!exactAttributes(geo)||!(index instanceof BufferAttribute)||
    !(index.array instanceof Uint16Array)||index.itemSize!==1||index.count!==n-(end-start)||index.normalized||
    index.array.length!==index.count||index.version!==0)return false;
   const buf=index.array;
   for(let i=0;i<start;i++)if(buf[i]!==i)return false;
   for(let i=start;i<buf.length;i++)if(buf[i]!==i+end-start)return false;
   return true;
  };
  const retire=()=>{try{mask.dispose();}finally{art.dispose();}};
  const view={
   intact,
   /** The draw callback MUST be synchronous. This is never an automatic
    * per-frame scene hook or an instruction to bypass GL/readback gates. */
   compare<T>(enabled:boolean,draw:(alternate:boolean)=>T):T{
    if(busy)throw Error('q192 comparison cannot reenter its draw bracket');
    busy=true;
    try{
     if(!enabled||!intact())return draw(false);
     try{scene.add(art.group);lane.sync(art.group.parent===scene&&base());}
     catch{lane.sync(false);art.group.removeFromParent();return draw(false);}
     if(!lane.visible||!matchingResidual()){
      lane.sync(false);art.group.removeFromParent();return draw(false);
     }
     return draw(true);
    }finally{
     try{lane.sync(false);}
     finally{
      try{art.group.removeFromParent();}
      finally{busy=false;if(closed)retire();}
     }
    }
   },
   dispose(){if(closed)return;closed=true;if(!busy)retire();}
  };
  model=undefined;
  return view;
 }catch{return;}
 finally{model?.dispose();}
}
