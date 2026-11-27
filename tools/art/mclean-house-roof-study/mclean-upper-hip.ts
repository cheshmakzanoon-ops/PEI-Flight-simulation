import * as T from 'three';
import {MCLEAN_UPPER_HIP as model} from './mclean-upper-hip.generated.ts';

/** An isolated four-plane source witness, not a complete historic roof.
 * The bottom closes the mathematical study at a chosen inward section
 * (23.8m), not an observed eave nor a game collision or mounting height.
 */
export function createMcLeanUpperHipWitness(){
 const positions:number[]=[],slates:number[]=[],role:number[]=[];
 for(let j=0;j<model.indices.length;j+=3){
  const points=[0,1,2].map(k=>model.vertices[model.indices[j+k]]);
  const address=model.roles[j/3],roof=address!=='sealedBaseWitness';
  for(const [u,y,v] of points){
   positions.push(u,y-model.baseY,v);
   slates.push(address==='westRise'||address==='eastFall'?v:u,y-model.baseY);
   role.push(Number(roof));
  }
 }
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 g.setAttribute('hipSlate',new T.Float32BufferAttribute(slates,2));
 g.setAttribute('hipRoof',new T.Float32BufferAttribute(role,1));
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 const m=new T.MeshStandardMaterial({color:0x454a4e,roughness:.88,metalness:0,side:T.FrontSide});
 m.onBeforeCompile=(sh)=>{
  const vp='#include <color_vertex>',fp='#include <color_fragment>';
  if(sh.vertexShader.split(vp).length!==2||sh.fragmentShader.split(fp).length!==2)return;
  sh.vertexShader='attribute vec2 hipSlate;attribute float hipRoof;varying vec2 hipSlateV;varying float hipRoofV;\n'+
   sh.vertexShader.replace(vp,vp+'\n hipSlateV=hipSlate;hipRoofV=hipRoof;');
  sh.fragmentShader=/* glsl */`
varying vec2 hipSlateV;varying float hipRoofV;
float slatePalette(vec2 a){a=fract(a*vec2(.1031,.11369));a+=dot(a,a.yx+19.19);return fract((a.x+a.y)*a.x);}
float upperHipCourse(vec2 v){
 vec2 q=vec2(v.x/.30,v.y/.12),p=fwidth(q);
 float fade=1.-smoothstep(.28,1.0,max(p.x,p.y));
 if(fade<=.002)return 1.;
 float row=floor(q.y);
 float u=q.x+.47*mod(row,2.)+.08*(slatePalette(vec2(row,8.))-0.5);
 vec2 f=fract(vec2(u,q.y));
 float gutter=1.-smoothstep(.025,.08+max(.008,p.x*.38),min(f.x,1.-f.x));
 float lap=1.-smoothstep(.017,.074+max(.01,p.y*.35),f.y);
 float tone=(slatePalette(vec2(floor(u),row))-.5)*.19;
 float edge=(.14*gutter+.18*lap);
 return 1.+fade*(tone-edge);
}
`+sh.fragmentShader.replace(fp,fp+'\n if(hipRoofV>.5)diffuseColor.rgb*=upperHipCourse(hipSlateV);');
 };
 m.customProgramCacheKey=()=> 'mclean-upper-hip-witness-v1';
 const mesh=new T.Mesh(g,m);
 mesh.name='McLean House Inn – detached measured upper hip';
 mesh.castShadow=false;mesh.receiveShadow=false;
 return Object.freeze({mesh,triangles:model.indices.length/3,close(){mesh.removeFromParent();g.dispose();m.dispose();}});
}
