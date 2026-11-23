import * as THREE from 'three';
import {readCoastalPack} from '../sim/coastal-packs.ts';
import {SOURIS_LIGHT as plan} from './souris-light.generated.ts';
import {SOURIS_ROOF,SOURIS_ROOF_SHA256} from './souris-roof.generated.ts';

/** Inert outside its neighbourhood. Only an exact resident caster requests the pack. */
export class SourisLighting {
 readonly id=plan.id;
 readonly active={value:0};
 readonly uniforms:Record<string,THREE.IUniform>;
 private resident=false;
 private attempted=false;
 private loaded=false;
 private running?:Promise<void>;
 private readonly base:string;
 private readonly fetcher:typeof fetch;
 private readonly timeout:number;
 constructor(base:string,fetcher:typeof fetch=fetch,timeout=1600){
  this.base=base;this.fetcher=fetcher;this.timeout=timeout;
  this.uniforms={
   sourisLightMap:{value:new THREE.DataTexture(new Uint8Array(2),1,1,THREE.RGFormat)},
   sourisGroundMap:{value:new THREE.DataTexture(new Uint8Array(2),1,1,THREE.RGFormat)},
   sourisLightLive:this.active,
   sourisLightBounds:{value:new THREE.Vector4(...plan.leftTopXZ,1/(plan.width*plan.cellMetres),1/(plan.height*plan.cellMetres))},
   sourisGroundBounds:{value:new THREE.Vector4(...plan.groundLeftTopXZ,1/plan.groundSize[0],1/plan.groundSize[1])},
   sourisLightSize:{value:new THREE.Vector2(plan.width,plan.height)},
   sourisLightSun:{value:new THREE.Vector3(...plan.shadowYZRatio,plan.shadowDatumY)}};
 }
 setCaster(present:boolean){
  this.resident=present;
  this.active.value=present&&this.loaded?1:0;
  if(!present||this.attempted)return this.running;
  this.attempted=true;
  this.running=this.install();
  return this.running;
 }
 private async install(){
  const raw=await loadSourisLighting(this.base,this.fetcher,this.timeout);
  if(!raw)return;
  const shadow=new THREE.DataTexture(raw.subarray(0,plan.shadowBytes),plan.width,plan.height,THREE.RGFormat);
  shadow.minFilter=shadow.magFilter=THREE.NearestFilter;shadow.needsUpdate=true;
  const source=new THREE.DataTexture(raw.subarray(plan.shadowBytes),...plan.groundSize,THREE.RGFormat);
  source.minFilter=source.magFilter=THREE.LinearFilter;source.needsUpdate=true;
  this.uniforms.sourisLightMap.value.dispose();this.uniforms.sourisGroundMap.value.dispose();
  this.uniforms.sourisLightMap.value=shadow;this.uniforms.sourisGroundMap.value=source;
  this.loaded=true;this.active.value=this.resident?1:0;
 }
 intersects(x:number,z:number,r:number,b:number){
  const [l,t,h,j]=plan.edgeBoundsXZ;
  return r>=l-70&&b>=t-70&&x<=h+70&&z<=j+70;
 }
}
export function sourisLightingForTerrain(base:string,terrainSha:string){
 if(plan.terrainSha256!==terrainSha||plan.evidenceSha256!==SOURIS_ROOF.evidenceSha256||
    plan.shellSha256!==SOURIS_ROOF_SHA256)return;
 return new SourisLighting(base);
}
export function loadSourisLighting(base:string,fetcher:typeof fetch=fetch,timeout=1600){
 return readCoastalPack(base+plan.asset,fetcher,timeout,plan,b=>new Uint8Array(b));
}
export const sourisOcclusionGLSL=/*glsl*/`
 uniform sampler2D sourisLightMap,sourisGroundMap;
 uniform vec4 sourisLightBounds,sourisGroundBounds;
 uniform vec2 sourisLightSize;
 uniform vec3 sourisLightSun;
 uniform float sourisLightLive;
 bool sourisOutside(vec2 q){return any(lessThanEqual(q,vec2(0.)))||any(greaterThanEqual(q,vec2(1.)));}
 float sourisHit(vec2 uv,float height){
  // A 25 cm height code gives enough depth precision without linearly
  // averaging incompatible receiver heights at a roof's silhouette.
  float y=(texture2D(sourisLightMap,uv).r*255.-1.)*.25;
  return smoothstep(.28,.54,y-height);
 }
 float sourisCast(vec3 p){
  vec2 q=p.xz-sourisLightBounds.xy-sourisLightSun.xy*(p.y-sourisLightSun.z);
  vec2 uv=q*sourisLightBounds.zw;
  if(sourisLightLive<.5||sourisOutside(uv))return 0.;
  vec2 c=uv*sourisLightSize-.5,f=fract(c),t=1./sourisLightSize,a=(floor(c)+.5)*t;
  return mix(mix(sourisHit(a,p.y),sourisHit(a+vec2(t.x,0.),p.y),f.x),
      mix(sourisHit(a+vec2(0.,t.y),p.y),sourisHit(a+t,p.y),f.x),f.y);
 }
 float sourisPerimeter(vec2 p){
  vec2 uv=(p-sourisLightBounds.xy)*sourisLightBounds.zw;
  if(sourisLightLive<.5||sourisOutside(uv))return 0.;
  vec2 cell=uv*sourisLightSize-.5,frac=fract(cell),t=1./sourisLightSize;
  vec2 a=(floor(cell)+.5)*t;
  return mix(mix(texture2D(sourisLightMap,a).g,texture2D(sourisLightMap,a+vec2(t.x,0.)).g,frac.x),
    mix(texture2D(sourisLightMap,a+vec2(0.,t.y)).g,texture2D(sourisLightMap,a+t).g,frac.x),frac.y);
 }
 vec2 sourisGroundReturn(vec2 p){
  vec2 uv=(p-sourisGroundBounds.xy)*sourisGroundBounds.zw;
  if(sourisLightLive<.5||sourisOutside(uv))return vec2(0.);
  vec2 f=texture2D(sourisGroundMap,uv).rg;
  return vec2(f.x/max(f.y,.0001),f.y);
 }
`;

// Original local presentation only. Cover and terrain remain authoritative.
export const sourisGroundLightGLSL=/*glsl*/`
 vec3 sourisSoil(vec3 col,vec3 p,float detail,float pixelFootprint){
  float direct=sourisCast(p);
  vec2 ground=sourisGroundReturn(p.xz);
  float ao=sourisPerimeter(p.xz),relativeReturn=ground.x,support=ground.y;
  if(max(direct,max(ao,support))<.002)return col;
  float small=1.-smoothstep(.17,.95,pixelFootprint);
  float grain=(noise(p.xz*2.28)-.5)*small+.51*(noise(p.xz*.72)-.5);
  float damp=noise(p.xz*.17);
  float low=(1.-smoothstep(.16,.54,relativeReturn))*support;
  // Use the measured contrasts to temper the existing aerial base, but
  // do not paint a guessed pavement polygon or equate intensity with RGB.
  vec3 neutral=col*vec3(.43,.48,.53)+vec3(.012,.014,.016);
  col=mix(col,neutral,.69*low);
  col*=1.+detail*(support*(.10*(relativeReturn-.55)+.22*grain)+.11*low*(damp-.57));
  float luma=dot(col,vec3(.2126,.7152,.0722));
  float chroma=max(max(col.r,col.g),col.b)-min(min(col.r,col.g),col.b);
  float bright=smoothstep(.15,.29,luma)*(1.-smoothstep(.055,.18,chroma));
  // Reject near-wall white bleed gently even where no support exposes
  // exact ground type; do not extend it over distant grass or the shoreline.
  col*=1.-.22*bright*smoothstep(.011,.22,ao);
  return col*(1.-.50*ao)*mix(vec3(1.),vec3(.46,.56,.68),direct);
 }
`;

export const sourisMetalGLSL=/*glsl*/`
 float sourisNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(warmWindowHash(i),warmWindowHash(i+vec2(1,0)),f.x),
   mix(warmWindowHash(i+vec2(0,1)),warmWindowHash(i+1.),f.x),f.y);
 }
 vec3 sourisClad(vec3 col,vec3 n,vec3 p,vec2 local,vec2 basis,float y,float isRoof,float fine){
  vec2 t=vec2(-basis.y,basis.x);
  vec2 along=(isRoof<.5&&abs(dot(n.xz,basis))>.72)?t:basis;
  float u=dot(local,along),v=isRoof>.5?dot(local,t):y;
  float cell=isRoof>.5?1.15:2.85;
  float seam=band(u/cell,.025,.057),edge=band(u/cell,.057,.077);
  float lap=band(v/(isRoof>.5?6.2:3.85),.061,.086);
  float fresh=sourisNoise(vec2(u*.35+4.,v*.103-7.));
  float seamTone=warmWindowHash(vec2(floor(u/cell),floor(v/(isRoof>.5?6.2:3.85))));
  vec3 warm=mix(vec3(.87,.955,1.04),vec3(1.076,1.017,.936),fresh);
  vec3 steel=col*mix(vec3(1.),warm,.63)*(.92+.125*seamTone);
  steel*=1.-fine*(.20*seam+.092*lap);
  steel+=vec3(.018,.019,.020)*edge*fine;
  float rain=sourisNoise(vec2(u*.96,v*.047+2.1))*.61+sourisNoise(vec2(u*3.1,v*.082))*.39;
  float masked=1.-smoothstep(.11,.91,fwidth(u));
  float lower=(1.-smoothstep(.16,2.5,v))*(1.-isRoof);
  float runoff=smoothstep(.54,.82,rain)*(1.-isRoof)*masked;
  steel=mix(steel,steel*vec3(.73,.74,.67),lower*(.40+.28*rain));
  steel*=1.-runoff*.105;
  float corr=u/(isRoof>.5?.47:.32);
  float ripple=sin(corr*6.2831)*(1.-smoothstep(.1,.88,fwidth(corr)));
  vec3 modeNormal=normalize(n+vec3(along.x,0.,along.y)*ripple*.11);
  vec3 view=normalize(cameraPosition-p),sun=normalize(vec3(-.60,.74,-.31));
  float bounced=max(0.,dot(modeNormal,sun))-max(0.,dot(n,sun));
  float softSheen=pow(max(0.,dot(modeNormal,normalize(view+sun))),17.);
  float exposedLower=(1.-smoothstep(.33,.67,y))*(1.-isRoof);
  steel=mix(steel,steel*vec3(.70,.71,.68),.50*exposedLower);
  return steel*(1.+.14*bounced)+vec3(.031,.036,.041)*softSheen;
 }
`;
