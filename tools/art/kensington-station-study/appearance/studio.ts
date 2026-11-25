import {
  ACESFilmicToneMapping,Color,DirectionalLight,HemisphereLight,Mesh,MeshStandardMaterial,PCFShadowMap,
  PerspectiveCamera,PlaneGeometry,Scene,SRGBColorSpace,Vector2,WebGLRenderer,
} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createKensingtonApproximateSilhouette} from './silhouette.ts';
import {createNeutralStationRoofMaterial} from './neutral-roof-material.ts';
import {studioAngularStoneAtlas} from './angular-stone-recipe.ts';

const angles={
  track:[[25,12.4,26],[0,3.8,-4.7]],bay:[[4,6.1,15.9],[.15,2.11,-2.3]],
  rear:[[-22,13,-34],[.6,3.45,-4.9]],roof:[[15,25,23],[0,2.75,-5.7]],
} as const;
function run(el:HTMLCanvasElement,stage:HTMLElement){
 const r=new WebGLRenderer({canvas:el,antialias:true,powerPreference:'high-performance'});
 r.setPixelRatio(Math.min(devicePixelRatio,1.5));
 r.outputColorSpace=SRGBColorSpace;r.toneMapping=ACESFilmicToneMapping;
 r.shadowMap.enabled=true;r.shadowMap.type=PCFShadowMap;
 const scene=new Scene();scene.background=new Color(0x718191);
 const cam=new PerspectiveCamera(49,1,.1,300);
 const controls=new OrbitControls(cam,el);
 controls.enableDamping=true;controls.dampingFactor=.10;controls.minDistance=5;controls.maxDistance=95;
 controls.maxPolarAngle=Math.PI*.489;
 const sun=new DirectionalLight(0xffefe0,2.35);
 sun.position.set(-26,36,18);sun.target.position.set(0,0,-4);
 sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 sun.shadow.camera.left=-27;sun.shadow.camera.right=27;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;
 sun.shadow.camera.near=.5;sun.shadow.camera.far=100;sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0002;sun.shadow.normalBias=.024;
 scene.add(sun,sun.target,new HemisphereLight(0xddeaff,0x77706b,1.27));
 const ground=new Mesh(new PlaneGeometry(260,260),new MeshStandardMaterial({color:0x727e89,roughness:.97}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;scene.add(ground);
 const draft=createKensingtonApproximateSilhouette();
 const cover=createNeutralStationRoofMaterial();
 const a=studioAngularStoneAtlas(),stone=new MeshStandardMaterial({
  color:0xffffff,roughness:.96,map:a.map,normalMap:a.normalMap,normalScale:new Vector2(.87,.87)
 });
 // A separate viewer is allowed to use the synthetic stage pose. There is
 // nothing here that identifies, hides or attaches a player scenery owner.
 for(const m of draft.art.children){
  if(!(m instanceof Mesh))continue;
  const role=m.userData.role;
  if(['main-roof','bay-roof','shelter-SW','shelter-NE'].includes(role))m.material=cover;
  if(['stone-wall','support-SW','support-NE'].includes(role))m.material=stone;
 }
 const archStone=draft.arch.children.find(m=>m.name==='Kensington fieldstone');
 if(archStone instanceof Mesh)archStone.material=stone;
 draft.owner.visible=true;scene.add(draft.owner);
 const onSize=()=>{
  const w=stage.clientWidth,h=stage.clientHeight;
  if(w>0&&h>0){cam.aspect=w/h;cam.updateProjectionMatrix();r.setSize(w,h,false);}
 };
 const changeView=(key:keyof typeof angles)=>{
   const [eye,aim]=angles[key];cam.position.set(eye[0],eye[1],eye[2]);controls.target.set(aim[0],aim[1],aim[2]);controls.update();
   for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))
    b.setAttribute('aria-pressed',String(b.dataset.view===key));
 };
 for(const b of document.querySelectorAll<HTMLButtonElement>('[data-view]'))b.addEventListener('click',()=>{
  const key=b.dataset.view;if(key&&Object.hasOwn(angles,key))changeView(key as keyof typeof angles);
 });
 const observer=new ResizeObserver(onSize);observer.observe(stage);onSize();changeView('track');
 r.setAnimationLoop(()=>{controls.update();r.render(scene,cam);});
 window.addEventListener('pagehide',event=>{
   if(event.persisted)return;
   r.setAnimationLoop(null);observer.disconnect();controls.dispose();draft.dispose();
   a.map.dispose();a.normalMap.dispose();cover.dispose();stone.dispose();
   ground.geometry.dispose();ground.material.dispose();sun.dispose();r.dispose();
 });
}
try{
 const el=document.querySelector<HTMLCanvasElement>('#preview'),stage=document.querySelector<HTMLElement>('#stage');
 if(!el||!stage)throw Error('Missing rendering surface');
 run(el,stage);
}catch(e){document.querySelector('#warning')?.setAttribute('data-active','');console.warn('Kensington study not rendered',e);}
