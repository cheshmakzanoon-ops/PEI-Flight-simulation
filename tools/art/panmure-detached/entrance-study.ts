/** Detached access carpentry for proportions only. Neither as-built ramps nor
 * an accessible/takeoff surface. Authored form; no source textures. */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const grain=/* glsl */`
float carpentryHash(vec2 p){return fract(sin(dot(p,vec2(23.141,43.821)))*32532.22);}
`;
const timber=new T.MeshStandardMaterial({color:0x9a8773,roughness:.93});
timber.onBeforeCompile=shader=>{
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 woodP;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nwoodP=position;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 woodP;'+grain)
   .replace('#include <color_fragment>',`#include <color_fragment>
    float continuous=sin(31.*woodP.x+2.1*sin(2.1*woodP.z)+.57*sin(39.*woodP.z))
      +sin(83.6*woodP.x+.94*sin(15.*woodP.z));
    float fineLo=.92+.038*continuous;
    float shifts=carpentryHash(floor(vec2(woodP.z*6.25,woodP.y*13.)));
    float joint=1.-smoothstep(.005,.045,fract(woodP.z*6.25));
    diffuseColor.rgb*=fineLo*(.96+.08*shifts)*(1.-.14*joint);
   `);
};
timber.customProgramCacheKey=()=> 'panmure-private-carpentry-v1';

export function detachedEntrance(){
 const root=new T.Group();root.name='Detached speculative entrance';
 root.userData.asBuilt=false;
 const buffers:T.BufferGeometry[]=[];
 function block(x:number,y:number,z:number,a:number,b:number,c:number){
  buffers.push(new T.BoxGeometry(a,b,c).toNonIndexed().translate(x,y,z));
 }
 function rail(a:T.Vector3,b:T.Vector3,w:number,h=w){
  const u=b.clone().sub(a),distance=u.length(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),u.normalize());
  const g=new T.BoxGeometry(distance,h,w).toNonIndexed();
  const pos=a.clone().lerp(b,.5),matrix=new T.Matrix4().compose(pos,q,new T.Vector3(1,1,1));
  buffers.push(g.applyMatrix4(matrix));
 }
 // Local +X is the authoring door sector, not a real surveyed bearing.
 const deckStart=4.16,lip=5.62,half=1.02,top=.61;
 for(let n=0;n<8;n++){
  const w=(lip-deckStart)/8;
  block(deckStart+(n+.5)*w,top-.027,0,w-.011,.054,half*2);
 }
 for(const z of [-.91,.91])block((deckStart+lip)*.5,top-.15,z,lip-deckStart,.245,.112);
 for(const x of [4.46,5.45])for(const z of [-.79,.79])block(x,.285,z,.14,.57,.14);
 for(let n=0;n<4;n++){
  const xx=lip+(n+.5)*.245,yy=top-(n+1)*.126;
  block(xx,yy,0,.259,.045,half*1.95);
  block(xx+.111,yy-.064,0,.032,.128,half*1.9);
 }
 for(const side of [-1,1]){
  const z=side*.92;
  for(const [x,y] of [[4.44,top],[lip,top],[lip+.91,.1]]){
   block(x,y+.435,z,.097,.91,.097);
   block(x,y+.909,z,.129,.054,.129);
  }
  rail(new T.Vector3(4.42,top+.824,z),new T.Vector3(lip,top+.824,z),.085,.092);
  rail(new T.Vector3(lip,top+.824,z),new T.Vector3(lip+.94,.93,z),.085,.092);
  for(let i=1;i<5;i++){
   const x=4.44+i*(lip-4.44)/5;
   block(x,top+.385,z,.041,.77,.043);
  }
 }
 const merged=mergeGeometries(buffers);
 for(const b of buffers)b.dispose();
 if(!merged)throw Error('Authored entrance geometry cannot be assembled');
 merged.computeBoundingBox();merged.computeBoundingSphere();
 const mesh=new T.Mesh(merged,timber);
 mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 return root;
}
