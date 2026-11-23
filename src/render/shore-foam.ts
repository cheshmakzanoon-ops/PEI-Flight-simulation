/** Original procedural foam. Cover is a shoreline distance proxy, not bathymetry. */
export const shoreFoamGLSL=`
 float shoreFoam(vec2 q,float shore,float t,float dist,vec2 slope,float phaseFootprint){
   // The calling shader evaluates derivatives on both sides before branching.
   if(shore<=-32.||dist>=4000.)return 0.;
   // Larger, slow-varying patches break up crests along the coast. Advect the
   // smaller field independently so the entire shoreline does not break in sync.
   float reach=noise(q*.016+vec2(29.,13.));
   float field=noise(q*.063+vec2(7.,19.)+t*vec2(.027,-.015));
   float breadth=mix(10.,24.,reach);
   float water=-shore;
   float coastalBand=(1.-smoothstep(breadth,breadth+8.,water))*smoothstep(.08,1.4,water);
   // Shore distance gets smaller as a progressing crest approaches the land.
   float phase=water*.69+t*1.70+3.8*field+2.3*reach;
   float nearAA=1.-smoothstep(.74,3.1,phaseFootprint);
   // A thin bubbling crest, not an opaque broad stripe. The residual swash
   // wets the immediate edge but fades before the outer breaker band.
   float ridge=smoothstep(.72,.99,sin(phase));
   float grains=clamp(.5+2.2*(slope.x+slope.y),0.,1.);
   float speckle=mix(.73,1.10,grains);
   float opening=smoothstep(.45,.73,.72*field+.28*reach);
   float head=coastalBand*ridge*opening*speckle*nearAA;
   float wash=coastalBand*exp(-water*.29)*smoothstep(.31,.75,field)*smoothstep(.04,.48,water);
   float remnant=coastalBand*smoothstep(.50,.78,field)*(.3+.7*grains);
   float lod=1.-smoothstep(950.,4000.,dist);
   return lod*(head*.39+wash*.16+remnant*.08);
 }
`

/** Original procedural detail; no chart depth, wind or tide is inferred. */
export const brokenShoreFoamGLSL=`
float brokenShoreFoam(vec2 q,float shore,float t,float dist,vec2 slope,float footprint,float pixelM){
  if(shore<=-32.||dist>=4000.)return 0.;
  vec2 drift=vec2(t*.031,-t*.019);
  float reach=noise(q*.014+vec2(29.,13.));
  float breaks=noise(q*.048+vec2(7.,19.)+drift);
  float pools=noise(q*.173+vec2(-12.5,30.)+drift);
  float foamAge=noise(q*.288+vec2(3.1,7.6)+drift*1.8);
  float off=-shore;
  float crestBand=(1.-smoothstep(mix(8.,21.,reach),mix(14.,30.,reach),off))*smoothstep(.11,1.55,off);
  float phase=off*.72+t*1.63+3.35*breaks+3.65*reach+.93*pools;
  float aa=1.-smoothstep(.62,2.82,footprint+pixelM*.11);
  float ridge=smoothstep(mix(.67,.86,pools),.997,sin(phase));
  float macroOpen=smoothstep(.42,.76,breaks*.57+reach*.29+pools*.14);
  float mediumOpen=smoothstep(.26,.62,pools*.62+foamAge*.38);
  float slopeFlash=clamp(.55+1.15*(slope.x+slope.y),.15,1.);
  // Fine breakup is differential-filtered. At distance it tends to the mean
  // brightness rather than a blinking binary mask.
  float bubbleFade=1.-smoothstep(.26,1.58,pixelM);
  float bubbles=noise(q*.81+vec2(5.3,18.7)+drift*2.65);
  float pepper=mix(.72,.50+.42*smoothstep(.29,.78,bubbles),bubbleFade);
  float crest=crestBand*ridge*macroOpen*mediumOpen*aa*pepper*(.67+.33*slopeFlash);
  float swash=exp(-off*.38)*smoothstep(.27,.81,pools)*smoothstep(.08,.67,off);
  float residue=crestBand*smoothstep(.45,.83,pools*.55+foamAge*.45)*(1.-aa*.49);
  float range=1.-smoothstep(850.,4000.,dist);
  return range*(crest*.44+swash*.095+residue*.065);
}
`
