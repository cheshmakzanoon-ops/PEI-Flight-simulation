/** Opt-in physical filtering of existing *colour weights* on ordinary dry
 * shore faces. This does not replace the Cover sign in any consumer. */
export const SHORE_TONE_OPTION='shoreToneStudy';
export const SHORE_TONE_FULL_M=300,SHORE_TONE_FAR_M=480;
export const SHORE_TONE_EDGE_STOCK_M=1,SHORE_TONE_EDGE_FULL_M=24;
export const SHORE_TONE_INTEGER_TOLERANCE_DN=1/1024;
export function shoreToneRequested(q:URLSearchParams){
 return q.has(SHORE_TONE_OPTION)&&q.get('scenery')!=='detail';
}
const lane='uniform sampler2D imageMap,coverMap,detailMap,paintMap;';
const beach='float beach=(1.-smoothstep(4.,25.,coast))';
const cliff='float cliff=(1.-smoothstep(3.,15.,coast))';
const owner='vec2 q=(vuv-detailBox.xy)*detailBox.zw;';
const metres='uniform vec2 detailSize;';

const exactColourDistance=`
 uniform float shoreToneGain;
 // Approximate normalized 8-bit hardware filtering can return metre-sized
 // steps. Reconstruct the fraction from the original four R8 lane values.
 // We touch no sign, depth, classification, physics or regional source.
 float colourShoreDistance(vec2 uv,vec2 ownerUV,float oldValue,float distanceM){
  if(shoreToneGain<=0.||oldValue<1.||oldValue>28.||distanceM>=${SHORE_TONE_FAR_M}.)return oldValue;
  // A precise backend already preserves fractional byte interpolation.
  float code=oldValue*.5;
  if(abs(code-round(code))>${SHORE_TONE_INTEGER_TOLERANCE_DN})return oldValue;
  // Either tile may use a protected authored material. Disappear from
  // both sides of every edge at the same physical width before sampling.
  vec2 edge=min(ownerUV,1.-ownerUV)*detailSize;
  float seam=min(edge.x,edge.y);
  if(seam<=${SHORE_TONE_EDGE_STOCK_M}.)return oldValue;
  ivec2 size=textureSize(coverMap,0);
  vec2 p=clamp(uv*vec2(size)-.5,vec2(0.),vec2(size-1));
  ivec2 a=ivec2(floor(p)),b=min(a+1,size-1);
  vec2 w=p-vec2(a);
  float aa=texelFetch(coverMap,a,0).g,ba=texelFetch(coverMap,ivec2(b.x,a.y),0).g;
  float ab=texelFetch(coverMap,ivec2(a.x,b.y),0).g,bb=texelFetch(coverMap,b,0).g;
  float h=(mix(mix(aa,ba,w.x),mix(ab,bb,w.x),w.y)*255.-128.)*2.;
  float filtered=mix(h,oldValue,smoothstep(${SHORE_TONE_FULL_M}.,${SHORE_TONE_FAR_M}.,distanceM));
  float strength=shoreToneGain*smoothstep(${SHORE_TONE_EDGE_STOCK_M}.,${SHORE_TONE_EDGE_FULL_M}.,seam);
  return strength>=1.?filtered:mix(oldValue,filtered,strength);
 }
`;

/** Change only the two inferred legacy colour weights, leaving every other
 * use of the stock terrain sampler (including all discard) verbatim. */
export function smoothShoreTone(fragment:string,ordinary:boolean){
 if(!ordinary||!fragment.includes(lane)||!fragment.includes(beach)||!fragment.includes(cliff)||
    !fragment.includes(owner)||!fragment.includes(metres))return fragment;
 return fragment.replace(lane,lane+exactColourDistance)
  .replace(beach,'float colourCoast=colourShoreDistance(vuv,q,coast,d);\n '+beach.replace('coast','colourCoast'))
  .replace(cliff,cliff.replace('coast','colourCoast'));
}
