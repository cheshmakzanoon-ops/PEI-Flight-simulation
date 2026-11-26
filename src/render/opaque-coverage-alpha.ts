import {AddEquation,CustomBlending,OneFactor,ZeroFactor} from 'three';

/** For a covered sample of an otherwise opaque primitive, keep the old
 * RGB replacement and preserve the alpha of the scene underneath. */
export const opaqueCoverageBlend=Object.freeze({
 blending:CustomBlending,
 blendEquation:AddEquation,blendSrc:OneFactor,blendDst:ZeroFactor,
 blendEquationAlpha:AddEquation,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneFactor,
});

export function supportsOpaqueCoverage(gl:Pick<WebGLRenderingContext,'getContextAttributes'|'getParameter'|'SAMPLES'>){
 const attributes=gl.getContextAttributes();
 return attributes?.alpha===true&&attributes.antialias===true&&gl.getParameter(gl.SAMPLES)>=2;
}
