import {MeshStandardMaterial} from 'three';
/** Original detached optical cue only. Samples no image, existing scene
 * environment, window interior, or actual location weather. */
export function patchKentGlass(fragment:string){
 const common='#include <common>',opaque='#include <opaque_fragment>';
 if([common,opaque].some(k=>fragment.indexOf(k)<0||fragment.indexOf(k)!==fragment.lastIndexOf(k))||fragment.includes('peiKentGlazing'))return;
 const gl=/* glsl */`
vec3 peiKentGlazing(vec3 lit,vec3 N,vec3 E){
 vec3 n=normalize(N),e=normalize(E),r=inverseTransformDirection(reflect(-e,n),viewMatrix);
 float sky=smoothstep(-.24,.50,r.y),horizon=1.-smoothstep(.035,.42,abs(r.y-.040));
 vec3 organic=mix(vec3(.032,.042,.052),vec3(.106,.157,.197),sky);
 organic=mix(organic,vec3(.144,.160,.168),.34*horizon);
 float graze=pow(1.-clamp(dot(n,e),0.,1.),4.);
 return mix(lit*.83,organic,.43+.23*graze);
}
`;
 return fragment.replace(common,common+'\n'+gl).replace(opaque,
  'outgoingLight=peiKentGlazing(outgoingLight, normal, isOrthographic ? vec3(0.,0.,1.) : normalize(vViewPosition));\n'+opaque);
}
export function makeKentGlass(){
 const material=new MeshStandardMaterial({name:'Detached Inn / analytic old pane',color:0x32424e,roughness:.27,metalness:0});
 material.onBeforeCompile=q=>{const stage=patchKentGlass(q.fragmentShader);if(stage)q.fragmentShader=stage;};
 material.customProgramCacheKey=()=> 'pei-inn-kent-detached-glass-v1';
 return material;
}
