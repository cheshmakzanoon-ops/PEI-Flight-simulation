/** Must match HarbourCover.distance exactly. Keeps the province fallback
 * authoritative outside the reviewed water-only approach. */
export const harbourCoastGLSL=/*glsl*/`
 uniform sampler2D harbourMask;
 uniform vec4 harbourBounds;  // left, north, right, south in scene metres
 uniform vec2 harbourSize;   // raster points at first/last bounds, not pixel edges
 float harbourDistance(float original,vec2 xz){
  if(any(lessThanEqual(xz,harbourBounds.xy))||any(greaterThanEqual(xz,harbourBounds.zw)))return original;
  vec2 p=(xz-harbourBounds.xy)/(harbourBounds.zw-harbourBounds.xy);
  vec2 v=texture2D(harbourMask,(.5+p*(harbourSize-1.))/harbourSize).rg;
  if(v.g<=0.)return original;
  return original+v.g*(min(original,(v.r*255.-128.)*.25)-original);
 }
`;
