import {ACESFilmicToneMapping,Color,DirectionalLight,HemisphereLight,PerspectiveCamera,Scene,WebGLRenderer,SRGBColorSpace} from 'three';
import {buildFoundersRailShop} from './founders-rail-shop-study.ts';

const status=document.querySelector<HTMLParagraphElement>('#review-status')!;
const host=document.querySelector<HTMLElement>('#review-view')!;
const nav=document.querySelector<HTMLElement>('#poses')!;
const poses=[
 {name:'Prince Street',eye:[-27,7,-18],target:[2,5,-16],fov:51},
 {name:'Visitor entrance',eye:[-17,5,-35],target:[6,4,-25],fov:46},
 {name:'Harbour side',eye:[33,20,53],target:[34,5,-7],fov:51},
 {name:'Roof forms',eye:[37,46,-50],target:[37,4,-12],fov:48}
] as const;
function boot(){
 const renderer=new WebGLRenderer({antialias:true,alpha:false});
 renderer.outputColorSpace=SRGBColorSpace;
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
 const scene=new Scene();scene.background=new Color('#26343f');
 const mesh=buildFoundersRailShop();
 // Match the building's east/south map handedness without claiming georeferencing.
 mesh.group.scale.z=-1;scene.add(mesh.group);
 const sun=new DirectionalLight('#fff1e2',2.2);sun.position.set(-25,31,18);
 scene.add(sun,new HemisphereLight('#edf5ff','#74665a',1.4));
 const camera=new PerspectiveCamera(51,1,.1,500);
 host.append(renderer.domElement);
 let selected=0;
 const buttons=poses.map((pose,i)=>{
  const button=document.createElement('button');button.type='button';button.textContent=pose.name;
  button.addEventListener('click',()=>show(i));nav.append(button);return button;
 });
 const draw=()=>{
  const width=Math.min(Math.max(320,host.clientWidth),1200),height=Math.round(width*9/15);
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  renderer.render(scene,camera);
 };
 function show(i:number){
  selected=i;
  const p=poses[selected];camera.fov=p.fov;camera.position.set(p.eye[0],p.eye[1],p.eye[2]);camera.lookAt(p.target[0],p.target[1],p.target[2]);
  buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(j===selected)));
  status.textContent=p.name+' · '+mesh.triangles.toLocaleString('en-CA')+' triangles in '+mesh.batches+' material batches';
  draw();
 }
 const resize=new ResizeObserver(draw);resize.observe(host);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Graphics context lost. Reload to inspect the model.';});
 renderer.domElement.addEventListener('webglcontextrestored',()=>show(selected));
 show(0);
}
try{boot();}catch{status.textContent='WebGL 2 is required to inspect the Three.js exterior.';}
