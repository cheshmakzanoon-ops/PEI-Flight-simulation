import {keepSupplementalCanopyLegacyBlend} from '../canopy-coverage-alpha.ts';
import * as T from 'three';
import type {CanopyRow} from './assets.ts';
import type {RegionalStand} from './spec.ts';
export type CanopySeat=(x:number,z:number,h:number,w:number)=>number|undefined;
const anchor='clamp((a-.30)*3.8,0.,1.)';
/** Precisely the stock crown atlas and stock billboard vertex family. The only
 * optical modification affects this new mesh's alpha-to-coverage gain. */
export function createRegionalCanopy(scene:T.Scene,base:T.ShaderMaterial,s:RegionalStand,rows:readonly CanopyRow[],seat:CanopySeat){
 const total=rows.length;
 const keys=Object.keys(base.uniforms);
 const sun=base.uniforms.canopySun?.value;
 const directional=keys.length===2&&keys.includes('canopySun')&&sun?.isVector3===true&&
    [sun.x,sun.y,sun.z].every(Number.isFinite)&&Math.abs(sun.lengthSq()-1)<.01&&
    base.vertexShader.includes('uniform vec3 canopySun; varying vec3 cardSun;')&&
    base.fragmentShader.includes('varying vec3 cardSun;');
 if(total!==s.count||!base.isShaderMaterial||!base.alphaToCoverage||base.transparent||!base.depthTest||!base.depthWrite||
    base.side!==T.DoubleSide||(keys.length!==1&&!directional)||!base.uniforms.canopy?.value?.isTexture||
    base.fragmentShader.split(anchor).length!==2)return;
 const stems=new Float32Array(total*3),shapes=new Float32Array(total*4),bound=new T.Box3();
 let highest=-Infinity;
 for(const [i,[x,z,h,w]] of rows.entries()){
  const y=seat(x,z,h,w);
  if(y===undefined||!Number.isFinite(y)||y<s.seats[0]||y>s.seats[1])return;
  stems.set([x,y-.16,z],i*3);
  // Exactly the pre-review supplemental family, independent of stock RNG.
  const atlasVariant=(i*37+11)%101<10?(s.county==='Queens'?2:3):((i*17+5)%37<18?0:1);
  shapes.set([h,w,atlasVariant,.86+.19*((i*2251)%997)/997],i*4);
  const vertical=Math.max(w,1.04*h)*.5;
  highest=Math.max(highest,stems[i*3+1]+.65*h+vertical);
  const r=.5*Math.hypot(w,2*vertical)+.025;
  bound.expandByPoint(new T.Vector3(x-r,stems[i*3+1]+.47*h-vertical-.025,z-r));
  bound.expandByPoint(new T.Vector3(x+r,stems[i*3+1]+.65*h+vertical+.025,z+r));
 }
 const mat=base.clone();
 keepSupplementalCanopyLegacyBlend(mat);
 // Share the existing owned sampler object; no new texture or atlas upload.
 mat.uniforms={...base.uniforms,regionalCanopyAlpha:{value:0}};
 mat.fragmentShader='uniform float regionalCanopyAlpha;\n'+base.fragmentShader.replace(anchor,anchor+'*regionalCanopyAlpha');
 const plane=new T.PlaneGeometry(),g=new T.InstancedBufferGeometry();
 g.index=plane.index;g.setAttribute('position',plane.getAttribute('position'));g.setAttribute('uv',plane.getAttribute('uv'));
 g.setAttribute('stem',new T.InstancedBufferAttribute(stems,3));g.setAttribute('shape',new T.InstancedBufferAttribute(shapes,4));
 g.boundingSphere=bound.getBoundingSphere(new T.Sphere());g.instanceCount=total;
 const mesh=new T.Mesh(g,mat);mesh.name='Regional canopy '+s.id;mesh.visible=false;scene.add(mesh);
 return {mesh,total,highest,get gain(){return mat.uniforms.regionalCanopyAlpha.value as number;},
  gainTo(n:number){mesh.visible=Number.isFinite(n)&&n>.001;mat.uniforms.regionalCanopyAlpha.value=mesh.visible?Math.min(n,1):0;},
  dispose(){mesh.removeFromParent();g.dispose();mat.dispose();}
 };
}
