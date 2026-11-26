import {AddEquation,NormalBlending,OneMinusSrcAlphaFactor,SrcAlphaFactor,type Material} from 'three';
import {opaqueCoverageBlend as opaqueCanopyCoverageBlend,supportsOpaqueCoverage as supportsOpaqueCanopyCoverage} from './opaque-coverage-alpha.ts';

export {opaqueCanopyCoverageBlend,supportsOpaqueCanopyCoverage};

/** Recreate only the known coverage mode. An arbitrary caller's blend state
 * is not a supported replacement for the established crown material. */
export function inheritedCanopyCoverageBlend(m:Material){
 return Object.entries(opaqueCanopyCoverageBlend).every(([k,v])=>
  m[k as keyof typeof opaqueCanopyCoverageBlend]===v)?opaqueCanopyCoverageBlend:undefined;
}


/** The specialized supplemental meshes keep their old independently
 * reviewed blend state even when they inherit the billboard shader. */
export function keepSupplementalCanopyLegacyBlend(m:Material){
 if(inheritedCanopyCoverageBlend(m))Object.assign(m,{
  blending:NormalBlending,blendEquation:AddEquation,blendSrc:SrcAlphaFactor,blendDst:OneMinusSrcAlphaFactor,
  blendEquationAlpha:null,blendSrcAlpha:null,blendDstAlpha:null,
 });
}
