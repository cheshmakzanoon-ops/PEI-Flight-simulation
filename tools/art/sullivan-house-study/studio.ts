import * as T from 'three';
import {makeSullivanDormer} from './dormer.ts';
import { r } from './finish.ts';
const W=1160,H=798,scene=new T.Scene();scene.background=new T.Color(0xb1bcb6);scene.fog=new T.Fog(0xb1bcb6,23,83);
const camera=new T.PerspectiveCamera(38,W/H,.05,100);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.015;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.querySelector('#picture')!.append(renderer.domElement);
function skies(){
 const w=448,h=224,bin=new Float32Array(w*h*4),sm=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w,v=(y+.5)/h,bend=.478+.031*Math.sin(u*Math.PI*14)+.024*Math.sin(u*Math.PI*24+.51)+.007*Math.sin(u*Math.PI*64)+.003*Math.sin(u*Math.PI*137);
  const line=sm(v,bend-.004,bend+.009),rise=sm(v,.45,.89);
  const c=sm(.49*Math.sin((v*7.8-u*6.0)*6.283)+.36*Math.sin(u*118+47*v)+.17*Math.cos(137*v-89*u),.20,.72)*(1-sm(v,.58,.84));
  const trees=(.05*r(x>>1,y>>1)+.019*Math.cos(122*u+v*23)),g=[.046+trees,.064+trees,.049+.73*trees],s=[.45+.37*c-.04*rise,.62+.31*c-.04*rise,.73+.29*c+.073*rise];
  const o=(x+y*w)*4;for(let j=0;j<3;j++)bin[o+j]=lerp(g[j],s[j],line);bin[o+3]=1;
 }
 const a=new T.DataTexture(bin,w,h,T.RGBAFormat,T.FloatType);a.mapping=T.EquirectangularReflectionMapping;a.magFilter=a.minFilter=T.LinearFilter;a.needsUpdate=true;
 const p=new T.PMREMGenerator(renderer),map=p.fromEquirectangular(a);p.dispose();return{a,map};
}
const sky=skies();scene.environment=sky.map.texture;scene.environmentIntensity=.96;
const h=new T.HemisphereLight(0xe3edf7,0x8e7e63,1.72);scene.add(h);
const sun=new T.DirectionalLight(0xffead1,2.84);sun.position.set(-3.11,6.89,4.36);sun.target.position.set(0,2.01,.08);sun.castShadow=true;
Object.assign(sun.shadow.camera,{left:-4.1,right:4.1,top:4.2,bottom:-4.2,near:.16,far:26});sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00019;sun.shadow.normalBias=.004;scene.add(sun,sun.target);
const base=new T.Mesh(new T.PlaneGeometry(110,110),new T.MeshStandardMaterial({color:0x969181,roughness:.97}));
base.rotation.x=-Math.PI/2;base.position.y=-.163;base.receiveShadow=true;scene.add(base);
const dormer=makeSullivanDormer();scene.add(dormer);
const g=dormer.getObjectByName('glazing')as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
g.material.onBeforeCompile=shader=>{
 shader.uniforms.innReflection={value:sky.a};
 shader.vertexShader='varying vec3 vInnWS;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvInnWS=(modelMatrix*vec4(position,1.)).xyz;');
 shader.fragmentShader='uniform sampler2D innReflection;\nvarying vec3 vInnWS;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
  vec3 innN=inverseTransformDirection(normal,viewMatrix),viewer=normalize(cameraPosition-vInnWS),ref=reflect(-viewer,innN);
  vec2 p=vec2(fract(atan(ref.z,ref.x)*.15915494+.5),asin(clamp(ref.y,-1.,1.))*.31830988+.5);
  vec3 innSky=texture2D(innReflection,p).rgb;
  outgoingLight=mix(outgoingLight,innSky,.121+.143*pow(1.-max(0.,dot(innN,viewer)),2.));
  #include <opaque_fragment>
 `);
};g.material.customProgramCacheKey=()=> 'Sullivan original sky lobe studio 1';
const views={
 full:{eye:[3.15,2.77,8.77],at:[.13,2.39,.27],fov:36.0,lighting:2.84},
 elevation:{eye:[.15,2.61,9.06],at:[0,2.45,.29],fov:39.3,lighting:1.57},
 canted:{eye:[4.61,2.81,4.32],at:[.16,2.53,.49],fov:37.5,lighting:2.39},
 shingles:{eye:[-3.23,4.01,4.40],at:[-.82,2.72,.44],fov:32.2,lighting:2.50},
 eave:{eye:[4.82,.453,3.86],at:[2.373,.66,1.16],fov:34.4,lighting:2.30},
};
function draw(name:keyof typeof views){
 const q=views[name];sun.intensity=q.lighting;h.intensity=q.lighting<1.8?1.91:1.51;
 camera.position.fromArray(q.eye);camera.lookAt(new T.Vector3().fromArray(q.at));camera.fov=q.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);
}
(window as any).sullivanStudio=(n:keyof typeof views)=>{draw(n);return{png:renderer.domElement.toDataURL('image/png'),pose:views[n],parts:dormer.children.map(o=>[o.name,(o as T.Mesh).geometry.attributes.position.count/3]),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}};
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-pose]'))b.onclick=()=>{draw(b.dataset.pose as keyof typeof views);document.querySelectorAll('[data-pose]').forEach(a=>a.setAttribute('aria-pressed',String(b===a)))};
draw('full');
