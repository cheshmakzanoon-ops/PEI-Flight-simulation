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
  vec3 pattern=textureGrad(provinceFurrowScan,coord,a,b).rgb;
  vec3 second=textureGrad(provinceFurrowScan,coord+vec2(.465,0.),a,b).rgb;
  pattern=mix(pattern,second,smoothstep(.30,.70,noise(p.xz*.104+43.)));
  float footprint=max(length(a),length(b))*6.55, fine=1.-smoothstep(.22,1.05,footprint);
  float local=.46+1.08*pattern.r;
  float macro=noise(p.xz*.086+110.)-.5;
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
