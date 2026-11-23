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
