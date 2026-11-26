import * as T from 'three';
import {makeHolmanDetached} from './holman-closed-study.ts';
import {makeHolmanFinish,type HolmanFinish} from './holman-exterior-finish.ts';
import {holmanBrickMaterial} from './reviewer-offered-brick.ts';
import {holmanCurtainGlass} from './reviewer-offered-glass.ts';
import frames from './detached-lenses.json';
const [w,h]=frames.size,[near,far]=frames.cameraPlanes,node=makeHolmanDetached();
const s=new T.Scene(),cam=new T.PerspectiveCamera(42,w/h,near,far);
const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,logarithmicDepthBuffer:true,alpha:false});
r.setPixelRatio(1);r.setSize(w,h);r.setClearColor(0x212a33,1);r.outputColorSpace=T.SRGBColorSpace;
r.shadowMap.enabled=true;r.shadowMap.type=T.PCFShadowMap;r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=true;
r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.0;
const sun=new T.DirectionalLight(0xffede1,2.4),hemi=new T.HemisphereLight(0xddeeff,0x655349,frames.ambient);
sun.position.fromArray(frames.mainLight).add(new T.Vector3(40,0,18));sun.target.position.set(40,2,18);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-71,right:71,top:63,bottom:-63,near:14,far:340});sun.shadow.normalBias=.016;sun.shadow.bias=-.000075;
sun.shadow.camera.updateProjectionMatrix();s.add(node.group,hemi,sun,sun.target);
const off=new Map<string,T.Material>(),on=new Map<string,T.Material>(),combined=new Map<string,T.Material>();
for(const obj of node.group.children){
 const m=obj as T.Mesh,role=m.geometry.userData.role as HolmanFinish;
 m.castShadow=true;m.receiveShadow=true;
 off.set(m.name,makeHolmanFinish(role,false));on.set(m.name,makeHolmanFinish(role,true));
 combined.set(m.name,role==='brick'?holmanBrickMaterial(0,.55):role==='curtain'?holmanCurtainGlass(.66):on.get(m.name)!);
}
let warmed=false;
const white=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),black=new T.MeshBasicMaterial({color:0x000000,toneMapped:false});
const change1=['brick','stoneBase','roof','glazing','curtain'],change2=['brick','curtain'];
const gl=r.getContext();document.body.appendChild(r.domElement);
function qa(id:string,mode:string){
 const locked=frames.poses.find(p=>p.id===id);if(!locked)throw Error('unknown pose');
 cam.fov=locked.fov;cam.position.fromArray(locked.eye);cam.lookAt(new T.Vector3().fromArray(locked.target));cam.updateProjectionMatrix();
 if(!warmed){
  for(const m of node.group.children as T.Mesh[])m.material=off.get(m.name)!;
  r.render(s,cam);warmed=true;
 }
 const mask=mode==='mask1'||mode==='mask2'||mode==='maskView',list=mode==='mask1'?change1:mode==='mask2'?change2:undefined;
 r.setClearColor(mask?0:0x212a33,1);
 for(const m of node.group.children as T.Mesh[])m.material=mask?(list===undefined||list.includes(m.name)?white:black):
  mode==='plain'?off.get(m.name)!:mode==='photo'?on.get(m.name)!:mode==='combined'?combined.get(m.name)!:(()=>{throw Error('unknown variant')})();
 r.render(s,cam);
 return {frame:r.domElement.toDataURL(),gl:gl.getError(),calls:r.info.render.calls,triangles:r.info.render.triangles,eyes:cam.position.toArray(),programs:r.info.programs?.length??0,matrix:[...cam.matrixWorld.elements,...cam.projectionMatrix.elements]};
}
Object.assign(window,{holmanStudioQA:qa,shaInfo:{schema:Object.keys(node.roleTriangles),revision:T.REVISION}});
