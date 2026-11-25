/** Original close-range diffuse treatment, not ortho-imagery, a crop map, or geometry. */
import * as T from 'three';
import {MASK,MASK_BOUNDS,MASK_SHAPE} from './mask.generated.ts';
import {PASTURE,correctPastureFrame,pastureDigest} from './flight.ts';
import {boundedPackedBody} from '../../sim/packed-bytes.ts';
const edge=(x:number)=>x-Math.floor(x);
const smooth=(x:number)=>x*x*(3-2*x);
function label(x:number,y:number,a:number){
 let h=Math.imul((x+1837)|0,0x757fb325)^Math.imul((y+6427)|0,0x1b39f555)^Math.imul(a,0x19381103);
 h=Math.imul(h^(h>>>11),0x9e3779b1);
 return ((h^(h>>>13))>>>0)/4294967295;
}
function periodic(x:number,y:number,w:number,h:number,seed:number){
 const a=Math.floor(x),b=Math.floor(y),u=smooth(edge(x)),v=smooth(edge(y));
 const k=(j:number,l:number)=>label(((a+j)%w+w)%w,((b+l)%h+h)%h,seed);
 return (k(0,0)+(k(1,0)-k(0,0))*u)*(1-v)+(k(0,1)+(k(1,1)-k(0,1))*u)*v;
}
function grassLightMap():
 {data:Uint8Array;size:number}{
 const N=128,b=new Uint8Array(N*N*4);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const u=(i+.5)/N,v=(j+.5)/N;
  const w=periodic(u*9,v*9,9,9,92)-.5;
  const b1=periodic((u+w*.053)*38,(v+Math.sin(6.28318530718*u)*.029+w*.026)*13,38,13,17);
  // Deliberately use periodic diagonal warp by integer lattice phase. A
  // fine fiber is short, not a continuous row, and its mean falls into mips.
  const a=periodic((u+(periodic(u*7,v*7,7,7,61)-.5)*.034)*49,v*17,49,17,81);
  const p=periodic(u*19,v*23,19,23,7);
  const rough=.56*(a-.5)+.23*(p-.5)+.21*(periodic(u*37,v*52,37,52,11)-.5);
  const ridge=(periodic((u+w*.037)*37,v*31,37,31,130)-.5)*.65+(periodic(u*9,v*9,9,9,111)-.5)*.35;
  const shadow=.70*rough+.12*w+.13*(b1-.5)*(1-Math.abs(p-.5)*1.8);
  const k=(j*N+i)*4;
  b[k]=Math.round((.5+shadow)*255);
  b[k+1]=Math.round((.5+ridge*.65)*255);
  b[k+2]=Math.round((.5+.80*(p-.5)+.20*(b1-.5))*255);
  b[k+3]=255;
 }
 return {data:b,size:N};
}
const panmureGLSL=`
uniform highp sampler2D panmureFieldMask,panmureGrain;
uniform highp vec4 panmureBox;
uniform float panmureGain;
void panmurePasture(inout vec3 c,vec3 p,vec3 n,float d,float coast,vec2 dx,vec2 dy,vec3 sun) {
 if(coast<86.||coast>180.||d>=458.||n.y<.78||p.y<3.)return;
 vec2 z=p.xz-panmureBox.xy;
 vec2 uv=z*panmureBox.zw;
 if(any(lessThanEqual(uv,vec2(0)))||any(greaterThanEqual(uv,vec2(1))))return;
 float w=texture2D(panmureFieldMask,uv).r*panmureGain*
         (1.-smoothstep(215.,458.,d))*smoothstep(.78,.91,n.y);
 if(w<.0015)return;
 // A continuous diffuse response from the measured pasture membership;
 // stock TCI contrast and all its actual semi-dry detail remain the base.
 // These muted green/gold coefficients are original artistic interpretations.
 vec2 k=mat2(.934,.357,-.357,.934)*z;
 float broad=noise(k*vec2(.091,.125))-.5;
 float salt=noise(k*vec2(.35,.297))-.5;
 float worn=smoothstep(.10,.71,.41+broad*.73+salt*.24);
 float neutral=dot(c,vec3(.24,.65,.11));
 vec3 landscape=mix(vec3(.054,.081,.032),vec3(.092,.103,.050),worn);
 landscape*=clamp(.86+neutral*2.0,.91,1.18);
 vec3 color=mix(c*vec3(1.024,1.052,.966),landscape,.36);
 color*=1.+(.080*broad+.058*salt);
 // The same continuous stock face normal still drives game lighting/shadows;
 // only radiance at a subpixel blade orientation is modulated down close.
 float fw=max(length(dx),length(dy)),recent=(1.-smoothstep(.094,.47,fw))*(1.-smoothstep(53.,117.,d));
 // Short patches of pressed and upright grass affect luminance rather than a
 // saturated green wash. Fade the metre-scale signal before it is undersampled.
 float tuftGate=(1.-smoothstep(.32,1.05,fw))*(1.-smoothstep(78.,165.,d));
 if(tuftGate>.001)color*=1.+.095*tuftGate*(noise(k*vec2(.83,.49)+vec2(1.71,5.3)*broad)-.5);
 if(recent>.001){
   mat2 rot=mat2(.934,.357,-.357,.934);
   vec2 plant=k*.67+vec2(noise(k*.23),noise(k.yx*.25))*.073;
   vec3 fiber=textureGrad(panmureGrain,plant,rot*dx*.67,rot*dy*.67).rgb-.5;
   float lit=.55+.45*max(dot(n,sun),0.);
   color*=1.+recent*(.213*fiber.r+lit*.105*fiber.g);
   color+=recent*fiber.b*vec3(.004,.008,.003);
 }
 c=mix(c,color,w);
}
`;

const WIRE_SIZE=3361,WIRE_SHA='cbfb3a27ed2e7a860b7c5d481eb8c60c53c2caf1c81f47ae1fdf1ce2002db500';
/** Source frame, compressed and decoded bytes are independent pins, not values
 * trusted from the generated module. Bounded decoding cannot allocate an arbitrary blob. */
export async function readPastureMask(wireText:string=MASK,bounds:readonly number[]=MASK_BOUNDS,shape:readonly number[]=MASK_SHAPE){
 try{
  if(!correctPastureFrame(bounds,shape)||!globalThis.crypto?.subtle||wireText.length!==4*Math.ceil(WIRE_SIZE/3))return;
  const wire=Uint8Array.from(atob(wireText),x=>x.charCodeAt(0));
  if(wire.byteLength!==WIRE_SIZE||await pastureDigest(wire.buffer)!==WIRE_SHA)return;
  const size=PASTURE.width*PASTURE.height;
  const out=await boundedPackedBody(new Blob([wire]).stream().pipeThrough(new DecompressionStream('gzip')),size);
  if(out.byteLength!==size||await pastureDigest(out)!==PASTURE.mask)return;
  return new Uint8Array(out);
 }catch{return;}
}
type Compose=(declarations:string,optics:string)=>string;
export async function preparePasture(material:T.ShaderMaterial,compose:Compose){
 const data=await readPastureMask();if(!data)return;
 const {data:p,size}=grassLightMap();
 const tex=new T.DataTexture(data,PASTURE.width,PASTURE.height,T.RedFormat,T.UnsignedByteType);
 tex.name='Panmure · one-metre pasture eligibility';tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
 const t=new T.DataTexture(p,size,size,T.RGBAFormat,T.UnsignedByteType);
 t.name='Panmure · original short grass reflectance';t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;
 t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;
 const gain={value:0};
 // Derivatives are calculated outside pixel-varying branches in the terrain shader.
 const optics='if(panmureGain>0.) panmurePasture(col,p,n,d,coast,panmureDx,panmureDy,sun);';
 return {gain,install(){
   const next=compose(panmureGLSL,optics);if(next===material.fragmentShader)return false;
   const b=PASTURE.bounds;
   material.uniforms={...material.uniforms,panmureFieldMask:{value:tex},panmureGrain:{value:t},
     panmureBox:{value:new T.Vector4(b[0],b[1],1/PASTURE.width,1/PASTURE.height)},panmureGain:gain};
   material.fragmentShader=next;material.needsUpdate=true;return true;
 },dispose(){tex.dispose();t.dispose();}};
}
