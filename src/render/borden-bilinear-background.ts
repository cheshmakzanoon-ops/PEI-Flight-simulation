import type {BordenOpaqueScope} from './borden-opaque-scope.ts';
import {LateColourScope} from './late-colour-scope.ts';
import {projectBordenCentres,signedStockCellTriangles,signedCurtainTriangles} from './borden-motion-centres.ts';
import {PointFillPool} from './point-fill-pool.ts';
import type {BordenCanopyResident,BordenPropResident} from './borden-canopy-resident.ts';
import * as T from 'three';
import {authorizeBordenCoast,bordenCoastAirUniform,BORDEN_CURTAIN_NAME,hashBordenCoastShader,pinBordenCoastMaterial,
 type BordenAtmosphericGain,type BordenCoastInputs,type BordenCoastReceipt} from './borden-bilinear-authority.ts';

/** A signed, far-depth background fill, not a shore remesh.
 * Nothing writes to stock depth/material state. The usual per-fragment
 * frontier material still receives true world XYZ and its original lighting.
 * This experiment deliberately does not support offscreen targets, non-stock
 * depth/sample profiles, ordinary forward rendering after unusual exceptions,
 * XR, array views or an arbitrary external caller injecting a depth clear.
 */
export type BordenBackgroundInputs=BordenCoastInputs&{
 /** Construction-born stock sky; the only unoccluding color draw allowed
  * to potentially overlap the tiny geometry in the opaque phase. */
 readonly stockSky:T.Mesh;
 readonly canopy:BordenCanopyResident;readonly prop:BordenPropResident;readonly opaque:BordenOpaqueScope;
};
export type BordenBackgroundLease={
 readonly mesh:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;
 readonly diagnostics:Readonly<BordenCoastReceipt>;
 begin(camera:T.PerspectiveCamera):(()=>void)|undefined;
 dispose():void;
};
const r187='187',sort=1_000_000_000;
const AUTH='peiBordenSkyFill',H='#include <logdepthbuf_fragment>',TONE='#include <colorspace_fragment>';
const SKY={
 vertex:'f65c08a3dd783f22adb0a2facbe33fd6ea52aaf36a6d2b8422b0b9fe0c83d36a',
 literal:'53d93c6dab57a30eb3f4b5c5f43091713af41eaab73ce05d009cf82e6643b293',
 // Existing stock aerial wrapper around the literal sky.
 aerial:'8135647a5a8cc183683f2a217b78bb0419fe2a4ada60967035655ddcf9e06750',
} as const;
const aKey=(s:string,key:string)=>s.split(key).length===2;
const eq=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] as const;
const identity=(o:T.Object3D)=>eq(o.matrixWorld.elements,I)&&o.position.x===0&&o.position.y===0&&o.position.z===0&&
 !o.quaternion.x&&!o.quaternion.y&&!o.quaternion.z&&o.quaternion.w===1&&o.scale.x===1&&o.scale.y===1&&o.scale.z===1;
const bound=(a:T.BufferAttribute)=>[a,a.array,a.version,a.itemSize,a.count,a.normalized];
const end=(s:string)=>s.trimEnd().endsWith(TONE+'\n}');
function material(stock:T.ShaderMaterial,gain:{value:number}){
 if(stock.uniformsGroups.length!==0||!aKey(stock.fragmentShader,H)||!aKey(stock.fragmentShader,TONE)||
    !end(stock.fragmentShader)||stock.fragmentShader.includes('gl_FragDepth')||AUTH in stock.uniforms||
    stock.vertexShader.includes(AUTH)||stock.fragmentShader.includes(AUTH))return;
 // ShaderMaterial.clone() would clone uniform Textures and bump their
 // shared Source.version. Copy a read-only surrogate instead, never
 // temporarily mutating stock and never cloning source textures.
 const bridge=Object.create(stock) as T.ShaderMaterial;
 Object.defineProperty(bridge,'uniforms',{value:Object.freeze({})});
 const m=new T.ShaderMaterial().copy(bridge);
 m.uniforms={...stock.uniforms,[AUTH]:gain};
 m.fragmentShader='uniform highp float '+AUTH+';\n'+stock.fragmentShader.replace(H,
  'if('+AUTH+'!=1.)discard;\n '+H)
  .replace(TONE,TONE+'\n gl_FragDepth=1.0;');
 m.depthFunc=T.EqualDepth;m.depthWrite=false;m.colorWrite=true;m.depthTest=true;m.allowOverride=false;
 m.name=BORDEN_CURTAIN_NAME+' · depth-clear only';
 return m;
}
function skyStock(visibility:T.Mesh,s:T.Scene,air?:BordenAtmosphericGain){
 const m=visibility.material;
 return visibility.parent===s&&visibility.visible&&visibility.renderOrder===-10&&visibility.layers.mask===1&&
  !visibility.frustumCulled&&m instanceof T.ShaderMaterial&&m.visible&&m.depthTest===false&&m.depthWrite===false&&m.colorWrite&&
  !m.transparent&&!m.stencilWrite&&visibility.geometry.getAttribute('position')?.count===4&&visibility.geometry.index?.count===6&&
  m.uniforms.skyDiagnostic&&bordenCoastAirUniform(m,air)?m:undefined;
}
/** Only invoked around a single actual outer renderer.render. No own compile
 * or offscreen draws; object and material hooks neutralize if custody drifted.
 */
export async function prepareBordenBackgroundCoast(inputs:BordenBackgroundInputs):Promise<BordenBackgroundLease|undefined>{
 try{
  const {scene,renderer,stockShore,ocean,stockSky,stockAtmosphericGain:air}=inputs,
   gl=renderer.getContext() as WebGL2RenderingContext;
  if(T.REVISION!==r187||!('createVertexArray' in gl))return;
  const size=new T.Vector2(),port=new T.Vector4();
  function normal(){
   const c=gl.getContextAttributes();if(!c||!c.alpha||!c.depth||!c.antialias||c.stencil||!c.premultipliedAlpha)return false;
   if(renderer.getContext()!==gl||gl.isContextLost()||!renderer.capabilities.logarithmicDepthBuffer||
      renderer.capabilities.reversedDepthBuffer||renderer.capabilities.precision!=='highp'||scene.overrideMaterial||!renderer.autoClear||!renderer.autoClearColor||
      !renderer.autoClearDepth||!renderer.sortObjects||renderer.xr.isPresenting||renderer.localClippingEnabled||
      renderer.clippingPlanes.length||renderer.getRenderTarget()!==null||renderer.getScissorTest()||
      gl.isEnabled(gl.STENCIL_TEST)||gl.isEnabled(gl.SCISSOR_TEST)||gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)!==null||
      gl.getParameter(gl.DEPTH_CLEAR_VALUE)!==1||gl.getParameter(gl.DEPTH_BITS)!==24||gl.getParameter(gl.SAMPLES)!==4)return false;
   renderer.getDrawingBufferSize(size);renderer.getCurrentViewport(port);
   return port.x===0&&port.y===0&&port.z===size.x&&port.w===size.y&&size.x>0&&size.y>0;
  }
  if(!normal())return;
  const sky=skyStock(stockSky,scene,air);if(!sky)return;
  const env=scene.environment,background=scene.background,skyGeo=stockSky.geometry,skyPin=pinBordenCoastMaterial(sky);
  const steady=()=>normal()&&inputs.stockAtmosphericGain===air&&scene.environment===env&&scene.background===background&&
   stockSky.geometry===skyGeo&&skyStock(stockSky,scene,air)===sky&&eq(pinBordenCoastMaterial(sky),skyPin);
  const skyHashes=await Promise.all([hashBordenCoastShader(sky.vertexShader),hashBordenCoastShader(sky.fragmentShader)]);
  if(!eq(skyHashes,[SKY.vertex,air===undefined?SKY.literal:SKY.aerial])||!steady())return;
  const checked=await authorizeBordenCoast(inputs,steady);if(!checked)return;
  const proof:NonNullable<typeof checked>=checked;
  const ground=signedStockCellTriangles(proof.ground);
  const curtain=signedCurtainTriangles(proof.geometry);
  const {geometry,diag,material:stock}=proof,scalar={value:0},draft=material(stock,scalar);
  if(!draft){geometry.dispose();return;}
  const variant:T.ShaderMaterial=draft;
  const pool=new PointFillPool(variant);
  const parent=new T.Group(),mesh=new T.Mesh(geometry,variant);
  parent.name='Borden signed coast background guard';
  parent.renderOrder=sort;mesh.renderOrder=sort;
  parent.add(pool.mesh,mesh);mesh.name=BORDEN_CURTAIN_NAME;mesh.castShadow=false;mesh.receiveShadow=false;mesh.visible=false;
  const position=geometry.getAttribute('position') as T.BufferAttribute,u=geometry.getAttribute('uv') as T.BufferAttribute;
  const stamp=[...bound(position),...bound(u)],vPin=pinBordenCoastMaterial(variant);
  const late=new LateColourScope();
  const frustum=new T.Frustum(),proj=new T.Matrix4(),unionPixel=new T.Box2();
  const out=new T.Vector3();
  let dead=false;
  type Frame={camera:T.PerspectiveCamera;renderFrame:number;order:number;view:readonly number[];project:readonly number[]; armed:boolean;pointExpected:boolean;pointOk:boolean;pointDone:boolean;later?:boolean};
  let draw:Frame|undefined;
  function value(on:boolean){
   scalar.value=on?1:0;
   variant.uniformsNeedUpdate=true;
   // r187 submits count=0; past-buffer start yields a negative intersection
   // and returns before the GL draw when this frame stays stock.
   geometry.setDrawRange(on?0:position.count+1,on?position.count:0);
  }
  function reset(){draw=undefined;pool.clear();mesh.visible=false;parent.renderOrder=sort;mesh.renderOrder=sort;value(false);}
  function own(){
   return !dead&&parent.parent===scene&&mesh.parent===parent&&parent.visible&&mesh.geometry===geometry&&mesh.material===variant&&
    parent.renderOrder===(draw?.order??sort)&&mesh.renderOrder===(draw?.order??sort)&&identity(parent)&&identity(mesh)&&
    parent.layers.mask===1&&mesh.layers.mask===1&&mesh.matrixAutoUpdate&&mesh.matrixWorldAutoUpdate&&mesh.frustumCulled&&
    !mesh.castShadow&&!mesh.receiveShadow&&!variant.allowOverride&&variant.depthFunc===T.EqualDepth&&!variant.depthWrite&&
    variant.uniforms[AUTH]===scalar&&eq(pinBordenCoastMaterial(variant),vPin)&&
    !geometry.index&&!geometry.groups.length&&geometry.indirect===null&&!Object.keys(geometry.morphAttributes).length&&
    geometry.getAttribute('position')===position&&geometry.getAttribute('uv')===u&&eq([...bound(position),...bound(u)],stamp);
  }
  function inView(camera:T.PerspectiveCamera){
   if(camera.layers.mask!==1||!camera.isPerspectiveCamera||camera.reversedDepth||!camera.matrixWorldAutoUpdate)return false;
   const [a,b,c,d]=diag.box,dx=Math.max(a-camera.position.x,camera.position.x-c,0),dz=Math.max(b-camera.position.z,camera.position.z-d,0);
   if(dx*dx+dz*dz>7000**2)return false;
   proj.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
   frustum.setFromProjectionMatrix(proj,T.WebGLCoordinateSystem);
   return [mesh,stockShore,ocean,proof.ground].every(o=>o.frustumCulled&&frustum.intersectsObject(o));
  }
  /** Some opaque objects (HUD or depthless overlays) need protection beyond
   * equal clear depth. Unknown depthless geometry may coexist only when its
   * conservative perspective-space bounds cannot touch our visible fill.
   */
  function projected(b:T.Box3,c:T.PerspectiveCamera,rect:T.Box2){
   rect.makeEmpty();
   for(let i=0;i<8;i++){
    out.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z);
    out.applyMatrix4(c.matrixWorldInverse);
    // Mixed/near-behind is unknown, not a projected disjoint cert.
    if(out.z>=-c.near||!Number.isFinite(out.z))return false;
    out.applyMatrix4(c.projectionMatrix);
    if(!Number.isFinite(out.x)||!Number.isFinite(out.y))return false;
    rect.min.x=Math.min(rect.min.x,out.x);rect.min.y=Math.min(rect.min.y,out.y);
    rect.max.x=Math.max(rect.max.x,out.x);rect.max.y=Math.max(rect.max.y,out.y);
   }
   return !rect.isEmpty();
  }
  function opensLate(camera:T.PerspectiveCamera,order:number,pointExpected:boolean){
   const raw=renderer.renderLists.get(scene,0),list=raw.opaque,tail=list.at(-1);
   if(list.length>1024||!tail||tail.object!==mesh||tail.geometry!==geometry||tail.material!==variant||tail.group!==null||
      tail.groupOrder!==order||tail.renderOrder!==order||!geometry.boundingBox||
      raw.transmissive.some(q=>q.object===mesh)||raw.transparent.some(q=>q.object===mesh))return false;
   if(!projected(geometry.boundingBox,camera,unionPixel))return false;
   // Expansion is only for the veto of unsafe co-rendered depthless objects:
   // never alters the actual effect, its bounds or image masks.
   unionPixel.min.x-=4/size.x;unionPixel.max.x+=4/size.x;
   unionPixel.min.y-=4/size.y;unionPixel.max.y+=4/size.y;
   let land=0,water=0,shore=0,skies=0,pointOwners=0,earlier=true;
   for(let i=0;i<list.length-1;i++){
    const {object,material:m,geometry:g}=list[i];
    if(object===proof.ground&&m===inputs.ground()?.local)land++;
    if(object===ocean&&m===proof.waterMaterial)water++;
    if(object===stockShore&&m===stock)shore++;
    if(object===stockSky&&m===sky){skies++;continue;}
    if(object===mesh)return false;
    if(object===pool.mesh){
     if(!pointExpected||i!==list.length-2||list[i].group!==null||!g||!pool.owns(m,g)||
        object.parent!==mesh.parent||!identity(object)||object.layers.mask!==1||
        list[i].groupOrder!==order||list[i].renderOrder!==order-1)return false;
     pointOwners++;continue;
    }
    if(!inputs.opaque.tracks(list[i],camera,unionPixel,ocean as T.Mesh<T.BufferGeometry,T.Material>,inputs.canopy))earlier=false;
   }
   return earlier&&land===1&&water===1&&shore===1&&skies===1&&pointOwners===Number(pointExpected);
  }
  function laterColors(frame:Frame){
   if(frame.later!==undefined)return frame.later;
   const list=renderer.renderLists.get(scene,0),canvas=renderer.domElement;
   const future=late.tracks([...list.transmissive,...list.transparent],frame.camera,unionPixel,canvas.width,canvas.height,inputs.canopy,inputs.prop);
   return frame.later=future.ok;
  }
  pool.mesh.onBeforeRender=(r,s,c,g,m,group)=>{
   const f=draw,point=pool.mesh;
   let guard=false;
   try{guard=!!f&&f.pointExpected&&!f.pointOk&&r===renderer&&s===scene&&c===f.camera&&g===point.geometry&&m===point.material&&group===null&&
    renderer.info.render.frame===f.renderFrame&&own()&&proof.still()&&inView(f.camera)&&
    eq(c.matrixWorldInverse.elements,f.view)&&eq(c.projectionMatrix.elements,f.project)&&opensLate(f.camera,f.order,f.pointExpected)&&laterColors(f);
   }catch{/* Fall back to stock without interposing an error in its render. */}
   pool.admit(guard);if(!guard)pool.vetoDraw();if(f)f.pointOk=guard;
  };
  pool.mesh.onAfterRender=(r,s,c,g,m,group)=>{
   const f=draw;
   if(f?.pointOk&&r===renderer&&s===scene&&c===f.camera&&g===pool.mesh.geometry&&m===pool.mesh.material&&
      group===null&&renderer.info.render.frame===f.renderFrame)f.pointDone=true;
   pool.admit(false);
  };
  function sameLastPair(f:Frame){
   const list=renderer.renderLists.get(scene,0).opaque,penultimate=list.at(-2),last=list.at(-1);
   return f.pointOk&&f.pointDone&&!!penultimate&&!!last&&penultimate.object===pool.mesh&&!!penultimate.geometry&&
    pool.owns(penultimate.material,penultimate.geometry)&&last.object===mesh&&last.geometry===geometry&&last.material===variant&&
    penultimate.groupOrder===f.order&&last.groupOrder===f.order&&penultimate.renderOrder===f.order-1&&last.renderOrder===f.order;
  }
  mesh.onBeforeRender=(r,s,c,g,m,group)=>{
   const f=draw;let yes=false;
   try{
    yes=!!f&&!f.armed&&m===variant&&r===renderer&&s===scene&&c===f.camera&&g===geometry&&group===null&&
     renderer.info.render.frame===f.renderFrame&&mesh.visible&&own()&&proof.still()&&inView(f.camera)&&
     eq(c.matrixWorldInverse.elements,f.view)&&eq(c.projectionMatrix.elements,f.project)&&
     (f.pointExpected?sameLastPair(f):opensLate(f.camera,f.order,false)&&laterColors(f));
   }catch{/** Any unknown pass skips coverage. */}
   if(yes)f!.armed=true;
   value(yes);
  };
  // Continues to protect even if rendering a depth-only shader run outside
  // the allowed callbacks. WebGLRenderer reads this final update before setProgram.
  variant.onBeforeRender=()=>{variant.uniformsNeedUpdate=true;};
  // Respect exact source pin after assigning our one construction-owned hook.
  const updated=pinBordenCoastMaterial(variant);vPin.splice(0,vPin.length,...updated);
  mesh.onAfterRender=()=>{value(false);};
  reset();scene.add(parent);
  return {mesh,diagnostics:diag,
   begin(camera){
    if(draw){reset();return;}
    reset();
    try{
     if(!own()||!proof.still())return;
     camera.updateWorldMatrix(true,false);
     if(!inView(camera))return;
     const renderFrame=renderer.info.render.frame+1,order=sort+renderFrame;
     if(!Number.isSafeInteger(order)||renderFrame<=0)return;
     // Number copied into the actual list item by Three. A stale depth0
     // list can contain the same mesh/program but cannot carry this frame's stamp.
     const q:Frame={camera,renderFrame,order,view:[...camera.matrixWorldInverse.elements],
      project:[...camera.projectionMatrix.elements],armed:false,pointExpected:false,pointOk:false,pointDone:false};
     draw=q;parent.renderOrder=order;mesh.renderOrder=order;mesh.visible=true;
     if(ground&&curtain){
      const c=renderer.domElement;
      const ref=projectBordenCentres(camera,curtain,ground,c.width,c.height);
      if(!ref){reset();return;}
      if(ref.centres.length){
       if(!pool.stage(c.width,c.height,ref.centres)){reset();return;}
       q.pointExpected=true;pool.mesh.renderOrder=order-1;pool.mesh.layers.mask=mesh.layers.mask;
      }
     }else{reset();return;}
     return ()=>{if(draw===q)reset();};
   }catch{reset();return;}
   },
   dispose(){if(dead)return;reset();dead=true;
    if(parent.parent===scene)scene.remove(parent);
    geometry.dispose();pool.dispose();variant.dispose();
   },
  };
 }catch{return;}
}
