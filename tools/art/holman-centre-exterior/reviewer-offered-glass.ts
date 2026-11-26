import {MeshStandardMaterial} from 'three';

/** Original dark curtainwall approximation. No scene-depth capture,
 * real photo reflection, copied glass pattern or extra pass. */
export function holmanCurtainGlass(reflectionGain=.76){
 if(!Number.isFinite(reflectionGain)||reflectionGain<0||reflectionGain>1)throw Error('Invalid curtainwall gain');
 const m=new MeshStandardMaterial({color:0x263032,roughness:.28,metalness:.16});
 m.name='Holman visual study · dark curtainwall glass';
 m.customProgramCacheKey=()=> 'holman-curtain-2026-v1';
 m.onBeforeCompile=p=>{
  p.uniforms.holmanGlassGain={value:reflectionGain};
  p.vertexShader='varying vec3 hCurtainWorld;varying vec3 hCurtainNormal;\n'+p.vertexShader;
  p.vertexShader=p.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   hCurtainWorld=(modelMatrix*vec4(transformed,1.)).xyz;
   hCurtainNormal=normalize(mat3(modelMatrix)*objectNormal);
  `);
  p.fragmentShader='varying vec3 hCurtainWorld;varying vec3 hCurtainNormal;uniform float holmanGlassGain;\n'+p.fragmentShader;
  p.fragmentShader=p.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   // Broad sky/ground illumination follows view angle; it does not invent
   // windows behind this pane or draw a fake reflection of a known building.
   vec3 curtainV=normalize(cameraPosition-hCurtainWorld),curtainN=normalize(hCurtainNormal);
   float curtainCos=clamp(dot(curtainV,curtainN),0.,1.);
   vec3 curtainR=reflect(-curtainV,curtainN);
   float curtainSky=smoothstep(-.14,.56,curtainR.y);
   float curtainF=.056+.50*pow(1.-curtainCos,5.);
   vec3 curtainAmbient=mix(vec3(.033,.038,.035),vec3(.166,.207,.231),curtainSky);
   totalEmissiveRadiance+=curtainAmbient*(.19+.81*curtainF)*holmanGlassGain;
  `);
 };
 return m;
}
