import {ShaderMaterial} from 'three';
import {churchSunGLSL,type ChurchGroundSun} from './church-ground-sun.ts';

const head='void main(){';
const original='col*=.90+.31*light;';
const maskKeys=['churchSunMask','churchSunBox','churchSunLive'] as const;

/** A detached specialization. The stock tile retains its program, imagery
 * slots, blend state, and mutable uniform values. The receiver's caller must
 * still qualify linked programs and the coupled ground/actor transaction. */
export function prepareIndianRiverSunReceiver(stock:ShaderMaterial,mask:ChurchGroundSun){
 const [i,j]=mask.tile,source=stock.fragmentShader,uniforms=stock.uniforms;
 if(i!==10||j!==11||stock.lights||stock.uniformsGroups.length||source.includes('churchDirectOcclusion(')||
   source.split(head).length!==2||source.split(original).length!==2||maskKeys.some(k=>k in uniforms)||
   stock.onBeforeCompile!==ShaderMaterial.prototype.onBeforeCompile||
   stock.customProgramCacheKey!==ShaderMaterial.prototype.customProgramCacheKey)return;

 const replacement=source.replace(head,churchSunGLSL+'\n'+head).replace(original,`
 if(churchSunLive>.5){
  float churchOcc=churchDirectOcclusion(p,d,coast);
  if(churchOcc>0.)col*=(.90+.31*light*(1.-.96*churchOcc))*mix(vec3(1.),vec3(.94,.97,1.),churchOcc*light);
  else ${original}
 }else ${original}
 `);
 const material=new ShaderMaterial().copy(Object.create(stock,{uniforms:{value:{}}}) as ShaderMaterial);
 material.fragmentShader=replacement;
 material.uniforms={...uniforms,...mask.uniforms};
 const names=Object.keys(uniforms),sealed={...material.uniforms};
 const vertex=stock.vertexShader,stockVersion=stock.version,version=material.version,defines=material.defines;
 const def=Object.entries(defines),stockDefines=stock.defines,originalDef=Object.entries(stockDefines);
 const tex=mask.uniforms.churchSunMask.value,box=mask.uniforms.churchSunBox.value,image=tex.image,data=image.data;
 const bounds=box.toArray(),w=image.width,h=image.height,format=tex.format,type=tex.type;
 const flags=['visible','transparent','depthWrite','depthTest','colorWrite','alphaToCoverage','blending','side','fog','toneMapped'] as const;
 const mode=flags.map(key=>stock[key]);
 let disposed=false;
 return {
  stock,material,
  intact:()=>!disposed&&stock.vertexShader===vertex&&material.vertexShader===vertex&&stock.fragmentShader===source&&
   material.fragmentShader===replacement&&stock.version===stockVersion&&material.version===version&&
   !stock.lights&&!material.lights&&flags.every((key,i)=>stock[key]===mode[i]&&material[key]===mode[i])&&
   material.defines===defines&&stock.defines===stockDefines&&Object.keys(defines).length===def.length&&
   Object.keys(stockDefines).length===originalDef.length&&def.every(([k,v])=>defines[k]===v)&&originalDef.every(([k,v])=>stockDefines[k]===v)&&
   mask.uniforms.churchSunMask.value===tex&&mask.uniforms.churchSunBox.value===box&&tex.image===image&&image.data===data&&
   image.width===w&&image.height===h&&tex.format===format&&tex.type===type&&box.x===bounds[0]&&box.y===bounds[1]&&box.z===bounds[2]&&box.w===bounds[3]&&
   stock.uniforms===uniforms&&Object.keys(uniforms).length===names.length&&
   Object.keys(material.uniforms).length===names.length+maskKeys.length&&
   names.every(k=>uniforms[k]===sealed[k]&&material.uniforms[k]===uniforms[k])&&
   maskKeys.every(k=>material.uniforms[k]===sealed[k]),
  dispose(){if(!disposed){disposed=true;material.dispose();}},
 };
}
