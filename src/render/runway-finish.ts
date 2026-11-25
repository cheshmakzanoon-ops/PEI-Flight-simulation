/** Original, understated 10/28 surface finish. Keep the existing markings
 * and atlas registration. This is not a pavement survey or navigation data. */
export const runwayFinishGLSL=/* glsl */`
vec3 cyygPaving(vec3 paint,vec2 metres,float footprint,float d){
 // The synthetic atlas's solid asphalt is #414546 (sRGB). Preserve
 // every pixel receiving detectable marking colour, including mip edges.
 if(max(paint.r,max(paint.g,paint.b))>.0620||footprint>=2.7||d>600.)return paint;
 float fade=(1.-smoothstep(.38,2.7,footprint))*(1.-smoothstep(250.,600.,d));
 float siteWear=noise(metres*vec2(.039,.16)+vec2(15.18,3.17))-.5;
 float subtleStipple=0.,smallAggregate=0.;
 float mid=1.-smoothstep(.073,.47,footprint);
 float tight=1.-smoothstep(.015,.088,footprint);
 if(mid>.001)subtleStipple=(noise(metres*vec2(4.01,4.56)+11.2)-.5)*mid;
 if(tight>.001)smallAggregate=(noise(metres*27.4+11.9)-.5)*tight;
 // Turn an opaque plain colour into a mineral surface without inventing
 // cured joints, measured friction, stains or a different threshold.
 float quiet=fade*(siteWear*.11+subtleStipple*.16+smallAggregate*.18);
 return paint*(1.+quiet);
}
`;
