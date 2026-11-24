import {FieldShardSource} from '../sim/field-shards.ts';
import {FieldStream,fieldStreamMaskGLSL} from './field-stream.ts';
import {FIELD_DIRECTORY_PIN} from './province-fields.generated.ts';
import type {FieldPilot} from './fields-pilot.ts';

export function fetchProvinceDirectory(base:string){
 return FieldShardSource.open(base+'fields-province/',FIELD_DIRECTORY_PIN);
}
export function provinceFields(source:FieldShardSource,material:FieldPilot){
 return {stream:new FieldStream(source),scan:material.scan,admitted:false,toggle:{value:1}};
}
export type ProvinceFieldStudy=ReturnType<typeof provinceFields>;
export const provinceFieldOpticsGLSL=fieldStreamMaskGLSL+`
 uniform sampler2D provinceFurrowScan;
 uniform float provinceFieldStrength;
 float paintProvinceFields(inout vec3 col,inout vec3 normal,vec3 p,float d,float coast){
  vec2 dx=dFdx(p.xz),dy=dFdy(p.xz);
  if(abs(provinceFieldStrength)<.001||d>=330.||coast<190.||normal.y<.75)return 0.;
  vec3 mask=fieldShaderMask(p.xz);
  float influence=mask.z*smoothstep(190.,245.,coast)*(1.-smoothstep(165.,330.,d))*smoothstep(.75,.93,normal.y)*abs(provinceFieldStrength);
  if(influence<.002)return 0.;
  if(provinceFieldStrength<0.){col=vec3(4.,0.,4.);return influence;}
  vec2 tangent=mask.xy,along=-tangent,cross=vec2(-tangent.y,tangent.x);
  vec2 coord=vec2(dot(p.xz,along),dot(p.xz,cross))/6.55;
  vec2 a=vec2(dot(dx,along),dot(dx,cross))/6.55,b=vec2(dot(dy,along),dot(dy,cross))/6.55;
  coord.x+=(noise(p.xz*.038+13.)-.5)*1.35;
  coord.y+=(noise(p.xz*.026+vec2(19.,-12.))-.5)*.043;
  float footprint=max(length(a),length(b))*6.55,fine=1.-smoothstep(.22,1.05,footprint);
  // Keep the supported row direction. Correlate the authored surface
  // irregularity across metres so a field is not a repeated dark ruler.
  vec2 drift=vec2((noise(p.xz*.030+vec2(71.,-9.))-.5)*.62,
   (noise(p.xz*.049+vec2(-37.,23.))-.5)*.047);
  vec2 xy=coord+drift;
  vec3 run=textureGrad(provinceFurrowScan,xy,a*1.08,b*1.08).rgb;
  vec3 alternate=textureGrad(provinceFurrowScan,xy+vec2(.37,.078),a*1.08,b*1.08).rgb;
  float wear=smoothstep(.31,.67,noise(p.xz*.079+vec2(44.,168.)));
  vec3 pattern=mix(run,alternate,.36*wear);
  // The foreground may resolve clods, but the deepest stripe should lose
  // contrast when its period shrinks to the projected fragment footprint.
  float edgeFade=1.-smoothstep(.18,.79,footprint);
  float nearGrain=(1.-smoothstep(18.,56.,d))*(1.-smoothstep(.09,.29,footprint));
  float crust=(noise(p.xz*3.55+vec2(98.,-34.))-.5)*.12+
              (noise(p.xz*.93+vec2(-62.,31.))-.5)*.07;
  float macro=noise(p.xz*.086+110.)-.5;
  float local=mix(.993,mix(.70+.60*pattern.r,.52+.96*pattern.r,nearGrain),.42+.58*edgeFade)+
       macro*.038+crust*nearGrain;
  macro=mix(macro,noise(p.xz*.044+vec2(87.,38.))-.5,.55);
  float gain=clamp(1.+(local-1.)*(.38+.30*fine)+.08*macro,.74,1.23);
  float green=smoothstep(.035,.235,(col.g-col.r)/max(.022,dot(col,vec3(.2126,.7152,.0722))));
  col=mix(col,col*gain*mix(vec3(1.01,.97,.93),vec3(.98,1.04,.95),green),influence);
  vec2 adjustment=(pattern.gb-.5)*(.30*influence*fine);
  vec2 sw=along*adjustment.x-cross*adjustment.y;
  vec3 detail=vec3(sw.x,0.,sw.y);
  normal=normalize(normal+detail-dot(normal,detail)*normal);
  return influence;
 }
`;
