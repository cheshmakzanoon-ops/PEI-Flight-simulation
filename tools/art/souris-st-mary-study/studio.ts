import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeDetachedSaintMary,MARY_ROLES,type MaryRole} from './souris-saint-mary-forms.ts';
import {makeDetachedMaryFinish} from './souris-saint-mary-finishes.ts';
import {makeDetachedMaryFinishV2} from './souris-st-mary-finish-v2.ts';

const angles = {
  entry: {name:'Southwest entry', direction:[.40,.21,1], look:[0,13,6]},
  side: {name:'Side elevation', direction:[1,.23,.23], look:[0,13,0]},
  chase: {name:'Chase viewing angle', direction:[.52,.12,1], look:[0,13,0]},
  detail: {name:'Tower details', direction:[-.28,.25,1], look:[-1,19,22]},
} as const;
type Angle=keyof typeof angles;

const display=document.querySelector<HTMLElement>('#display')!;
const load=document.querySelector<HTMLElement>('#load')!;
const viewName=document.querySelector<HTMLElement>('#view-name')!;
const finish=document.querySelector<HTMLInputElement>('#finish')!;
const buttons=[...document.querySelectorAll<HTMLButtonElement>('button[data-view]')];
function run() {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.12;
  renderer.domElement.setAttribute('aria-label','Original 3D approximation of St. Mary’s exterior in Souris');
  display.append(renderer.domElement);

  const scene=new T.Scene();
  scene.background=new T.Color('#b5c5c5');
  const sky=new T.HemisphereLight('#d2e6ef','#766b5e',2);
  const sun=new T.DirectionalLight('#fff2d8',2.25);
  sun.position.set(-52,72,47);
  const fill=new T.DirectionalLight('#8caebd',.62);
  fill.position.set(39,14,-34);

  const mats=(enabled:boolean)=>new Map(MARY_ROLES.map(role=>[role,enabled?makeDetachedMaryFinishV2(role):makeDetachedMaryFinish(role,false)]));
  const shaded=mats(true), flat=mats(false);
  const church=makeDetachedSaintMary(role=>shaded.get(role)!);
  const ground=new T.Mesh(new T.PlaneGeometry(220,220),new T.MeshStandardMaterial({color:'#7e8174',roughness:.95}));
  ground.rotateX(-Math.PI/2);
  ground.position.y=-.035;
  scene.add(sky,sun,fill,ground,church);

  const camera=new T.PerspectiveCamera(39,1,.3,550);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.minDistance=15;
  controls.maxDistance=230;
  controls.maxPolarAngle=Math.PI*.48;
  const envelope=new T.Box3().setFromObject(church);
  const towerWindow=new T.Box3(new T.Vector3(-16,6,18),new T.Vector3(15,32,29));
  let which:Angle='entry';
  let disposed=false;
  let pending=0;
  function redraw() {
    if(pending||disposed)return;
    pending=requestAnimationFrame(()=>{
      pending=0;
      renderer.render(scene,camera);
      renderer.domElement.dataset.orbitReady=which;
      renderer.domElement.dataset.finish=String(finish.checked);
      load.textContent=`${renderer.info.render.triangles-2} model triangles · ${renderer.info.render.calls-1} model draws`;
    });
  }
  function place(next:Angle) {
    which=next;
    const v=angles[which];
    controls.target.set(v.look[0],v.look[1],v.look[2]);
    const outward=new T.Vector3(v.direction[0],v.direction[1],v.direction[2]).normalize();
    const right=new T.Vector3(0,1,0).cross(outward).normalize();
    const up=outward.clone().cross(right);
    const bounds=which==='detail'?towerWindow:envelope;
    const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2))*.85;
    let distance=0;
    for(const x of [bounds.min.x,bounds.max.x])
      for(const y of [bounds.min.y,bounds.max.y])
        for(const z of [bounds.min.z,bounds.max.z]){
          const delta=new T.Vector3(x,y,z).sub(controls.target);
          distance=Math.max(distance,delta.dot(outward)+Math.max(
            Math.abs(delta.dot(right))/(tangent*camera.aspect),Math.abs(delta.dot(up))/tangent));
        }
    camera.position.copy(outward).multiplyScalar(distance).add(controls.target);
    controls.update();
    viewName.textContent=v.name;
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.view===which));
    redraw();
  }
  function resize() {
    const w=display.clientWidth,h=display.clientHeight;
    if(w<2||h<2)return;
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    place(which);
  }
  controls.addEventListener('change',redraw);
  for(const button of buttons)button.addEventListener('click',()=>{
    const view=button.dataset.view;
    if(view&&Object.hasOwn(angles,view))place(view as Angle);
  });
  finish.addEventListener('change',()=>{
    for(const [i,child] of church.children.entries()){
      if(child instanceof T.Mesh)child.material=(finish.checked?shaded:flat).get(MARY_ROLES[i] as MaryRole)!;
    }
    redraw();
  });
  const observer=new ResizeObserver(resize);
  observer.observe(display);
  resize();
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    disposed=true;
    cancelAnimationFrame(pending);
    observer.disconnect();controls.dispose();renderer.dispose();
    ground.geometry.dispose();ground.material.dispose();
    for(const mesh of church.children)if(mesh instanceof T.Mesh)mesh.geometry.dispose();
    for(const set of [shaded,flat])for(const mat of set.values())mat.dispose();
  },{once:true});
}
try { run(); } catch {
  display.classList.add('fallback');
  display.textContent='WebGL 2 is unavailable in this browser. The study is not part of the live simulator.';
  load.textContent='';
}
