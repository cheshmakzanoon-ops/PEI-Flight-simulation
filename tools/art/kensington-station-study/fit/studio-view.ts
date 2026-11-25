import * as THREE from 'three';
import {makeRoofWitness,type FitProof,type Uv} from './roof-witness';
import fit from './fit-sealed.json';
const roofEnvelopeUV=fit.roofEnvelopeUV.map((p):Uv=>{
 if(p.length!==2||!p.every(Number.isFinite))throw new Error('Invalid horizontal preview outline');
 return [p[0],p[1]];
});
const F:FitProof={...fit,roofEnvelopeUV},surface=makeRoofWitness(F),world=surface.group;
const [a,b]=F.worldAdapter.coefficientsFromUV1ToXZ;
const atlasLocal=(u:number,v:number,y:number)=>new THREE.Vector3(a[0]*u+b[0]*v,y-F.worldAdapter.localOriginY,a[1]*u+b[1]*v);
const W=980,H=700;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,W/H,.08,150);
scene.background=new THREE.Color(0xe5e6df);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
document.body.appendChild(renderer.domElement);
const guide=new THREE.GridHelper(50,50,0x7a8380,0xb0b7ab);
guide.position.copy(atlasLocal(0,5,38.25));scene.add(guide);
const hemi=new THREE.HemisphereLight(0xffffff,0xd8cabe,1.95);
const sun=new THREE.DirectionalLight(0xffebcf,2.2);sun.position.set(-6,11,7);scene.add(hemi,sun);
world.position.set(0,0,0);scene.add(world);
const guideMaterial=new THREE.LineBasicMaterial({color:0x606751,depthTest:false,transparent:true,opacity:.42});
const groundEnvelope=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(F.roofEnvelopeUV.map(([u,v])=>atlasLocal(u,v,38.29))),guideMaterial);
scene.add(groundEnvelope);
function draw(eye:number[], aim:number[]){
 camera.position.copy(atlasLocal(eye[0],eye[1],eye[2]));camera.lookAt(atlasLocal(aim[0],aim[1],aim[2]));camera.updateMatrixWorld(true);
 scene.updateMatrixWorld(true);renderer.render(scene,camera);
 return {png:renderer.domElement.toDataURL('image/png'),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
(window as any).drawRoof=draw;
draw([-16,-35,54],[0,4,42]);
