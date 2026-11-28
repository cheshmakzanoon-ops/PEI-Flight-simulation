import {crownLeafFinishGLSL} from './crown-leaf-finish.ts';

export const pars=`
 attribute vec3 stem;attribute vec4 shape;varying vec2 vUV;varying vec3 param;
 #include <common>
 #include <logdepthbuf_pars_vertex>`;
export const crownV=pars+`
 void main(){
  vec3 ray=normalize(cameraPosition-(stem+vec3(0.,shape.x*.5,0.)));
  vec3 right=normalize(vec3(ray.z+.00001,0.,-ray.x));vec3 up=normalize(cross(ray,right));
  float tilt=smoothstep(.19,.80,ray.y);float portrait=mix(shape.x*1.04,shape.y,tilt);
  vec3 center=stem+vec3(0.,shape.x*mix(.47,.65,tilt),0.);
  vec3 p=center+position.x*shape.y*right+position.y*portrait*up;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);vUV=uv;param=vec3(shape.z,tilt,shape.w);
 #include <logdepthbuf_vertex>
 }`;
export const crownF=`
 varying vec2 vUV;varying vec3 param;uniform sampler2D canopy;
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
 #include <logdepthbuf_fragment>
 vec2 uv=clamp(vUV,vec2(.004),vec2(.996));
 vec4 side=texture2D(canopy,vec2((param.x+uv.x)*.25,.50+.5*uv.y));
 vec4 top=texture2D(canopy,vec2((param.x+uv.x)*.25,.5*uv.y));
 float a=mix(side.a,top.a,param.y);if(a<.30)discard;
 vec3 c=mix(side.rgb*side.a,top.rgb*top.a,param.y)/max(a,.001);
 gl_FragColor=vec4(c*param.z,clamp((a-.30)*3.8,0.,1.));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
/** Keep the published canopy atlas/silhouette, but shade an approximate
 * crown lobe against the world sun instead of brightening every card alike. */
export const daylightVertex='uniform vec3 canopySun; varying vec3 cardSun;\n'+crownV.replace(
 'vec3 p=center+','cardSun=vec3(dot(canopySun,right),dot(canopySun,up),dot(canopySun,ray));\n  vec3 p=center+');
export const daylightFragment='varying vec3 cardSun;\n'+crownF.replace('gl_FragColor=vec4(c*param.z,',`
 vec2 ellipse=(uv-.5)*vec2(1.55,1.68);
 float dome=sqrt(max(.03,1.-dot(ellipse,ellipse)));
 vec3 normal=normalize(vec3(ellipse,dome));
 float sunward=clamp(dot(normal,cardSun),-.45,1.);
 float response=.930+.154*smoothstep(-.27,.82,sunward);
 float ambient=1.-.090*(1.-smoothstep(.05,.74,uv.y))*(1.-param.y);
 vec3 chroma=mix(vec3(.957,.994,1.026),vec3(1.046,1.016,.956),smoothstep(.02,.77,sunward));
 // A small backlit rim is limited to green leaf clusters and vanishes
 // in top views. It does not change the measured silhouette/coverage.
 float foliage=smoothstep(.008,.051,c.g-c.r);
 float rim=(1.-smoothstep(.25,.82,dome))*smoothstep(.12,.78,-cardSun.z)*(1.-param.y)*foliage;
 vec3 lit=c*param.z*response*ambient*chroma+c*vec3(.095,.078,.021)*rim;
 gl_FragColor=vec4(lit,`);
const crownLeafDecl='varying vec3 cardSun,crownLeafScale;';
export const leafVertex=daylightVertex.replace('varying vec3 cardSun;',crownLeafDecl).replace('vec3 p=center+',
 'crownLeafScale=vec3(shape.y,portrait,length(cameraPosition-center));\n  vec3 p=center+');
export const leafFragment=daylightFragment.replace('varying vec3 cardSun;',crownLeafDecl)
 .replace('void main(){',crownLeafFinishGLSL+'\n void main(){\n float crownFootprint=length(fwidth(vUV*crownLeafScale.xy));')
 .replace('vec2 ellipse=', 'c=crownLeafFinish(c,uv,cardSun,param.x,a,crownLeafScale,crownFootprint);\n vec2 ellipse=');
/** Exact installed near-crown family for independent canopy consumers.
 * Admission refers to this pair, not a loosely matched custom shader. */
export const STOCK_LEAF_CROWN_PROGRAM=Object.freeze({vertexShader:leafVertex,fragmentShader:leafFragment});
