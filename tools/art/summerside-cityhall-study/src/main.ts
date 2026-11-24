import * as T from 'three';
import {buildCityHall} from './cityhall-model.ts';
import {makeMaterial} from './cityhall-materials.ts';
const query=new URLSearchParams(location.search),pose=query.get('pose')??'southwest',closed=query.get('annex')==='survey2020';
const p={
 southwest:{eye:[-45,13.5,46],target:[-.5,9.5,1.8],f:46},
 aerial:{eye:[-47,42.8,73],target:[2,9.4,1],f:46},
 clock:{eye:[-21,23.75,12.65],target:[-12.44,21.5,-.37],f:40},
 masonry:{eye:[-25.5,4.75,10.0],target:[-14.00,4.07,.55],f:47},
 southBay:{eye:[-2.8,6.82,21.65],target:[5.72,7.33,9.06],f:49},
 westBays:{eye:[-31,7.16,4.22],target:[-14.92,6.54,-.73],f:46},
 street:{eye:[-42,6.70,45.5],target:[-1,11.0,1.4],f:45},
 roof:{eye:[-2.1,47.4,66],target:[4.3,11.5,0],f:42},
 northeast:{eye:[32.4,18.9,-43.6],target:[1.4,10.1,0],f:48},
}[pose]??{eye:[-45,13.5,46],target:[-.5,9.5,1.8],f:46};
const cloudy=query.has('overcast');
const s=new T.Scene(),r=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
r.setPixelRatio(1);r.setSize(innerWidth,innerHeight);r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.0;
r.shadowMap.enabled=true;r.shadowMap.type=T.PCFShadowMap;
document.body.append(r.domElement);
const cam=new T.PerspectiveCamera(p.f,innerWidth/innerHeight,.08,550);cam.position.fromArray(p.eye);cam.lookAt(...p.target as [number,number,number]);
const skyV=`
 varying vec3 vP;
 void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
const skyF=`
 varying vec3 vP;
 float h(vec2 p){vec3 c=fract(vec3(p.xyx)*.1031);c+=dot(c,c.yzx+33.33);return fract((c.x+c.y)*c.z);}
 float noise(vec2 q){vec2 p=floor(q),x=fract(q);x=x*x*(3.-2.*x);return mix(mix(h(p),h(p+vec2(1,0)),x.x),mix(h(p+vec2(0,1)),h(p+vec2(1)),x.x),x.y);}
 void main(){
  vec3 d=normalize(vP);float y=max(d.y,0.); vec3 sky=mix(vec3(.53,.66,.74),vec3(.22,.43,.66),pow(y,.56));
  vec2 u=d.xz*(3.0/(.14+max(.0,d.y)))+vec2(15.,-3.);
  float mass=.61*noise(u)+.25*noise(u*2.06)+.11*noise(u*4.1)+.04*noise(u*8.);
  float co=smoothstep(.53,.85,mass)*smoothstep(-.012,.155,d.y);
  vec3 cloud=mix(vec3(.59,.66,.69),vec3(.86,.89,.88),smoothstep(.6,.84,mass));
  gl_FragColor=vec4(mix(sky,cloud,co*.85),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }
`;
const sky=new T.Mesh(new T.SphereGeometry(450,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:skyV,fragmentShader:skyF}));
sky.position.copy(cam.position);sky.renderOrder=-999;s.add(sky);
const hemi=new T.HemisphereLight(cloudy?0xedf5fe:0xe2edfb,0x9e815d,cloudy?2.36:1.45);
const sun=new T.DirectionalLight(cloudy?0xe7eff4:0xffead0,cloudy?.74:2.19);
sun.position.set(-36,55,44);sun.target.position.set(0,4,2);sun.castShadow=true;sun.shadow.camera.near=6;sun.shadow.camera.far=118;
sun.shadow.camera.left=-27;sun.shadow.camera.right=27;sun.shadow.camera.bottom=-23;sun.shadow.camera.top=27;
sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00021;sun.shadow.normalBias=.041;sun.shadow.radius=2.7;
s.add(hemi,sun,sun.target);
const plane=new T.PlaneGeometry(800,800);
plane.rotateX(-Math.PI*.5);const pu=plane.attributes.uv,pw=plane.attributes.position;
for(let i=0;i<pu.count;i++)pu.setXY(i,pw.getX(i),pw.getZ(i));
const floor=new T.Mesh(plane,makeMaterial('pavement'));floor.position.y=-.081;floor.receiveShadow=true;s.add(floor);
const {model,count}=buildCityHall(closed);s.add(model);s.updateMatrixWorld(true);
r.render(s,cam); r.render(s,cam);
Object.assign(window,{cityHallReview:{active:'detached',annex:closed,eye:cam.position.toArray(),target:p.target,count,draws:r.info.render.calls,triangles:r.info.render.triangles,shadowMap:2048,assetRequests:0},cityHallStill:()=>r.domElement.toDataURL('image/png')});
