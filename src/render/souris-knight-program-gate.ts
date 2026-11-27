import {FrontSide,REVISION,type Camera,type Group,type Material,type Mesh,type Scene,type WebGLRenderer} from 'three';

type LinkedProgram={program:WebGLProgram;isReady:()=>boolean};
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,16));
/** Exact four signed exterior actors. The single front-sided lantern
 * transparency is not a permission for other material shapes. */
export function knightExteriorMaterials(art:Group){
 if(art.children.length!==4)return;
 const parts=art.children as Mesh[];
 const out:Material[]=[];
 for(const [i,part] of parts.entries()){
  const m=part.material;
  if(!part.isMesh||part.parent!==art||!part.visible||Array.isArray(m)||!m.visible||!m.colorWrite||!m.depthTest||
     m.transparent!==(i===3)||(i===3?(m.side!==FrontSide||m.depthWrite||m.forceSinglePass||m.opacity!==.36):
      (!m.depthWrite||m.opacity!==1)))return;
  out.push(m);
 }
 return new Set(out).size===4?out:undefined;
}
/** Link the actual native 3 opaque submissions and the single transparent
 * front-sided lantern, without obtaining or hiding a building owner. */
export async function linkKnightPrograms(r:WebGLRenderer,camera:Camera,scene:Scene,art:Group,signal:AbortSignal,scope:()=>boolean){
 try{
  const materials=knightExteriorMaterials(art);
  if(REVISION!=='187'||art.parent||!materials||signal.aborted||!scope())return;
  const gl=r.getContext(),env=scene.environment,fog=scene.fog,layers=camera.layers.mask,
   output=r.outputColorSpace,tone=r.toneMapping,shadows=r.shadowMap.enabled,shadowType=r.shadowMap.type;
  const samePath=()=>!gl.isContextLost()&&r.getContext()===gl&&r.getRenderTarget()===null&&
   !r.xr.isPresenting&&!scene.overrideMaterial&&!r.localClippingEnabled&&!r.clippingPlanes.length&&
   scene.environment===env&&scene.fog===fog&&camera.layers.mask===layers&&
   r.outputColorSpace===output&&r.toneMapping===tone&&r.shadowMap.enabled===shadows&&r.shadowMap.type===shadowType;
  if(!samePath())return;
  const versions=materials.map(m=>m.version),submitted=r.compile(art,camera,scene);
  if(submitted.size!==materials.length||materials.some(m=>!submitted.has(m)))return;
  const handles=materials.map(m=>(r.properties.get(m) as {currentProgram?:LinkedProgram}).currentProgram);
  if(handles.some(v=>!v?.program||typeof v.isReady!=='function'))return;
  const pinned=()=>samePath()&&(!art.parent||art.parent===scene)&&
   knightExteriorMaterials(art)?.every((m,i)=>m===materials[i]&&m.version===versions[i]&&
    (r.properties.get(m) as {currentProgram?:LinkedProgram}).currentProgram===handles[i])===true;
  const deadline=performance.now()+4700;
  for(let i=0;i<=294&&performance.now()<deadline;i++){
   if(signal.aborted||!scope()||art.parent||!pinned())return;
   if(handles.every(v=>v!.isReady())){
    if(!handles.every(v=>gl.isProgram(v!.program)&&gl.getProgramParameter(v!.program,gl.LINK_STATUS)===true)||!pinned())return;
    return ()=>!signal.aborted&&pinned();
   }
   await wait();
  }
 }catch{/** Unsupported native renderer or incomplete shader strictly keeps stock. */}
}
