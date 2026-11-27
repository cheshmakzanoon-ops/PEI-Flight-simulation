import {REVISION,type Camera,type Group,type Material,type Mesh,type Object3D,type Scene,type WebGLRenderer} from 'three';

type Program={readonly program:WebGLProgram;isReady:()=>boolean};
export type OlearyProgramProof=()=>boolean;
export type OlearyLink=(group:Group,signal:AbortSignal)=>Promise<OlearyProgramProof|undefined>;
type Lamp=Object3D&{isLight?:boolean;castShadow?:boolean};
// Separate bounded budgets for the cold five-program station. A busy
// software renderer must not force the other independent actors to wait.
export const OLEARY_STATION_PREFLIGHT_MS=16000;
export const OLEARY_STATION_PROGRAM_MS=7400;
const expiredCohortPrograms=new WeakSet<AbortSignal>();
/** An elapsed cold program wait is distinct from a shader link refusal,
 * changed renderer path, or expired source/grade ownership. */
export const coldCohortProgramsExpired=(signal:AbortSignal)=>expiredCohortPrograms.has(signal);
const pause=()=>new Promise<void>(done=>setTimeout(done,16));
function lampRoster(scene:Scene,camera:Camera){
 const lamps:[Object3D,string,boolean][]=[];
 scene.traverseVisible((o:Lamp)=>{if(o.isLight&&o.layers.test(camera.layers))lamps.push([o,o.type,o.castShadow===true]);});
 return lamps;
}
/** Three r187 WebGL's public detached compile plus its narrowly pinned
 * currentProgram handle. A never-submitted program cannot discard stock. */
export function olearyLinkPrograms(r:WebGLRenderer,camera:Camera,scene:Scene,draws:1|2|3|4|5=5,recheckUnattached=false,timeoutMs?:number):OlearyLink{
 return async(group,signal)=>{
  try{
   if(REVISION!=='187'||signal.aborted||group.parent||(draws===4?group.children.length!==2:group.children.length!==draws)||typeof r.compile!=='function')return;
   const gl=r.getContext(),env=scene.environment,envMapping=env?.mapping,fog=scene.fog,layer=camera.layers.mask,
    out=r.outputColorSpace,tone=r.toneMapping,shadows=r.shadowMap.enabled,shadowType=r.shadowMap.type,clip=r.localClippingEnabled;
   const sameRenderPath=()=>!gl.isContextLost()&&r.getContext()===gl&&r.getRenderTarget()===null&&
    scene.environment===env&&env?.mapping===envMapping&&scene.fog===fog&&!scene.overrideMaterial&&
    camera.layers.mask===layer&&r.outputColorSpace===out&&r.toneMapping===tone&&
    r.shadowMap.enabled===shadows&&r.shadowMap.type===shadowType&&r.localClippingEnabled===clip&&!r.clippingPlanes.length;
   if(!sameRenderPath())return;
   const leaves=draws===4?group.children.flatMap((g,i)=>
    (g as Group).isGroup&&g.children.length===(i===0?3:1)?g.children:[]):group.children;
   if(leaves.length!==draws)return;
   const meshes=leaves as Mesh[];
   if(meshes.some(q=>!q.isMesh||Array.isArray(q.material)||!q.material.visible||q.material.transparent))return;
   const expected=new Set(meshes.map(q=>q.material as Material));
   if(expected.size!==draws)return;
   const lighting=lampRoster(scene,camera);
   const compiled=r.compile(group,camera,scene);
   if(compiled.size!==draws||Array.from(expected,m=>compiled.has(m)).some(q=>!q))return;
   const records=Array.from(expected,m=>[m,(r.properties.get(m) as {currentProgram?:Program}).currentProgram] as const);
   if(records.some(([,p])=>!p?.program||typeof p.isReady!=='function'))return;
   const samePrograms=()=>records.every(([m,p])=>(r.properties.get(m) as {currentProgram?:Program}).currentProgram===p);
   const pending=()=>!signal.aborted&&!group.parent&&sameRenderPath()&&samePrograms();
   // Five cold station materials may complete over several busy software
   // frames. Keep that artist's detached wait bounded without reducing the
   // required programs or relaxing admission for the smaller previews.
   const budget=timeoutMs??(draws===5?OLEARY_STATION_PROGRAM_MS:1600);
   const deadline=performance.now()+budget;
   const mayWait=()=>{
    if(!pending())return false;
    if(performance.now()<deadline)return true;
    if(draws===5&&recheckUnattached)expiredCohortPrograms.add(signal);
    return false;
   };
   // Use only our bounded poll; don't leave a pending Three compileAsync
   // timer after loss of the old tile's admission lease.
   const maxTicks=Math.ceil(budget/16);
   for(let ticks=0;ticks<=maxTicks;ticks++){
    if(!mayWait())return;
    if(!records.every(([,p])=>p!.isReady())){await pause();continue;}
    if(!records.every(([,p])=>gl.isProgram(p!.program)&&gl.getProgramParameter(p!.program,gl.LINK_STATUS)===true))return;
    if(!mayWait())return;
    const sameLighting=()=>{
     const current=lampRoster(scene,camera);
     return current.length===lighting.length&&!current.some((refs,i)=>refs.some((v,j)=>v!==lighting[i][j]));
    };
    if(!sameLighting())return;
    // The optional shared actors still await source/cover hashes after link.
    // Recheck the exact light roster once again before their first attachment.
    return ()=>sameRenderPath()&&samePrograms()&&(!recheckUnattached||!!group.parent||sameLighting());
   }
  }catch{/** A missing/incompatible renderer or a rejected linked program leaves stock. */}
 };
}
