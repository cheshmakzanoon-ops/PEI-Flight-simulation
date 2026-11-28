import * as T from 'three';
import {makeTignishRoof,type RoofRecipe} from '../roof.ts';
import {makeTignishNaveFinish} from './roof-finish.ts';
import recipeJson from '../fit.json';
const recipe=recipeJson as unknown as RoofRecipe, W=960,H=640;
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(W,H);renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.22;renderer.outputColorSpace=T.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const gl=renderer.getContext() as WebGL2RenderingContext;
const scene=new T.Scene();
scene.background=new T.Color(0x29313b);
const sun=new T.DirectionalLight(0xfff1db,2.2);sun.position.set(-15,24,18);
const ambient=new T.HemisphereLight(0xe7ecf4,0x454b4d,1.28);
scene.add(sun,ambient);
const camera=new T.PerspectiveCamera(42,W/H,.03,500);
const stock=makeTignishRoof(recipe),candidate=makeTignishNaveFinish(recipe);
const root=candidate.group;
stock.position.set(0,0,0);root.position.set(0,0,0);
const black=new T.MeshBasicMaterial({color:0,toneMapped:false}),white=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});
type Angle='south'|'north'|'middle'|'overcast';
function take(angle:Angle){
 const southern=angle!=='north';
 const role='nave-'+(southern?'south':'north')+'-east-segment';
 const focus=candidate.changed.find(x=>x.userData.role===role);
 if(!focus)throw Error('Missing exact focus role');
 const wire=recipe.patches.find(p=>p.id===role)!.planes[0],u=10.7,v=southern?-7.25:2.24;
 const B=recipe.world;
 const target=new T.Vector3(u*B.worldXZPerU[0]+v*B.worldXZPerV[0],wire[0]+wire[1]*u+wire[2]*v-recipe.localYOrigin,
  u*B.worldXZPerU[1]+v*B.worldXZPerV[1]);
 const normals=focus.geometry.attributes.normal,n=new T.Vector3(normals.getX(0),normals.getY(0),normals.getZ(0));
 const d=angle==='middle'?31:angle==='overcast'?11:9;
 const tangent=new T.Vector3(...[B.worldXZPerU[0],0,B.worldXZPerU[1]]).normalize();
 camera.position.copy(target).addScaledVector(n,d).addScaledVector(tangent,d*.46).add(new T.Vector3(0,d*.26,0));
 camera.lookAt(target);camera.updateMatrixWorld();
 sun.intensity=angle==='overcast'?.1:2.2;ambient.intensity=angle==='overcast'?2.25:1.28;
 const materials=candidate.changed.map(x=>x.material);
 function render(group:T.Group,sub?:T.Material){
  if(group.parent)throw Error('No stale studio group');
  if(sub)candidate.changed.forEach(x=>{x.material=sub as T.MeshStandardMaterial;});
  scene.add(group);
  try{
   renderer.render(scene,camera);
   const rgba=new Uint8Array(W*H*4);
   gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   const info=renderer.info.render;
   return {rgba,png:renderer.domElement.toDataURL('image/png'),stats:[info.calls,info.triangles],error:gl.getError()};
  }finally{
   scene.remove(group);
   candidate.changed.forEach((x,i)=>{x.material=materials[i];});
  }
 }
 const s=render(stock),a=render(root),b=render(root,black),w=render(root,white),r=render(stock);
 const sum={visible:0,changed:0,strong:0,exterior:0,alpha:0,restore:0};
 let mean=0;
 for(let i=0;i<s.rgba.length;i+=4){
  const A=Math.max(...[0,1,2].map(k=>w.rgba[i+k]-b.rgba[i+k]))>0;
  const M=Math.max(...[0,1,2].map(k=>Math.abs(a.rgba[i+k]-s.rgba[i+k])));
  sum.visible+=+A;sum.changed+=+(M>0);sum.strong+=+(M>3);sum.exterior+=+(M>0&&!A);
  sum.alpha+=+(s.rgba[i+3]!==a.rgba[i+3]);
  sum.restore+=+([0,1,2,3].some(k=>s.rgba[i+k]!==r.rgba[i+k]));
  if(A)mean+=M;
 }
 const metadata={angle,stats:[s,a,b,w,r].map(z=>z.stats),errors:[s,a,b,w,r].map(z=>z.error),
  rgbaBits:[gl.getParameter(gl.RED_BITS),gl.getParameter(gl.GREEN_BITS),gl.getParameter(gl.BLUE_BITS),gl.getParameter(gl.ALPHA_BITS)],
  samples:gl.getParameter(gl.SAMPLES),sum,meanMaxRgbDelta:mean/Math.max(1,sum.visible),
  camera:[camera.matrixWorldInverse.elements.slice(),camera.projectionMatrix.elements.slice()],
  light:[sun.intensity,ambient.intensity]};
 return {metadata,images:Object.fromEntries(Object.entries({stock:s,finished:a,'black-role':b,'white-role':w,restore:r}).map(([k,v])=>[k,v.png]))};
}
Object.defineProperty(window,'peiNativeRoofFinish',{value:take});
