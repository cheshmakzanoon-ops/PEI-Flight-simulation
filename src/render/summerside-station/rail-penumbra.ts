/** A continuous separable tent over the same production depth+light-plane.
 * Unlike three unweighted rounded texels, the sample leaving the 4×4 stencil
 * reaches zero weight before the centre crosses a shadow-pixel boundary.
 * Only this exterior's materials use it; shared terrain/road shaders stay exact.
 */
export const railPenumbraGLSL=`
 uniform float localCastLive,localCastTexel;
 uniform sampler2D localCastMap;
 uniform mat4 localCastTransform;
 uniform vec3 localCastSun,localCastRight,localCastUp;
 uniform float localCastPlaneScale;
 #include <packing>
 float railBuildingShade(vec3 p,vec3 n,float distanceToEye){
  if(localCastLive<.001||distanceToEye>625.)return 0.;
  vec3 q=(localCastTransform*vec4(p,1.)).xyz*.5+.5;
  if(q.z<=0.||q.z>=1.||any(lessThan(q.xy,vec2(.01)))||any(greaterThan(q.xy,vec2(.99))))return 0.;
  float reach=1.-smoothstep(.382,.49,max(abs(q.x-.5),abs(q.y-.5)));
  float incidence=dot(n,localCastSun);
  float guarded=(incidence<0.?-1.:1.)*max(abs(incidence),.105);
  vec2 gradient=localCastPlaneScale*vec2(dot(n,localCastRight),dot(n,localCastUp))/guarded;
  float bias=(.15+.39*(1.-smoothstep(.105,.38,abs(incidence))))*.000654;
  vec2 pos=q.xy/localCastTexel-.5;
  vec2 phase=fract(pos),base=(floor(pos)+.5)*localCastTexel;
  float lit=0.,weights=0.;
  for(int y=-1;y<=2;y++)for(int x=-1;x<=2;x++){
   vec2 off=vec2(float(x),float(y));
   vec2 span=1.-smoothstep(vec2(0.),vec2(2.),abs(off-phase));
   float w=span.x*span.y;
   vec2 tap=base+off*localCastTexel;
   float atTap=q.z+dot(gradient,tap-q.xy)-bias;
   lit+=w*step(atTap,unpackRGBAToDepth(texture2D(localCastMap,tap)));
   weights+=w;
  }
  return localCastLive*(1.-lit/max(weights,.001))*reach*(1.-smoothstep(430.,625.,distanceToEye));
 }
`;
