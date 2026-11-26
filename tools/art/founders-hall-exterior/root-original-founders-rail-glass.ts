import {MeshStandardMaterial} from 'three';

/** Original depth-tested glazing finish for the existing curved apertures.
 * The geometry supplies the arch and real dividers. The shader does not
 * paint fake windows or a photograph of the surrounding port. */
export function foundersRailGlass(finish=.84,skyGain=1){
 if(!Number.isFinite(finish+skyGain)||finish<0||finish>1||skyGain<0||skyGain>1.15)
  throw Error('Glazing finish is outside the source study range');
 const m=new MeshStandardMaterial({color:0x303a3c,metalness:.065,roughness:.255});
 m.name='Founders study · arched rail-shop glazing';
 m.customProgramCacheKey=()=> 'founders-curved-rail-glass-v1';
 m.onBeforeCompile=p=>{
  p.uniforms.railStudyGain={value:finish};
  p.uniforms.railStudySky={value:skyGain};
  p.vertexShader='varying vec3 railWindowPoint,railWindowN;varying vec2 railPaneMeter;\n'+p.vertexShader;
  p.vertexShader=p.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   railWindowPoint=(modelMatrix*vec4(transformed,1.)).xyz;
   railWindowN=inverseTransformDirection(normalize(normalMatrix*objectNormal),viewMatrix);
   railPaneMeter=position.xy;
  `);
  p.fragmentShader='varying vec3 railWindowPoint,railWindowN;varying vec2 railPaneMeter;uniform float railStudyGain,railStudySky;\n'+p.fragmentShader;
  p.fragmentShader=p.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 railEye=normalize(cameraPosition-railWindowPoint);
   vec3 railFace=normalize(railWindowN);
   float detail=1.-smoothstep(.016,.15,length(fwidth(railPaneMeter)));
   float ripple=(sin(railPaneMeter.x*.52+railPaneMeter.y*.35)*.003+
                 sin(railPaneMeter.x*.96-railPaneMeter.y*.41)*.0013)*detail;
   vec3 railLocalN=normalize(railFace+vec3(ripple,2.*ripple,-ripple));
   vec3 skyRay=reflect(-railEye,railLocalN);
   float atAngle=1.-clamp(dot(railEye,railLocalN),0.,1.);
   float glassF=.046+.55*pow(atAngle,5.);
   float horizon=smoothstep(-.22,.48,skyRay.y);
   vec3 greyGround=vec3(.035,.039,.038);
   vec3 coastalSky=mix(vec3(.118,.158,.169),vec3(.230,.277,.304),horizon);
   vec3 broadDirection=mix(greyGround,coastalSky,smoothstep(-.28,.10,skyRay.y));
   totalEmissiveRadiance+=broadDirection*(.13+.70*glassF)*railStudyGain*railStudySky;
  `);
 };
 return m;
}
