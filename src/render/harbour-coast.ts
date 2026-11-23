/** Must match HarbourCover.distance exactly. Keeps the province fallback
 * authoritative outside the reviewed water-only approach. */
export const harbourCoastGLSL=/*glsl*/`
 uniform sampler2D harbourMask;
 uniform vec4 harbourBounds;  // left, north, right, south in scene metres
 uniform vec2 harbourSize;   // raster points at first/last bounds, not pixel edges
 vec2 harbourAt(vec2 xz){
  if(any(lessThanEqual(xz,harbourBounds.xy))||any(greaterThanEqual(xz,harbourBounds.zw)))return vec2(.5,0.);
  vec2 p=(xz-harbourBounds.xy)/(harbourBounds.zw-harbourBounds.xy);
  return texture2D(harbourMask,(.5+p*(harbourSize-1.))/harbourSize).rg;
 }
 float harbourFrom(float original,vec2 v){
  if(v.g<=0.)return original;
  return original+v.g*(min(original,(v.r*255.-128.)*.25)-original);
 }
 float harbourDistance(float original,vec2 xz){return harbourFrom(original,harbourAt(xz));}
 float harbourOptics(vec2 v){
  // A local sheltered-light effect, not inferred bathymetry. Positive shore
  // cells and the bounded source's taper remain unaffectable.
  return v.g*smoothstep(.10,8.,(128.-v.r*255.)*.25);
 }

`;
