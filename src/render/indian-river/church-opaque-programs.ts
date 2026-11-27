import {Mesh,MeshPhysicalMaterial,MeshStandardMaterial,REVISION,type Group,type PerspectiveCamera,type Scene,type WebGLRenderer} from 'three';
import {supportsOpaqueCoverage} from '../opaque-coverage-alpha.ts';

type Program={program:WebGLProgram;isReady:()=>boolean};
const pause=()=>new Promise<void>(done=>setTimeout(done,16));

/** Compile every original art tier in the flight's exact ordinary render
 * environment. No live building draw is hidden during this operation. */
export async function linkChurchOpaquePrograms(renderer:WebGLRenderer,camera:PerspectiveCamera,scene:Scene,group:Group,
 signal:AbortSignal,maxWait=5800):Promise<(()=>boolean)|undefined>{
 try{
  if(REVISION!=='187'||group.parent||signal.aborted||renderer.shadowMap.enabled)return;
  const gl=renderer.getContext(),env=scene.environment,envMapping=env?.mapping,fog=scene.fog,layers=camera.layers.mask,
    tone=renderer.toneMapping,output=renderer.outputColorSpace;
  const frames=()=>!signal.aborted&&!gl.isContextLost()&&renderer.getContext()===gl&&renderer.getRenderTarget()===null&&
   !renderer.xr.isPresenting&&!scene.overrideMaterial&&supportsOpaqueCoverage(gl)&&gl.getParameter(gl.SAMPLES)===4&&
   !renderer.shadowMap.enabled&&!renderer.localClippingEnabled&&!renderer.clippingPlanes.length&&
   scene.environment===env&&env?.mapping===envMapping&&scene.fog===fog&&camera.layers.mask===layers&&
   renderer.toneMapping===tone&&renderer.outputColorSpace===output;
  if(!frames())return;
  const mats=new Set<MeshStandardMaterial>();
  const leaves:{node:Mesh;material:MeshStandardMaterial;version:number}[]=[];
  const opaque=(m:MeshStandardMaterial)=>m.visible&&!m.transparent&&!m.alphaToCoverage&&!m.alphaTest&&m.opacity===1&&
   m.depthWrite&&m.depthTest&&m.colorWrite&&!m.wireframe&&(!(m instanceof MeshPhysicalMaterial)||m.transmission===0);
  group.traverse(o=>{
   if(!(o instanceof Mesh))return;
   const m=o.material;
   if(!(m instanceof MeshStandardMaterial)||!opaque(m))throw Error('Unexpected church paint layer');
   mats.add(m);leaves.push({node:o,material:m,version:m.version});
  });
  if(leaves.length!==27||mats.size!==14)return;
  const compiled=renderer.compile(group,camera,scene);
  if(compiled.size!==mats.size||!Array.from(mats,m=>compiled.has(m)).every(Boolean))return;
  const records=Array.from(mats,m=>({m,p:(renderer.properties.get(m) as {currentProgram?:Program}).currentProgram}));
  if(records.some(({p})=>!p?.program||typeof p.isReady!=='function'))return;
  const key=()=>records.every(({m,p})=>(renderer.properties.get(m) as {currentProgram?:Program}).currentProgram===p);
  const lamps=()=>{
   const out:unknown[][]=[];
   scene.traverseVisible(o=>{
    if('isLight' in o&&o.isLight===true&&o.layers.test(camera.layers))out.push([o,o.type,o.castShadow]);
   });
   return out;
  };
  const expected=lamps();
  const checkedLighting=()=>{
   const now=lamps();
   return now.length===expected.length&&now.every((t,i)=>t.every((v,j)=>v===expected[i][j]));
  };
  const proof=()=>frames()&&key()&&checkedLighting()&&leaves.every(({node,material,version})=>
    node.material===material&&material.version===version&&opaque(material));
  const deadline=performance.now()+maxWait;
  while(!group.parent&&proof()&&performance.now()<deadline){
   if(records.every(({p})=>p!.isReady())){
    if(!records.every(({p})=>gl.isProgram(p!.program)&&gl.getProgramParameter(p!.program,gl.LINK_STATUS)===true))return;
    return !group.parent&&proof()?proof:undefined;
   }
   await pause();
  }
 }catch{/** A refused graphics path must not hide the original church. */}
}
