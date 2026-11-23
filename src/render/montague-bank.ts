/** Same bilinear sample and monotone minimum as WaterOnlyCover.distance. */
export const montagueBankGLSL=`
 uniform sampler2D montagueWaterMask;
 uniform vec4 montagueWaterBounds;
 uniform vec2 montagueWaterSize;
 vec2 montagueWaterSample(vec2 xz){
  if(any(lessThanEqual(xz,montagueWaterBounds.xy))||any(greaterThanEqual(xz,montagueWaterBounds.zw)))return vec2(0.);
  vec2 p=(xz-montagueWaterBounds.xy)/(montagueWaterBounds.zw-montagueWaterBounds.xy);
  return texture2D(montagueWaterMask,(.5+p*(montagueWaterSize-1.))/montagueWaterSize).rg;
 }
 float montagueFrom(float prior,vec2 v){
  if(v.g<=0.)return prior;
  return prior+v.g*(min(prior,(v.r*255.-128.)*.25)-prior);
 }
 float montagueWaterDistance(float prior,vec2 xz){return montagueFrom(prior,montagueWaterSample(xz));}
 // Art support, not flow speed, bathymetry or tides. The calm signal is
 // positive only inside the conservative measured-water support and fades
 // out before every atlas border and every observed dry bank.
 float montagueStillWater(vec2 v){
  return v.g*smoothstep(.18,2.0,(128.-v.r*255.)*.25);
 }
`;
