import * as T from 'three';
import {buildElmiraTrackside} from './trackside.ts';
const w=1000,h=760;
const scene=new T.Scene();scene.background=new T.Color(0xbdc1b5);scene.fog=new T.FogExp2(0xbdc1b5,.052);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(w,h,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.querySelector('#stage')!.append(renderer.domElement);
const camera=new T.PerspectiveCamera(42,w/h,.035,55);
// Synthetic daylight for view-sensitive glazing. No photography is shipped or sampled.
function analyticSky(){
 const W=256,H=128,field=new Float32Array(4*W*H),smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp;
 const ridge=(u:number)=>.443+.020*Math.sin(u*Math.PI*12+.93)+.014*Math.sin(u*Math.PI*24+Math.sin(u*Math.PI*8))+.012*Math.cos(u*Math.PI*62);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const u=(x+.5)/W,v=(y+.5)/H,n=ridge(u),sky=smooth(v,n-.009,n+.011),s=smooth(v,.44,.83);
  const p=.67*Math.sin((u*6+v*5)*Math.PI*2)*Math.cos(2*Math.PI*(v*6-.5*Math.sin(u*8*Math.PI)))+.26*Math.cos(2*Math.PI*(u*14+v*18))+.09*Math.sin(2*Math.PI*(v*37-u*32));
  const c=smooth(p,.03,.33)*(1-smooth(v,.59,.83))*sky,edge=smooth(v,.30,.47);
  const color=[lerp(.21,.28,s),lerp(.26,.46,s),lerp(.27,.64,s)],ground=[lerp(.076,.050,edge),lerp(.092,.061,edge),lerp(.070,.047,edge)];
  const i=4*(x+y*W);
  for(let k=0;k<3;k++)field[i+k]=lerp(ground[k],1.32*color[k]+(.59+.09*k)*c,sky);field[i+3]=1;
 }
 const tex=new T.DataTexture(field,W,H,T.RGBAFormat,T.FloatType);tex.mapping=T.EquirectangularReflectionMapping;tex.needsUpdate=true;
 const gen=new T.PMREMGenerator(renderer),target=gen.fromEquirectangular(tex);gen.dispose();tex.dispose();return target;
}
scene.environment=analyticSky().texture;scene.environmentIntensity=1.04;
scene.add(new T.HemisphereLight(0xcce2fe,0x8d8067,1.35));
const sun=new T.DirectionalLight(0xffecd2,2.5);sun.position.set(-3.65,4.25,4.18);sun.target.position.set(0,1,.05);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-3.5,right:3.5,top:3.5,bottom:-3.5,near:.4,far:17});sun.shadow.bias=-.00014;sun.shadow.normalBias=.002;sun.shadow.radius=3.2;scene.add(sun,sun.target);
const plane=new T.Mesh(new T.PlaneGeometry(50,50),new T.MeshStandardMaterial({color:0xa39b87,roughness:.95}));plane.rotation.x=-Math.PI/2;plane.position.y=-.173;plane.receiveShadow=true;scene.add(plane);
const model=buildElmiraTrackside();scene.add(model);scene.updateMatrixWorld(true);
const rc=new T.Raycaster();
function ray(p:number[],d:number[]){rc.set(new T.Vector3().fromArray(p),new T.Vector3().fromArray(d).normalize());return rc.intersectObject(model,true).slice(0,1).map(s=>({part:s.object.name,point:s.point.toArray().map(x=>+x.toFixed(4))}))[0]??null}
const probes=()=>{
 const panes=(model.userData.glassCenters as {cx:number;cy:number}[]).map(c=>ray([c.cx,c.cy,2],[0,0,-1]));
 return {panes,rail:ray([-.24,1.71,1.75],[0,0,-1]),bracket:ray([1.15,2.70,.92],[0,0,-1]),eave:ray([.35,2.76,.82],[0,1,0]),roof:ray([.52,3.6,1.009],[0,-1,0]),wall:ray([.6,2.01,1.7],[0,0,-1]),foot:ray([.6,.31,1.7],[0,0,-1]),platform:ray([.6,1.,.44],[0,-1,0])};
}
const poses={assembly:{eye:[2.98,2.14,5.94],look:[0,1.56,.32]},underEave:{eye:[2.92,1.36,2.96],look:[.22,2.00,.17]},sash:{eye:[.39,1.72,2.43],look:[-.19,1.72,.04]},bracket:{eye:[2.70,2.33,2.05],look:[1.09,2.61,.31]},roof:{eye:[2.35,4.15,3.08],look:[.06,2.54,.41]}};
let current:keyof typeof poses='assembly';
function render(name:keyof typeof poses){
 const p=poses[name];current=name;camera.position.fromArray(p.eye);camera.lookAt(new T.Vector3().fromArray(p.look));camera.updateMatrixWorld(true);renderer.render(scene,camera);
}
function capture(name:keyof typeof poses){
 render(name);return {png:renderer.domElement.toDataURL('image/png'),camera:poses[name],draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,parts:model.children.map(child=>({name:child.name,triangles:(child as T.Mesh).geometry.getAttribute('position').count/3})),probes:probes()};
}
(window as any).elmiraStudy=capture;
for(const e of document.querySelectorAll<HTMLButtonElement>('[data-pose]'))e.onclick=()=>{render(e.dataset.pose as typeof current);document.querySelectorAll('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(e===b)))};
render(current);
