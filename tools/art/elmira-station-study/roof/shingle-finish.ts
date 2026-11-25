// Finish-only interpretation. Synthesised painted colour/roughness/normals, no photos,
// vertex displacement or measured shingle-size claims. Shared maps across all facets.
import * as T from 'three';
import type { RoofInputs,BaseKey,HoodKey } from './roof.ts';
const mod=(a:number,b:number)=>((a%b)+b)%b;
const hash=(a:number,b:number)=>{let n=Math.imul(a+271,0x45d9f3b)^Math.imul(b+89,0x27d4eb2d);n=Math.imul(n^(n>>>16),0x45d9f3b);return((n^(n>>>16))>>>0)/4294967296;};
function noise(x:number,y:number,s:number){
 const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 return(1-sy)*((1-sx)*hash(i+s,j)+sx*hash(i+s+1,j))+sy*((1-sx)*hash(i+s,j+1)+sx*hash(i+s+1,j+1));
}
function shingleTile(){
 const W=512,H=512,n=11;
 const rows=Array.from({length:n},(_,r)=>{
  const count=8+(r%3),width=Array.from({length:count},(_,i)=>.72+.57*hash(i*127+r*17,8)),sum=width.reduce((a,b)=>a+b),cuts=[0];
  for(const w of width)cuts.push(cuts.at(-1)!+w/sum);
  return{cuts,offset:hash(r,16)};
 });
 function board(row:number,u:number){
  const ir=mod(row,n),r=rows[ir],x=mod(u+r.offset,1);let i=0;
  while(i+1<r.cuts.length-1&&x>=r.cuts[i+1])i++;
  const f=(x-r.cuts[i])/(r.cuts[i+1]-r.cuts[i]),seed=ir*83+i*197;
  const toe=.088*(hash(seed,114)-.5)+.024*(f-.5)*(hash(seed,53)-.5);
  const inc=hash(seed,177)>.86?-.025*Math.max(0,1-13*Math.abs(f-(.27+.49*hash(seed,1)))):0;
  return{row:ir,seed,f,toe:toe+inc,wide:r.cuts[i+1]-r.cuts[i]};
 }
 const ink=new Uint8Array(W*H*4),norm=new Uint8Array(W*H*4),rgh=new Uint8Array(W*H*4),elev=new Float32Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,u=(x+.5)/W,q=(y+.5)*n/H,base=Math.floor(q),a=board(base,u),b=board(base+1,u);
  const row=q>=base+1+b.toe?base+1:q<base+a.toe?base-1:base,item=row===base?a:row===base+1?b:board(row,u);
  const depth=q-row-item.toe,along=item.f,seed=item.seed;
  const joint=Math.min(along,1-along),sun=1-Math.exp(-Math.max(0,joint)*95),rough=hash(seed,59);
  const f=along*(10+10*item.wide),g=.18*Math.sin(6.1*depth+hash(seed,12)*6.28),thread=noise(f*5.9+g,depth*.89,seed*3+67);
  const wash=noise(f*.31+g*.4,depth*.52,seed+88);
  const fibr=.5+.5*Math.cos(6.283*(f*2.3+noise(f+g,depth*.89,seed+22)*1.36)),speck=hash(x,y);
  const endSh=1-.145*Math.exp(-Math.max(0,1-depth)*21),grey=136+12*(rough-.5)+8*(wash-.5)+6*(thread-.5)+4*(fibr-.5)+3*(speck-.5);
  const warm=3.8*(hash(seed,46)-.45),c=grey*(.77+.23*sun)*endSh;
  ink.set([c+1.5+warm,c+2.5,c+3.1-warm,255],4*i);
  // Units here are a smooth emboss field, not surveyed heights. A disappearing lap and
  // minute fibre relief carry most of the articulation after distant mipmapping.
  elev[i]=(1-depth)*.134+thread*.008+fibr*.004+sun*.020+wash*.009;
  const rr=Math.max(0,Math.min(255,193+39*rough+11*thread));rgh.set([rr,rr,rr,255],4*i);
 }
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const ix=4*(y*W+x),dx=-(elev[y*W+(x+1)%W]-elev[y*W+mod(x-1,W)])*3.1,dy=-(elev[((y+1)%H)*W+x]-elev[mod(y-1,H)*W+x])*3.1,len=Math.hypot(dx,dy,1);
  norm.set([(dx/len*.5+.5)*255,(dy/len*.5+.5)*255,(1/len*.5+.5)*255,255],ix);
 }
 function tex(b:Uint8Array,color=false){const t=new T.DataTexture(b,W,H);t.wrapS=t.wrapT=T.RepeatWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=6;if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t}
 return{map:tex(ink,true),normalMap:tex(norm),roughnessMap:tex(rgh)};
}
export function applyElmiraShingleFinish(g:T.Group,p:RoofInputs){
 const maps=shingleTile();
 for(const obj of g.children){
  const m=obj as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>,[part,role]=m.name.split('/'),cf=part==='main'?p.main[role as BaseKey]:p.hood[role as HoodKey];
  const L=Math.hypot(cf[1],cf[2]);let a=cf[1]/L,b=cf[2]/L;
  if(!Number.isFinite(a+b)){a=0;b=1}
  const uv=m.geometry.getAttribute('uv'),next=new Float32Array(uv.count*2);
  for(let i=0;i<uv.count;i++){
   const u=uv.getX(i),v=uv.getY(i);
   next[i*2]=(u*b-v*a)/1.58+hash(role.length,31);
   next[i*2+1]=(u*a+v*b)*Math.sqrt(1+L*L)/1.42+hash(role.length,67);
  }
  // New shading UVs only: no change to position, index, facet seams, or material visibility.
  m.geometry.setAttribute('uv',new T.Float32BufferAttribute(next,2));m.material.dispose();
  m.material=new T.MeshStandardMaterial({color:0xc6cbc8,...maps,roughness:.95,metalness:0,normalScale:new T.Vector2(.78,.78)});
 }
}
