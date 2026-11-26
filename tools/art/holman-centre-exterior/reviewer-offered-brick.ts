import {MeshStandardMaterial} from 'three';

/** Original exterior material for an observed brick facade. Dimensions and
 * palette are artwork rather than documented Holman construction specs. */
export const HOLMAN_BRICK_METRIC={course:.074,span:.222,mortar:.011} as const;
const masonry=`
float holmanHash(vec2 p){
 vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
 q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
}
float holmanNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(holmanHash(i),holmanHash(i+vec2(1.,0.)),f.x),
  mix(holmanHash(i+vec2(0.,1.)),holmanHash(i+vec2(1.)),f.x),f.y);
}
vec3 holmanClay(vec2 metres,float exposure,out float mortar){
 vec2 pixel=max(fwidth(metres),vec2(.0003));
 float row=floor(metres.y/.074);
 vec2 course=vec2(metres.x+mod(row,2.)*.111,metres.y);
 vec2 cell=floor(course/vec2(.222,.074));
 vec2 toJoint=(.5-abs(fract(course/vec2(.222,.074))-.5))*vec2(.222,.074);
 vec2 soft=min(pixel*.68,vec2(.042,.029));
 vec2 brick=smoothstep(vec2(.0055)-soft,vec2(.0055)+soft,toJoint);
 float visible=1.-smoothstep(.008,.061,max(pixel.x,pixel.y));
 mortar=mix(.167,1.-brick.x*brick.y,visible);
 vec3 deep=vec3(.111,.025,.017), light=vec3(.216,.068,.039);
 vec3 clay=mix(deep,light,mix(.56,.25+.67*holmanHash(cell+2.7),visible*.91));
 float w=holmanNoise(metres*.209), stain=holmanNoise(metres*vec2(.15,.42)+2.6);
 float pore=(holmanNoise(metres*119.)-.5)*(1.-smoothstep(.002,.012,max(pixel.x,pixel.y)));
 clay*=.92+.16*w+.07*pore;
 clay=mix(clay,clay*vec3(.82,.91,.94),stain*.25*exposure);
 vec3 infill=mix(vec3(.181,.151,.111),vec3(.110,.081,.067),.20+.30*w);
 return mix(clay,infill,mortar);
}`;
export function holmanBrickMaterial(courseOrigin=0,exposure=.65){
 if(!Number.isFinite(courseOrigin)||!Number.isFinite(exposure)||exposure<0||exposure>1)throw Error('Invalid Holman study finish');
 const m=new MeshStandardMaterial({color:0xffffff,roughness:.82,metalness:0});
 m.name='Holman visual study · original red masonry';
 m.onBeforeCompile=p=>{
  p.uniforms.holmanCourseOrigin={value:courseOrigin};
  p.uniforms.holmanExposed={value:exposure};
  p.vertexShader='varying vec2 holmanP;uniform float holmanCourseOrigin;\n'+p.vertexShader;
  p.vertexShader=p.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 along=vec3(normal.z,0.,-normal.x);
   float norm=length(along);
   holmanP=vec2(dot(position,along)/max(norm,.001),position.y-holmanCourseOrigin);
  `);
  p.fragmentShader='varying vec2 holmanP;uniform float holmanExposed;\n'+masonry+'\n'+p.fragmentShader;
  p.fragmentShader=p.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float holmanMortar=0.;
   diffuseColor.rgb*=holmanClay(holmanP,holmanExposed,holmanMortar);
  `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,.94,holmanMortar*.66);
  `);
 };
 m.customProgramCacheKey=()=> 'holman-brick-metric-2026-v1';
 return m;
}
