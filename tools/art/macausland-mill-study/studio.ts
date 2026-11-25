import * as T from 'three';
import {makeMillFront} from './mill-front.ts';
import {finish,seed} from './finish.ts';
const W=1160,H=798;
const scene=new T.Scene();scene.background=new T.Color(0xa2afb2);scene.fog=new T.Fog(0xa2afb2,18,46);
const camera=new T.PerspectiveCamera(37,W/H,.035,107);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
document.querySelector('#picture')!.append(renderer.domElement);

function atmosphere(){
 const width=384,height=192,pixels=new Float32Array(width*height*4);
 const smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp,aa=Math.PI*2;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=(y+.5)/height;
  const ridge=.504+.022*Math.cos(aa*(u*5-.21))+.014*Math.sin(aa*u*11)+.008*Math.sin(aa*u*29)+.0033*Math.cos(aa*u*63)+.0012*seed(x,17);
  const foliage=.028+.020*Math.cos(aa*u*19)*Math.sin(aa*(v*13-u*8))+.027*seed(x>>1,y>>1);
  const horizon=smooth(v,ridge-.005,ridge+.013);
  const zone=.52+.16*Math.sin(aa*(u*2+v*2))+.13*Math.cos(aa*(u*4+v*5))+.13*Math.sin(aa*(u*6-v*11));
  const cloud=smooth(zone,.34,.74)*(1-.35*smooth(v,.55,.93));
  const high=.5*smooth(v,.58,.94)+.21*cloud;
  const floor=1-.8*smooth(v,.42,.60);
  const land=[.080*floor+foliage,.086*floor+foliage*1.28,.066*floor+foliage*.92];
  const sun=[.36+cloud*.31+high*.14,.49+cloud*.30+high*.13,.62+cloud*.22+high*.19];
  const z=4*(x+y*width);for(let i=0;i<3;i++)pixels[z+i]=lerp(land[i],sun[i],horizon);pixels[z+3]=1;
 }
 const cube=new T.DataTexture(pixels,width,height,T.RGBAFormat,T.FloatType);
 cube.minFilter=cube.magFilter=T.LinearFilter;cube.mapping=T.EquirectangularReflectionMapping;cube.needsUpdate=true;
 const gg=new T.PMREMGenerator(renderer),target=gg.fromEquirectangular(cube);gg.dispose();
 return {cube,target};
}
const skies=atmosphere();scene.environment=skies.target.texture;scene.environmentIntensity=.85;
const sky=new T.HemisphereLight(0xd5e2ec,0x9d927e,1.24);scene.add(sky);
const sun=new T.DirectionalLight(0xffeddb,2.70);sun.position.set(-7.89,12.74,12.4);sun.target.position.set(-.5,1.75,-2.42);
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:9,bottom:-9,near:.24,far:36});
sun.shadow.bias=-.00016;sun.shadow.normalBias=.007;sun.castShadow=true;scene.add(sun,sun.target);
const floorMat=new T.MeshStandardMaterial({...finish('ground'),roughness:1,metalness:.013,normalScale:new T.Vector2(.58,.58)});
floorMat.onBeforeCompile=s=>{
 s.vertexShader='varying vec3 footing;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfooting=(modelMatrix*vec4(position,1.)).xyz;');
 s.fragmentShader='varying vec3 footing;\n'+s.fragmentShader.replace('#include <color_fragment>',`
 #include <color_fragment>
 vec2 p=footing.xz, d=vec2(max(abs(p.x)-5.0,0.0),max(abs(p.y+2.815)-2.815,0.0));
 float r=length(d),h=.72+.16*cos(p.x*8.4+.47*sin(p.y*3.8))+.12*sin(p.y*5.3+p.x*1.4);
 float near=1.-smoothstep(.032,.32+.2*h,r);
 diffuseColor.rgb*=1.-(.23+.105*h)*near;
 `);
};
const slab=new T.Mesh(new T.PlaneGeometry(105,105),floorMat);
const uv=slab.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*42,uv.getY(i)*42);
slab.rotation.x=-Math.PI/2;slab.position.y=-.036;slab.receiveShadow=true;scene.add(slab);
const mill=makeMillFront();scene.add(mill);
const glazing=mill.getObjectByName('real-glazing')as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
// The analytic sky returns a continuous reflected lobe across adjacent true plates of glass.
glazing.material.onBeforeCompile=s=>{
 s.uniforms.millSky={value:skies.cube};
 s.vertexShader='varying vec3 millWS;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmillWS=(modelMatrix*vec4(position,1.)).xyz;');
 s.fragmentShader='uniform sampler2D millSky;\nvarying vec3 millWS;\n'+s.fragmentShader.replace('#include <opaque_fragment>',`
  vec3 nw=inverseTransformDirection(normal,viewMatrix),v=normalize(cameraPosition-millWS),q=reflect(-v,nw);
  vec2 p=vec2(fract(atan(q.z,q.x)*.15915494+.5),asin(clamp(q.y,-1.,1.))*.31830988+.5);
  vec3 b=texture2D(millSky,p).rgb;float fr=pow(1.-max(0.,dot(nw,v)),2.1);
  outgoingLight=mix(outgoingLight,b,.109+.146*fr);
  #include <opaque_fragment>
 `);
};glazing.material.customProgramCacheKey=()=> 'MacAusland procedural cloudy sky v1';
const views={
 full:{eye:[-6.57,1.89,14.22],at:[-.38,2.26,-1.13],fov:31.0,light:2.47},
 elevation:{eye:[.08,1.65,14.21],at:[0,2.16,-.05],fov:34.3,light:1.47},
 service:{eye:[-3.83,2.74,4.25],at:[-1.69,2.61,.10],fov:34.3,light:2.24},
 slider:{eye:[2.43,1.17,4.09],at:[.86,.91,.018],fov:35.2,light:2.63},
 return:{eye:[-10.62,2.13,1.67],at:[-4.81,1.53,-2.26],fov:36.4,light:2.09},
 roof:{eye:[-5.22,7.45,4.12],at:[-1.54,3.02,-1.83],fov:37.3,light:2.38},
};
type View=keyof typeof views;
function draw(name:View){
 const pose=views[name];sun.intensity=pose.light;sky.intensity=name==='elevation'?1.9:1.25;
 camera.position.fromArray(pose.eye);camera.lookAt(new T.Vector3().fromArray(pose.at));camera.fov=pose.fov;
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.render(scene,camera);
}
(window as any).millStudio=(n:View)=>{
 draw(n);return {png:renderer.domElement.toDataURL('image/png'),pose:views[n],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
 parts:mill.children.map(o=>[o.name,(o as T.Mesh).geometry.getAttribute('position').count/3])};
};
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-pose]')){
 b.onclick=()=>{draw(b.dataset.pose as View);document.querySelectorAll('[data-pose]').forEach(a=>a.setAttribute('aria-pressed',String(b===a)));};
}
draw('full');
