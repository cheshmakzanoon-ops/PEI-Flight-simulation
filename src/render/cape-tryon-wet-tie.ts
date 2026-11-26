/** Existing signed Cover and ocean plane only. A deliberately late
 * depth-equal draw can replace an empty sky sample, never real depth. */
export const CAPE_WET_PATCH={x:-23545,z:-3765,width:510,height:310,range:850} as const;
export const capeWetTieGLSL=/*glsl*/`
 uniform float capeWetPass;
 float preciseCapeWet(vec2 uv){
  ivec2 dims=textureSize(coverMap,0);
  vec2 f=clamp(uv*vec2(dims)-.5,vec2(0.),vec2(dims)-1.);
  ivec2 g=ivec2(floor(f)),e=min(g+ivec2(1),dims-1);
  vec2 w=fract(f);
  float a=floor(texelFetch(coverMap,g,0).g*255.+.5)-128.;
  float b=floor(texelFetch(coverMap,ivec2(e.x,g.y),0).g*255.+.5)-128.;
  float c=floor(texelFetch(coverMap,ivec2(g.x,e.y),0).g*255.+.5)-128.;
  float d=floor(texelFetch(coverMap,e,0).g*255.+.5)-128.;
  return 2.*mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
 }
`;
export const capeWetPatchGateGLSL=/*glsl*/`
 if(!(capeWetPass>=.5)||shore!=0.||dist>=${CAPE_WET_PATCH.range.toFixed(1)}||
  p.x< -23800.||p.x> -23290.||p.z< -3920.||p.z> -3610.)discard;
 float exact=preciseCapeWet(uv);
 // Leave genuinely dry, true-zero and numerically ambiguous subpixel
 // samples unchanged. This is the signed stock mask, not a tide survey.
 if(exact>=-.075)discard;
 shore=exact;
 // This separate depth-equal draw only sees the normal far clear depth.
 gl_FragDepth=1.;
`;

type Bounds={left:number;top:number;right:number;bottom:number};
type CoverRaster={width:number;height:number;bytes:Uint8Array};

/** A conservative raster envelope for rounded-zero negative samples:
 * every contributor <128 means hardware cannot interpolate to 128, and
 * every contributor >=128 means exact interpolation is not wet. */
export function capeWetCells(bounds:Bounds,cover:CoverRaster){
 const {left,top,right,bottom}=bounds,{width,height,bytes}=cover;
 const {x,z,width:w,height:h}=CAPE_WET_PATCH,dx=(right-left)/width,dz=(bottom-top)/height;
 const minX=x-w/2,maxX=x+w/2,minZ=z-h/2,maxZ=z+h/2;
 if(!Number.isFinite(dx)||!Number.isFinite(dz)||dx<=0||dz<=0||bytes.length!==width*height*2)return [];
 const index=(p:number,a:number,s:number)=>Math.floor((p-a)/s-.5);
 const ranges:{i:number;j:number;x0:number;z0:number;x1:number;z1:number}[]=[];
 for(let j=Math.max(0,index(minZ,top,dz));j<=Math.min(height-2,index(maxZ,top,dz));j++){
  for(let i=Math.max(0,index(minX,left,dx));i<=Math.min(width-2,index(maxX,left,dx));i++){
   const k=(j*width+i)*2+1,vals=[bytes[k],bytes[k+2],bytes[k+2*width],bytes[k+2*width+2]];
   if(Math.min(...vals)>=128||Math.max(...vals)<128)continue;
   // Adjacent cells share Float32 endpoints because their grid origin is
   // recomputed from the same integer. The shader also retains hard bounds.
   const x0=Math.max(minX,left+(i+.5)*dx),x1=Math.min(maxX,left+(i+1.5)*dx);
   const z0=Math.max(minZ,top+(j+.5)*dz),z1=Math.min(maxZ,top+(j+1.5)*dz);
   if(x1>x0&&z1>z0)ranges.push({i,j,x0,z0,x1,z1});
  }
 }
 return ranges;
}
