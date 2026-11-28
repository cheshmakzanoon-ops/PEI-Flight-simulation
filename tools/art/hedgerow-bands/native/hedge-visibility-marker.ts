import * as T from 'three';
const WIDTH=256, HEIGHT=176, LIMIT=45000; // exact original instance capacity, last 56 texels unused
const MAIN=' void main(){';
const COLOR=' #include <colorspace_fragment>';
type Tuple=Readonly<{vertex:string;fragment:string}>;
/** Evidence-only marker: final RGB after the original alpha calculation, atlas,
 * depth discard and shading. This is not a new sprite or a game-facing shader. */
export function markerSource(live:Tuple,signed:Tuple){
 const {vertex,fragment}=live;
 if(vertex!==signed.vertex||fragment!==signed.fragment||vertex.includes('hedgeProofOwner')||
    vertex.split(MAIN).length!==2||fragment.split(MAIN).length!==2||fragment.split(COLOR).length!==2||
    !fragment.includes('if(a<.30)discard;')||!fragment.includes('clamp((a-.30)*3.8,0.,1.)')||
    !vertex.includes('attribute vec3 stem;attribute vec4 shape;'))return;
 return {
  vertex:'flat out highp int hedgeProofOwner;\n'+vertex.replace(MAIN,MAIN+'\n  hedgeProofOwner=gl_InstanceID;'),
  fragment:`flat in highp int hedgeProofOwner;
  uniform highp sampler2D hedgeProofMask;
  uniform vec3 hedgeProofRGB;
  `+fragment.replace(COLOR,COLOR+`
  // Alpha is never rewritten. The owner texture is bound on a detached program.
  if(texelFetch(hedgeProofMask,ivec2(hedgeProofOwner%256,hedgeProofOwner/256),0).r>.5)
    gl_FragColor.rgb=hedgeProofRGB;
  `),
 };
}
export function makeInstanceCoverageTexture(owned:readonly number[],oldForestPrefix:number,total:number){
 if(!Number.isInteger(total)||total<1||total>LIMIT||!Number.isInteger(oldForestPrefix)||
    oldForestPrefix<0||oldForestPrefix>=total||!owned.length||
    owned.some((n,i)=>!Number.isSafeInteger(n)||n<oldForestPrefix||n>=total||i>0&&n<=owned[i-1]))return;
 const bytes=new Uint8Array(WIDTH*HEIGHT);
 for(const i of owned)bytes[i]=255;
 const map=new T.DataTexture(bytes,WIDTH,HEIGHT,T.RedFormat,T.UnsignedByteType);
 map.magFilter=map.minFilter=T.NearestFilter;map.generateMipmaps=false;
 map.colorSpace=T.NoColorSpace;map.flipY=false;map.unpackAlignment=1;
 map.needsUpdate=true;
 return {texture:map,close:()=>map.dispose()};
}
