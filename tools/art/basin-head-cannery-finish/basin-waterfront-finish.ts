import * as T from 'three';

/** Existing unindexed Cannery only. Shores, rail, gables, roof and other faces
 * are deliberately not part of this finish. All limits are submitted vertices. */
export const FRONT_FINISH = {
 cladding: {span:[54,60], count:204, rgb:0xc9c8b8, position:'5a7d965cfd8c5d9a3f83191bac993de96bc7196ae3fc640e68d154fbb90fd8ab',
   uv:'a0a01843a4f699d9bd9088eb7e584c0191936c14da492a662c29c57d42d43aeb',normal:'f619548d1e96c6859f4286a57d0ff0f8b8cbf2f612b83291ac53fd57d3c73e7a'},
 door: {span:[0,30], count:30, rgb:0x874743, position:'7d536155051431ee1129ebb29bcaaafd7cd463fea0a6d1077ed0a41742892cbf',
   uv:'dc87a41a60af85c5057970370f68a1658609408ad171fdd2e3cee4b9b55eade8',normal:'5794d399ab259f9b17cb8675bbf32341caa04c845024baa29e97d73cdd038821'},
 gallery: {span:[24,30], count:36, rgb:0xa69c87, position:'bcb3a922019c7ffef1d3343ddbf65a3d6eea80d999c5e6f18890806fd93dd6d6',
   uv:'3c01585257bde33cf77590ea513e00cb3601a349bf4d912345361275030118a5',normal:'b9a3d2f46de1887a7fd6d77f71e66a6a34e558cee2dda17c618597d320d94004'},
} as const;
export type FrontRole=keyof typeof FRONT_FINISH;
const roles=Object.keys(FRONT_FINISH) as FrontRole[];
const streams=['position','normal','uv'] as const;
const childNames=['cladding','trim','roof','harbourRoof','timber','door','glass','gallery'].map(s=>'Cannery '+s);
type Shader={uniforms:Record<string,{value:unknown}>;vertexShader:string;fragmentShader:string};
const token=(s:string,k:string)=>s.split(k).length===2;

const functions=/*glsl*/`
// Surface profiles are in approximate *author* metres of the existing UV,
 // not measured lengths or photo-derived textures. Footprints are in pixels.
varying vec2 canneryWoodMetres;
flat varying int canneryWoodRole;
uniform float canneryWoodGain;
float cwHash(vec2 xy){
 vec3 p=fract(vec3(xy.xyx)*vec3(.1031,.1033,.0973));
 p+=dot(p,p.yzx+31.72);
 return fract((p.x+p.y)*p.z);
}
float cwNoise(vec2 q){
 vec2 i=floor(q),f=fract(q); f=f*f*(3.-2.*f);
 return mix(mix(cwHash(i),cwHash(i+vec2(1,0)),f.x),
            mix(cwHash(i+vec2(0,1)),cwHash(i+vec2(1,1)),f.x),f.y);
}
float cwIntegral(float q,float w){return floor(q)*w+min(fract(q),w);}
float cwBand(float q,float f,float w){
 float h=max(.001,.5*f);
 return (clamp((cwIntegral(q+h,w)-cwIntegral(q-h,w))/(2.*h),0.,1.)-w)*
    (1.-smoothstep(.54,1.22,f));
}
float cwSlope(float a,float b,float t){
 float f=clamp((t-a)/(b-a),0.,1.);return 6.*f*(1.-f)/(b-a);
}
struct CanneryWood{vec3 albedo; float rough; vec2 gradient;};
`;

const wall=/*glsl*/`
CanneryWood surface(vec2 p,vec2 f,int unused){
 CanneryWood o;
 const float sh=.159;
 float h=(p.y+.037)/sh,k=floor(h),r=fract(h);
 // A mildly irregular attached shake butt and staggered course across the wall
 // plane. The lap is source-observed; exact sizes, patterns and paint are art.
 float t=p.x/.235+fract(k*.381966)*.79+cwHash(vec2(k,12.))*.19;
 float strips=(1.-smoothstep(.19,.80,max(f.x/.235,f.y/sh)));
 float butt=cwBand(h+.014,f.y/sh,.108);
 float join=cwBand(t+.027,f.x/.235,.061)*strips;
 float face=(cwHash(vec2(floor(t),k))-.5)*strips;
 float grain=(cwNoise(vec2(p.x*11.0,p.y*.97)+22.)-.5)*(1.-smoothstep(.032,.11,f.x));
 float worn=cwNoise(vec2(p.x*.32,p.y*.47)+8.);
 float markField=cwNoise(vec2(p.x*.67,p.y*1.04)-12.);
 float eave=4.954993+(p.x-.309531)*.02434782;
 float under=1.-smoothstep(.025,.61,eave-p.y);
 float damp=1.-smoothstep(.10,.67+.34*worn,p.y-1.96);
 float w=clamp(.44*worn+.29*markField+.27*cwNoise(vec2(p.x*.74,p.y*.16)+13.),0.,1.);
 float stain=clamp((w-.20)/.58,0.,1.);
 float change=.968+.188*(stain-.49)-.165*under-.106*damp+.058*face+.052*grain-.162*butt-.128*join;
 o.albedo=diffuse*change*mix(vec3(.954,.986,1.045),vec3(1.051,1.007,.949),stain);
 o.rough=.90-.045*stain-.031*damp;
 float exposed=(1.-smoothstep(.18,.60,f.y/sh));
 float slope=.0023/sh*(cwSlope(.035,.158,r)-cwSlope(.251,.80,r));
 o.gradient=vec2(0.,clamp(slope,-.16,.18)*exposed);
 return o;
}
`;

const red=/*glsl*/`
CanneryWood surface(vec2 p,vec2 f,int door){
 CanneryWood o;
 const float centers[5]=float[5](2.9018555,5.6102541,8.5121095,11.4139650,14.3158205);
 float k=float(door), x=p.x-centers[door];
 float top=4.21-p.y,bottom=p.y-2.06;
 float edge=min(.522334-abs(x),min(top,bottom));
 float inset=1.-smoothstep(.012,.088+f.x*.3,edge);
 float rub=cwNoise(vec2(p.x*2.11,p.y*.55)+vec2(k*2.6,17.0));
 float window=1.-smoothstep(.06,.53+rub*.19,bottom);
 float running=cwNoise(vec2(p.x*3.4,p.y*.70)+vec2(k*1.01,-18.0));
 float g0=cwNoise(vec2(p.x*19.8,p.y*2.25)+vec2(7.,k))-.5;
 float grain=g0*(1.-smoothstep(.029,.12,f.x));
 float pitch=.155+(cwHash(vec2(k,20.))-.5)*.026;
 float stem=(x+.30)/pitch, board=cwHash(vec2(floor(stem),k*2.53))-.5;
 float fine=1.-smoothstep(.24,.86,f.x/pitch);
 float seam=cwBand(stem+.021,f.x/pitch,.069);
 float sw=1.-smoothstep(.018,.32,top);
 float colour=.96+.091*(cwHash(vec2(k,4.51))-.5)+.12*(running-.5)+.13*board*fine+.101*grain-.179*seam-.19*inset-.10*sw;
 vec3 oxide=diffuse*vec3(1.072,1.016,.96)*colour;
 o.albedo=mix(oxide,oxide*vec3(1.13,1.39,1.42),window*(.23+.14*rub));
 o.rough=.76+.106*window+.069*running;
 float r=fract(stem);
 // Optical edge relief on the same plane; not a new split or door hardware.
 float slope=.0021/pitch*(cwSlope(.037,.158,r)-cwSlope(.843,.963,r));
 o.gradient=vec2(clamp(slope,-.2,.2)*fine,0.);
 return o;
}
`;

const deck=/*glsl*/`
CanneryWood surface(vec2 p,vec2 f,int unused){
 CanneryWood o;
 const float width=.176;
 float board=(p.x+.071)/width,id=floor(board),r=fract(board);
 float l=2.72+1.38*cwHash(vec2(id,6.1));
 float q=p.y/l+cwHash(vec2(id,2.87));
 float w=cwNoise(vec2(p.x*.91,p.y*.50)+vec2(23.,-7.));
 float fleck=(cwNoise(vec2(p.x*10.8,p.y*1.17)+vec2(1.,12.))-.5)*(1.-smoothstep(.031,.135,f.x));
 float coarse=cwNoise(vec2(p.x*1.48,p.y*.77)-vec2(8.,22.));
 float step=f.x/width, fin=1.-smoothstep(.21,.78,step), lengthFade=1.-smoothstep(.23,.68,f.y/l);
 float plank=(cwHash(vec2(id,floor(q)))-.5)*fin*lengthFade;
 float split=cwBand(board+.027,step,.092);
 float end=cwBand(q+.011,f.y/l,.025)*fin;
 // Give the sheltered return just below the existing cladding a softer
 // dark part; not a physical shade cast or a claim about actual traffic.
 float sheltered=(1.-smoothstep(.012,.50,p.x-14.063348));
 float field=.763+.18*(w-.42)+.074*(coarse-.5)+.152*plank+.09*fleck-.235*split-.17*end-.143*sheltered;
 vec3 m=mix(vec3(.91,1.02,1.14),vec3(1.065,1.026,.974),clamp(w*.82+coarse*.24,0.,1.));
 o.albedo=diffuse*field*m;
 o.rough=.83+.105*w;
 float slope=.0031/width*(cwSlope(.034,.175,r)-cwSlope(.825,.966,r));
 o.gradient=vec2(clamp(slope,-.185,.185)*fin,0.);
 return o;
}
`;

const active=/*glsl*/`
// Derivatives are formed on all covered fragments before the flat face gate.
vec2 cwU=dFdx(canneryWoodMetres),cwV=dFdy(canneryWoodMetres);
vec3 cwX=dFdx(-vViewPosition),cwY=dFdy(-vViewPosition);
if(canneryWoodRole>=0&&canneryWoodGain>0.){
 CanneryWood cw=surface(canneryWoodMetres,abs(cwU)+abs(cwV),canneryWoodRole);
 diffuseColor.rgb=mix(diffuseColor.rgb,cw.albedo,canneryWoodGain);
 roughnessFactor=mix(roughnessFactor,cw.rough,canneryWoodGain);
 vec3 rx=cross(cwY,normal),ry=cross(normal,cwX);
 float d=dot(cwX,rx);
 if(abs(d)>1.e-9)normal=normalize(abs(d)*normal-sign(d)*canneryWoodGain*
   (dot(cw.gradient,cwU)*rx+dot(cw.gradient,cwV)*ry));
}
`;

export function patchCanneryWood(shader:Shader,role:FrontRole,gain:{value:number}){
 const c='#include <common>',u='#include <uv_vertex>',n='#include <normal_fragment_maps>';
 if(!token(shader.vertexShader,c)||!token(shader.vertexShader,u)||!token(shader.fragmentShader,c)||
    !token(shader.fragmentShader,n)||'canneryWoodGain' in shader.uniforms)return false;
 const [a,b]=FRONT_FINISH[role].span;
 const owner=role==='door'?'gl_VertexID/6':'0';
 shader.vertexShader=shader.vertexShader
  .replace(c,c+'\nvarying vec2 canneryWoodMetres;\nflat varying int canneryWoodRole;')
  .replace(u,u+`\ncanneryWoodMetres=uv;\ncanneryWoodRole=(gl_VertexID>=${a}&&gl_VertexID<${b})?${owner}:-1;`);
 shader.fragmentShader=shader.fragmentShader
  .replace(c,c+functions+({cladding:wall,door:red,gallery:deck}[role]))
  .replace(n,n+active);
 shader.uniforms.canneryWoodGain=gain;
 return true;
}

type Owner=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
function valid(o:T.Object3D,role:FrontRole,stockKey:boolean){
 if(!(o instanceof T.Mesh)||!(o.material instanceof T.MeshStandardMaterial))return;
 const m=o.material,g=o.geometry,r=FRONT_FINISH[role];
 if(g.index||g.drawRange.start!==0||g.drawRange.count!==Infinity||g.groups.length||Object.keys(g.morphAttributes).length||
    Object.keys(g.attributes).length!==3||(!stockKey?false:m.customProgramCacheKey()!=='basin-cannery-v1-'+role)||
    !m.color.equals(new T.Color(r.rgb))||!m.depthTest||!m.depthWrite||!m.colorWrite||m.side!==T.DoubleSide||
    m.roughness!==.83||m.metalness!==0||m.opacity!==1||m.transparent||m.alphaHash||m.alphaTest!==0||m.alphaToCoverage||
    m.map||m.normalMap||m.bumpMap||m.envMap||m.alphaMap||m.roughnessMap||m.metalnessMap||m.flatShading||!m.toneMapped)return;
 const a=streams.map(s=>g.getAttribute(s));
 if(a.some((x,i)=>!(x instanceof T.BufferAttribute)||x.normalized||x.count!==r.count||
   x.itemSize!==(i===2?2:3)||!(x.array instanceof Float32Array)))return;
 return {mesh:o as Owner,material:m,geometry:g,attrs:a,arrays:a.map(x=>x.array)};
}
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
/** Private preparation on the already owned, validated current preview actor.
 * Exact Node generation is tested; a differently packed engine seat refuses.
 * No load/activation policy, visibility changes, or alternate draw calls. */
export async function prepareCanneryWaterfrontFinish(group:T.Group){
 if(T.REVISION!=='187'||!group.isGroup||group.name!=='Historic Cannery at Basin Head'||
    group.children.length!==8||group.children.some((o,i)=>o.name!==childNames[i])||!globalThis.crypto?.subtle)return;
 const selected=[];
 for(const k of roles){
  const mesh=group.children.find(o=>o.name==='Cannery '+k)!;
  const a=valid(mesh,k,true);if(!a)return;
  selected.push({...a,role:k,before:a.material.onBeforeCompile,authorKey:a.material.customProgramCacheKey});
 }
 const custody=await Promise.all(selected.map(async a=>Promise.all(a.arrays.map(async (b,i)=>{
  const q=new Uint8Array(b.buffer,b.byteOffset,b.byteLength).slice();
  return hex(await crypto.subtle.digest('SHA-256',q))===FRONT_FINISH[a.role][streams[i]];
 }))));
 if(custody.some(q=>q.includes(false))||selected.some(a=>{
  const q=valid(a.mesh,a.role,true);
  return !q||a.mesh.parent!==group||q.geometry!==a.geometry||q.material!==a.material||
    a.material.onBeforeCompile!==a.before||a.material.customProgramCacheKey!==a.authorKey||
    a.attrs.some((v,i)=>v!==q.attrs[i]||a.arrays[i]!==q.arrays[i]);
 }))return;
 const gain={value:0};let released=false;
 const leases=selected.map(a=>{
  const m=a.material;
  const hook:typeof a.before=function(this:T.MeshStandardMaterial,s,r){a.before.call(this,s,r);patchCanneryWood(s,a.role,gain);};
  const key=()=> 'basin-cannery-v1/'+a.role+'/waterfront-wood-1';
  m.onBeforeCompile=hook;m.customProgramCacheKey=key;m.needsUpdate=true;
  return {...a,hook,key};
 });
 return {set(enabled:boolean){
  if(released||leases.some(l=>l.mesh.parent!==group||l.mesh.geometry!==l.geometry||
     l.mesh.material!==l.material||l.material.onBeforeCompile!==l.hook||l.material.customProgramCacheKey!==l.key)){
   gain.value=0;return false;
  }
  gain.value=enabled?1:0;return true;
 },release(){
  if(released)return;released=true;gain.value=0;
  for(const l of leases)if(l.material.onBeforeCompile===l.hook&&l.material.customProgramCacheKey===l.key){
   l.material.onBeforeCompile=l.before;l.material.customProgramCacheKey=l.authorKey;l.material.needsUpdate=true;
  }
 }};
}
