// Original optical relief on the stock crown card; not a leaf census or
// a texture derived from photographs. Existing silhouette, species layout,
// stems, shadow and replacement volumes do not change.
export const crownLeafFinishGLSL=/*glsl*/`
 float crownGrainHash(vec2 p){
  vec3 h=fract(p.xyx*vec3(.1037,.0961,.1083));h+=dot(h,h.yxz+17.17);
  return fract((h.x+h.y)*h.z);
 }
 float crownGrainNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(crownGrainHash(i),crownGrainHash(i+vec2(1,0)),f.x),
             mix(crownGrainHash(i+vec2(0,1)),crownGrainHash(i+1.),f.x),f.y);
 }
 vec3 crownLeafFinish(vec3 c,vec2 st,vec3 sun,float species,float a,vec3 viewScale,float footprint){
  float distance=viewScale.z;
  if(distance>=155.||footprint>=.64||a<.48||c.g<c.r+.004)return c;
  float windward=(1.-smoothstep(92.,155.,distance))*(1.-smoothstep(.16,.64,footprint));
  float presence=smoothstep(.48,.89,a)*smoothstep(.004,.035,c.g-c.r);
  vec2 p=(st-.5)*viewScale.xy;
  vec2 broad=vec2(.84*p.x+.54*p.y,-.54*p.x+.84*p.y);
  float lobeA=crownGrainNoise(broad*2.6+vec2(15.1,51.8)*species)-.5;
  float lobeB=crownGrainNoise(broad*5.5+vec2(-20.1,10.6))-.5;
  float mottling=lobeA*.21+lobeB*.10*(1.-smoothstep(.08,.28,footprint));
  float leaf=0.;
  if(footprint<.092&&species<1.5){
   // A small elliptic blade and center rib resolve only in genuine close
   // views. Offset and orientation change in each cell; zero at the edges.
   vec2 cell=floor(broad*9.4),f=fract(broad*9.4)-.5;
   float key=crownGrainHash(cell+vec2(14.5,12.6)*species);
   float angle=(key-.5)*2.5;
   vec2 rot=vec2(cos(angle),sin(angle));
   f=mat2(rot.x,-rot.y,rot.y,rot.x)*(f-vec2(key-.5,.5-key)*.12);
   float d=length(f*vec2(1.,2.2)),aa=clamp(footprint*4.4,.024,.14);
   float blade=1.-smoothstep(.27-aa,.27+aa,d);
   float rib=1.-smoothstep(.016,.047+aa*.42,abs(f.y));
   leaf=blade*(.17+(.20+sun.x*.03)*key-.17*smoothstep(-.05,.12,f.y)+.04*rib)*
        (1.-smoothstep(.030,.092,footprint))-.033;
  }
  float terr=windward*presence;
  return c*(1.+terr*(mottling+leaf)) + terr*lobeA*vec3(.021,.016,-.005);
 }
`;
