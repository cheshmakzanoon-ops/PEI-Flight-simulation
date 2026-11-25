import * as T from 'three';
import type {VerifiedAerialSky} from './aerial-perspective-lab.ts';

/** The verified Standard sky already loaded by the world, not its PMREM clone.
 * The owner-opt-in cannot initiate a sky transfer or ask for a different source. */
export type DalvayGlazingSource={
 readonly verified:VerifiedAerialSky;
 readonly panorama:T.Texture;
 readonly scene:T.Scene;
 readonly viewer:T.PerspectiveCamera;
 readonly engine:T.WebGLRenderer;
 readonly report:(active:boolean)=>void;
};
// One set of coefficients for shader and offline optical witnesses. These are
// creative parameters, not a measured index of refraction or glazing product.
const glass={f0:.046,grazing:.23,under:.27,underEnd:-.065,aboveStart:.17,mipMin:4.65,mipMax:10.25,mipBias:.76,
 pixelLo:.21,pixelHi:.81,farLo:310,farHi:570,nearLo:.48,nearHi:1.42,nearScale:5} as const;
const gl=Object.fromEntries(Object.entries(glass).map(([k,v])=>[k,Number.isInteger(v)?v.toFixed(1):String(v)])) as Record<keyof typeof glass,string>;
const sampler='dalvayOriginalSky',near='dalvayGlassNear';
const constant='dalvay-finish-original-sky-1';
const common='#include <common>',output='#include <opaque_fragment>';
const underTint=[glass.under*.97,glass.under,glass.under*1.034] as const;

const opticalFragment=`
uniform sampler2D ${sampler};
uniform float ${near};
float dvGlassFresnel(float ndv){
 float x=1.-clamp(ndv,0.,1.),x2=x*x;
 return ${gl.f0}+${gl.grazing}*x2*x2*x;
}
vec3 dvGlazing(vec3 stock,vec3 viewNormal,vec3 viewDir,vec3 viewPosition){
 // This is the original screen sky's azimuth registration. No invented
 // trees, room, ground reflection, new environment texture or scene pass.
 vec3 ray=transformDirectionByInverseViewMatrix(reflect(-viewDir,viewNormal),viewMatrix);
 float pole=length(ray.xz);
 float u=0.5+0.512+0.159154943*(pole>1.e-4?atan(ray.z,ray.x):0.);
 float v=.5+.318309886*asin(clamp(ray.y,-.025,.994));
 vec2 uv=vec2(u,v),du=dFdx(uv),dv=dFdy(uv);
 du.x-=floor(du.x+.5);dv.x-=floor(dv.x+.5);
 vec2 texels=vec2(4096.,2048.);
 float mipPixels=max(length(du*texels),length(dv*texels));
 float screenMetres=max(length(dFdx(viewPosition)),length(dFdy(viewPosition)));
 float distanceM=length(viewPosition),z=viewPosition.z;
 // Reject singular derivatives, near clipping, and far unresolved pixels
 // without changing depth, colour, geometry, or the existing shader below.
 if(!(pole>=0. && pole<=1.001 && abs(ray.y)<=1.001 && mipPixels>=0. && mipPixels<1.e7 && screenMetres>=0. &&
      screenMetres<${gl.pixelHi} && distanceM<${gl.farHi} &&
      z>max(${gl.nearLo},${near}*${gl.nearScale})))return stock;
 float m=clamp(log2(max(1.,mipPixels))+${gl.mipBias},${gl.mipMin},${gl.mipMax});
 m=mix(${gl.mipMax},m,smoothstep(.028,.16,pole));
 float farFade=1.-smoothstep(${gl.farLo},${gl.farHi},distanceM);
 float areaFade=1.-smoothstep(${gl.pixelLo},${gl.pixelHi},screenMetres);
 float nearFade=smoothstep(max(${gl.nearLo},${near}*${gl.nearScale}),max(${gl.nearHi},12.*${near}),z);
 float f=farFade*areaFade*nearFade*dvGlassFresnel(abs(dot(viewNormal,viewDir)));
 float up=smoothstep(${gl.underEnd},${gl.aboveStart},ray.y);
 vec3 low=vec3(${underTint.map(x=>x.toFixed(6)).join(',')});
 if(up<=0.)return mix(stock,low,f);
 // Hardware samples the existing mip chain in linear space. Compress the
 // panorama highlights smoothly, retaining broad cloud hue without a white coat.
 vec3 sky=textureLod(${sampler},uv,m).rgb*.9;
 float l=dot(sky,vec3(.2126,.7152,.0722));
 vec3 cloud=mix(vec3(l),sky,.57);
 vec3 upper=vec3(.079,.086,.097)+cloud/(1.+1.12*cloud)*.83;
 return mix(stock,mix(low,upper,up),f);
}`;
export function dalvayGlazingFragment(fragment:string){
 const once=(x:string)=>fragment.indexOf(x)>=0&&fragment.indexOf(x)===fragment.lastIndexOf(x);
 if(!once(common)||!once(output)||!fragment.includes('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;')||
    !fragment.includes('#include <lights_fragment_begin>')||fragment.includes(sampler))return;
 return fragment.replace(common,common+'\n'+opticalFragment).replace(output,
  'outgoingLight=dvGlazing(outgoingLight,normal,geometryViewDir,vViewPosition);\n'+output);
}

/** Reference calculation for the registered finite/angle/horizon/filter gate.
 * Scope is only these chosen coefficients, not measured glass or a GPU result. */
export function dalvayGlazingWitness(p:{viewCos:number;rayY:number;footprintPx:number;pixelM:number;distanceM:number;viewZ:number;cameraNear:number;skyLinear:readonly [number,number,number]}){
 const {viewCos,rayY,footprintPx,pixelM,distanceM,viewZ,cameraNear,skyLinear}=p;
 if(![viewCos,rayY,footprintPx,pixelM,distanceM,viewZ,cameraNear,...skyLinear].every(Number.isFinite)||cameraNear<=0||
    footprintPx<0||footprintPx>=1e7||pixelM<0||pixelM>=glass.pixelHi||distanceM<0||distanceM>=glass.farHi||
    viewZ<=Math.max(glass.nearLo,cameraNear*glass.nearScale)||skyLinear.some(c=>c<0||c>1))return;
 const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const smooth=(a:number,b:number,v:number)=>{const x=clamp((v-a)/(b-a));return x*x*(3.-2.*x);};
 const layer=(glass.f0+glass.grazing*(1-clamp(Math.abs(viewCos)))**5)*(1-smooth(glass.pixelLo,glass.pixelHi,pixelM))*
  (1-smooth(glass.farLo,glass.farHi,distanceM))*smooth(Math.max(glass.nearLo,cameraNear*glass.nearScale),Math.max(glass.nearHi,12*cameraNear),viewZ);
 const pole=Math.sqrt(Math.max(0,1-clamp(rayY,-1,1)**2)),lod=clamp(Math.log2(Math.max(1,footprintPx))+glass.mipBias,glass.mipMin,glass.mipMax);
 const horizon=smooth(glass.underEnd,glass.aboveStart,rayY),l=(skyLinear[0]*.2126+skyLinear[1]*.7152+skyLinear[2]*.0722)*.9;
 const radiance=skyLinear.map((ch,i)=>{const cl=.43*l+.57*.9*ch;return underTint[i]+horizon*([.079,.086,.097][i]+.83*cl/(1+1.12*cl)-underTint[i]);});
 return {layer,mip:glass.mipMax+(lod-glass.mipMax)*smooth(.028,.16,pole),horizon,radiance};
}

/** Keep the existing material ID, attributes, index, depth writes, and draw.
 * A qualified main-camera pass selects a distinct exact shader program on
 * this one object. Every other pass selects the original stock hooks again. */
export function bindDalvayGlazing(mesh:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,source:DalvayGlazingSource){
 const {verified,panorama,scene,viewer,engine,report}=source,material=mesh.material,geo=mesh.geometry,environment=scene.environment;
 if(!environment||verified?.texture!==panorama||!panorama.isTexture||!material.isMeshStandardMaterial||material.name!=='Dalvay · glazing'||
    material.onBeforeCompile!==T.Material.prototype.onBeforeCompile||material.customProgramCacheKey!==T.Material.prototype.customProgramCacheKey||
    geo.index?.count!==1512||geo.getAttribute('position')?.count!==1216)return;
 const img=panorama.image as {width:number;height:number}|undefined,owner=panorama.source,version=owner.version,skyVersion=panorama.version;
 const validSky=()=>verified.texture===panorama&&!!img&&img.width===4096&&img.height===2048&&panorama.image===img&&panorama.source===owner&&owner.version===version&&
  panorama.version===skyVersion&&panorama.mapping===T.UVMapping&&panorama.colorSpace===T.SRGBColorSpace&&panorama.generateMipmaps===true&&
  panorama.wrapS===T.RepeatWrapping&&panorama.wrapT===T.ClampToEdgeWrapping&&panorama.minFilter===T.LinearMipmapLinearFilter&&
  panorama.magFilter===T.LinearFilter&&panorama.flipY===true&&panorama.format===T.RGBAFormat&&panorama.type===T.UnsignedByteType&&
  scene.environment===environment&&environment.source===owner&&environment.image===img&&environment.mapping===T.EquirectangularReflectionMapping&&
  scene.environmentIntensity===.77&&scene.environmentRotation.x===0&&scene.environmentRotation.y===-.512*Math.PI*2&&scene.environmentRotation.z===0;
 const opaque=()=>!material.transparent&&material.opacity===1&&material.depthWrite&&material.depthTest&&material.colorWrite&&material.envMap===null&&
  material.alphaTest===0&&material.side===T.DoubleSide&&material.roughness===.29&&material.metalness===.08;
 if(engine.capabilities.maxTextures<16||!validSky()||!opaque()||!viewer.isPerspectiveCamera)return;
 const stockCompiler=material.onBeforeCompile,stockKey=material.customProgramCacheKey,priorDraw=mesh.onBeforeRender;
 const waterlessSky={value:panorama},nativeNear={value:viewer.near};
 let active=false,closed=false,driverFallback=false,previousPass=false;
 const artKey=()=>constant;
 const compile:typeof stockCompiler=(shader,renderer)=>{
  const fragment=dalvayGlazingFragment(shader.fragmentShader);
  if(!fragment||renderer!==engine){driverFallback=true;report(false);return;}
  shader.fragmentShader=fragment;shader.uniforms[sampler]=waterlessSky;shader.uniforms[near]=nativeNear;
 };
 const select=(next:boolean)=>{
  if(active===next)return;
  if(next){
   if(material.onBeforeCompile!==stockCompiler||material.customProgramCacheKey!==stockKey)return;
   material.onBeforeCompile=compile;material.customProgramCacheKey=artKey;
  }else{
   if(material.onBeforeCompile===compile)material.onBeforeCompile=stockCompiler;
   if(material.customProgramCacheKey===artKey)material.customProgramCacheKey=stockKey;
  }
  // Three stores one uniforms object on a material, not one per cached
  // program. Switching mutable hooks on an already drawn material otherwise
  // reuses the wrong sampler locations when returning to a cached program.
  // Invalidate only this material's renderer cache at the actual transition,
  // preserving its object ID/render ordering and every texture/draw owner.
  if(previousPass)material.dispose();
  material.needsUpdate=true;active=next;report(next&&!driverFallback);
 };
 const draw:typeof priorDraw=function(this:typeof mesh,renderer,world,camera,geometry,mat,group){
  priorDraw.call(this,renderer,world,camera,geometry,mat,group);
  const next=!closed&&!driverFallback&&renderer===engine&&world===scene&&camera===viewer&&mat===material&&geometry===geo&&
   mesh.material===material&&mesh.geometry===geo&&
   (!active||material.onBeforeCompile===compile&&material.customProgramCacheKey===artKey)&&
   scene.overrideMaterial===null&&renderer.getRenderTarget()===null&&!renderer.xr.isPresenting&&!renderer.getContext().isContextLost()&&
   Number.isFinite(viewer.near)&&viewer.near>0&&Number.isFinite(viewer.far)&&viewer.far>viewer.near&&validSky()&&opaque();
  if(next)nativeNear.value=viewer.near;
  select(next);previousPass=true;
 };
 mesh.onBeforeRender=draw;
 return {dispose(){
  if(closed)return;
  closed=true;select(false);
  if(mesh.onBeforeRender===draw)mesh.onBeforeRender=priorDraw;
 }};
}
