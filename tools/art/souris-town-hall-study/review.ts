import * as T from 'three';
import {buildSourisTownHall} from './src/hall.ts';
const renderer = new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(1);
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1;
document.body.appendChild(renderer.domElement);
const scene=new T.Scene();
scene.background=new T.Color(0x7e9cb7);
const camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.1,350);
const hemi=new T.HemisphereLight(0xe3eeff,0x78654c,1.48);
const sun=new T.DirectionalLight(0xffedda,2.2);
scene.add(hemi,sun);
// Use the simulator's existing CC0 light probe, not photographed building pixels.
const skyUrl=new URL('../../../public/world/maritime-sky.webp',import.meta.url).href;
const sky=await new T.TextureLoader().loadAsync(skyUrl);
sky.colorSpace=T.SRGBColorSpace;
sky.mapping=T.EquirectangularReflectionMapping;
scene.environment=sky;scene.environmentIntensity=.77;
const t0=performance.now();
const hall=buildSourisTownHall();
const setupMs=performance.now()-t0;
const textures=new Set<T.Texture>();
hall.traverse(o=>{
 const m=(o as T.Mesh).material;
 for(const one of m?(Array.isArray(m)?m:[m]):[]) {
   const p=one as T.MeshPhysicalMaterial;
   for(const x of [p.map,p.normalMap,p.roughnessMap])if(x)textures.add(x);
 }
});
const logicalAssetBytes=[...textures].reduce((n,x)=>n+((x.image as {data?:ArrayBufferView}|null)?.data?.byteLength??0),0);

scene.add(hall);
const floor=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({color:0x74716b,roughness:.96}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
const poses={
 sourceGeo:{eye:[-7.13454,1.4,14.21332],aim:[0,6.25,0],fov:46},
 sourceAxial:{eye:[.12,1.42,14.22],aim:[0,6.25,0],fov:46},
 street:{eye:[.58,2.55,23.8],aim:[.01,5.73,0],fov:39},
 detail:{eye:[-.94,2.35,12.5],aim:[-1.07,4.64,0],fov:42},
 west:{eye:[-17.5,7.5,24],aim:[-.40,6.21,-2.38],fov:41},
 air:{eye:[22.3,23.6,35.8],aim:[0,6,-4.29],fov:34}
} as const;
type Pose=keyof typeof poses;
(window as any).hallFrame=(shot:Pose,mode:'sim'|'light')=>{
 const p=poses[shot];camera.position.set(p.eye[0],p.eye[1],p.eye[2]);camera.lookAt(p.aim[0],p.aim[1],p.aim[2]);
 camera.fov=p.fov;camera.updateProjectionMatrix();
 const U=[.9592013718148051,.2827237667911843],V=[.2827237667911843,-.9592013718148051];
 if(mode==='sim')sun.position.set(U[0]*-.60+U[1]*-.31,.74,-(V[0]*-.60+V[1]*-.31)).normalize().multiplyScalar(90);
 else sun.position.set(.44,.61,.60).normalize().multiplyScalar(90);
 renderer.render(scene,camera);
 return {scene:{draws:renderer.info.render.calls,triangles:renderer.info.render.triangles},detachedResources:{setupMs,logicalAssetBytes,textures:textures.size},data:hall.userData};
};
const opts=new URLSearchParams(location.search);
const desired=opts.get('shot');
const pose:Pose=desired&&Object.hasOwn(poses,desired)?desired as Pose:'street';
(window as any).hallFrame(pose,opts.get('light')==='sim'?'sim':'light');
