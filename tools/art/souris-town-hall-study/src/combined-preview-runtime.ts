import * as T from 'three';
import {buildSourisTownHallCombinedStudy} from './combined-studies.ts';
import {deferHallTextures,type Result} from './deferred-textures.ts';
import {STAIR_FLOOR} from './stair-floor.generated.ts';
import {DATUM} from './survey.ts';
import type {CombinedHallPreview} from './combined-options.ts';

const poses={
 entry:{eye:[-5.2,2.,13.4],aim:[0,2.85,-.2],fov:44},
 rear:{eye:[-15.6,17.8,-30.],aim:[-2.2,5.35,-8.7],fov:34},
} as const;
const skyUrl=new URL('../../../../public/world/maritime-sky.webp',import.meta.url).href;

/** Only this separate HTML entry can instantiate the detached combination. */
export async function startCombinedHallPreview(opts:CombinedHallPreview,status:Element){
 const stage=document.querySelector<HTMLElement>('#preview-stage');
 if(!stage)throw Error('Detached preview stage missing');
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 const scene=new T.Scene();
 scene.background=new T.Color(0x7e9cb7);
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const pose=poses[opts.shot],camera=new T.PerspectiveCamera(pose.fov,1,.1,350);
 camera.position.set(pose.eye[0],pose.eye[1],pose.eye[2]);camera.lookAt(pose.aim[0],pose.aim[1],pose.aim[2]);
 const hemi=new T.HemisphereLight(0xe3eeff,0x78654c,1.48),sun=new T.DirectionalLight(0xffedda,2.2);
 scene.add(hemi,sun);
 if(opts.light==='sim'){
  const U=[.9592013718148051,.2827237667911843],V=[.2827237667911843,-.9592013718148051];
  sun.position.set(U[0]*-.60+U[1]*-.31,.74,-(V[0]*-.60+V[1]*-.31)).normalize().multiplyScalar(90);
 }else sun.position.set(.44,.61,.60).normalize().multiplyScalar(90);
 const compound=buildSourisTownHallCombinedStudy();scene.add(compound.root);
 const floor=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({color:0x74716b,roughness:.96}));
 floor.rotation.x=-Math.PI/2;floor.position.y=opts.shot==='entry'?-.32:-.006;scene.add(floor);
 // Use precisely the published entrance-view floor for the front angle,
 // not an extension of the lower-rear model or a site/terrain contact claim.
 let reviewStepBed:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>|undefined;
 if(opts.shot==='entry'){
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(STAIR_FLOOR.flatMap(q=>q.flatMap(([u,v,y])=>[u,y-DATUM,-v])),3));
  geo.computeVertexNormals();const mat=floor.material.clone();mat.side=T.DoubleSide;
  reviewStepBed=new T.Mesh(geo,mat);scene.add(reviewStepBed);
 }
 let released=false,actualSky:T.Texture|undefined,job:ReturnType<typeof deferHallTextures>|undefined;
 let state:Result|{state:'loading';size:number;bytes:number}={state:'loading',size:opts.size,bytes:0};
 const usableStage=()=>{
  if(released||!stage.contains(renderer.domElement))return;
  const box=stage.getBoundingClientRect();
  const width=Math.floor(box.width),height=Math.floor(box.height);
  return width>=1&&height>=1?{width,height}:undefined;
 };
 const draw=()=>{if(usableStage())renderer.render(scene,camera);};
 const resize=()=>{
  const bounds=usableStage();if(!bounds)return false;
  const {width,height:available}=bounds;
  // Preserve both sides of the reviewed framing on narrow screens.
  // Wide viewport support and the canonical 620×460 view stay unchanged.
  const height=Math.min(available,Math.max(1,Math.floor(width*460/620)));
  if(renderer.domElement.width===width&&renderer.domElement.height===height&&camera.aspect===width/height)return false;
  renderer.setSize(width,height);
  camera.aspect=width/height;camera.updateProjectionMatrix();draw();return true;
 };
 const observer=new ResizeObserver(resize);
 const release=()=>{
  if(released)return;
  released=true;observer.disconnect();removeEventListener('resize',resize);removeEventListener('pagehide',pageHide);
  job?.release();scene.environment=null;actualSky?.dispose();
  compound.dispose();floor.geometry.dispose();floor.material.dispose();
  reviewStepBed?.geometry.dispose();reviewStepBed?.material.dispose();
  renderer.dispose();renderer.domElement.remove();
 };
 const pageHide=(ev:PageTransitionEvent)=>{if(!ev.persisted)release();};
 addEventListener('pagehide',pageHide);addEventListener('resize',resize);
 try{
  const sky=await new T.TextureLoader().loadAsync(skyUrl);
  if(released){sky.dispose();return;}
  actualSky=sky;sky.colorSpace=T.SRGBColorSpace;sky.mapping=T.EquirectangularReflectionMapping;
  scene.environment=sky;scene.environmentIntensity=.77;
  renderer.domElement.setAttribute('aria-label','Three-dimensional detached Souris Town Hall study');
  // Matte immediately, one original worker, same set of material pointers.
  job=deferHallTextures(compound.hall,opts.size);
  stage.append(renderer.domElement);observer.observe(stage);resize();
  status.textContent='Original matte materials while the detailed surfaces load.';
  const diagnostics=()=>({
   composition:'detached',pose:opts.shot,texture:state,reviewFloor:opts.shot==='entry'?'original entry study': 'neutral rear studio',
   view:camera.matrixWorldInverse.elements.slice(),projection:camera.projectionMatrix.elements.slice(),
   draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,released,
  });
  Object.assign(window,{hallCombinedPreview:diagnostics,hallCombinedTexturesReady:job.ready});
  state=await job.ready;
  if(!released){
   status.textContent=state.state==='ready'?'Detailed original materials ready.':'Original matte materials retained.';
   if(!resize())draw();
  }
 }catch(error){release();throw error;}
}
