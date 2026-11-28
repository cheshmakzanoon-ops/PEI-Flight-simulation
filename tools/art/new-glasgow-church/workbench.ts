import {ACESFilmicToneMapping,Color,Mesh,PerspectiveCamera,Scene,Vector3,WebGLRenderer} from 'three';
import {churchStudioGround,makeChurchDetached} from './church-core.ts';

const canvas=document.querySelector<HTMLCanvasElement>('#church')!;
const panel=document.querySelector<HTMLElement>('#viewport')!;
const status=document.querySelector<HTMLElement>('#status')!;
const buttons=[...document.querySelectorAll<HTMLButtonElement>('button[data-view]')];
type Pose=Readonly<{
 title:string;
 hint:string;
 eye:readonly [number,number,number];
 look:readonly [number,number,number];
 fov:number;
}>;
const views:ReadonlyMap<string,Pose>=new Map([
 ['front',{title:'Northwest frontage',hint:'Pointed windows, gable trim, recessed door and the iron ornament above the spire.',
   eye:[14,5.5,-34],look:[.7,5.44,-8],fov:32.4}],
 ['flank',{title:'Windowed side',hint:'Four photographed lancets and the eave junction.',
   eye:[23,7.7,-23.8],look:[.8,5.34,-7.45],fov:36.9}],
 ['scale',{title:'Distance study',hint:'The main silhouette, seen from about 170 metres on the studio stage.',
   eye:[74,24,-158],look:[.7,5.3,-8],fov:33.6}],
]);
function launch(){
 const renderer=new WebGLRenderer({canvas,alpha:false,antialias:true});
 const art=makeChurchDetached();
 const floor=churchStudioGround();
 const stage=new Mesh(floor,art.material);
 const scene=new Scene();
 scene.background=new Color(0x7a8d98);
 scene.add(stage,art.mesh);
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.1;
 const camera=new PerspectiveCamera(32.4,1,.08,900);
 const focus=new Vector3();
 let raf=0,closed=false,verticalFov=32.4;
 function draw(){
  raf=0;
  if(closed)return;
  const w=Math.max(1,panel.clientWidth),h=Math.max(1,panel.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  // Hold at least the same horizontal aperture as the review frame on narrow screens.
  const a=verticalFov*Math.PI/360;
  camera.fov=Math.atan(Math.tan(a)*Math.max(1,1.05/camera.aspect))*360/Math.PI;
  camera.updateProjectionMatrix();
  renderer.render(scene,camera);
 }
 function schedule(){if(!closed&&!raf)raf=requestAnimationFrame(draw);}
 function choose(key:string){
  const pose=views.get(key);
  if(!pose||closed)return;
  camera.position.set(...pose.eye);
  camera.lookAt(focus.set(...pose.look));
  verticalFov=pose.fov;
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
  canvas.setAttribute('aria-label','Three.js church model: '+pose.title);
  status.textContent=pose.hint;
  schedule();
 }
 const observe=new ResizeObserver(schedule);
 observe.observe(panel);
 buttons.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.view??'')));
 function close(){
  if(closed)return;
  closed=true;
  observe.disconnect();
  if(raf)cancelAnimationFrame(raf);
  scene.remove(art.mesh,stage);floor.dispose();art.dispose();renderer.dispose();
 }
 addEventListener('pagehide',e=>{if(!e.persisted)close();});
 canvas.addEventListener('webglcontextlost',()=>{
  close();
  status.textContent='The graphics context was lost. Reload to try again.';
  buttons.forEach(b=>{b.disabled=true;});
 });
 choose('front');
}
try{launch();}catch(error){
 console.error(error);
 status.textContent='WebGL could not start. The still image is available in the sidebar.';
 buttons.forEach(b=>{b.disabled=true;});
}
