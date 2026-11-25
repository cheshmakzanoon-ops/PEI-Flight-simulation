import * as T from 'three';
import { makeElmiraRoof, type RoofInputs } from './roof.ts';
import { applyElmiraShingleFinish } from './shingle-finish.ts';
const jp=await fetch(new URL('./fit.json',import.meta.url));if(!jp.ok)throw Error('fit unavailable');
const p=await jp.json() as RoofInputs, scene=new T.Scene();scene.background=new T.Color(0xb6c2c4);scene.fog=new T.FogExp2(0xb6c2c4,.016);
const ren=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});ren.setSize(1100,708,false);ren.setPixelRatio(1);ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=1.07;ren.shadowMap.enabled=true;ren.shadowMap.type=T.PCFSoftShadowMap;document.querySelector('#stage')!.append(ren.domElement);
const local=new T.Group(),roof=makeElmiraRoof(p);applyElmiraShingleFinish(roof,p);local.add(roof);local.position.set(-p.world.worldXZAtUV00[0],-39,-p.world.worldXZAtUV00[1]);scene.add(local);
scene.add(new T.HemisphereLight(0xd4e4f1,0x87816c,1.34));
const sun=new T.DirectionalLight(0xffeedc,2.74);sun.position.set(-15,18,-17);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-16,right:16,top:15,bottom:-15,near:.5,far:90});sun.shadow.mapSize.set(1536,1536);sun.shadow.normalBias=.008;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
const stage=new T.Mesh(new T.PlaneGeometry(125,125),new T.MeshStandardMaterial({color:0x8c9184,roughness:.95}));stage.rotation.x=-Math.PI/2;stage.position.y=-1;stage.receiveShadow=true;scene.add(stage);
const cam=new T.PerspectiveCamera(37.5,1100/708,.08,230);
const poses={track:{eye:[-13.1,11.0,-24.3],aim:[0,2.95,0]},hips:{eye:[18.6,14.7,-21.5],aim:[0,3.0,0]},dormer:{eye:[-2.35,8.05,-11.45],aim:[.65,3.75,-2.17]},plan:{eye:[-.16,33,-4.10],aim:[0,2.3,0]}};
function draw(name:keyof typeof poses){const a=poses[name];cam.position.fromArray(a.eye);cam.lookAt(new T.Vector3().fromArray(a.aim));cam.updateMatrixWorld();ren.render(scene,cam)}
(window as any).elmiraRoofStudio=(name:keyof typeof poses)=>{draw(name);return{image:ren.domElement.toDataURL('image/png'),name,camera:poses[name],positionHashClaim:'physical positions unchanged from sealed makeElmiraRoof()',triangles:roof.children.reduce((s,c)=>s+(c as T.Mesh).geometry.attributes.position.count/3,0),drawCallsIncludingStudioAndShadow:ren.info.render.calls}};
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-pose]'))b.addEventListener('click',()=>{draw(b.dataset.pose as keyof typeof poses);document.querySelectorAll('[data-pose]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)))});
draw('track');
