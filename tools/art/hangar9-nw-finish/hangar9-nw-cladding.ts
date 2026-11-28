/** Detached Three r187 optical study only. No actors, scene binding or loader.
 * Never install on a mesh by filename/guess. Full native owner/draw custody is
 * a separate requirement; gl_VertexID is meaningful only in that authenticated draw.
 */
import {DoubleSide, Material, REVISION, ShaderMaterial} from 'three';

export const H9_NW_SCOPE = Object.freeze({
  base:'efbacd5efacc76f33936e9a82a39cebad99e58ff',
  tile:'q0322', ordinal:64, ringEdge:17, vertexStart:4935, vertexEnd:4941,
  ownerCount:23394, uvWidth:51.541622161865234, uvHeight:18.5,
  packedSource:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
  wireSource:'335c293cd1eb61e5840fc8b1b6be655cd62c9e153cc6046b0080f9854b5da3d2',
  positionSHA:'d06f10ed97449b2f2df18ac9fb61d9bbc30ba521bb6aa91198b2c25766eff950',
  vertexSHA:'0d53b72c008f4b429c6569b02263f2c8e25a99c6ccbc344b4dbdebb607c20ac5',
  fragmentSHA:'37e88165dcec7859a052cf5ae8f1e6c577646c06d9059860c4d732c01aa285c4',
});
const VE = 'void main(){';
const FE = '\n void main(){\n #include <logdepthbuf_fragment>';
const WALL = '\n else if(roof<.5){\n  vec2 grid=uv2d/vec2(2.62,3.08);';
const NS = 'h9Study';
export const H9_NW_SHEET_GLSL = `
 // Pixel box average of a repeated *authored* roll. It is not a
 // measurement of the door/profile; sub-resolution detail averages to zero.
 float h9StudyInterval(float q,float a,float b){
   return floor(q)*(b-a)+clamp(fract(q)-a,0.,b-a);
 }
 float h9StudyFiltered(float q,float width,float a,float b){
   return (h9StudyInterval(q+.5*width,a,b)-h9StudyInterval(q-.5*width,a,b))/width-(b-a);
 }
 vec3 h9StudyEnamel(vec2 m, vec2 span){
   float du=max(span.x,.001), dv=max(span.y,.001);
   // Paint weathering in METRES on the original wall UV. No apertures, logos
   // or fitted panel count; two broad, softly structured brush-scale envelopes.
   float sweep=sin(.31*m.x+.71*sin(.21*m.y)+.6)
       *(1.-smoothstep(1.5,4.5,du))*(1.-smoothstep(2.5,6.,dv));
   float flush=sin(.71*m.x-.13*m.y+.34*sin(.29*m.x)+1.6)
       *(1.-smoothstep(.55,2.7,du))*(1.-smoothstep(3.,7.,dv));
   float belt=smoothstep(.35,4.2,m.y); // quiet contact weathering, no new layer
   float ribWidth=du/.58;
   float rolling=h9StudyFiltered(m.x/.58,ribWidth,.12,.30)
       *(1.-smoothstep(.23,.95,ribWidth));
   vec3 enamel=vec3(.113,.148,.131);  // original linear cool mineral-green grey
   return enamel*(.969+.041*belt+.041*sweep+.025*flush-.052*rolling)
       +vec3(-.0015,.0013,.0002)*flush;
 }
`;
const FRAG_HEADER = `
 flat in int h9StudyRole;
 uniform float h9StudyGain;
` + H9_NW_SHEET_GLSL;
const FRAG_MAIN = FE + `
 // Compute footprint before either face or gain branch, so the falloff is
 // local to the real original UV and not a derivative of an ID/coverage mask.
 vec2 h9StudySpan=fwidth(uv2d);`;
const FRAG_WALL = `
 else if(h9StudyRole==1 && roof<.5 && facade==0. && h9StudyGain==1.){
  c=h9StudyEnamel(uv2d,h9StudySpan);
 }
 else if(roof<.5){
  vec2 grid=uv2d/vec2(2.62,3.08);`;
const count = (s:string,q:string)=>s.split(q).length-1;
const sha = async (s:string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),
    n=>n.toString(16).padStart(2,'0')).join('');

export async function exactH9NwStudySources(vertexShader:string, fragmentShader:string) {
  if (!globalThis.crypto?.subtle || vertexShader.includes(NS) || fragmentShader.includes(NS)
      || count(vertexShader,VE)!==1 || count(fragmentShader,FE)!==1 || count(fragmentShader,WALL)!==1)
    return;
  if(await sha(vertexShader)!==H9_NW_SCOPE.vertexSHA || await sha(fragmentShader)!==H9_NW_SCOPE.fragmentSHA)
    return;
  return {
    vertexShader:'flat out int h9StudyRole;\n'+vertexShader.replace(VE,VE+
      `\n h9StudyRole=(gl_VertexID>=${H9_NW_SCOPE.vertexStart}&&gl_VertexID<${H9_NW_SCOPE.vertexEnd})?1:0;`),
    fragmentShader:FRAG_HEADER+fragmentShader.replace(FE,FRAG_MAIN).replace(WALL,FRAG_WALL),
  };
}
const supported = (m:ShaderMaterial) =>
  m.constructor===ShaderMaterial && m.side===DoubleSide && m.vertexColors &&
  m.depthTest && m.depthWrite && m.colorWrite && !m.transparent &&
  !m.alphaToCoverage && !m.wireframe && !m.polygonOffset && !m.stencilWrite &&
  m.alphaTest===0 && m.opacity===1 && m.glslVersion===null &&
  m.onBeforeCompile===Material.prototype.onBeforeCompile &&
  m.customProgramCacheKey===Material.prototype.customProgramCacheKey &&
  !m.defines.h9StudyGain && !Object.hasOwn(m.uniforms,'h9StudyGain');

/** A borrowed-wrapper material, never an install/toggle for a scene. */
export async function makeH9NwCladdingStudy(stock:ShaderMaterial) {
  if(REVISION!=='187'||!supported(stock))return;
  const v=stock.vertexShader,f=stock.fragmentShader,u=stock.uniforms,ver=stock.version;
  const refs=Object.entries(u).flat();
  const src=await exactH9NwStudySources(v,f);
  const now=Object.entries(stock.uniforms).flat();
  if(!src||!supported(stock)||stock.vertexShader!==v||stock.fragmentShader!==f||
     stock.uniforms!==u||stock.version!==ver||refs.length!==now.length||
     refs.some((word,i)=>word!==now[i]))return;
  // Copy state without cloneUniforms cloning shared Texture Source. The live
  // stock dictionaries/wrappers, programs and material IDs remain untouched.
  const m=new ShaderMaterial();
  m.copy(Object.create(stock,{uniforms:{value:Object.create(null)}}));
  const gain={value:0};
  m.uniforms={...u,h9StudyGain:gain};
  m.vertexShader=src.vertexShader;
  m.fragmentShader=src.fragmentShader;
  let disposed=false;
  return Object.freeze({
    material:m,
    setGain(value:0|1) {
      if(disposed || (value!==0&&value!==1))throw Error('invalid detached finish gain');
      gain.value=value;
    },
    dispose() {if(!disposed){disposed=true;m.dispose();}},
  });
}
