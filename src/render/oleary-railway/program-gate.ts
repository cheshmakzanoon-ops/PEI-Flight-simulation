import {REVISION,type Camera,type Group,type Material,type Mesh,type Object3D,type Scene,type WebGLRenderer} from 'three';

type Program={readonly program:WebGLProgram;isReady:()=>boolean};
export type OlearyProgramProof=()=>boolean;
export type OlearyLink=(group:Group,signal:AbortSignal)=>Promise<OlearyProgramProof|undefined>;
type Lamp=Object3D&{isLight?:boolean;castShadow?:boolean};
const pause=()=>new Promise<void>(done=>setTimeout(done,16));
function lampRoster(scene:Scene,camera:Camera){
 const lamps:[Object3D,string,boolean][]=[];
 scene.traverseVisible((o:Lamp)=>{if(o.isLight&&o.layers.test(camera.layers))lamps.push([o,o.type,o.castShadow===true]);});
 return lamps;
}
/** Three r187 WebGL's public detached compile plus its narrowly pinned
 * currentProgram handle. A never-submitted program cannot discard stock. */
export function olearyLinkPrograms(r:WebGLRenderer,camera:Camera,scene:Scene):OlearyLink{
 return async(group,signal)=>{
  try{
   if(REVISION!=='187'||signal.aborted||group.parent||group.children.length!==5||typeof r.compile!=='function')return;
   const gl=r.getContext(),env=scene.environment,envMapping=env?.mapping,fog=scene.fog,layer=camera.layers.mask,
    out=r.outputColorSpace,tone=r.toneMapping,shadows=r.shadowMap.enabled,shadowType=r.shadowMap.type,clip=r.localClippingEnabled;
   const sameRenderPath=()=>!gl.isContextLost()&&r.getContext()===gl&&r.getRenderTarget()===null&&
    scene.environment===env&&env?.mapping===envMapping&&scene.fog===fog&&!scene.overrideMaterial&&
    camera.layers.mask===layer&&r.outputColorSpace===out&&r.toneMapping===tone&&
    r.shadowMap.enabled===shadows&&r.shadowMap.type===shadowType&&r.localClippingEnabled===clip&&!r.clippingPlanes.length;
   if(!sameRenderPath())return;
   const meshes=group.children as Mesh[];
   if(meshes.some(q=>!q.isMesh||Array.isArray(q.material)||!q.material.visible||q.material.transparent))return;
   const expected=new Set(meshes.map(q=>q.material as Material));
   if(expected.size!==5)return;
   const lighting=lampRoster(scene,camera);
   const compiled=r.compile(group,camera,scene);
   if(compiled.size!==5||Array.from(expected,m=>compiled.has(m)).some(q=>!q))return;
   const records=Array.from(expected,m=>[m,(r.properties.get(m) as {currentProgram?:Program}).currentProgram] as const);
   if(records.some(([,p])=>!p?.program||typeof p.isReady!=='function'))return;
   const samePrograms=()=>records.every(([m,p])=>(r.properties.get(m) as {currentProgram?:Program}).currentProgram===p);
   const pending=()=>!signal.aborted&&!group.parent&&sameRenderPath()&&samePrograms();
   const deadline=performance.now()+1600;
   // Use only our bounded poll; don't leave a pending Three compileAsync
   // timer after loss of the old tile's admission lease.
   for(let ticks=0;ticks<=100;ticks++){
    if(!pending()||performance.now()>=deadline)return;
    if(!records.every(([,p])=>p!.isReady())){await pause();continue;}
    if(!records.every(([,p])=>gl.isProgram(p!.program)&&gl.getProgramParameter(p!.program,gl.LINK_STATUS)===true))return;
    if(!pending()||performance.now()>=deadline)return;
    const current=lampRoster(scene,camera);
    if(current.length!==lighting.length||current.some((refs,i)=>refs.some((v,j)=>v!==lighting[i][j])))return;
    return ()=>sameRenderPath()&&samePrograms();
   }
  }catch{/** A missing/incompatible renderer or a rejected linked program leaves stock. */}
 };
}
