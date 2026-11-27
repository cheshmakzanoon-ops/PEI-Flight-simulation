import * as T from 'three';
import {opaqueCoverageBlend} from '../opaque-coverage-alpha.ts';

export type MarshLight={sun:T.Vector3;wind?:T.Vector2;msaa?:boolean;keepSceneAlpha?:boolean};
const movement=`
uniform float marshTime;
uniform float marshWindStrength;
uniform vec2 marshWind;
attribute vec4 marshLook;
vec2 leafMovement(vec3 q,mat4 I){
 vec3 root=(modelMatrix*I*vec4(0.,0.,0.,1.)).xyz;
 float phi=6.2831853*marshLook.x+dot(root.xz,vec2(.093,-.077));
 float gust=.40*sin(marshTime*1.29+phi)+.20*sin(marshTime*.53+phi*.74)+.12*sin(marshTime*3.5+phi+q.x*6.);
 float y=max(0.,q.y);
 vec2 planar=(marshWind*(.034+.044*gust)+vec2(marshWind.y,-marshWind.x)*(.015*gust))
          *marshWindStrength*y*y;
 vec2 xaxis=I[0].xz,zaxis=I[2].xz;
 return vec2(dot(planar,xaxis)/max(.09,dot(xaxis,xaxis)),dot(planar,zaxis)/max(.09,dot(zaxis,zaxis)));
}
`;
export function marshMaterials(controls:MarshLight,cast:boolean){
 const wind=controls.wind?.clone()??new T.Vector2(.786,-.618);
 if(!Number.isFinite(wind.x)||!Number.isFinite(wind.y)||wind.lengthSq()<1.e-6)wind.set(.786,-.618);
 wind.normalize();
 const sun=controls.sun.clone();
 if(![sun.x,sun.y,sun.z].every(Number.isFinite)||sun.lengthSq()<1e-6)sun.set(-.52,.78,.35);
 sun.normalize();
 const msaa=controls.msaa??true;
 const uniforms={marshTime:{value:0},marshWindStrength:{value:0.52},marshWind:{value:wind},marshSun:{value:sun},marshAGL:{value:0}};
 const forward=new T.ShaderMaterial({
  name:'Original cordgrass-inspired leaf and stem optics',
  side:T.DoubleSide,alphaToCoverage:msaa,depthWrite:true,transparent:false,
  ...(msaa&&controls.keepSceneAlpha===true?opaqueCoverageBlend:undefined),
  uniforms,
  vertexShader:`
  attribute vec4 marshBlade;
  varying vec4 blade, look;varying vec3 pw,nw;
  varying float localHeight;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  ${movement}
  void main(){
   vec3 p=position;
   vec2 movement=leafMovement(p,instanceMatrix);
   p.xz+=movement;
   vec4 point=instanceMatrix*vec4(p,1.);
   pw=(modelMatrix*point).xyz;
   vec3 ix=instanceMatrix[0].xyz,iy=instanceMatrix[1].xyz,iz=instanceMatrix[2].xyz;
   vec3 n=normal;
   n.y-=dot(n.xz,movement)*(2./max(.18,abs(p.y)));
   nw=normalize(mat3(modelMatrix)*(ix*n.x/max(.07,dot(ix,ix))+iy*n.y/max(.07,dot(iy,iy))+iz*n.z/max(.07,dot(iz,iz))));
   localHeight=point.y-instanceMatrix[3].y;
   blade=marshBlade;look=marshLook;
   gl_Position=projectionMatrix*viewMatrix*vec4(pw,1.);
   #include <logdepthbuf_vertex>
  }
  `,
  fragmentShader:`
  uniform vec3 marshSun;uniform float marshAGL;
  varying vec4 blade,look;varying vec3 pw,nw;
  varying float localHeight;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main(){
   #include <logdepthbuf_fragment>
   float d=length(cameraPosition-pw);
   // Producer supports roots to 54m and refreshes after 9m movement.
   // Finish before that moving outer boundary, allowing a swept leaf margin.
   float planar=length(cameraPosition.xz-pw.xz);
   float fade=(1.-smoothstep(29.,43.75,planar))*(1.-smoothstep(60.,87.,marshAGL));
   if(fade<${msaa?'.026':'.51'})discard;
   float bud=blade.w,life=clamp(look.y,0.,1.),damp=clamp(look.z,0.,1.);
   float matLayer=step(2.5,blade.z),seedHead=step(1.5,blade.z)*(1.-matLayer),culm=step(.5,blade.z)*(1.-seedHead)*(1.-matLayer);
   if(seedHead>.5&&(look.w>.66||life<.32))discard;
   vec3 normal=normalize(nw),viewDir=normalize(cameraPosition-pw);
   if(!gl_FrontFacing)normal=-normal;
   float sky=.54+.29*(.5+.5*normal.y),ns=max(0.,dot(normal,marshSun));
   float ledge=.51+.49*smoothstep(-.020,.188,localHeight);
   float rootAge=smoothstep(.44,.85,life),tip=smoothstep(.48+.22*bud,.99,blade.x);
   float dormant=clamp(tip*(.26+.62*life)+rootAge*(.23+.31*(1.-bud)),0.,1.);
   vec3 fresh=mix(vec3(.172,.203,.069),vec3(.094,.141,.052),damp);
   vec3 old=mix(vec3(.271,.190,.072),vec3(.221,.145,.061),damp);
   vec3 color=mix(fresh,old,dormant)*(.74+.27*bud+.13*look.x);
   color*=.965+.050*(1.-abs(blade.y))+.035*sin(17.7*blade.x+6.4*bud)*(1.-smoothstep(9.,32.,d));
   color=mix(color,mix(vec3(.082,.083,.034),vec3(.215,.154,.054),.63*life+.27*blade.x),culm*.93);
   color=mix(color,vec3(.123,.094,.044)*(.78+.38*bud),seedHead);
   float forwardScatter=max(0.,dot(viewDir,-marshSun))*(.38+.62*(1.-abs(dot(normal,marshSun))));
   float specular=max(0.,dot(normal,normalize(marshSun+viewDir)));
   // Diagonally broken fibre ensembles. The curved nappe remains real
   // geometry; subpixel leaflets merge into the low crown at approach range.
   float tracks=(blade.y+.03*sin(blade.x*19.+bud*3.1)+.05*blade.x*bud)*9.35+bud*165.;
   float resolution=(1.-smoothstep(.7,2.75,fwidth(tracks)))*(1.-smoothstep(8.7,19.,d));
   float weave=.49+.28*sin(tracks)+.18*sin(tracks*.49+7.*blade.x);
   float lobe=1.-smoothstep(.63+.08*sin(blade.x*12.+9.*bud),1.005,abs(blade.y));
   float fold=.19+.55*lobe+.26*(1.-abs(blade.y));
   vec3 matGreen=mix(vec3(.101,.129,.039),vec3(.073,.106,.042),damp);
   vec3 matOld=mix(vec3(.188,.144,.055),vec3(.151,.103,.057),damp);
   vec3 matHue=mix(matGreen,matOld,clamp(rootAge*.50+bud*.32+tip*.35,0.,1.));
   matHue*=.68+.31*fold+(weave-.53)*.43*resolution+.16*bud+.11*look.x;
   matHue*=.69+.31*smoothstep(.012,.082,localHeight);
   color=mix(color,matHue,matLayer);
   float unevenEnd=1.-smoothstep(.79+.095*sin(tracks*.71+bud*2.),1.043,blade.x);
   float cut=mix(.91,.25+.75*smoothstep(.20,.69,weave),.75*resolution);
   fade*=mix(1.,(0.29+.71*lobe)*cut*(.72+.28*unevenEnd),matLayer);
   if(fade<${msaa?'.026':'.51'})discard;
   color=color*(sky+.62*ns)*mix(ledge,1.,matLayer)+(vec3(.068,.077,.024)*(1.-culm*.59))*forwardScatter*(.30+.60*tip)*ledge*(1.-.8*matLayer);
   color+=color*pow(specular,7.)*(.014+.030*(1.-damp))*ledge*(1.-.83*matLayer);
   float air=1.-exp(-d*.00050);
   gl_FragColor=vec4(mix(color,vec3(.28,.34,.30),air),fade);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }
  `
 });
 if(!cast)return {forward,depth:undefined,uniforms};
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
 depth.onBeforeCompile=q=>{
  q.uniforms.marshTime=uniforms.marshTime;
  q.uniforms.marshWindStrength=uniforms.marshWindStrength;
  q.uniforms.marshWind=uniforms.marshWind;
  q.vertexShader=`
  attribute vec4 marshBlade;varying float marshShadowAllowed;
  ${movement}
  `+q.vertexShader.replace('#include <begin_vertex>',`
  #include <begin_vertex>
  marshShadowAllowed=marshBlade.z>1.5&&marshBlade.z<2.5&&(marshLook.w>.66||marshLook.y<.32)?0.:1.;
  transformed.xz+=leafMovement(position,instanceMatrix);
  `);
  q.fragmentShader='varying float marshShadowAllowed;\n'+q.fragmentShader.replace('void main() {','void main() { if(marshShadowAllowed<.5)discard;');
 };
 depth.customProgramCacheKey=()=> 'curved marsh clump shadow v1';
 return {forward,depth,uniforms};
}
