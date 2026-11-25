import * as T from 'three';
import {makeTignishRoof,type RoofRecipe} from './roof.ts';
const res=await fetch(new URL('./fit.json',import.meta.url));if(!res.ok)throw Error('Detached roof fit not available');
const p=await res.json()as RoofRecipe,W=1200,H=790;
const scene=new T.Scene();scene.background=new T.Color(0xb9c6c0);scene.fog=new T.FogExp2(0xb9c6c0,.008);
const ren=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});ren.setSize(W,H,false);ren.setPixelRatio(1);ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=1.07;
document.querySelector('#surface')!.append(ren.domElement);
const bay=makeTignishRoof(p),anchor=new T.Group(),[x0,z0]=p.world.worldXZAtUV00;
anchor.position.set(-x0,-p.localYOrigin,-z0);anchor.add(bay);scene.add(anchor);
scene.add(new T.HemisphereLight(0xd6e4f2,0xa0996d,2.25));
const sun=new T.DirectionalLight(0xffebd2,2.48);sun.position.set(12,25,16);scene.add(sun);
const nearUV=(u:number,v:number)=>new T.Vector3(p.world.worldXZPerU[0]*u+p.world.worldXZPerV[0]*v,-7.0,p.world.worldXZPerU[1]*u+p.world.worldXZPerV[1]*v);
scene.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(p.outlineUV.map(q=>nearUV(...q))),new T.LineBasicMaterial({color:0x695951,transparent:true,opacity:.89})));
const grid=new T.GridHelper(62,31,0x8a9a8c,0xa7b2a5);grid.position.y=-7.035;grid.material.transparent=true;grid.material.opacity=.52;scene.add(grid);
const cam=new T.PerspectiveCamera(38,W/H,.10,260);
const poses={
 nearEast:{eye:[31.3,31.7,38.9],look:[.4,2.7,-.8],up:[0,1,0],fov:39},
 north:{eye:[-12.3,32.9,-39.4],look:[.2,3.4,-.25],up:[0,1,0],fov:41.5},
 plan:{eye:[-.015,65,.001],look:[0,0,0],up:[0,0,-1],fov:36.5},
 west:{eye:[-37,22.65,-13.37],look:[-3.7,1.8,-1.1],up:[0,1,0],fov:40.2},
};
function draw(key:keyof typeof poses){
 const v=poses[key];cam.position.fromArray(v.eye);cam.up.fromArray(v.up);cam.fov=v.fov;cam.updateProjectionMatrix();cam.lookAt(new T.Vector3().fromArray(v.look));cam.updateMatrixWorld(true);ren.render(scene,cam);
}
const meshTris=bay.children.reduce((s,c)=>s+(c as T.Mesh).geometry.attributes.position.count/3,0);
(window as any).tignishMeasuredStudio=(key:keyof typeof poses)=>{draw(key);return{png:ren.domElement.toDataURL('image/png'),pose:poses[key],physicalTriangles:meshTris,roofRoles:new Set(bay.children.map(x=>x.userData.role)).size,calls:ren.info.render.calls}};
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-pose]'))b.onclick=()=>{draw(b.dataset.pose as keyof typeof poses);document.querySelectorAll('[data-pose]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));};
draw('nearEast');
