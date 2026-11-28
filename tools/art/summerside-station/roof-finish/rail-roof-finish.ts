import * as T from 'three';

/** Straight shared edges of the submitted 268-face F32 pitched roof, owner
 * q032001/163. The finish uses those physical joins, not a projected photo.
 * The lower-pitch skirts' long change-of-pitch lines are NOT drainage valleys.
 * A ridge cap, throat stain and tiny lapped profile are art, never surveyed. */
export const valleys = [
 [15.25725,7.77434,-2.23112,18.94181,4.31303,-7.38108],
 [8.38745,4.27540,2.83848,12.08424,7.76954,-2.25144],
 [8.61716,4.32688,-7.40321,12.08424,7.76954,-2.25144],
 [15.25725,7.77434,-2.23112,18.83812,4.34296,2.82955],
 [.14,6.99214,-1.21488,1.59,5.72920,.64886],
 [-1.28,5.77826,.55221,.14,6.99214,-1.21488],
 [-1.58,6.97593,-3.49235,-.53,6.07091,-4.83854],
 [-2.63,6.08698,-4.82326,-1.58,6.97593,-3.49235],
] as const;
export const caps = [
 [-10.13813,7.73590,-2.39373,12.08424,7.76954,-2.25144],
 [13.56927,9.32766,4.96097,13.74549,9.25727,-9.48015],
 [15.25725,7.77434,-2.23112,25.28500,7.78952,-2.16691],
 [-16.22621,4.36020,-7.45645,-10.13813,7.73590,-2.39373],
 [-15.84923,4.40400,2.44101,-10.13813,7.73590,-2.39373],
 [.14,6.88532,2.6,.14,6.99214,-1.21488],
 [-1.58,6.90122,-7.05,-1.58,6.97593,-3.49235],
] as const;
const vec=(v:readonly number[])=>'vec3('+v.map(x=>x.toFixed(5)).join(',')+')';
const lines=(name:string,ss:readonly (readonly number[])[])=>ss.map(s=>
 ` ${name}=min(${name},railSegment2(p,${vec(s.slice(0,3))},${vec(s.slice(3,6))}));`).join('\n');

const definitions=/*glsl*/`
varying vec3 railFinishPosition;
varying vec3 railFinishPlane;
uniform float railFinishGain;
float railSegment2(vec3 p,vec3 a,vec3 b){
 vec3 d=b-a, v=p-a;
 vec3 q=v-d*clamp(dot(v,d)/dot(d,d),0.,1.);
 return dot(q,q);
}
float railScramble(vec2 p){
 vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
 q+=dot(q,q.yzx+33.33);
 return fract((q.x+q.y)*q.z);
}
float railNoise(vec2 p){
 vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(railScramble(a),railScramble(a+vec2(1.,0.)),f.x),
            mix(railScramble(a+vec2(0.,1.)),railScramble(a+vec2(1.,1.)),f.x),f.y);
}
// Mean coverage of a repeated finite lap strip over the projected one-pixel
// footprint. At sub-pixel size it tends to the constant course coverage.
float railLapIntegral(float x,float width){
 return floor(x)*width+min(fract(x),width);
}
float railLap(float x,float span,float width){
 float t=max(span*.5,.001);
 return clamp((railLapIntegral(x+t,width)-railLapIntegral(x-t,width))/(2.*t),0.,1.);
}
float railRampDerivative(float lo,float hi,float x){
 float t=clamp((x-lo)/(hi-lo),0.,1.);
 return 6.*t*(1.-t)/(hi-lo);
}
struct RailRoofSurface { vec3 reflectance; float rough; vec2 gradient; };
RailRoofSurface railRoof(vec3 p,vec2 uv,vec2 foot){
 RailRoofSurface t;
 // Original scale choice for a dark, small-format lapped skin, not
 // reconstruction of a make, precise shingle size, or observed repair.
 const float course=.155, tab=.312;
 float row=uv.y/course, f=fract(row), r=floor(row);
 float joint=uv.x/tab+fract(r*.381966)*.91+railScramble(vec2(r,4.))* .17;
 float laps=(railLap(row+.023,foot.y/course,.122)-.122)*(1.-smoothstep(.48,1.45,foot.y/course));
 float tabDetail=(1.-smoothstep(.24,.87,foot.x/tab))*(1.-smoothstep(.28,1.02,foot.y/course));
 float tabFace=railScramble(vec2(floor(joint),r))-.5;
 float tabLine=(railLap(joint+.021,foot.x/tab,.057)-.057)*tabDetail;

 // Muted irregular wet/dry tonal families; elongated mildly down the
 // actual plane's runoff direction. No regular streaks or copied stains.
 vec2 v=uv*vec2(.34,.107)+vec2(19.01,-13.37);
 float warp=railNoise(uv*vec2(.17,.29)+7.);
 float z=railNoise(v+vec2(.89*warp,.26*warp));
 float mat=railNoise(uv*vec2(.60,.41)+vec2(12.4,8.2));
 float fleck=railNoise(uv*vec2(2.35,1.89)-17.);
 float wear=smoothstep(.27,.72,z*.76+mat*.24);
 float grain=(fleck-.5)*(1.-smoothstep(.14,.49,max(foot.x,foot.y)));
 float cap2=1e4,valley2=1e4;
 ${lines('cap2',caps)}
 ${lines('valley2',valleys)}
 float dc=sqrt(cap2),dv=sqrt(valley2);
 float metricFoot=max(foot.x,foot.y);
 float exactLip=1.-smoothstep(.055,.155+metricFoot*.5,dc);
 exactLip*=1.-smoothstep(.145,.46,metricFoot);
 float underLip=(1.-smoothstep(.10,.26+metricFoot*.45,dc))*(1.-exactLip*.90);
 float damp=1.-smoothstep(.025,.39+mat*.22,dv);
 float throat=(1.-smoothstep(.040,.125+metricFoot*.3,dv))*(1.-smoothstep(.19,.61,metricFoot));
 float large=1.-smoothstep(.72,2.80,metricFoot);
 float shift=large*(.295*(wear-.47)+.061*(mat-.5)+.072*grain-.17*damp-.073*throat
    +.165*exactLip-.086*underLip-.117*laps+(tabFace*.104)*tabDetail-.073*tabLine);
 t.reflectance=(1.+shift)*mix(vec3(.974,1.0,1.018),vec3(1.025,1.006,.980),wear);
 t.rough=large*(.064*(wear-.45)-.155*throat-.106*exactLip+.032*damp+.026*grain);
 // The overlap is millimetre-scale optical relief only. The finite return
 // and slow lay are bounded in the same local metres used for the mesh.
 float resolved=(1.-smoothstep(.14,.51,foot.y/course))*(1.-exactLip)*(1.-throat);
 float broader=clamp(.0027/course*(railRampDerivative(.030,.16,f)-railRampDerivative(.27,.88,f)),
                     -.17,.19);
 t.gradient=vec2(0.,broader*resolved);
 return t;
}
`;

const useFinish=/*glsl*/`
if (railFinishGain>0.) {
 vec3 railPlane=normalize(railFinishPlane);
 vec3 railUp=vec3(0.,1.,0.);
 vec3 railAcross=normalize(cross(railUp,railPlane));
 vec3 railRun=normalize(railUp-railPlane*railPlane.y);
 vec2 railUV=vec2(dot(railFinishPosition,railAcross),dot(railFinishPosition,railRun));
 vec2 railDx=dFdx(railUV),railDy=dFdy(railUV);
 RailRoofSurface railSample=railRoof(railFinishPosition,railUV,abs(railDx)+abs(railDy));
 diffuseColor.rgb*=mix(vec3(1.),railSample.reflectance,railFinishGain);
 roughnessFactor=clamp(roughnessFactor+railSample.rough*railFinishGain,.60,.98);
 vec3 railSx=dFdx(-vViewPosition),railSy=dFdy(-vViewPosition);
 vec3 railRx=cross(railSy,normal),railRy=cross(normal,railSx);
 float railDet=dot(railSx,railRx);
 if(abs(railDet)>1.e-9){
  vec3 railGradient=dot(railSample.gradient,railDx)*railRx+dot(railSample.gradient,railDy)*railRy;
  normal=normalize(abs(railDet)*normal-sign(railDet)*railFinishGain*railGradient);
 }
}
`;

type Program={vertexShader:string;fragmentShader:string;uniforms:Record<string,{value:unknown}>};
const featureTokens=['#include <common>','#include <begin_vertex>','#include <normal_fragment_maps>'] as const;
const single=(s:string,t:string)=>s.split(t).length===2;
/** No alpha, clipping, position, shadow, sampler, depth or output writes. */
export function compileRailRoofFinish(shader:Program, gain:{value:number}):boolean{
 const [common,begin,maps]=featureTokens;
 if(!single(shader.vertexShader,common)||!single(shader.vertexShader,begin)||
    !single(shader.fragmentShader,common)||!single(shader.fragmentShader,maps)||
    'railFinishGain' in shader.uniforms)return false;
 shader.vertexShader=shader.vertexShader
  .replace(common,common+'\nvarying vec3 railFinishPosition;\nvarying vec3 railFinishPlane;')
  .replace(begin,begin+'\nrailFinishPosition=position;\nrailFinishPlane=normal;');
 shader.fragmentShader=shader.fragmentShader.replace(common,common+'\n'+definitions).replace(maps,maps+'\n'+useFinish);
 shader.uniforms.railFinishGain=gain;
 return true;
}

const authority = {
 position:'dbb55bec7de3d898285cab9e4ff7c45bf5afb259875e8628787d624f65f5bc66',
 normal:'668240e9c1cd2b63eb2c90d418dd28b2cd6cdc03a2b83baae52288a26c4fe4c9',
 uv:'d89899670a144489399a5ad5b0f78ef42703074642da1be31cf14fb0941e5f4c',
 color:'35788553309fa99d6c5d015197f17fd84e50bf5185c2dc429e308d8db8c3398f',
 index:'d8c22e7ab1a4b4ad6ada9a6a9d96a0f076a16ef16bf9b780301fc2d23917736e',
 map:'b3a7ca62bcf7522dfe297a05bdad2cb8ce251d2d0885f5f8ac17074b6c69c4dc',
} as const;
type Data=Float32Array|Uint16Array|Uint8Array;
function inspect(art:T.Group){
 if(T.REVISION!=='187'||!art.isGroup||art.children.length!==10)return;
 const seen=art.children.filter(q=>q.name==='roof');
 if(seen.length!==1||!(seen[0] instanceof T.Mesh)||!(seen[0].material instanceof T.MeshStandardMaterial))return;
 const roof=seen[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const m=roof.material,g=roof.geometry,map=m.map;
 if(m.name!=='roof'||m.customProgramCacheKey()!=='summ-rail-base'||!m.vertexColors||m.transparent||m.opacity!==1||
    m.side!==T.FrontSide||!m.color.equals(new T.Color(1,1,1))||!m.depthTest||!m.depthWrite||!m.colorWrite||
    m.alphaToCoverage||m.alphaTest!==0||m.alphaHash||!m.toneMapped||m.flatShading||m.normalMap||m.bumpMap||
    m.roughnessMap||m.metalnessMap||m.alphaMap||m.aoMap||m.envMap||m.roughness!==.84||m.metalness!==.02||
    !(map instanceof T.DataTexture)||map.colorSpace!==T.SRGBColorSpace||map.format!==T.RGBAFormat||map.type!==T.UnsignedByteType||
    map.wrapS!==T.RepeatWrapping||map.wrapT!==T.RepeatWrapping||map.anisotropy!==4||map.flipY||!map.generateMipmaps||
    map.minFilter!==T.LinearMipmapLinearFilter||map.magFilter!==T.LinearFilter||
    map.repeat.x!==.6329113924050632||map.repeat.y!==.8130081300813008||map.rotation!==0||map.offset.x!==0||map.offset.y!==0||
    map.image.width!==256||map.image.height!==256||!(map.image.data instanceof Uint8Array)||map.image.data.byteLength!==262144||
    g.groups.length!==0||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==4||
    Object.keys(g.morphAttributes).length!==0)return;
 const data={} as Record<keyof typeof authority,Data>;
 for(const [a,width] of [['position',3],['normal',3],['uv',2],['color',3],['index',1]] as const){
  const b=a==='index'?g.index:g.getAttribute(a);
  if(!(b instanceof T.BufferAttribute)||b.normalized||b.itemSize!==width||b.count!==804||
     !(a==='index'?b.array instanceof Uint16Array:b.array instanceof Float32Array))return;
  data[a]=b.array as Data;
 }
 data.map=map.image.data;
 return {roof,g,m,map,data};
}
/** Prepared only on this station's privately owned, already verified base
 * artwork. No global component, networking, texture ownership or draw
 * change. Do not attach a variant to the separately optional shadow mode. */
export async function prepareRailRoofFinish(art:T.Group){
 const v=inspect(art);if(!v||!globalThis.crypto?.subtle)return;
 const cb=v.m.onBeforeCompile,k=v.m.customProgramCacheKey;
 const keys=Object.keys(authority) as (keyof typeof authority)[];
 const bytes=await Promise.all(keys.map(a=>{
  const q=v.data[a];
  return crypto.subtle.digest('SHA-256',new Uint8Array(q.buffer,q.byteOffset,q.byteLength).slice());
 }));
 if(bytes.some((b,i)=>Array.from(new Uint8Array(b),q=>q.toString(16).padStart(2,'0')).join('')!==authority[keys[i]]))return;
 const after=inspect(art);
 if(!after||after.roof!==v.roof||after.g!==v.g||after.m!==v.m||after.map!==v.map||
    keys.some(a=>after.data[a]!==v.data[a])||v.m.onBeforeCompile!==cb||v.m.customProgramCacheKey!==k)return;
 const gain={value:0};let released=false;
 const beforeCompile:typeof cb=function(this:T.MeshStandardMaterial,s,r){cb.call(this,s,r);compileRailRoofFinish(s,gain);};
 const cacheKey=()=> 'summ-rail-base/registered-lapped-roof-v1';
 v.m.onBeforeCompile=beforeCompile;v.m.customProgramCacheKey=cacheKey;v.m.needsUpdate=true;
 return {set(active:boolean){
  if(released||v.roof.parent!==art||v.roof.geometry!==v.g||v.roof.material!==v.m||
     v.m.map!==v.map||v.m.onBeforeCompile!==beforeCompile||v.m.customProgramCacheKey!==cacheKey){gain.value=0;return false;}
  gain.value=active?1:0;
  return true;
 },release(){
  if(released)return;released=true;gain.value=0;
  // The standard decoder owns this material; do not clobber a later owner.
  if(v.m.onBeforeCompile===beforeCompile&&v.m.customProgramCacheKey===cacheKey){
   v.m.onBeforeCompile=cb;v.m.customProgramCacheKey=k;v.m.needsUpdate=true;
  }
 }};
}
