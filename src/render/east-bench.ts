import {readCoastalPack} from '../sim/coastal-packs.ts';
import {EAST_BENCH} from './east-bench.generated.ts';

export type EastBenchMask=Readonly<{values:Uint8Array;plan:typeof EAST_BENCH}>;
export async function loadEastBench(base:string,fetcher:typeof fetch=fetch,timeoutMs=1600):Promise<EastBenchMask|undefined>{
 return readCoastalPack(base+EAST_BENCH.asset,fetcher,timeoutMs,EAST_BENCH,b=>({
  values:new Uint8Array(b),plan:EAST_BENCH
 }));
}

/** Original rock albedo on pre-existing terrain. Requires eastSandstoneGLSL's
 * same world-space texture primitive; the mask never places or lifts a face.
 */
export const eastBenchGLSL=/*glsl*/`
uniform sampler2D eastBenchMask;
uniform vec4 eastBenchBounds;  // X/Z origin and inverse metre extent

float eastBenchWeight(vec3 p,float d){
 vec2 q=(p.xz-eastBenchBounds.xy)*eastBenchBounds.zw;
 if(d>=560.||any(lessThanEqual(q,vec2(0.)))||any(greaterThanEqual(q,vec2(1.))))return 0.;
 return texture2D(eastBenchMask,q).r*(1.-smoothstep(175.,560.,d));
}
// Shallow, unequal, broken plates, not a grid of closed polygon cracks.
float benchRelief(vec2 q){
 vec2 axis=vec2(dot(q,vec2(.37,-.929)),dot(q,vec2(.929,.37)));
 float bend=noise(axis*.39+vec2(6.3,8.5))-.5;
 vec2 layers=vec2(axis.x*.69+.46*bend,axis.y*2.14+.50*bend);
 float ledge=noise(layers)*.78+noise(axis*vec2(1.31,1.53))*.22;
 return smoothstep(.23,.67,ledge);
}
vec4 eastBenchColor(vec3 p,vec3 px){
 vec2 q=p.xz-eastBenchBounds.xy;
 vec3 v=vec3(q.x,p.y,q.y);
 float broad=rockTexture(v*vec3(.33,.54,.39)),grainBase=rockTexture(v*vec3(1.36,1.19,1.42));
 float dryness=smoothstep(.07,1.81,p.y+1.12*(broad-.51));
 float footprint=max(px.x,px.z),close=1.-smoothstep(.18,.71,footprint);
 float plate=benchRelief(q);
 float mineral=smoothstep(.25,.78,.30*plate+.38*broad+.32*grainBase);
 // These are small, discontinuous wet crevices between plate-like patches,
 // not dark outlines around every shape.
 float crevice=(1.-smoothstep(.12,.40,plate))*smoothstep(.39,.74,grainBase)*close;
 float flake=smoothstep(.32,.72,grainBase)*(1.-smoothstep(.38,.89,footprint));
 vec3 wet=mix(vec3(.062,.058,.054),vec3(.126,.117,.107),mineral);
 vec3 dry=mix(vec3(.101,.091,.080),vec3(.159,.151,.136),mineral);
 vec3 stone=mix(wet,dry,dryness);
 float shade=0.,grit=0.;
 if(close>.01){
  vec2 slope=vec2(benchRelief(q+vec2(.12,0.))-plate,benchRelief(q+vec2(0.,.12))-plate)*.68;
  vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
  shade=(dot(n,sun)-sun.y)*close;
 }
 float detail=1.-smoothstep(.07,.21,footprint);
 if(detail>.01)grit=(rockTexture(v*vec3(4.2,5.4,4.7))-.5)*detail;
 stone*=.86+.19*broad+.17*flake-.26*crevice+.36*shade+.24*grit;
 // A ground return can't distinguish exposed bedrock from narrow
 // pockets of the previous sediment. Break up the paint from the inside:
 // no dilation of the evidence mask and no continuous dark plate.
 float scatter=noise(q*.81+vec2(p.y*.60,-p.y*.31));
 float debris=smoothstep(.22,.75,.50*grainBase+.31*scatter+.19*plate);
 return vec4(stone,mix(.22,.90,debris));
}
`;
