/** Original exterior response; no image, donor map, normal tiles or network samples. */
import * as T from 'three';
export const woodSun=new T.Vector3(-.60,.73,-.31).normalize();
export const woodVertex=/*glsl*/`
attribute float paintRole;
attribute vec3 pigment;
varying vec3 localP;
varying vec3 worldP;
varying vec3 studioN;
varying vec2 boardUV;
varying vec3 coat;
varying float role;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
 localP=position;
 worldP=(modelMatrix*vec4(position,1.)).xyz;
 studioN=normal;
 boardUV=uv;coat=pigment;role=paintRole;
 gl_Position=projectionMatrix*viewMatrix*vec4(worldP,1.);
 #include <logdepthbuf_vertex>
}
`;
export const woodFragment=/*glsl*/`
uniform vec3 woodSunLocal;
uniform vec3 woodEyeLocal;
uniform float useLocalEye;
uniform float woodProof;
varying vec3 localP;
varying vec3 worldP;
varying vec3 studioN;
varying vec2 boardUV;
varying vec3 coat;
varying float role;
#include <common>
#include <logdepthbuf_pars_fragment>
float hash(vec2 p){
 vec3 t=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
 t+=dot(t,t.yxz+33.33);
 return fract((t.x+t.y)*t.z);
}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
float filtered(float scale,float footprint){
 return 1.-smoothstep(.25,.71,footprint/scale);
}
float rack(vec2 U,float foot,float w,float course){
 float row=floor(U.y/course),shift=hash(vec2(91,row)),offs=hash(vec2(row,489.));
 float gu=U.x/w+.64*shift,gv=U.y/course;
 float seed=hash(vec2(floor(gu),row));

 float hue=(seed-.5)*.060*filtered(w,foot)+(offs-.5)*.035*filtered(course,foot);
 float v=fract(gv),u=fract(gu);
 float lap=(1.-smoothstep(.011,.102,v))*filtered(course,foot);
 float side=(1.-smoothstep(.012,.041,min(u,1.-u)))*filtered(w,foot);
 float softLip=(1.-smoothstep(.043,.210,1.-v))*filtered(course,foot);
 return hue-.139*lap-.054*side+.055*softLip;
}
bool hPlane(vec3 p,vec3 d,vec3 n,float cap,inout vec2 t){
 float z=dot(d,n),v=cap-dot(p,n);
 if(abs(z)<1.e-7)return v>=0.;
 if(z>0.)t.y=min(t.y,v/z);
 else t.x=max(t.x,v/z);
 return t.x<t.y;
}
bool boxAt(vec3 a,vec3 b,vec3 p,vec3 ray){
 vec2 t=vec2(.023,90.);
 return hPlane(p,ray,vec3(1,0,0),b.x,t)&&hPlane(p,ray,vec3(-1,0,0),-a.x,t)&&
   hPlane(p,ray,vec3(0,1,0),b.y,t)&&hPlane(p,ray,vec3(0,-1,0),-a.y,t)&&
   hPlane(p,ray,vec3(0,0,1),b.z,t)&&hPlane(p,ray,vec3(0,0,-1),-a.z,t);
}
bool taperAt(vec3 p,vec3 d){
 // Exact 6.3 to 4.02 m tower body loft. Gallery and roofing are separate roles.
 float k=(3.15-2.01)/(12.14-.28),a=3.15+k*.28;
 vec2 t=vec2(.025,90.);
 return hPlane(p,d,vec3(0,-1,0),-.28,t)&&hPlane(p,d,vec3(0,1,0),12.14,t)&&
 hPlane(p,d,vec3(1,k,0),a,t)&&hPlane(p,d,vec3(-1,k,0),a,t)&&
 hPlane(p,d,vec3(0,k,1),a,t)&&hPlane(p,d,vec3(0,k,-1),a,t);
}
bool gableAt(vec3 p,vec3 d,float ox,float w,float yn,float yPeak,float sl,float zL,float zH){
 // The occupied architectural prismatic envelope, not an aerial/terrain mask.
 vec2 t=vec2(.025,90.);p.x-=ox;
 return hPlane(p,d,vec3(1,0,0),w,t)&&hPlane(p,d,vec3(-1,0,0),w,t)&&
 hPlane(p,d,vec3(0,-1,0),-yn,t)&&
 hPlane(p,d,vec3(0,0,1),zH,t)&&hPlane(p,d,vec3(0,0,-1),-zL,t)&&
 hPlane(p,d,vec3(sl,1,0),yPeak,t)&&hPlane(p,d,vec3(-sl,1,0),yPeak,t);
}
float localOcclusion(vec3 p,vec3 d){
 if(taperAt(p,d))return 0.09;
 if(gableAt(p,d,0.,2.398,.294,7.584,1.30,-11.04,-2.76))return .08;
 if(gableAt(p,d,.59,1.615,.286,3.96,.804,-13.37,-10.947))return .17;
 if(boxAt(vec3(-2.486,12.932,-2.486),vec3(2.486,13.153,2.486),p,d))return .24;
 if(boxAt(vec3(-.57,6.94,-8.27),vec3(-.12,9.16,-7.80),p,d))return .19;
 return 1.;
}
vec3 reflectedSky(vec3 ray){
 return mix(vec3(.29,.323,.295),mix(vec3(.66,.747,.783),vec3(.32,.49,.67),
   smoothstep(.09,.83,ray.y)),smoothstep(-.07,.16,ray.y));
}
void main(){
 #include <logdepthbuf_fragment>
 vec3 n=normalize(studioN);
 vec3 eye=mix(cameraPosition,woodEyeLocal,useLocalEye),view=normalize(eye-localP);
 vec3 p=localP, L=normalize(woodSunLocal);
 float fp=max(length(dFdx(localP)),length(dFdy(localP)));
 float ufp=max(fwidth(boardUV.x),fwidth(boardUV.y));
 if(role<.5){
  float v=fract(boardUV.y/.114),w=filtered(.114,ufp);
  float courseLip=(smoothstep(.005,.069,v)-smoothstep(.083,.19,v))*w;
  vec3 shingleT=normalize(vec3(0.,1.,0.)-n*n.y);
  // Real geometric normals remain uniform per face. A little inward relief is
  // a derivative-bounded optical response only, not larger tile geometry.
  n=normalize(n+shingleT*(.067*courseLip-.015*w));
 }
 float np=max(dot(n,L),0.),nv=max(.02,dot(n,view));
 vec3 C=coat;
 if(role<.5){
  float tile=rack(boardUV,ufp,.229,.114);
  float grain=(noise(vec2(boardUV.x*38.,boardUV.y*4.6))-.5)*.054*filtered(.035,ufp);
  float age=(noise(boardUV/1.58)-.5)*.047;
  C*=1.+tile+grain+age;
  C*=mix(.83,1.,smoothstep(.29,1.52,p.y));
 }else if(role<2.5){
  float wear=(noise(boardUV*vec2(11.,2.4))-.5)*.13*filtered(.18,ufp);
  float macro=(noise(boardUV*.48)-.5)*.12;
  C*=1.+wear+macro;
 }else if(role<3.5){
  float tile=rack(boardUV.yx,ufp,.306,.132);
  float gravel=(noise(boardUV*89.)-.5)*.18*filtered(.018,ufp);
  float wash=(noise(boardUV*vec2(1.33,.62))-.5)*.102;
  C*=1.+tile*1.56+gravel+wash;
  C+=vec3(.009,.010,.011)*(1.-smoothstep(.04,.28,nv));
 }else if(role<4.5){
  float higher=smoothstep(13.18,13.60,p.y);
  float F=.043+.72*pow(1.-nv,4.8);
  vec3 reflected=reflect(-view,n),refl=reflectedSky(reflected);
  // Observe contrasting reflected sky and dim enclosure, not a reconstruction
  // of a real lens or its equipment. The lantern's interior is stylized
  // optical depth behind a real octagonal pane, never a beacon.
  vec3 through=-view;
  float passage=max(0.,-dot(p.xz,through.xz)/max(dot(through.xz,through.xz),.001));
  vec3 focus=p+through*passage;
  float occultance=(1.-smoothstep(.12,.36,length(focus.xz)))*smoothstep(13.97,14.16,focus.y)*
    (1.-smoothstep(14.59,14.84,focus.y));
  vec3 throughPane=reflectedSky(through)*(.12+.28*smoothstep(13.90,14.76,focus.y));
  vec3 diffuseNear=vec3(.039,.048,.054)*(.77+.21*noise(boardUV*vec2(.97,.7)));
  vec3 backing=mix(diffuseNear,mix(throughPane,vec3(.093,.064,.039),.79*occultance),higher);
  float lintel=.94-.11*smoothstep(14.64,15.058,p.y)*higher;
  float haze=.99-.075*(noise(boardUV*vec2(21.,8.))-.44)*filtered(.15,ufp);
  C=(mix(backing,refl,F)+vec3(.005,.006,.007))*lintel*haze;
 }else if(role<5.5){
  C*=1.+(noise(boardUV*.96)-.5)*.102;
 }else if(role<6.5){
  float damp=(1.-smoothstep(0.,.42,p.y));
  C*=.87+(noise(boardUV*vec2(6.,13.))-.5)*.29*filtered(.12,ufp)-.11*damp;
 }else if(role<7.5){
  C*=.90+(noise(boardUV*26.)-.5)*.12*filtered(.06,ufp);
 }else if(role<8.5){
  C*=.88+rack(boardUV,ufp,.212,.076)*1.51+(noise(boardUV*30.)-.5)*.10*filtered(.04,ufp);
 }else if(role<9.5){
  C*=.94+(noise(boardUV*9.4)-.5)*.22*filtered(.18,ufp);
 }else if(role<10.5){
  C*=.98+(noise(boardUV*vec2(2.4,31.))-.5)*.23*filtered(.065,ufp);
 }else{
  float a=noise(p.xz/10.3),b=noise(p.xz/2.1),c=noise(p.xz/.40)*filtered(.40,fp);
  C*=.86+.25*a+.13*b+.057*c;
 }
 vec3 stepBase=p+n*.023;
 vec3 S=normalize(cross(L,vec3(0,1,0)));
 float vis=0.;
 if(np>0.){
  // Authored studio sun angular footprint. Large opaque parts only, no actual site shadow.
  vis=.5*localOcclusion(stepBase,normalize(L+S*.014))+.5*localOcclusion(stepBase,normalize(L-S*.014));
 }
 float hemi=.52+.48*smoothstep(-.28,1.,n.y);
 float under=1.;
 if(role<.5)under*=1.-.20*smoothstep(11.36,12.15,p.y);
 if(role>10.5){
  float baseDist=length(max(abs(p.xz)-vec2(3.17,3.17),0.));
  float wingDist=length(max(abs(vec2(p.x,p.z+7.00))-vec2(2.41,4.06),0.));
  under=1.-.18*exp(-1.56*min(baseDist,wingDist));
 }
 vec3 ambient=mix(vec3(.254,.285,.321),vec3(.407,.439,.455),hemi)*under;
 vec3 key=vec3(.89,.794,.68)*vis*np;
 float gloss=(role<.5?.065:(role<2.5?.109:(role<3.5?.024:(role<4.5?.10:.042))));
 float shine=pow(max(dot(n,normalize(L+view)),0.),role<2.5?21.:13.)*np*vis*gloss;
 vec3 col=role>=3.5&&role<4.5 ? C*(.82+.18*vis)+vec3(.93,.91,.83)*shine
                                  :C*(ambient+key)+vec3(.93,.91,.83)*shine;
 float distance=length(eye-p);
 col=mix(col,vec3(.41,.504,.535),1.-exp(-distance*.00087));
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 if(woodProof>.5){
  gl_FragColor.rgb=role>10.5?vec3(0.):vec3(1.);
 }
}
`;
export function woodMaterial(){
 return new T.ShaderMaterial({name:'Original shingle, painted iron and recessed glass, detached',
   uniforms:{woodSunLocal:{value:woodSun.clone()},woodEyeLocal:{value:new T.Vector3()},
    useLocalEye:{value:0},woodProof:{value:0}},
   vertexShader:woodVertex,fragmentShader:woodFragment,side:T.FrontSide,
   transparent:false,toneMapped:true,depthWrite:true,depthTest:true,blending:T.NoBlending});
}
