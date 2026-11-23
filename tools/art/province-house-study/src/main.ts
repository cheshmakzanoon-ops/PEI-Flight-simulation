import * as T from 'three';
import { porticoStudy } from './portico';
import { stonePoint } from './masonry';

const renderer = new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.02;
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFShadowMap;
document.body.append(renderer.domElement);
const scene=new T.Scene();
const skyGeo=new T.SphereGeometry(280,20,12);
const skyM=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
 vertexShader:`varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec3 ray;
 void main(){vec3 r=normalize(ray);float u=clamp(r.y,0.,1.); float f=.50+.18*sin(9.*r.x+7.*r.y)+.14*sin(18.2*r.z-11.4*r.y)+.09*cos(28.*r.x+11.3*r.z);
  vec3 blue=mix(vec3(.53,.59,.62),vec3(.37,.48,.62),smoothstep(.0,.76,u));
  vec3 light=mix(vec3(.54,.58,.61),vec3(.90,.90,.86),smoothstep(.02,.37,u));
  gl_FragColor=vec4(mix(blue,light,.45+.37*smoothstep(.29,.68,f)),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`
});
const sky=new T.Mesh(skyGeo,skyM);sky.renderOrder=-55;scene.add(sky);
const {stagedGeometry,nearOrders,approachOrders,unworked,neutral,finite}=porticoStudy();
scene.add(stagedGeometry,unworked,neutral);
const camera=new T.PerspectiveCamera(44,innerWidth/innerHeight,.055,430);
const bounce=new T.HemisphereLight(0xe1e6ec,0x766253,1.40);scene.add(bounce);
const sun=new T.DirectionalLight(0xffefdd,2.00);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=20;sun.shadow.camera.bottom=-20;
sun.shadow.camera.near=1;sun.shadow.camera.far=118;sun.shadow.normalBias=.041;sun.shadow.bias=-.000024;
sun.shadow.radius=1.8; sun.target.position.set(0,4,0);scene.add(sun,sun.target);
const rim=new T.DirectionalLight(0xbcd2ee,.27);rim.position.set(26,27,-30);scene.add(rim);
const poses={
  street:{p:[-4.7,3.70,36.7],target:[0,6.28,.30],fov:49},
  bay:{p:[12.45,3.0,18.75],target:[.15,5.35,2.25],fov:45},
  sun:{p:[-15.13,6.40,29.80],target:[1.10,6.38,.5],fov:47},
  capital:{p:[-4.05,9.34,7.83],target:[-3.69,9.53,3.16],fov:34},
  fly:{p:[-34.0,21.60,61.5],target:[1.67,5.27,-4.22],fov:41},
} as const;
function render(candidate:boolean,pose:keyof typeof poses,cloudy=false,lod:'hero'|'approach'|'auto'='hero'){
  const def=poses[pose]; stagedGeometry.visible=candidate;unworked.visible=!candidate;
  const hero = lod==='hero'||(lod==='auto'&&Math.hypot(def.p[0],def.p[1]-6,def.p[2]-3.14)<20);
  nearOrders.visible=hero;approachOrders.visible=!hero;
  camera.fov=def.fov;camera.position.fromArray(def.p);camera.lookAt(new T.Vector3().fromArray(def.target));camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  const s=pose==='capital'?9.6:26;
  sun.shadow.camera.left=-s;sun.shadow.camera.right=s;sun.shadow.camera.top=s*.80;sun.shadow.camera.bottom=-s*.80;
  sun.shadow.normalBias=pose==='capital'?.018:.044;
  sun.shadow.camera.updateProjectionMatrix();
  bounce.intensity=cloudy?2.38:1.58;
  sun.intensity=cloudy?.67:1.94;
  sun.position.set(...(cloudy?[-29,48,27]:[-31,36,22]) as [number,number,number]);
  renderer.render(scene,camera);
  return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,samples:renderer.getContext().getParameter(renderer.getContext().SAMPLES),pose,cloudy,tier:candidate?(hero?"hero":"approach"):"compare"};
}
function inspect(){
  const stat:{detail:number,approach:number,control:number,drawBatches:number,finite:boolean,types:Record<string,number>}={detail:0,approach:0,control:0,drawBatches:stagedGeometry.children.length-1,finite:true,types:finite};
 for(const [node,key] of [[stagedGeometry,'detail'],[stagedGeometry,'approach'],[unworked,'control']] as const)node.traverse(o=>{
  if ((key==='detail'&&o.parent===approachOrders)||(key==='approach'&&o.parent===nearOrders)) return;
  if(!(o instanceof T.Mesh))return;
  const p=o.geometry.getAttribute('position');stat[key]+=p.count/3;
  for(const a of ['position','normal','uv','color']){const b=o.geometry.getAttribute(a);stat.finite=stat.finite&&!!b&&Array.from(b.array).every(Number.isFinite);}
 });
 scene.updateMatrixWorld(true);
 const ray=new T.Raycaster();const transom=[];
 for(const x of [-4.18,0,4.18]){
   for(const y of [1.30,2.85,3.18]){
     ray.set(new T.Vector3(x,y,5.4),new T.Vector3(0,0,-1));
     const hit=ray.intersectObject(stagedGeometry,true).find(h=>h.point.z>-.14);
     transom.push({x,y,firstFrontZ:hit?.point.z??null});
   }
 }
 const insideBays=transom.filter(x=>x.y!==3.18).every(x=>x.firstFrontZ===null||(x.firstFrontZ<1.81));
 const stair=[];
 for(const x of [-4.18,0,4.18]) {
   for(const [z,expected] of [[4.79,-.01],[4.46,.155],[4.01,.310],[3.61,.465],[3.327,.465],[3.296,.465],[2.91,.465],[1.65,.465]] as const){
      // First ray to the nominal public tread or vestibule, not the portico roof above the opening.
      ray.set(new T.Vector3(x,1.05,z),new T.Vector3(0,-1,0));
      const y=ray.intersectObject(stagedGeometry,true)[0]?.point.y ?? ray.intersectObject(neutral,true)[0]?.point.y;
      stair.push({x,z,expected,y});
    }
 }
 const maxStairError=Math.max(...stair.map(a=>Math.abs((a.y??1e6)-a.expected)));
 return {...stat,transom,insideBays,maxStairError,stair};
}
Object.assign(window,{portico:{render,inspect,stonePoint}});
render(true,'street',true,'auto');
