import * as T from 'three';
import {SHADOW_FIELD} from './basilica-cast-glsl.ts';

export type CastRole='land'|'walk'|'road';
export type SunUniforms={bsLive:{value:number},bsSourceDepth:{value:T.DepthTexture}};
export function one(s:string,a:string,insert:string){
 if(s.split(a).length!==2)throw Error('Basilica sunlight: unexpected shader surface');return s.replace(a,insert);
}
const fn=(s:string)=>one(s,'void main()',SHADOW_FIELD+'\nvoid main()');
const classic=(s:string)=>one(s,'#include <common>','#include <common>\nvarying vec3 bsPhysicalP;\n');
/** Receivers use original world positions and retain their own light and coordinate conventions. */
export function castMaterial(d:T.Material,role:CastRole,u:SunUniforms):T.Material{
 if(role==='land'||role==='walk'){
  const src=d as T.ShaderMaterial;if(!src.isShaderMaterial||src.glslVersion===T.GLSL3)throw Error('unrecognized ground material');
  const m=src.clone();m.uniforms={...src.uniforms,...u};
  const base=role==='land'?'col*=.90+.31*light;':'c*=.655+.44*slope;';
  const replacement=role==='land'?`vec3 bsFacet=normalize(cross(terrainDx,terrainDy));if(bsFacet.y<0.)bsFacet=-bsFacet;float bsShade=basilicaDirect(p,bsFacet);
   if(bsShade>0.)col*=.90+.31*light*(1.-bsShade);else ${base}`:
   `float bsShade=basilicaDirect(wp,n);if(bsShade>0.)c*=.655+.44*slope*(1.-bsShade);else ${base}`;
  // Keep the original function/joints/sun/fog and unrelated layer expressions intact.
  m.fragmentShader=one(fn(src.fragmentShader),base,replacement);m.name='Basilica bounded sun · '+role;return m;
 }
 const src=d as T.MeshStandardMaterial;if(!src.isMeshStandardMaterial)throw Error('unrecognized lit material');
 const m=src.clone(),before=src.onBeforeCompile,programKey=src.customProgramCacheKey();m.name='Basilica bounded sun · '+role+' · '+src.name;
 m.customProgramCacheKey=()=>programKey+':basilica-sun-1-'+role;
 m.onBeforeCompile=(shader,r)=>{
  before.call(src,shader,r);Object.assign(shader.uniforms,u);
  shader.vertexShader=one(classic(shader.vertexShader),'#include <project_vertex>',
   'bsPhysicalP=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>\n');
  shader.fragmentShader=one(classic(shader.fragmentShader),'#include <lights_fragment_end>',`
   #include <lights_fragment_end>
   vec3 bsNormal=normalize(cross(dFdx(bsPhysicalP),dFdy(bsPhysicalP)));
   if(bsNormal.y<0.)bsNormal=-bsNormal;
   float bsShade=basilicaDirect(bsPhysicalP,bsNormal);
   if(bsShade>0.){reflectedLight.directDiffuse*=1.-bsShade;reflectedLight.directSpecular*=1.-bsShade;}`);
  shader.fragmentShader=fn(shader.fragmentShader);
 };
 return m;
}
