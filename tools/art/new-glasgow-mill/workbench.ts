import {ACESFilmicToneMapping,Color,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene,Vector3,WebGLRenderer} from 'three';
import {makeMillDetached,millStudioFloor} from './mill-exterior.ts';

const canvas=document.querySelector<HTMLCanvasElement>('#mill')!;
const panel=document.querySelector<HTMLElement>('#viewport')!;
const status=document.querySelector<HTMLElement>('#status')!;
const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-view]'));
type Preset=Readonly<{
 title:string;description:string;eye:readonly [number,number,number];
 target:readonly [number,number,number];
}>;
const views:Readonly<Record<string,Preset>>={
 river:{title:'River elevation',description:'Study the three projecting dormers and lower glazing.',
   eye:[29,14.2,9],target:[0.5,5.7,3.5]},
 gable:{title:'Gable and dormers',description:'Oblique inspection of the steep gable, sash and eaves.',
   eye:[21,13,-21],target:[-0.5,5.8,3.5]},
 approach:{title:'Approach scale',description:'Approximate model scale at the first stock viewing distance, 340 m.',
   eye:[339.54,67,-9.25],target:[-1,5.1,3.5]},
 flyover:{title:'Flyover scale',description:'Approximate model scale at the closer stock viewing distance, 196 m.',
   eye:[191.40,65,41.25],target:[-1,5.1,3.5]}
};
function launch(){
 const renderer=new WebGLRenderer({canvas,alpha:false,antialias:true});
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.10;
 const scene=new Scene();scene.background=new Color(0x8a9ca1);
 const art=makeMillDetached();scene.add(art.mesh);
 const ground=millStudioFloor(),floorMat=new MeshBasicMaterial({color:0x65716a});
 scene.add(new Mesh(ground,floorMat));
 const camera=new PerspectiveCamera(53,1,.10,1800);
 const aim=new Vector3();
 let pending=0,stopped=false;
 function draw(){
  pending=0;
  if(stopped)return;
  const width=Math.max(1,Math.round(panel.clientWidth)),height=Math.max(1,Math.round(panel.clientHeight));
  renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.render(scene,camera);
 }
 const schedule=()=>{if(!pending&&!stopped)pending=requestAnimationFrame(draw);};
 function choose(key:string){
  const next=views[key];
  if(!next||stopped)return;
  aim.set(...next.target);
  camera.position.set(...next.eye);
  camera.lookAt(aim);
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===key)));
  status.textContent=next.description;
  canvas.setAttribute('aria-label','Original Three.js Mill exterior: '+next.title);
  schedule();
 }
 const observe=new ResizeObserver(schedule);observe.observe(panel);
 buttons.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.view??'')));
 function close(){
  if(stopped)return;
  stopped=true;
  observe.disconnect();
  if(pending)cancelAnimationFrame(pending);
  scene.remove(art.mesh);art.dispose();ground.dispose();floorMat.dispose();renderer.dispose();
 }
 addEventListener('pagehide',e=>{if(!e.persisted)close();});
 canvas.addEventListener('webglcontextlost',()=>{
  close();status.textContent='The graphics context was lost. Reload the workbench to try again.';
 });
 choose('river');
}
try{launch();}catch(error){
 console.error(error);status.textContent='This workbench could not start WebGL. The simulator is unchanged.';
 buttons.forEach(b=>{b.disabled=true;});
}
