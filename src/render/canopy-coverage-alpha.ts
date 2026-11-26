import {AddEquation,CustomBlending,NormalBlending,OneFactor,OneMinusSrcAlphaFactor,SrcAlphaFactor,ZeroFactor,type Material} from 'three';

/** Crown coverage is a sample-mask input, not scene transparency. Keep
 * RGB replacement and depth writes for the covered samples, while
 * preserving alpha already written by the opaque scenery behind them. */
export const opaqueCanopyCoverageBlend=Object.freeze({
 blending:CustomBlending,
 blendEquation:AddEquation,blendSrc:OneFactor,blendDst:ZeroFactor,
 blendEquationAlpha:AddEquation,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor,
});

export function supportsOpaqueCanopyCoverage(gl:Pick<WebGLRenderingContext,'getContextAttributes'|'getParameter'|'SAMPLES'>){
 const attributes=gl.getContextAttributes();
 return attributes?.alpha===true&&attributes.antialias===true&&gl.getParameter(gl.SAMPLES)>=2;
}

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
