import type * as THREE from 'three';

/** Optical study only: existing photograph / terrain, no geometry or
 * navigation alterations. It approximates an ordinary clear-day medium,
 * NOT actual/current PEI aviation visibility or a full atmospheric solver. */
export const AERIAL_NEAR=2200;
export const AERIAL_FULL=7200;
export const AIRLIGHT_SKY_RISE=.024;
export const AIRLIGHT_CALIBRATION_SKY_SHA='ad8b104c57f5ca62e051c674bb970e248e0fa04e264bf7ad61e5f32d2a1b7e7d';
export const horizonCoefficients=[
 [.437170734,.530189150,.630355558],
 [-.039462614,-.042574080,-.042460775],
 [-.016088445,-.019251099,-.019028546],
 [.005301168,.006725224,.007534891],
 [.013145470,.014141476,.014851387]
] as const;
// Broad display channels represent bands, not the three monochromatic
// sample wavelengths. Retain a restrained 15% of the paper RGB dispersion
// about green for this non-spectral art study (no site weather claim).
export const molecularEx=[12.345e-6,13.5e-6,16.44e-6] as const;
export const weatherNeutralAerosolEx=14.5e-6;

export function pathMeanDensity(a:number,b:number,scale:number){
 const lo=Math.min(Math.max(a,0),Math.max(b,0)),hi=Math.max(Math.max(a,0),Math.max(b,0));
 const dh=(hi-lo)/scale;
 return Math.exp(-lo/scale)*(dh===0?1:-Math.expm1(-dh)/dh);
}
export function pathTransmission(m:number,a:number,b:number){
 const A=pathMeanDensity(a,b,1200)*weatherNeutralAerosolEx,R=pathMeanDensity(a,b,8000);
 return molecularEx.map(ex=>Math.exp(-Math.max(0,m)*(A+ex*R)));
}
const vec=(a:readonly number[])=>'vec3('+a.map(x=>x.toFixed(9)).join(',')+')';
export const skyAirlightGLSL=`
 uniform float atmosphericLabGain;
 vec3 peiairHorizon(vec3 direction){
  // Low azimuth harmonics, fitted to the linear scene-referred horizon of
  // the existing panorama path. No per-surface sky map fetch.
  vec2 u=direction.xz*inversesqrt(max(dot(direction.xz,direction.xz),1.e-9));
  return ${vec(horizonCoefficients[0])}+${vec(horizonCoefficients[1])}*u.x+${vec(horizonCoefficients[2])}*u.y+
         ${vec(horizonCoefficients[3])}*(u.x*u.x-u.y*u.y)+${vec(horizonCoefficients[4])}*(2.*u.x*u.y);
 }
 vec3 peiairSky(vec3 stock,vec3 direction){
  float y=abs(direction.y);
  if(atmosphericLabGain<=0.||y>=${AIRLIGHT_SKY_RISE})return stock;
  return mix(stock,peiairHorizon(direction),atmosphericLabGain*(1.-smoothstep(.0025,${AIRLIGHT_SKY_RISE},y)));
 }
`;
export const flightAerialGLSL=`
 ${skyAirlightGLSL}
 float peiairMeanDensity(float lo,float delta,float invScale){
  float q=delta*invScale;
  // Analytic average exponential, evaluated by a near-equal-altitude
  // expansion to avoid loss of precision on low, near-horizontal rays.
  float average=q<.04?1.-q*(.5-q*(.16666667-q*.04166667)):(1.-exp(-q))/q;
  return exp(-lo*invScale)*average;
 }
 // Near-horizontal far water is on the roughness-filtered, flat-normal
 // branch of the existing ocean. Match airlight from the same azimuth to
 // its nearly pure grazing reflection before applying the ray column.
 vec3 peiairGrazingSea(vec3 col,vec3 fragment,vec3 eye,float distanceM){
  if(atmosphericLabGain<=0.||distanceM<=5200.)return col;
  // Use incident mean slope after optical filtering, not one unresolved
  // perturbed ripple normal; retain specular wave detail in stock colour.
  float incidence=clamp((eye.y-fragment.y)/distanceM,0.,1.);
  if(incidence>=.018)return col;
  float allow=smoothstep(5200.,39000.,distanceM)*(1.-smoothstep(.004,.018,incidence));
  float f=.020+.98*pow(1.-incidence,5.);
  return mix(col,peiairHorizon((fragment-eye)/distanceM),allow*f);
 }
 vec3 peiairSurface(vec3 stock,vec3 sceneColor,vec3 fragment,vec3 eye,float meters){
  if(atmosphericLabGain<=0.||meters<=${AERIAL_NEAR}.)return stock;
  float lo=min(max(fragment.y,0.),max(eye.y,0.));
  float dh=abs(max(fragment.y,0.)-max(eye.y,0.));
  float wa=peiairMeanDensity(lo,dh,.000833333333);
  float wr=peiairMeanDensity(lo,dh,.000125);
  vec3 T=exp(-meters*(vec3(.0000145)*wa+vec3(.000012345,.0000135,.00001644)*wr));
  vec3 air=peiairHorizon((fragment-eye)/meters);
  vec3 response=air+(sceneColor-air)*T;
  return mix(stock,response,atmosphericLabGain*smoothstep(${AERIAL_NEAR}.,${AERIAL_FULL}.,meters));
 }
`;
const mistHead='vec3 mist(vec3 col,float d,float h){';
const skyCall='vec3 c=skyAt(normalize(skyRay));';
const mainlandCall='gl_FragColor=vec4(mix(c.rgb*l,vec3(.56,.68,.72),min(haze,.91)),1.);';
export type AerialRole='surface'|'backdrop'|'mainland';
/** Exact in-place-compatible source rewrite, only for the detached QA.
 * Return undefined on a changed third-party shader or unrelated material. */
export function labAerialFragment(src:string):{role:AerialRole;fragment:string}|undefined{
 if(src.includes('peiairSurface(')||src.includes('peiairSky('))return;
 if(src.includes(mistHead)&&/vec4\(mist\(/.test(src)){
  const idx=src.indexOf(mistHead),end=src.indexOf('}',idx);
  if(end<idx)return;
  const ocean=src.includes('uniform sampler2D imageMap,coverMap,rippleMap;')&&src.includes('float ndv=clamp(dot(normal,view)');
  const preTransfer=ocean?'peiairGrazingSea($1,p,cameraPosition,$2)':'$1';
  const output=src.slice(end+1).replace(/vec4\(mist\((\w+),(\w+),p\.y\),1\.\)/g,'vec4(peiairSurface(mist($1,$2,p.y),'+preTransfer+',p,cameraPosition,$2),1.)');
  if(!output.includes('peiairSurface('))return;
  return {role:'surface',fragment:src.slice(0,end+1)+flightAerialGLSL+output};
 }
 if(src.includes(skyCall)&&src.includes('uniform float skyDiagnostic;')){
  return {role:'backdrop',fragment:src.replace('void main(){',skyAirlightGLSL+'\nvoid main(){')
    .replace(skyCall,'vec3 c=peiairSky(skyAt(normalize(skyRay)),normalize(skyRay));')};
 }
 if(src.includes(mainlandCall)&&src.includes('float d=distance(wp,cameraPosition)')){
  return {role:'mainland',fragment:src.replace('void main(){',flightAerialGLSL+'\nvoid main(){')
    .replace(mainlandCall,'gl_FragColor=vec4(peiairSurface(mix(c.rgb*l,vec3(.56,.68,.72),min(haze,.91)),c.rgb*l,wp,cameraPosition,d),1.);')};
 }
}
export function stageAerialPerspective(scene:THREE.Scene,gain:{value:number},verifiedSkySha?:string){
 if(verifiedSkySha!==AIRLIGHT_CALIBRATION_SKY_SHA||!Number.isFinite(gain.value)||gain.value<0||gain.value>1)return;
 const passes=new Map<THREE.ShaderMaterial,NonNullable<ReturnType<typeof labAerialFragment>>>();
 scene.traverse(o=>{
  const m=(o as THREE.Mesh).material;
  if(!m||Array.isArray(m)||!(m as THREE.ShaderMaterial).isShaderMaterial||passes.has(m as THREE.ShaderMaterial))return;
  const shader=m as THREE.ShaderMaterial,newSource=labAerialFragment(shader.fragmentShader);
  if(newSource)passes.set(shader,newSource);
 });
 const roles=[...new Set([...passes.values()].map(p=>p.role))];
 if(!['surface','backdrop','mainland'].every(role=>roles.includes(role as AerialRole)))return;
 for(const [mat,pass] of passes){
  mat.fragmentShader=pass.fragment;mat.uniforms={...mat.uniforms,atmosphericLabGain:gain};mat.needsUpdate=true;
 }
 return {matched:passes.size,roles};
}

const NATIVE_SKY_BYTES=214798;
const INTERNAL_SKY_RECEIPT=Symbol('authenticated maritime sky');
export type VerifiedAerialSky={readonly texture:THREE.Texture;readonly [INTERNAL_SKY_RECEIPT]:true};
export type VerifyAerialSky=(url:string,decode:(url:string)=>Promise<THREE.Texture>)=>Promise<VerifiedAerialSky|undefined>;
/** The requested branch borrows the normal existing sky transfer. Decode
 * the exact verified bytes, not a second unbound image request. If the
 * optional bounded path fails, the caller simply uses its old loader. */
export async function loadVerifiedAerialSky(url:string,decode:(url:string)=>Promise<THREE.Texture>,fetcher=fetch,timeout=1750){
 if(!globalThis.crypto?.subtle)return;
 const controller=new AbortController();
 let timeoutId:ReturnType<typeof setTimeout>|undefined;
 const load=async():Promise<VerifiedAerialSky|undefined>=>{
  try{
   const response=await fetcher(url,{signal:controller.signal,cache:'force-cache'});
   if(response.status!==200||!response.body||controller.signal.aborted)return;
   const stream=response.body.getReader(),data=new Uint8Array(NATIVE_SKY_BYTES);
   let offset=0,done=false;
   try{
    while(!done){
     const part=await stream.read();
     if(part.done){done=true;break;}
     if(offset+part.value.byteLength>NATIVE_SKY_BYTES||controller.signal.aborted)return;
     data.set(part.value,offset);offset+=part.value.byteLength;
    }
   }finally{if(!done)void stream.cancel().catch(()=>{});stream.releaseLock();}
   if(offset!==NATIVE_SKY_BYTES||controller.signal.aborted)return;
   const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');
   if(sha!==AIRLIGHT_CALIBRATION_SKY_SHA||controller.signal.aborted)return;
   const objectURL=URL.createObjectURL(new Blob([data],{type:'image/webp'}));
   try{
    const texture=await decode(objectURL);
    const image=texture.image as {width?:number;height?:number}|undefined;
    if(controller.signal.aborted||image?.width!==4096||image?.height!==2048){
     texture.dispose();return;
    }
    return {texture,[INTERNAL_SKY_RECEIPT]:true};
   }finally{URL.revokeObjectURL(objectURL);}
  }catch{return;}
 };
 try{
  return await Promise.race([load(),new Promise<undefined>(resolve=>{
   timeoutId=setTimeout(()=>{controller.abort();resolve(undefined);},timeout);
  })]);
 }finally{if(timeoutId!==undefined)clearTimeout(timeoutId);}
}

export type AerialWorldOptics={
 readonly gain:{value:number};
 readonly armed:boolean;
 accepts(sky:THREE.Texture):boolean;
 bind(material:THREE.ShaderMaterial):THREE.ShaderMaterial;
};
export function verifiedAerialOptics(sky:VerifiedAerialSky):AerialWorldOptics|undefined{
 if(!sky?.[INTERNAL_SKY_RECEIPT])return;
 const gain={value:1},variants=new Map<string,ReturnType<typeof labAerialFragment>>();
 let failed=false,backdrop=false,surface=false,mainland=false;
 return {
  gain,
  get armed(){return !failed&&backdrop&&surface&&mainland;},
  accepts(texture){
   if(texture!==sky.texture){failed=true;gain.value=0;}
   return !failed;
  },
  bind(m){
   // A shared clone can already be tagged; don't duplicate its shader.
   if(m.fragmentShader.includes('peiairSurface(')||m.fragmentShader.includes('peiairSky(')){
    if(m.uniforms.atmosphericLabGain!==gain){failed=true;gain.value=0;}
    return m;
   }
   if(failed)return m;
   const old=m.fragmentShader;
   let patch=variants.get(old);
   if(!variants.has(old)){patch=labAerialFragment(old);variants.set(old,patch);}
   if(!patch){failed=true;gain.value=0;return m;}
   m.fragmentShader=patch.fragment;m.uniforms={...m.uniforms,atmosphericLabGain:gain};
   backdrop||=patch.role==='backdrop';surface||=patch.role==='surface';mainland||=patch.role==='mainland';
   return m;
  },
 };
}
