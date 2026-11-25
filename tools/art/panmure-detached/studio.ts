import {detachedEntrance} from './entrance-study.ts';
import * as T from 'three';
import { lowerPanmureEnvelope } from './envelope.ts';
import { candidateLantern } from './candidate-lantern.ts';
const scene=new T.Scene(), renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;
scene.background=new T.Color(0xa9c4d3);
const reflection=new T.Scene();
reflection.add(new T.Mesh(new T.SphereGeometry(14,20,12),new T.ShaderMaterial({
 side:T.BackSide,vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec3 direction;void main(){
  vec3 p=normalize(direction);float sky=smoothstep(-.055,.34,p.y);
  vec3 color=mix(vec3(.15,.10,.075),mix(vec3(.76,.86,.92),vec3(.24,.42,.72),smoothstep(.02,.9,p.y)),sky);
  float sheen=smoothstep(.63,.97,dot(p,normalize(vec3(-6.,4.,11.))));
  color+=vec3(.67,.69,.68)*sheen*sky;gl_FragColor=vec4(color,1.);
 }`})
));
const pm=new T.PMREMGenerator(renderer);const hdr=pm.fromScene(reflection,.012);
scene.environment=hdr.texture;scene.environmentIntensity=.68;pm.dispose();
const ambient=new T.HemisphereLight(0xc7e9ff,0x998876,1.38);
const sun=new T.DirectionalLight(0xffebc7,2.04);
sun.position.set(15,26,9);sun.target.position.set(0,6,0);sun.castShadow=true;
sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;
sun.shadow.normalBias=.028;sun.shadow.bias=-.00015;
const stand = new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0xc1c4bd,roughness:1}));
stand.rotation.x=-Math.PI/2;stand.position.y=.02;stand.receiveShadow=true;
const art=lowerPanmureEnvelope();
const q=new URLSearchParams(location.search),cap=q.get('cap');
if(q.has('access'))art.add(detachedEntrance());
if(cap==='8'||cap==='12')art.add(candidateLantern(cap==='8'?8:12,q.has('refined')));
art.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=!(o.material instanceof T.MeshPhysicalMaterial&&o.material.transmission>0);o.receiveShadow=true;}});
scene.add(ambient,sun,sun.target,stand,art);
const camera=new T.PerspectiveCamera(32,innerWidth/innerHeight,.25,250);
if(q.has('access')){
 camera.position.set(14,3.9,7.4);camera.lookAt(3.8,2.2,0);
}else if(q.has('gallery')){
 camera.position.set(15,15.5,10);camera.lookAt(0,14.9,0);
}else{
 camera.position.set(42,14,20);camera.lookAt(0,9.0,0);
}
document.body.appendChild(renderer.domElement);renderer.render(scene,camera);
const box=new T.Box3().setFromObject(art);
Object.assign(window,{ready:{tris:renderer.info.render.triangles,draws:renderer.info.render.calls,box:[box.min.toArray(),box.max.toArray()],meshGroups:art.children.length}});
