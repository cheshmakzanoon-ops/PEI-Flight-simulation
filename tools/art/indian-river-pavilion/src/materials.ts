import * as T from 'three';
export type Layer='cedar'|'trim'|'reveal'|'foundation'|'deck'|'wood'|'steel'|'roof'|'glass'|'interior';
export type Materials=Record<Layer,T.MeshStandardMaterial>;
const F=(v:number)=>v-Math.floor(v);
const clamp=(x:number,a=0,b=1)=>Math.min(Math.max(x,a),b);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function rnd(a:number,b:number,k:number){
 let h=Math.imul(a+37,374761393)^Math.imul(b+71,668265263)^Math.imul(k+13,1568601097);
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(u:number,v:number,a:number,b:number,k:number) {
 const x=u*a,y=v*b;const i=Math.floor(x),j=Math.floor(y),S=(t:number)=>t*t*(3-2*t),fx=S(F(x)),fy=S(F(y));
 const mod=(q:number,n:number)=>(q%n+n)%n;
 const R=(U:number,V:number)=>rnd(mod(U,a),mod(V,b),k);
 return lerp(lerp(R(i,j),R(i+1,j),fx),lerp(R(i,j+1),R(i+1,j+1),fx),fy)-.5;
}
type Sample=readonly [number,number,number,number];
function maps(mat:T.MeshStandardMaterial,N:number,M:number,U:number,V:number,fn:(u:number,v:number)=>Sample,depth=1){
 const tex=new Uint8Array(N*M*4),norm=new Uint8Array(N*M*4),field=new Float32Array(N*M);
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){
  const z=fn((i+.5)/N,(j+.5)/M),o=(i+j*N)*4;
  field[i+j*N]=z[3];
  for(let c=0;c<3;c++)tex[o+c]=clamp(Math.round(z[c]),0,255);
  tex[o+3]=255;
 }
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){
  const a=(i+N-1)%N,b=(i+1)%N,c=(j+M-1)%M,d=(j+1)%M,o=(i+j*N)*4;
  const X=(field[a+j*N]-field[b+j*N])*(N/2/U),Y=(field[i+c*N]-field[i+d*N])*(M/2/V);
  const r=Math.sqrt(1+X*X+Y*Y);
  norm[o]=Math.round(127.5*(1+X/r));norm[o+1]=Math.round(127.5*(1+Y/r));norm[o+2]=Math.round(127.5*(1+1/r));norm[o+3]=255;
 }
 const out=(data:Uint8Array,cs:string)=>{
  const t=new T.DataTexture(data,N,M,T.RGBAFormat);t.colorSpace=cs;
  t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1/U,1/V);
  t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.anisotropy=4;return t;
 };
 mat.map=out(tex,T.SRGBColorSpace);mat.normalMap=out(norm,T.NoColorSpace);mat.normalScale.set(depth,depth);mat.color.set(0xffffff);
}
const M=(c:number,r:number,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m,vertexColors:true});
export function pavilionMaterials(detailed=true):Materials{
 const result:Materials={
  cedar:M(0xd2d0c3,.78),trim:M(0xe3dfcf,.66),reveal:M(0x726d5e,.82),
  foundation:M(0x777068,.94),deck:M(0x876c47,.91),wood:M(0xbc9563,.78),steel:M(0x272e2e,.51,.28),roof:M(0x818486,.76,.05),
  interior:M(0xbeb8a6,.88),glass:new T.MeshPhysicalMaterial({color:0xc7d4d2,vertexColors:true,
   metalness:.45,roughness:.19,clearcoat:.35,clearcoatRoughness:.22,
   envMapIntensity:1.48,opacity:.28,transparent:true,depthWrite:false,side:T.DoubleSide})
 };
 if(!detailed)return result;
 maps(result.cedar,256,256,2.12,1.664,(u,v)=>{
  const N=13,R=16,row=Math.floor(v*R),base=F(u+(row&1)/(2*N)),col=Math.floor(base*N),x=F(base*N);
  const y=F(v*R),edge=clamp(1-y/.068),joint=clamp(1-Math.min(x,1-x)/.055)*(1-edge*.82);
  const grain=noise(u,v,141,15,2),haze=noise(u,v,5,7,4),fibre=noise(u,v,86,25,17);
  const k=212+7.9*haze+9.5*grain+3.4*fibre+5.6*(rnd(col,row,97)-.5)-15.6*edge-9.2*joint;
  return [k+2.3,k+1,k-3.3,.0043*(1-y)*clamp(y/.042)-.0015*joint+.00036*fibre];
 },.63);
 // Planar boards are an original physically scaled texture, not photo projection.
 maps(result.deck,256,256,3.52,2.038,(u,v)=>{
  const course=Math.floor(v*14),x=F(u+((course*19)%7)*.09),y=F(v*14);
  const seam=clamp(1-Math.min(y,1-y)/.027), butt=clamp(1-Math.min(x,1-x)/.008);
  const vein=noise(u,v,17,151,151),mottle=noise(u,v,11,18,14),grain=noise(u,v,6,73,149);
  const fade=12*noise(u,v,4,7,202)+7.4*(rnd(12,course,14)-.5);
  const c=108+fade+11.5*vein+12*mottle+6.5*grain-36*seam-20*butt;
  return [c+31,c+4,c-22,-.0018*seam-.0018*butt+.00065*grain+.00026*vein];
 },.55);
 maps(result.wood,128,256,2.3,2.8,(u,v)=>{
  const N=18, y=F(v*N),line=clamp(1-Math.min(y,1-y)/.029);
  const grain=noise(u,v,9,99,54)+.34*noise(u,v,28,37,15),stain=noise(u,v,6,15,67);
  const c=168+24*grain+17*stain-15*line+8*(rnd(5,Math.floor(v*N),92)-.5);
  return [c+37,c+14,c-21,.00040*grain-.00152*line];
 },.36);
 maps(result.roof,192,192,3.47,3.5,(u,v)=>{
  const band=clamp(1-Math.min(F(u*3),1-F(u*3))/.010);
  const mott=noise(u,v,8,8,28),mica=noise(u,v,113,113,17),sheen=noise(u,v,29,35,29);
  const l=113.2+9.6*mott+5.7*mica+4.7*sheen-6*band;
  return [l-1.1,l+.4,l+1.5,.00063*band+.00042*mica];
 },.34);
 result.glass.onBeforeCompile=(s)=>{
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 paneSite;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\npaneSite=(modelMatrix*vec4(position,1.)).xyz;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 paneSite;')
    .replace('#include <opaque_fragment>',`
      vec3 lv=normalize(vViewPosition);
      vec3 pn=normalize(normal+vec3(.003*sin(paneSite.z*4.5+paneSite.y*2.85),.004*sin(paneSite.x*4.4+paneSite.y*3.1),0.));
      vec3 rr=inverseTransformDirection(reflect(-lv,pn),viewMatrix);
      float f=pow(1.-abs(dot(lv,pn)),3.);
      vec3 rv=mix(vec3(.077,.080,.071),vec3(.22,.32,.45),smoothstep(-.18,.45,rr.y));
      outgoingLight=outgoingLight*.64+rv*(.33+.67*f);
      diffuseColor.a=mix(.20,.57,f);
      #include <opaque_fragment>`);
 };
 return result;
}
