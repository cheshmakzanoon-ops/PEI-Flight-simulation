import {PRINCE_SKY_FIELD as F} from './prince-roof-sky.generated.ts';
/** The 3 receiving planes are a measured low connector and two low cross-ridge faces.
 * The data is a cosine-weighted 14m sky visibility bake of existing triangles.
 * No imported photographs, added surface geometry, material identities or solar shadows. */
const CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const words=Math.ceil(F.cells/20);
let data:Uint32Array|undefined;
export function princeSkyWords(){
 if(!data){const out=new Uint32Array(words*4);let i=0;
  for(const s of F.samples6){const q=CHARS.indexOf(s);if(q<0)throw Error('Unexpected sky coefficient');
   out[Math.floor(i/5)]|=q<<((i%5)*6);i++;}
  if(i!==F.cells)throw Error('Incomplete roof visibility field');data=out;
 }
 return data;
}
function cell(i:number){return ((princeSkyWords()[Math.floor(i/5)]>>>((i%5)*6))&63)/F.quantization;}
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
/** Normalized fraction of local diffuse sky blocked; BEFORE strength or camera attenuation.
 * Contract is exact normal/upward, no dependence on image or inferred roof material. */
export function princeSkyBlock(x:number,y:number,z:number,nx:number,ny:number,nz:number){
 const dx=x-F.anchor[0],dz=z-F.anchor[1],u=dx*F.basis[0][0]+dz*F.basis[0][1],v=dx*F.basis[1][0]+dz*F.basis[1][1];
 for(const c of F.charts){
  if(nx*c.normal[0]+ny*c.normal[1]+nz*c.normal[2]<.99991||Math.abs(y-(c.plane[0]+u*c.plane[1]+v*c.plane[2]))>.035)continue;
  const s=(u-c.lo[0])/c.step,t=(v-c.lo[1])/c.step,i=Math.floor(s),j=Math.floor(t);
  if(i<0||j<0||i+1>=c.wh[0]||j+1>=c.wh[1])continue;
  const p=c.index+i+j*c.wh[0],a=s-i,b=t-j;
  const val=((1-a)*cell(p)+a*cell(p+1))*(1-b)+((1-a)*cell(p+c.wh[0])+a*cell(p+c.wh[0]+1))*b;
  return val*smooth((val-.015)/.020);
 }
 return 0;
}
const gl=(v:number)=>Number(v).toFixed(9),vec=(v:readonly number[])=>v.map(gl).join(',');
export const princeSkyGLSL=`
 uniform highp uvec4 princeSkyWords[${words}];
 float princeSkyDatum(int ix){int p=ix/5;uint word=princeSkyWords[p/4][p%4];
  return float((word>>uint((ix%5)*6))&63u)*(1./84.);}
 float princeSkyChart(vec2 uv,vec2 origin,ivec2 size,int ix){
  vec2 st=(uv-origin)/${gl(F.charts[0].step)};ivec2 c=ivec2(floor(st));
  if(any(lessThan(c,ivec2(0)))||any(greaterThanEqual(c+ivec2(1),size)))return 0.;
  int p=ix+c.x+c.y*size.x; vec2 f=fract(st);
  float a=mix(princeSkyDatum(p),princeSkyDatum(p+1),f.x),b=mix(princeSkyDatum(p+size.x),princeSkyDatum(p+size.x+1),f.x);
  float q=mix(a,b,f.y); return q*smoothstep(.015,.035,q);
 }
 float princeSkyBlock(vec3 pos,vec3 n){
  vec2 local=pos.xz-vec2(${vec(F.anchor)});
  vec2 uv=vec2(dot(local,vec2(${vec(F.basis[0])})),dot(local,vec2(${vec(F.basis[1])})));
  ${F.charts.map(c=>`if(dot(n,vec3(${vec(c.normal)}))>=.99991&&abs(pos.y-dot(vec3(1.,uv),vec3(${vec(c.plane)})))<=.035)
  return princeSkyChart(uv,vec2(${vec(c.lo)}),ivec2(${c.wh}),${c.index});`).join('\n')}
  return 0.;
 }
`;
