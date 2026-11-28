/** Detached RGB experiment for the exact authored branch shader. */
import {branchVertex,branchFragment} from './original-program.ts';
const paired='varying vec2 fCard,fDetail;';
const position='vec3 vertex=position;';
const old='c=leaf*fDetail.y*axisShade*(lift+.43*abs(side)+.215*tint);';
export const leafRadianceGain='peiLocalLeafLight';
const newRGB=`
  if(peiLocalLeafLight>0.){
   float filtered=mix(.50,tint,.20);
   float originalRadiance=fDetail.y*axisShade*(lift+.43*abs(side)+.215*filtered);
   float above=smoothstep(.40,.90,peiCrownDepth);
   c=leaf*(.22+.71*originalRadiance+.135*above)
     +vec3(.006,.005,.001)*above;
  }`;
const field='\n varying float peiCrownDepth;';
const at=(raw:string,k:string,suffix:string)=>{
 if(raw.split(k).length!==2)throw Error('woodland leaf study source anchor changed: '+k);
 return raw.replace(k,k+suffix);
};
/** The caller must keep the gain at 0 for the neutral control and provide
 * its own unchanged renderer/camera and coverage proof. No installation
 * or mutation is performed here; an unrecognized source is not modified. */
export function prepareLeafRadianceStudy(vertexShader:string,fragmentShader:string){
 if(vertexShader!==branchVertex||fragmentShader!==branchFragment)return undefined;
 return Object.freeze({
  vertexShader:at(at(vertexShader,paired,field),position,'\n  peiCrownDepth=position.y;'),
  fragmentShader:at(at(fragmentShader,paired,field+'\n uniform float '+leafRadianceGain+';'),old,newRGB),
  gainName:leafRadianceGain,neutralGain:0 as const,studyGain:1 as const,
 });
}
