import {ACESFilmicToneMapping,Color,DirectionalLight,HemisphereLight,PerspectiveCamera,Scene,WebGLRenderer,SRGBColorSpace} from 'three';
import {buildFoundersRailShop} from './founders-rail-shop-study.ts';

const status=document.querySelector<HTMLParagraphElement>('#review-status')!;
const host=document.querySelector<HTMLElement>('#review-view')!;
const nav=document.querySelector<HTMLElement>('#poses')!;
const gable=document.querySelector<HTMLButtonElement>('#gable-preview')!;
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
 let cap:Awaited<ReturnType<typeof import('./founders-west-clip-study.ts')['buildFoundersWestClipStudy']>>|undefined;
 let comparing=false;
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
  const active=comparing&&cap?cap:mesh;
  status.textContent=p.name+' · '+active.triangles.toLocaleString('en-CA')+' triangles in '+active.batches+' material batches'+
   (comparing?' · render-only gable check':'');
  draw();
 }
 gable.addEventListener('click',async()=>{
  gable.disabled=true;
  try{
   if(!cap){
    const mod=await import('./founders-west-clip-study.ts');
    cap=await mod.buildFoundersWestClipStudy();if(!cap.verified)throw Error("Unverified original asset");cap.group.scale.z=-1;cap.group.visible=false;
    const oldHandler=renderer.debug.onShaderError;let linked=true;
    renderer.debug.onShaderError=()=>{linked=false;};
    try{await renderer.compileAsync(cap.group,camera,scene);}finally{renderer.debug.onShaderError=oldHandler;}
    if(!linked)throw Error('Gable shader could not link');
    scene.add(cap.group);
   }
   comparing=!comparing;mesh.group.visible=!comparing;cap.group.visible=comparing;cap.setEnabled(comparing);
   gable.setAttribute('aria-pressed',String(comparing));show(selected);
  }catch{
   comparing=false;mesh.group.visible=true;if(cap){cap.group.visible=false;cap.setEnabled(false);if(!cap.group.parent)cap=undefined;}
   gable.setAttribute('aria-pressed','false');draw();status.textContent='The render-only gable comparison could not load. The original study is unchanged.';
  }finally{gable.disabled=false;}
 });
 const resize=new ResizeObserver(draw);resize.observe(host);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Graphics context lost. Reload to inspect the model.';});
 renderer.domElement.addEventListener('webglcontextrestored',()=>show(selected));
 show(0);
}
try{boot();}catch{status.textContent='WebGL 2 is required to inspect the Three.js exterior.';}
