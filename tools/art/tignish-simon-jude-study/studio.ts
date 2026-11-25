import * as T from 'three';
import {makeTignishBay} from './masonry-bay.ts';
import {rand,tignishCanopy} from './surface.ts';
const W=1110,H=800,scene=new T.Scene();scene.background=new T.Color(0xa7b1ac);scene.fog=new T.Fog(0xa7b1ac,24,79);
const camera=new T.PerspectiveCamera(35.5,W/H,.065,100);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.querySelector('#plate')!.append(renderer.domElement);
function daylight(){
 const w=384,h=192,m=new Float32Array(4*w*h),s=T.MathUtils.smoothstep;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const v=(y+.5)/h,u=(x+.5)/w,bias=.477+.023*Math.sin(u*6.283*6)+.021*Math.sin(u*6.283*13+.75)+.004*Math.cos(u*6.283*39)+.003*Math.sin(u*6.283*73);
  const sky=s(v,bias-.006,bias+.012),white=s(Math.sin(6.283*(5*u+4*v)+Math.sin(66*u+35*v))*.67+.32*Math.sin(91*u-59*v),.18,.65)*(1-s(v,.61,.88)),high=s(v,.53,.84);
  const a=.034*rand(Math.floor(x/3),Math.floor(y/2))+.029*(.5+.5*Math.cos(x*.45+y*.35));
  const upper=[.46+.25*white-.08*high,.58+.25*white-.043*high,.68+.25*white+.083*high];
  const lower=[.044+.87*a,.060+.97*a,.044+.71*a],i=(y*w+x)*4;
  for(let k=0;k<3;k++)m[i+k]=T.MathUtils.lerp(lower[k],upper[k],sky);m[i+3]=1;
 }
 const tex=new T.DataTexture(m,w,h,T.RGBAFormat,T.FloatType);tex.magFilter=tex.minFilter=T.LinearFilter;tex.mapping=T.EquirectangularReflectionMapping;tex.needsUpdate=true;
 const g=new T.PMREMGenerator(renderer),target=g.fromEquirectangular(tex);g.dispose();return {tex,target};
}
const sky=daylight();scene.environment=sky.target.texture;scene.environmentIntensity=1.08;
const ambient=new T.HemisphereLight(0xdce8f2,0x8b766c,1.51);scene.add(ambient);
const sun=new T.DirectionalLight(0xffead0,2.65);sun.position.set(-4.32,7.25,3.82);sun.target.position.set(0,2.05,-.13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-4.1;sun.shadow.camera.right=4.05;sun.shadow.camera.top=4.75;sun.shadow.camera.bottom=-3.8;sun.shadow.camera.near=.2;sun.shadow.camera.far=26;sun.shadow.normalBias=.0025;sun.shadow.bias=-.00013;scene.add(sun,sun.target);
const floor=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0x85857a,roughness:.97}));floor.rotation.x=-Math.PI/2;floor.position.y=.042;floor.receiveShadow=true;scene.add(floor);
const t=tignishCanopy(),leaf=new T.Mesh(
 new T.PlaneGeometry(8.2,7.0),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,alphaMap:t,alphaTest:.48,side:T.DoubleSide}));
leaf.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,alphaMap:t,alphaTest:.48,side:T.DoubleSide});
leaf.position.set(-2.49,5.57,2.57);leaf.rotation.set(-.51,.22,-.39);leaf.castShadow=true;scene.add(leaf);
const bay=makeTignishBay();scene.add(bay);
const glass=bay.getObjectByName('glass')as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
glass.material.onBeforeCompile=shader=>{
 shader.uniforms.bayDaylight={value:sky.tex};
 shader.vertexShader='varying vec3 vBayWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBayWorld=(modelMatrix*vec4(position,1.0)).xyz;');
 shader.fragmentShader='uniform sampler2D bayDaylight;\nvarying vec3 vBayWorld;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
  vec3 bayN=inverseTransformDirection(normal,viewMatrix),bayEye=normalize(cameraPosition-vBayWorld),bayR=reflect(-bayEye,bayN);
  vec2 bayPan=vec2(fract(atan(bayR.z,bayR.x)*.159154943+.50),asin(clamp(bayR.y,-1.,1.))*.318309886+.50);
  vec3 baySky=texture2D(bayDaylight,bayPan).rgb;
  outgoingLight=mix(outgoingLight,baySky,.092+.16*pow(1.-max(0.,dot(bayN,bayEye)),2.));
  #include <opaque_fragment>
 `);
};
glass.material.customProgramCacheKey=()=> 'Tignish studio geometric glass daylight 1';
const poses={
 full:{eye:[4.06,2.84,8.54],aim:[-.02,2.62,.02],fov:35.4,shade:false,canopy:true},
 elevation:{eye:[.42,2.76,8.53],aim:[.04,2.63,.015],fov:36.2,shade:true,canopy:false},
 tracery:{eye:[.67,3.96,3.28],aim:[-.61,3.87,-.02],fov:34.0,shade:false,canopy:false},
 reveal:{eye:[-2.46,2.72,3.27],aim:[-.73,2.72,-.076],fov:36.7,shade:true,canopy:false},
 step:{eye:[3.43,1.73,3.23],aim:[1.45,1.88,.23],fov:41.5,shade:false,canopy:false},
};
function draw(n:keyof typeof poses){
 const p=poses[n];sun.intensity=p.shade?1.34:2.53;ambient.intensity=p.shade?1.80:1.41;leaf.castShadow=p.canopy;
 camera.position.fromArray(p.eye);camera.lookAt(new T.Vector3().fromArray(p.aim));camera.fov=p.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);
}
function shots(n:keyof typeof poses){
 draw(n);return{png:renderer.domElement.toDataURL('image/png'),pose:poses[n],model:bay.children.map(o=>[o.name,(o as T.Mesh).geometry.attributes.position.count/3]),studioCalls:renderer.info.render.calls,studioTriangles:renderer.info.render.triangles};
}
(window as any).tignishBayStudio=shots;
for(const o of document.querySelectorAll<HTMLButtonElement>('[data-shot]'))o.addEventListener('click',()=>{draw(o.dataset.shot as keyof typeof poses);document.querySelectorAll('[data-shot]').forEach(b=>b.setAttribute('aria-pressed',String(o===b)));});
draw('full');
