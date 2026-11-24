import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCovehead } from './covehead.ts';

const scr = new URLSearchParams(location.search);
const tier = scr.has('flight') ? 'flight' : 'heritage';
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const scene=new T.Scene();
scene.background=new T.Color(0xb7c6d0);
const room = new RoomEnvironment();
const pmrem = new T.PMREMGenerator(renderer);
const env = pmrem.fromScene(room, .12);
room.dispose();pmrem.dispose();
scene.environment = env.texture;
scene.environmentIntensity=.72;
scene.add(new T.HemisphereLight(0xc9e4fc,0xaca391,1.02));
const sun=new T.DirectionalLight(0xffedcf,2.42);
sun.position.set(-13,17,10);sun.target.position.set(0,4,0);
sun.castShadow=true;
sun.shadow.mapSize.set(1536,1536);
sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;
sun.shadow.normalBias=.004;sun.shadow.bias=-.00018;
scene.add(sun,sun.target);
const stand=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0xc5c2b9,roughness:1}));
stand.rotation.x=-Math.PI/2;
stand.position.y=-.018;stand.receiveShadow=true;scene.add(stand);
const object=buildCovehead(tier);
object.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
scene.add(object);
const camera=new T.PerspectiveCamera(31,innerWidth/innerHeight,.25,150);
if(scr.has('lantern')) {
 camera.position.set(7.4,7.3,-7.9);camera.lookAt(0,7.05,0);
} else if(scr.has('reverse')){
 camera.position.set(-11,6.75,-15.1);camera.lookAt(0,4.2,0);
} else {
 camera.position.set(11.9,6.3,16.1);camera.lookAt(0,4.2,0);
}
renderer.render(scene,camera);
Object.assign(window,{review:{tier,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles}});
