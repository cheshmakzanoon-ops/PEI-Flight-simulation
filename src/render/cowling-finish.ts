import {Vector3, type MeshStandardMaterial} from 'three';

/**
 * Original Survey 01 maintenance-panel finish. Coordinates are aircraft-local
 * metres. The existing pilot-view dome retains its geometry and material flags.
 * Derivative-filtered pigment and roughness need no new texture or UVs.
 */
const finish = /* glsl */`
varying vec3 vSurveySkin;
float surveyStroke(float d,float r,float px) {
 return 1.0-smoothstep(max(0.0,r-px),r+px,abs(d));
}
`;
const pigment = /* glsl */`
vec2 uvCowl = vec2(abs(vSurveySkin.x),vSurveySkin.z);
vec2 cowlFootprint = max(fwidth(uvCowl),vec2(.0001));
float panelS = uvCowl.y + 2.125 + .155*uvCowl.x*uvCowl.x;
float ps = max(fwidth(panelS),.0001);
float cowlTop = smoothstep(.12,.32,vSurveySkin.y);
float finiteSpan = 1.0-smoothstep(.44,.49,uvCowl.x);
float readable = 1.0-smoothstep(.009,.032,ps);
float shutline=surveyStroke(panelS,.0024,ps*.72)*finiteSpan;
float chamfer=surveyStroke(panelS-.006,.0019,ps*.67)*finiteSpan;
float sideSpan=smoothstep(-3.50,-3.31,uvCowl.y)*(1.0-smoothstep(-2.32,-2.13,uvCowl.y));
float split=surveyStroke(uvCowl.x-(.332+.09*(uvCowl.y+2.20)),.0017,cowlFootprint.x*.72)*sideSpan;
float fastenerOffset=min(abs(uvCowl.x-.168),min(abs(uvCowl.x-.275),abs(uvCowl.x-.361)));
vec2 buttonUV=vec2(fastenerOffset,panelS+.034);
float buttonDist=length(buttonUV),aaButton=max(fwidth(buttonDist),.0001);
float bezel=surveyStroke(buttonDist,.009,aaButton*.68);
float flushPaintedHead=surveyStroke(length(buttonUV-vec2(.0,.0015)),.0062,aaButton*.67);
float slot=surveyStroke(buttonUV.y+.19*buttonUV.x,.0012,cowlFootprint.y*.65)*
 surveyStroke(buttonUV.x,.0043,cowlFootprint.x*.65);
float flange=smoothstep(-.018,-.003,panelS)*(1.0-smoothstep(.049,.063,panelS))*finiteSpan;
// The access cover is not mirrored: the filler and latch live on one side.
vec2 hatchUV=vec2(vSurveySkin.x-.148,panelS+.186);
vec2 hatchBox=abs(hatchUV)-vec2(.060,.056);
float hatchEdge=length(max(hatchBox,0.0))+min(max(hatchBox.x,hatchBox.y),0.0)-.011;
float hatchFootprint=max(fwidth(hatchEdge),.0001);
float hatchLip=surveyStroke(hatchEdge,.0021,hatchFootprint*.64);
float hatchPaint=1.0-smoothstep(-.007,-.0005,hatchEdge);
vec2 latchUV=hatchUV-vec2(0.025,.030);
float latch=surveyStroke(length(latchUV),.007,aaButton*.61);
float cowlDepth=smoothstep(-3.55,-3.37,vSurveySkin.z)*(1.0-smoothstep(-2.02,-1.96,vSurveySkin.z));
float sc=readable*cowlTop*cowlDepth;
diffuseColor.rgb*=1.0+sc*(.063*chamfer-.23*shutline-.13*split-.15*bezel+.145*flushPaintedHead-.15*slot-.05*flange-.11*hatchLip-.024*hatchPaint-.095*latch);
`;
function once(src:string,needle:string,value:string) {
 const i=src.indexOf(needle);
 return i>=0&&src.indexOf(needle,i+needle.length)<0?src.slice(0,i)+value+src.slice(i+needle.length):undefined;
}

export function surveyedCowlingFinish(stock:MeshStandardMaterial,datum?:Readonly<{scale:Vector3;offset:Vector3}>) {
 const skin=stock.clone();
 skin.name='Survey 01 • factory paint, cowl joint and flush fasteners';
 skin.customProgramCacheKey=()=> 'survey-01/pilot-cowl-finish';
 skin.onBeforeCompile=shader=>{
  const stage=once(shader.vertexShader,'#include <common>',
    '#include <common>\nvarying vec3 vSurveySkin;\nuniform vec3 surveySkinScale;\nuniform vec3 surveySkinOffset;');
  const v=stage&&once(stage,'#include <begin_vertex>',
    '#include <begin_vertex>\nvSurveySkin=transformed*surveySkinScale+surveySkinOffset;');
  const shared=once(shader.fragmentShader,'#include <common>','#include <common>\n'+finish);
  const pigmentStage=shared&&once(shared,'#include <color_fragment>','#include <color_fragment>\n'+pigment);
  const f=pigmentStage&&once(pigmentStage,'#include <roughnessmap_fragment>',
    '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+sc*(.10*shutline+.075*hatchLip+.046*hatchPaint-.08*flushPaintedHead-.042*latch),.04,1.0);');
  if(v&&f){
   shader.uniforms.surveySkinScale={value:datum?.scale??new Vector3(1,1,1)};
   shader.uniforms.surveySkinOffset={value:datum?.offset??new Vector3()};
   shader.vertexShader=v;
   shader.fragmentShader=f;
  }
 };
 return skin;
}
