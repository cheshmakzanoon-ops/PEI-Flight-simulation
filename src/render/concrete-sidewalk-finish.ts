// Original dry concrete appearance, not evidence of condition at individual
// paths. Metre-scale mix mottling and finer mineral aggregate share the exact
// existing sidewalk footprint. Neither alters the terrain, grade or joints.
export const concreteSidewalkFinishGLSL=/*glsl*/`
 vec3 concreteSidewalkFinish(vec3 c,vec2 xz,float footprint,float distance,bool precast){
  if(footprint>=.86||distance>=92.)return c;
  float reach=(1.-smoothstep(.24,.86,footprint))*(1.-smoothstep(56.,92.,distance));
  float body=wNoise(xz*1.9+vec2(21.3,66.2))-.5;
  float spread=wNoise(xz*.72+vec2(14.3,-19.7))-.5;
  float mineral=0.;
  if(footprint<.17){
   vec2 v=xz*15.0+vec2(9.25,-12.7),cell=floor(v),u=fract(v)-.5;
   float seed=wHash(cell+vec2(11.2,23.6));
   u-=vec2(seed-.5,wHash(cell+vec2(-19.2,16.8))-.5)*.22;
   float r=length(u*vec2(1.,.82)),aa=clamp(footprint*7.5,.022,.21);
   float grain=(1.-smoothstep(.22-aa,.22+aa,r))*(seed-.53);
   mineral=(grain+.008)*(1.-smoothstep(.035,.17,footprint));
  }
  float multiply=1.+reach*(body*(precast?.10:.16)+.075*spread+mineral*.23);
  return c*multiply + reach*spread*vec3(.013,.004,-.008);
 }
`;
