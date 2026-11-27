import * as T from 'three';
import {artStatus,buildExterior} from './model.ts';

const element=(id:string)=>{
 const found=document.getElementById(id);
 if(!found)throw new Error('Missing review element: '+id);
 return found;
};
const safe=(b:T.Box3)=>!b.isEmpty()&&[...b.min,...b.max].every(Number.isFinite)&&b.max.y>b.min.y;
function normalized(detail:'near'|'mid'){
 const art=buildExterior(detail),bounds=new T.Box3().setFromObject(art);
 if(!safe(bounds))throw new Error('Detached model has no finite height');
 const height=bounds.max.y-bounds.min.y,mid=bounds.getCenter(new T.Vector3());
 const scaled=new T.Group();
 scaled.scale.setScalar(1/height);
 scaled.position.set(-mid.x/height,-bounds.min.y/height,-mid.z/height);
 scaled.add(art);
 art.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=new URLSearchParams(location.search).has('selfShadow');}});
 return {scaled,bounds};
}
const near=normalized('near'),mid=normalized('mid');

const choices=[['Apron side',34],['Straight on',0],['Reciprocal',162]] as const;
let active=0;
const ui=element('angles'),status=element('status');
status.textContent=artStatus;

function makeView(host:HTMLElement,model:T.Group){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(2,Math.max(1.5,window.devicePixelRatio||1)));
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=T.VSMShadowMap;
 host.replaceChildren(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color(0xc6d8e3);scene.fog=new T.FogExp2(scene.background,.042);scene.add(model);
 const hemi=new T.HemisphereLight(0xf5f9ff,0xa39c91,1.55);
 const sun=new T.DirectionalLight(0xfff8f0,2.3);sun.position.set(-2,3.2,2.4);sun.target.position.y=.43;sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-2.8;sun.shadow.camera.right=2.8;
 sun.shadow.camera.bottom=-2.8;sun.shadow.camera.top=2.8;
 sun.shadow.camera.near=.2;sun.shadow.camera.far=12;sun.shadow.normalBias=.0026;sun.shadow.bias=-.00008;sun.shadow.radius=4;sun.shadow.blurSamples=10;
 const floor=new T.Mesh(new T.PlaneGeometry(190,190),new T.MeshStandardMaterial({color:0xa4a99e,roughness:1}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;
 scene.add(floor,hemi,sun,sun.target);
 const env=new T.Scene();
 env.add(new T.Mesh(new T.SphereGeometry(30,32,16),new T.ShaderMaterial({
  side:T.BackSide,
  vertexShader:'varying vec3 v; void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec3 v; void main(){float y=normalize(v).y;vec3 sky=mix(vec3(.87,.91,.98),vec3(.25,.43,.69),smoothstep(0.,.93,y));gl_FragColor=vec4(mix(vec3(.16,.16,.15),sky,smoothstep(-.12,.23,y)),1.);}'
 })));
 const pm=new T.PMREMGenerator(renderer);
 scene.environment=pm.fromScene(env,.035).texture;scene.environmentIntensity=.58;pm.dispose();
 const camera=new T.PerspectiveCamera(32,1,.025,220);
 return {renderer,scene,camera,host};
}
const hero=makeView(element('hero'),near.scaled);
const flight=makeView(element('flight'),mid.scaled);

const thumb={heightCssPx:0};
const crown=new T.Vector3(),foot=new T.Vector3();
function draw(){
 for(const view of [hero,flight]){
  const {renderer,scene,camera,host}=view;
  const w=host.clientWidth,h=host.clientHeight;
  if(w<=0||h<=0)continue;
  renderer.setSize(w,h,false);camera.aspect=w/h;
  const close=view===hero;
  camera.fov=close?32:53;camera.updateProjectionMatrix();
  const rad=choices[active][1]*Math.PI/180;
  // Match the approximate 75 px height in stock Chase screenshots, without
  // pretending this neutral stage recreates the game camera or backdrop.
  let distance=close?2.43:h/(150*Math.tan(53*Math.PI/360));
  for(let i=0;i<(close?1:4);i++){
   camera.position.set(Math.sin(rad)*distance,close?.85:1.03,Math.cos(rad)*distance);
   camera.lookAt(0,close?.51:.47,0);
   camera.updateMatrixWorld(true);
   if(!close){
    crown.set(0,1,0).project(camera);foot.set(0,0,0).project(camera);
    thumb.heightCssPx=(crown.y-foot.y)*h*.5;
    distance*=thumb.heightCssPx/75;
   }
  }
  renderer.render(scene,camera);
 }
}
const buttons=choices.map(([name],i)=>{
 const b=document.createElement('button');b.type='button';b.textContent=name;
 b.setAttribute('aria-pressed',String(i===active));
 b.addEventListener('click',()=>{
  active=i;buttons.forEach((q,k)=>q.setAttribute('aria-pressed',String(i===k)));draw();
 });
 ui.append(b);return b;
});
const resize=new ResizeObserver(draw);
resize.observe(hero.host);resize.observe(flight.host);
draw();
Object.assign(window,{reviewReady:{material:artStatus,sourceBounds:[near.bounds.min.toArray(),near.bounds.max.toArray()],midBounds:[mid.bounds.min.toArray(),mid.bounds.max.toArray()],thumb}});
