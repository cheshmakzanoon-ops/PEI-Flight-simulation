import * as T from 'three';

export const DALVAY_WATER_VISUAL={
 // Opaque suffix prevents HTTP providers from auto-inflating authenticated gzip.
 file:'dalvay-optics/2021-visual-core.dlb',bytes:1091,packed:'149ee965bc52ca42e75f506a5f688dd9b3f2420264ff427c5c23e7496d190f56',
 raw:'104b60f2dfc6d0f299a7fcff0169992f5d9c51a03b7dfbfdb81ad85b871fa139',
 width:199,height:135,step:4,sourceOrigin:[-548,-296],world:[9366.042434018622,9381.795112696944,796,540],
 center:[9914.042434018622,9677.795112696944],tiles:['17-12','17-13'],
 // Exact original GPU support was 2.11999989–3.50636363 game metres.
 // This conservative fence is not a physical water level or elevation edit.
 originalDrawnY:[2.11,3.52],
} as const;

const SHA=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export async function decodeDalvayOptics(body:ArrayBuffer){
 const s=DALVAY_WATER_VISUAL;
 if(!globalThis.crypto?.subtle||body.byteLength!==s.bytes||await SHA(body)!==s.packed)return;
 try{
  const raw=await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(raw.byteLength!==24+s.width*s.height||await SHA(raw)!==s.raw)return;
  const d=new DataView(raw);
  if(d.getUint32(0)!==0x444c3031||d.getUint16(4,true)!==s.width||d.getUint16(6,true)!==s.height||
     d.getFloat32(8,true)!==s.sourceOrigin[0]||d.getFloat32(12,true)!==s.sourceOrigin[1]||d.getFloat32(16,true)!==s.step||d.getFloat32(20,true)!==s.step)return;
  const a=new Uint8Array(raw,24);return a;
 }catch{return;}
}
export async function loadDalvayOptics(worldBase:string,transport:typeof fetch=fetch){
 try{
  const res=await transport(worldBase+DALVAY_WATER_VISUAL.file);
  if(!res.ok||!res.body)return;
  const cap=DALVAY_WATER_VISUAL.bytes,reader=res.body.getReader(),a=new Uint8Array(cap);let n=0;
  try{
   for(;;){const v=await reader.read();if(v.done)break;if(n+v.value.length>cap){await reader.cancel();return;}a.set(v.value,n);n+=v.value.length;}
  }finally{reader.releaseLock();}
  if(n!==cap)return;
  return decodeDalvayOptics(a.buffer);
 }catch{return;}
}

const GLSL=`
 uniform sampler2D dlvWaterMask,dlvSkyMap;
 uniform vec4 dlvBox;
 centroid varying vec3 dlvReceiverPos;
 // Analytic weak wave slopes in the two horizontal axes. Directions and
 // angular frequencies are split deliberately rather than forming a repeating
 // crossed grid. Attenuate projected bands before the pixel's Nyquist rate.
 vec2 dlvSlope(vec2 q,vec2 k,float amp,float phase,vec2 px,vec2 py){
  float width=max(abs(dot(k,px)),abs(dot(k,py)));
  float anti=1.-smoothstep(.55,2.6,width);
  return k*(cos(dot(q,k)+phase)*amp*anti);
 }
 vec3 dlvPaint(vec3 oldCol,vec3 w,vec3 dx,vec3 dy,float dist,vec3 sunVector,float t){
  if(w.y<${DALVAY_WATER_VISUAL.originalDrawnY[0].toFixed(2)}||w.y>${DALVAY_WATER_VISUAL.originalDrawnY[1].toFixed(2)})return oldCol;
  vec2 uv=(w.xz-dlvBox.xy)/dlvBox.zw;
  if(any(lessThanEqual(uv,vec2(0.)))||any(greaterThanEqual(uv,vec2(1.))))return oldCol;
  float water=textureLod(dlvWaterMask,uv,0.).r;
  if(water<.001)return oldCol;
  // Water is optically horizontal; variations in the legacy triangulated terrain
  // don't tilt a lake's specular lobe. Do not change that terrain or its elevation.
  vec3 grade=normalize(cross(dx,dy));if(grade.y<0.)grade=-grade;
  float calm=smoothstep(.996,.998,grade.y);
  float feather=water*water*(3.-2.*water);
  if(calm*feather<.001)return oldCol;
  vec2 q=w.xz-dlvBox.xy;
  float soft=1.-smoothstep(175.,1200.,dist);
  vec2 wv=vec2(0.);
  if(soft>.0001){
   float drift=noise(q*.031+vec2(13.2,-8.8))-.5;
   vec2 base=q+vec2(5.7*drift,-3.1*drift);
   // Mixed short and capillary bands, dominant along one notional breeze.
   // Seconds are the existing render clock, not tied to aircraft or physics.
   wv+=dlvSlope(base,vec2(1.53,.32),.00210,.19-3.92*t,dx.xz,dy.xz);
   wv+=dlvSlope(base,vec2(1.87,-.70),.00160,1.57-4.44*t,dx.xz,dy.xz);
   wv+=dlvSlope(base,vec2(2.73,.61),.00102,3.61-5.24*t,dx.xz,dy.xz);
   wv+=dlvSlope(base,vec2(3.59,-1.88),.00086,2.40-6.31*t,dx.xz,dy.xz);
   wv+=dlvSlope(base,vec2(4.32,1.74),.00050,5.01-6.76*t,dx.xz,dy.xz);
   wv+=dlvSlope(base,vec2(5.33,-.87),.00043,.74-7.28*t,dx.xz,dy.xz);
   wv+=dlvSlope(base,vec2(.62,4.06),.00036,4.02-6.35*t,dx.xz,dy.xz);
   wv*=soft*mix(.84,1.07,noise(q*.014+vec2(21.2,17.1)));
  }
  vec3 v=normalize(cameraPosition-w);
  vec3 n=normalize(vec3(wv.x,1.,wv.y));
  vec3 reflected=reflect(-v,n);
  vec2 sk=vec2(.5+atan(reflected.z,reflected.x)*.159154943+.512,.5+asin(clamp(reflected.y,-.025,1.))*.3183099);
  float pixel=max(length(dx.xz),length(dy.xz));
  vec3 sky=textureLod(dlvSkyMap,sk,clamp(log2(1.+11.*pixel),2.5,5.8)).rgb;
  sky=mix(vec3(.46,.55,.65),sky*.80,smoothstep(-.025,.055,reflected.y));
  // Fresh-water Fresnel, subdued by a rough microsurface and modest overcast haze.
  float f=.02037+.97963*pow(1.-clamp(dot(v,n),0.,1.),5.);
  float glint=pow(max(dot(normalize(v+sunVector),n),0.),mix(85.,115.,soft));
  vec3 absorption=vec3(.013,.028,.031);
  vec3 liquid=mix(absorption,sky,f*.42)+vec3(.52,.422,.295)*glint*.08;
  return mix(oldCol,liquid,feather*calm*.82);
 }
`;
export type DalvayReceiver=Readonly<{id:string;mesh:T.Mesh;stock:T.ShaderMaterial}>;
type Pass={previous:string;installed:string;previousVertex:string;installedVertex:string;uniforms:Record<string,T.IUniform>};
type Bound=DalvayReceiver&Pass&{version:number};
function variant(stock:T.ShaderMaterial,texture:T.DataTexture):Pass|undefined{
 const source=stock.fragmentShader,vertex=stock.vertexShader,head='void main(){',
  vertexField='varying vec3 p; varying vec2 vuv;',vertexAssign='p=w.xyz;vuv=uv;';
 const end=['gl_FragColor=vec4(mist(col,d,p.y),1.);','gl_FragColor=vec4(peiairSurface(mist(col,d,p.y),col,p,cameraPosition,d),1.);']
   .filter(k=>source.split(k).length===2);
 if(stock.glslVersion===T.GLSL3||end.length!==1||source.split(head).length!==2||
    !source.includes('vec3 terrainDx')||!stock.uniforms.skyMap?.value?.isTexture||
    vertex.split(vertexField).length!==2||vertex.split(vertexAssign).length!==2||vertex.includes('dlvReceiverPos'))return;
 const final=end[0],alreadySky=/uniform\s+sampler2D\s+[^;]*\bskyMap\b/.test(source);
 const uniforms:Record<string,T.IUniform>={dlvWaterMask:{value:texture},
   ...(!alreadySky?{dlvSkyMap:stock.uniforms.skyMap}:{}),dlvBox:{value:new T.Vector4(...DALVAY_WATER_VISUAL.world)}};
 if(Object.keys(uniforms).some(key=>key in stock.uniforms))return;
 const code=alreadySky?GLSL.replace('dlvWaterMask,dlvSkyMap','dlvWaterMask').replaceAll('dlvSkyMap','skyMap'):GLSL;
 const installed=source.replace(head,code+'\n'+head).replace(final,'col=dlvPaint(col,dlvReceiverPos,terrainDx,terrainDy,d,sun,clock);\n'+final);
 // For an MSAA-covered sliver, the ordinary p can be evaluated outside
 // that triangle and extrapolate tens or hundreds of metres at grazing view.
 // Use a covered centroid only for the new optic, without changing stock p.
 const installedVertex=vertex.replace(vertexField,vertexField+'\n centroid varying vec3 dlvReceiverPos;')
  .replace(vertexAssign,vertexAssign+'dlvReceiverPos=p;');
 return {previous:source,installed,previousVertex:vertex,installedVertex,uniforms};
}
/** A material on the original terrain only. Neither world collision nor GPU topology is altered. */
export class DalvayLakeOptics{
 private readonly mask:T.DataTexture;
 private current:Bound[]=[];
 private mounts=0;
 constructor(body:Uint8Array<ArrayBuffer>){
  const s=DALVAY_WATER_VISUAL;
  if(body.length!==s.width*s.height)throw Error('Unexpected Dalvay water mask');
  const a=this.mask=new T.DataTexture(body,s.width,s.height,T.RedFormat,T.UnsignedByteType);
  a.minFilter=a.magFilter=T.LinearFilter;a.generateMipmaps=false;a.flipY=false;a.unpackAlignment=1;a.needsUpdate=true;
  a.name='Dalvay · signed independent interior visual stencil';
 }
 get active(){return this.current.length===DALVAY_WATER_VISUAL.tiles.length;}
 get state(){return {active:this.active,visualOnly:true,receivers:this.current.map(t=>t.id),mounts:this.mounts};}
 private withdraw(){
  for(const t of this.current){
   let dirty=false;
   if(t.stock.fragmentShader===t.installed){t.stock.fragmentShader=t.previous;dirty=true;}
   if(t.stock.vertexShader===t.installedVertex){t.stock.vertexShader=t.previousVertex;dirty=true;}
   if(dirty)t.stock.needsUpdate=true;
   for(const [key,value] of Object.entries(t.uniforms))if(t.stock.uniforms[key]===value)delete t.stock.uniforms[key];
  }
  this.current=[];
 }
 update(receive:()=>readonly DalvayReceiver[]|undefined){
  const targets=receive(),ids=DALVAY_WATER_VISUAL.tiles;
  if(!targets||targets.length!==ids.length||!targets.every((t,i)=>t.id===ids[i])){this.withdraw();return;}
  if(targets.every((t,i)=>{
   const b=this.current[i];
   return b?.id===t.id&&b.mesh===t.mesh&&b.stock===t.stock&&t.mesh.material===b.stock&&
    b.installed===b.stock.fragmentShader&&b.installedVertex===b.stock.vertexShader&&b.version===b.stock.version&&
    Object.entries(b.uniforms).every(([key,value])=>b.stock.uniforms[key]===value);
  }))return;
  this.withdraw();
  const next=targets.map(t=>t.mesh.material===t.stock?variant(t.stock,this.mask):undefined);
  if(next.some(t=>!t)||targets[0].stock===targets[1].stock)return;
  // Preserve the exact material identity as well as geometry. The renderer
  // sorts opaque draw items by material ID, which can affect tied depth.
  this.current=targets.map((t,i)=>{
   const p=next[i]!;
   t.stock.fragmentShader=p.installed;t.stock.vertexShader=p.installedVertex;
   Object.assign(t.stock.uniforms,p.uniforms);t.stock.needsUpdate=true;
   return {...t,...p,version:t.stock.version};
  });
  this.mounts++;
 }
 dispose(){this.withdraw();this.mask.dispose();}
}
