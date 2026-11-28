import {
 BufferGeometry,Color,DataTexture,Float32BufferAttribute,Group,LinearFilter,LinearMipmapLinearFilter,Mesh,
 MeshStandardMaterial,NoColorSpace,RGBAFormat,SRGBColorSpace,UnsignedByteType,Vector2,
} from 'three';
import {makeTignishRoof,type RoofRecipe} from '../roof.ts';

const sides=new Set(['nave-south-east-segment','nave-south-west-segment','nave-north-east-segment','nave-north-west-segment']);
const U0=-7,U1=15.5,V0=-10.75,V1=5.5;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const mix=(a:number,b:number,t:number)=>a+t*(b-a);
const smooth=(t:number)=>t*t*(3-2*t);
const fract=(t:number)=>t-Math.floor(t);
const fade=(a:number,b:number,x:number)=>smooth(clamp((x-a)/(b-a),0,1));
function hash(x:number,y:number,k:number) {
 let h=(Math.imul(x,1597334677)^Math.imul(y,3812015801)^Math.imul(k,174823597))>>>0;
 h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x:number,y:number,k:number) {
 const i=Math.floor(x),j=Math.floor(y),s=smooth(x-i),t=smooth(y-j);
 return mix(mix(hash(i,j,k),hash(i+1,j,k),s),mix(hash(i,j+1,k),hash(i+1,j+1,k),s),t);
}
/** Original weathered-surface study. Input metres are the measured roof's plan U/V, not a photo projection. */
export function finishSample(u:number,v:number) {
 if(!Number.isFinite(u)||!Number.isFinite(v))throw Error('Non-finite roof plan sample');
 const south=v<-3;
 // Rise/run varies slightly between frozen planes. An illustrative pitch defines an artistic course spacing only.
 const across=u+.005*noise(v*2,u*.7,20);
 const runoff=south?(v+10.54):5.28-v;
 const down=runoff*1.565+.006*(noise(u*2,v*.8,21)-.5);
 const pitchAcross=.286,pitchSlope=.151;
 const row=Math.floor(down/pitchSlope);
 const rowFrac=fract(down/pitchSlope),tile=across/pitchAcross+.5*(row&1);
 const tileFrac=fract(tile),col=Math.floor(tile);
 const edge=(1-fade(.025,.14,rowFrac))*.46;
 const side=(1-fade(.025,.09,Math.min(tileFrac,1-tileFrac)))*
  fade(.14,.33,rowFrac)*(1-fade(.79,.98,rowFrac))*.24;
 const a=(hash(col,row,73)-.5);
 const mineral=noise(u*13.1,v*13.1,5)-.5,grain=noise(u*29,v*27,11)-.5;
 // Water runs down a pitched panel as wide, individually aperiodic streaks rather than rows of stripes.
 const ripple=noise(u*.82,v*.33,49),wide=noise(u*.23,v*.4,60)-.5;
 const stain=(noise(u*1.38+.37*ripple,v*.29,28)-.5)*
  (.20+.80*fade(.3,.92,noise(u*.36,v*.15,2)));
 // Increasing runoff here is distance *upslope* from the eave.
 const fromRidge=Math.max(0,(south?7.47:8.32)-runoff);
 const ridgeFade=1-fade(1.25,4.80,fromRidge);
 const weather=10.0*stain+6.6*wide+3.9*ridgeFade*(noise(u*.95,v*.75,29)-.36);
 const code=clamp(123+weather+4.8*a+4.2*mineral+3.4*grain-9.8*edge-6.5*side,103,142);
 const relief=.0019*(1-rowFrac)-.00047*edge-.00035*side+.000195*mineral+.00013*grain;
 const roughness=clamp(.879+.044*stain+.022*a+.025*mineral+.014*grain+edge*.032,.82,.94);
 return {albedo:[code*.996,code,code*.989] as const,relief,roughness};
}
function requireSize(size:number){
 if(!Number.isInteger(size)||size<64||size>1024||((size&(size-1))!==0))throw Error('Unsupported roof texture size');
}
export function makeFinishMaps(size=1024){
 requireSize(size);
 const n=size*size*4,A=new Uint8Array(n),N=new Uint8Array(n),R=new Uint8Array(n);
 const h=new Float32Array(size*size),du=(U1-U0)/size,dv=(V1-V0)/size;
 const b=(a:number)=>clamp(Math.round(a),0,255);
 // Four fixed subpixel samples per texel. Normal derivatives are measured in metres.
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const k=j*size+i;let a=0,g=0,c=0,v=0,r=0;
  for(const y of [.25,.75])for(const x of [.25,.75]){
   const s=finishSample(U0+(i+x)*du,V0+(j+y)*dv);
   a+=s.albedo[0];g+=s.albedo[1];c+=s.albedo[2];v+=s.relief;r+=s.roughness;
  }
  A.set([b(a/4),b(g/4),b(c/4),255],4*k);R.set([255,b(r*(255/4)),255,255],4*k);h[k]=v/4;
 }
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const k=j*size+i,a=Math.max(i-1,0),c=Math.min(size-1,i+1),b0=Math.max(j-1,0),d=Math.min(size-1,j+1);
  const x=-(h[j*size+c]-h[j*size+a])/((c-a)*du),y=-(h[d*size+i]-h[b0*size+i])/((d-b0)*dv*1.565);
  const l=Math.hypot(x,y,1);
  N.set([b(127.5*(1+x/l)),b(127.5*(1+y/l)),b(127.5*(1+1/l)),255],4*k);
 }
 function wrap(raw:Uint8Array,albedo:boolean){
  const tex=new DataTexture(raw,size,size,RGBAFormat,UnsignedByteType);
  tex.colorSpace=albedo?SRGBColorSpace:NoColorSpace;
  tex.generateMipmaps=true;tex.minFilter=LinearMipmapLinearFilter;tex.magFilter=LinearFilter;
  tex.anisotropy=4;tex.needsUpdate=true;return tex;
 }
 return {albedo:wrap(A,true),normal:wrap(N,false),roughness:wrap(R,false)};
}
/** Own fresh exact measured geometry. Only the named four detached roof sides receive the artwork. */
export function makeTignishNaveFinish(recipe:RoofRecipe,size=1024) {
 requireSize(size);
 const root=makeTignishRoof(recipe);
 let map:ReturnType<typeof makeFinishMaps>;
 try{map=makeFinishMaps(size);}
 catch(e){for(const x of root.children)if(x instanceof Mesh){x.geometry.dispose();x.material.dispose();}throw e;}
 const material=new MeshStandardMaterial({
  color:new Color(0xffffff),map:map.albedo,normalMap:map.normal,normalScale:new Vector2(.8,.8),
  roughness:1,roughnessMap:map.roughness,metalness:0,flatShading:true,
 });
 const changed:Mesh<BufferGeometry,MeshStandardMaterial>[]=[];
 try{
  if(!(root instanceof Group)||root.parent!==null)throw Error('Detached roof ownership required');
  for(const object of root.children){
   if(!(object instanceof Mesh)||!(object.material instanceof MeshStandardMaterial)||!sides.has(object.userData.role))continue;
   const a=object.geometry.attributes.uv,uv=[];
   for(let i=0;i<a.count;i++){
    const s=(a.getX(i)-U0)/(U1-U0),t=(a.getY(i)-V0)/(V1-V0);
    if(s<0||t<0||s>1||t>1)throw Error('Original sampled roof exceeds the artwork only domain');
    uv.push(s,t);
   }
   object.geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
   object.material.dispose();object.material=material;changed.push(object);
  }
  if(changed.length!==4)throw Error('Wrong named roof-side count');
 }catch(e){dispose();throw e;}
 function dispose(){
  root.removeFromParent();
  for(const object of root.children)if(object instanceof Mesh){
   object.geometry.dispose();if(object.material!==material)object.material.dispose();
  }
  material.dispose();map.albedo.dispose();map.normal.dispose();map.roughness.dispose();
 }
 return {group:root,changed,maps:map,dispose};
}
