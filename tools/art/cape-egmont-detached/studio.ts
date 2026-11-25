import * as T from 'three';
import {egmontTower} from './tower.ts';
const scene=new T.Scene(),r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
r.setSize(innerWidth,innerHeight);r.shadowMap.enabled=true;r.toneMapping=T.ACESFilmicToneMapping;r.outputColorSpace=T.SRGBColorSpace;
scene.background=new T.Color(0xcbdce0);
const sun=new T.DirectionalLight(0xfff0d6,2.8);sun.position.set(14,26,8);sun.castShadow=true;sun.target.position.y=6;
sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.bottom=-12;sun.shadow.camera.top=12;sun.shadow.normalBias=.025;sun.shadow.bias=-.00016;
scene.add(sun,sun.target,new T.HemisphereLight(0xb3dcff,0xad9380,1.38));
const horizon=new T.Scene();
horizon.add(new T.Mesh(new T.SphereGeometry(20,32,12),new T.ShaderMaterial({side:T.BackSide,
 vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec3 v;void main(){vec3 d=normalize(v);vec3 sky=mix(vec3(.83,.90,.96),vec3(.28,.52,.78),smoothstep(0.,.88,d.y));vec3 earth=vec3(.17,.14,.11);gl_FragColor=vec4(mix(earth,sky,smoothstep(-.08,.22,d.y)),1.);}`
})));
const pm=new T.PMREMGenerator(r);scene.environment=pm.fromScene(horizon,.02).texture;scene.environmentIntensity=.63;pm.dispose();
const pad=new T.Mesh(new T.PlaneGeometry(110,110),new T.MeshStandardMaterial({color:0x8f9982,roughness:1}));pad.rotation.x=-Math.PI/2;pad.receiveShadow=true;pad.position.y=-.023;scene.add(pad);
const art=egmontTower();art.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=!(o.material instanceof T.MeshPhysicalMaterial&&o.material.transmission>0);o.receiveShadow=true;}});scene.add(art);
const q=new URLSearchParams(location.search),c=new T.PerspectiveCamera(31,innerWidth/innerHeight,.1,150);
if(q.has('deck')){c.position.set(13,11.1,9);c.lookAt(0,10.9,0);}
else if(q.has('weather')){c.position.set(11,3.8,6);c.lookAt(2,3.65,0);}
else {c.position.set(29,8.65,18);c.lookAt(0,6.73,0);}
document.body.append(r.domElement);r.render(scene,c);
const bound=new T.Box3().setFromObject(art);
Object.assign(window,{ready:{triangles:r.info.render.triangles,draws:r.info.render.calls,bounds:[bound.min.toArray(),bound.max.toArray()]}});
