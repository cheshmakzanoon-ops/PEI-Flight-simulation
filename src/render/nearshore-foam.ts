import type {Cover} from '../sim/cover.ts';

// The only optical registration input is the already shipped 2021 Cover
// signed shoreline proxy. Neither this study nor its geometry is a tide,
// bathymetry, swell or as-built shoreline survey.
export const NEARSHORE_FOAM_COVER='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
export const NEARSHORE_FOAM_LIMIT=420;
export const NEARSHORE_FOAM_DEPTH=32;
export const NEARSHORE_FOAM_REACHES=[
 {id:'prince-west-open',origin:[-60280,-47236],tangent:[.38908782,.92120067],half:[565,125]},
 {id:'kings-north-open',origin:[32132,6838],tangent:[.95162152,-.30727265],half:[530,119]},
] as const;

export function nearshoreFoamRequested(options:URLSearchParams):boolean{
 return options.has('nearshoreFoamStudy')&&options.get('scenery')!=='detail';
}
export function nearshoreFoamMatches(cover:Pick<Cover,'sourceDecodedSha'|'width'|'height'>):boolean{
 return cover.width===4096&&cover.height===2720&&cover.sourceDecodedSha===NEARSHORE_FOAM_COVER;
}

const decimal=(a:number)=>a.toFixed(8);
const v2=(a:readonly number[])=>'vec2('+a.map(decimal).join(',')+')';

export const nearshoreFoamGLSL=/*glsl*/`
 uniform float nearshoreFoamMode;
 vec2 nearshoreFoamDomain(vec2 q,vec2 origin,vec2 tangent,vec2 halfSize){
  vec2 rel=q-origin;vec2 frame=vec2(dot(rel,tangent),dot(rel,vec2(-tangent.y,tangent.x)));
  vec2 reserve=halfSize-abs(frame);
  return vec2(frame.x,smoothstep(0.,45.,reserve.x)*smoothstep(0.,24.,reserve.y));
 }
 vec2 nearshoreFoamFrame(vec2 q){
  ${NEARSHORE_FOAM_REACHES.map(({origin,tangent,half},i)=>`
  if(max(abs(q.x-(${decimal(origin[0])})),abs(q.y-(${decimal(origin[1])})))<650.){
   vec2 frame=nearshoreFoamDomain(q,${v2(origin)},${v2(tangent)},${v2(half)});
   return vec2(frame.x+${decimal([571.,193.][i])},frame.y);
  }`).join('')}
  return vec2(0.);
 }
 // An optical coordinate only. Some renderer backends may quantize
 // normalized linear samples to a DN; these taps retain fractional motion.
 vec3 nearshoreFoamDepth(vec2 uv,vec2 extentSize,sampler2D source){
  ivec2 dim=textureSize(source,0);
  vec2 q=clamp(uv*vec2(dim)-.5,vec2(0.),vec2(dim-1));
  ivec2 i=ivec2(q),end=min(i+1,dim-1);
  vec2 f=fract(q);
  float a=texelFetch(source,i,0).g,b=texelFetch(source,ivec2(end.x,i.y),0).g;
  float c=texelFetch(source,ivec2(i.x,end.y),0).g,e=texelFetch(source,end,0).g;
  float z=256.-510.*mix(mix(a,b,f.x),mix(c,e,f.x),f.y);
  vec2 gradient=-510.*vec2(mix(b-a,e-c,f.y),mix(c-a,e-b,f.x))*vec2(dim)/extentSize;
  return vec3(z,gradient);
 }
 float nearshoreFoamBand(float d,float left,float right,float aa){
  return smoothstep(left-aa,left+aa,d)*(1.-smoothstep(right-aa,right+aa,d))*
    min(1.,(right-left)/max(.03,aa*1.6));
 }
 float nearshoreFoamArt(float u,float off,vec2 gradient,vec2 dx,vec2 dy,float clock,vec2 slope,float pixelM){
  // Material coordinates are advected toward decreasing offshore proxy
  // distance. Every crest has independent along-shore occupancy and life.
  float adv=off+clock*1.86;
  vec2 longUV=vec2(.034*u,.049*adv);
  float transverse=(noise(longUV+vec2(13.2,78.))-.5)*3.6+
    (noise(longUV*2.1+vec2(3.2,2.5))-.5)*1.1;
  // A narrow dark-water gap at each band's ends separates independently
  // phased, irregularly sized packets. Warp the lanes with their moving
  // material, not screen coordinates; amplitudes are zero at every ID change.
  float along=(u-clock*.19+transverse)/14.8;
  float lane=floor(along),alongIn=fract(along);
  float offset=hash(vec2(lane,67.24));
  float pitch=6.15+2.3*hash(vec2(lane,54.1));
  float phase=adv+pitch*offset+transverse*.45;
  float wave=floor(phase/pitch+.5),head=phase-wave*pitch;
  vec2 seed=vec2(lane,wave);
  float chance=hash(seed+vec2(12.9,64.20));
  float side=hash(seed+vec2(1.4,39.1));
  float halfWidth=.17+.20*hash(seed+vec2(.73,17.31));
  float centre=.5+(side-.5)*(.89-2.*halfWidth);
  float endMask=1.-smoothstep(halfWidth*.55,halfWidth,abs(alongIn-centre));
  // Some crests never break in this optical band. Beyond packet ends,
  // neither the trailing lace nor the wash can turn into a joined stripe.
  float presence=endMask*smoothstep(.16,.72,chance);
  float phasePixel=max(abs(dot(gradient,dx)),abs(dot(gradient,dy)))+.20*pixelM;
  float aa=clamp(.060+phasePixel*.57,.060,.82);
  float resolved=1.-smoothstep(.45,2.95,phasePixel);
  float shoal=smoothstep(1.1,3.3+3.1*side,off)*
    (1.-smoothstep(16.8+6.9*chance,24.2+6.*chance,off));
  vec2 laceUV=vec2((u-clock*.19)*.99+head*.52,adv*1.18);
  float distort=noise(laceUV*.52+vec2(81.3,93.1));
  float bubbles=noise(laceUV+vec2(1.36,-1.39)*distort);
  float fragmented=1.-smoothstep(.031,.155,abs(bubbles-.583));
  float small=1.-smoothstep(.25,1.55,pixelM);
  float broken=mix(.77,.28+.72*smoothstep(.15,.68,bubbles),small);
  // An age-dependent curl puts the brighter leading edge on top of small
  // attached, porous wake fragments instead of a second opaque ribbon.
  float curved=head+side*.86*(alongIn-centre)*(alongIn-centre)*8.+.12*distort;
  float lip=nearshoreFoamBand(curved,-.20-.18*chance,.25+.24*chance,aa)*broken;
  float porous=mix(.38,.18+.82*fragmented,small);
  float wake=nearshoreFoamBand(curved,.18,2.02,aa)*exp(-.58*max(0.,curved))*porous;
  float toe=smoothstep(.07,.32,off)*exp(-off*.73);
  float washed=nearshoreFoamBand(curved,.47,2.12,aa)*toe*porous;
  float slopeLight=clamp(.90+.26*(slope.x+slope.y),.74,1.08);
  return presence*resolved*slopeLight*(shoal*(.88*lip+.29*wake)+.30*washed);
 }
`;

export function nearshoreFoamRouterGLSL(defaultBroken:boolean){return /*glsl*/`
 float nearshoreOriginalFoam(vec2 q,float shore,float t,float dist,vec2 n,float footprint,float pixelM,bool useBroken){
  if(useBroken)return brokenShoreFoam(q,shore,t,dist,n,footprint,pixelM);
  return shoreFoam(q,shore,t,dist,n,footprint);
 }
 float chooseNearshoreFoam(vec2 q,vec2 uv,float shore,float t,float dist,vec2 n,float footprint,
                          float pixelM,vec2 dx,vec2 dy,vec2 extentSize,sampler2D source){
  bool experiment=nearshoreFoamMode>=1.5;
  bool useBroken=experiment?${defaultBroken?'true':'false'}:nearshoreFoamMode>=.5;
  if(experiment&&dist<${decimal(NEARSHORE_FOAM_LIMIT)}&&shore<0.&&shore>-${decimal(NEARSHORE_FOAM_DEPTH)}){
   vec2 frame=nearshoreFoamFrame(q);
   if(frame.y>0.){
    vec3 depth=nearshoreFoamDepth(uv,extentSize,source);
    float of=depth.x;
    float gain=frame.y*(1.-smoothstep(245.,${decimal(NEARSHORE_FOAM_LIMIT)},dist))*smoothstep(.06,.67,of)*
       (1.-smoothstep(27.5,${decimal(NEARSHORE_FOAM_DEPTH)},max(-shore,of)));
    if(gain>0.){
     float next=nearshoreFoamArt(frame.x,of,depth.yz,dx,dy,t,n,pixelM);
     if(gain>=1.)return next;
     return mix(nearshoreOriginalFoam(q,shore,t,dist,n,footprint,pixelM,useBroken),next,gain);
    }
   }
  }
  return nearshoreOriginalFoam(q,shore,t,dist,n,footprint,pixelM,useBroken);
 }
`;}
