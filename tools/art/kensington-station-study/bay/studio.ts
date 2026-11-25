import * as THREE from 'three';
import {makeKensingtonBayStudy} from './bay-joinery';
const W=980,H=700,scene=new THREE.Scene();scene.background=new THREE.Color(0xb4c0ca);
const camera=new THREE.PerspectiveCamera(43,W/H,.06,60);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.99;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
// Original analytic garden/sky reflection field, with no geographic panorama.
const skyW=196,skyH=98,d=new Float32Array(skyW*skyH*4);
const mix=THREE.MathUtils.lerp;
for(let y=0;y<skyH;y++)for(let x=0;x<skyW;x++){
 const u=(x+.5)/skyW,v=(y+.5)/skyH,t=THREE.MathUtils.smoothstep(v,.39,.7),over=1-THREE.MathUtils.smoothstep(v,.51,.73);
 const cloud=over*Math.pow(Math.max(0,Math.sin(u*Math.PI*4+v*10)*Math.cos(u*Math.PI*6+v*24)),.85);
 const i=(x+y*skyW)*4;
 d[i]=mix(.11,.39,t)+.35*cloud;d[i+1]=mix(.100,.565,t)+.36*cloud;d[i+2]=mix(.085,.85,t)+.37*cloud;d[i+3]=1;
}
const sky=new THREE.DataTexture(d,skyW,skyH,THREE.RGBAFormat,THREE.FloatType);
sky.mapping=THREE.EquirectangularReflectionMapping;sky.needsUpdate=true;
const pm=new THREE.PMREMGenerator(renderer), env=pm.fromEquirectangular(sky);scene.environment=env.texture;scene.environmentIntensity=.77;sky.dispose();pm.dispose();
scene.add(new THREE.HemisphereLight(0xfff7ee,0x87735a,.95));
const sun=new THREE.DirectionalLight(0xffedd4,2.15);sun.position.set(-3.71,5.12,3.70);sun.castShadow=true;
sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-3.3;sun.shadow.camera.right=3.3;sun.shadow.camera.top=4.3;sun.shadow.camera.bottom=-2.8;
sun.shadow.camera.near=.2;sun.shadow.camera.far=20;sun.shadow.bias=-.00023;sun.shadow.normalBias=.003;
sun.target.position.set(0,1.45,.2);scene.add(sun,sun.target);
const stage=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0xc0b7a3,roughness:.94}));
stage.rotation.x=-Math.PI*.5;stage.position.y=.078;stage.receiveShadow=true;scene.add(stage);
const mesh=makeKensingtonBayStudy();scene.add(mesh);
const rc=new THREE.Raycaster();
function trace(x:number,y:number){
  rc.set(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));
  return rc.intersectObject(mesh,true).slice(0,2).map(v=>({name:v.object.name,z:v.point.z}));
}
(window as any).studio=(eye:number[],aim:number[])=>{
 camera.position.fromArray(eye);camera.lookAt(new THREE.Vector3().fromArray(aim));camera.updateMatrixWorld(true);
 scene.updateMatrixWorld(true);renderer.render(scene,camera);
 return {png:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
  geometry:mesh.children.map(v=>{const p=v as THREE.Mesh;return {mat:p.name,triangles:p.geometry.attributes.position.count/3};}),
  probes:{clear:[trace(-.20,1.94),trace(.23,1.22)],stone:[trace(.89,1.94),trace(.57,2.19)],mullion:trace(0,1.13),sill:trace(.32,.46)}};
};
(window as any).studio([.73,1.59,4.5],[0,1.46,.22]);
