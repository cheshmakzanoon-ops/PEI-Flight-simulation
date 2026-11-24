import * as T from 'three';
export const roles=['shingle','ornamental','trim','fascia','roof','metal','stone','wood','shadow','glass','roseGlass','tealGlass','blueGlass'] as const;
export type Role=typeof roles[number];
type RGB=readonly [number,number,number];
type Recipe={colour:RGB,repeat?:readonly[number,number],rows?:number,cols?:number,roughness:number,metalness:number};
type Tile={size:number,scale:readonly [number,number],samples:Uint8Array};
/** All source texels are newly constructed from these original paint recipes. */
export const recipes:Record<Role,Recipe>={
 shingle:{colour:[205,195,174],repeat:[2.34,1.52],rows:10,cols:10,roughness:.79,metalness:0},
 ornamental:{colour:[201,191,170],repeat:[1.35,.94],rows:7,cols:8,roughness:.81,metalness:0},
 trim:{colour:[217,206,181],roughness:.68,metalness:0},
 fascia:{colour:[111,108,89],roughness:.80,metalness:0},
 roof:{colour:[66,75,60],repeat:[2.1,1.82],rows:11,cols:9,roughness:.87,metalness:0},
 metal:{colour:[81,85,76],roughness:.68,metalness:.12},
 stone:{colour:[139,133,115],repeat:[1.38,.67],rows:4,cols:4,roughness:.93,metalness:0},
 wood:{colour:[165,159,138],repeat:[1,1.8],rows:0,cols:6,roughness:.79,metalness:0},
 shadow:{colour:[70,68,58],roughness:.87,metalness:0},
 glass:{colour:[52,67,71],roughness:.26,metalness:.05},
 roseGlass:{colour:[93,62,59],roughness:.31,metalness:.03},
 tealGlass:{colour:[61,84,72],roughness:.29,metalness:.03},
 blueGlass:{colour:[66,78,99],roughness:.28,metalness:.03},
};
const f=(x:number)=>x-Math.floor(x),mod=(x:number,n:number)=>(x%n+n)%n;
const cl=(x:number)=>Math.max(0,Math.min(1,x));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(a:number,b:number,x:number)=>{const k=cl((x-a)/(b-a));return k*k*(3-2*k)};
function h(i:number,j:number,s:number){let a=Math.imul(i+11,198491317)^Math.imul(j+13,6542989)^Math.imul(s,7483);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967296}
function grain(u:number,v:number,gx:number,gy:number,s:number){
 const x=u*gx,y=v*gy,I=Math.floor(x),J=Math.floor(y),a=ease(0,1,f(x)),b=ease(0,1,f(y)),q=(i:number,j:number)=>h(mod(i,gx),mod(j,gy),s);
 return mix(mix(q(I,J),q(I+1,J),a),mix(q(I,J+1),q(I+1,J+1),a),b);
}
const cache=new Map<Role,Tile>();
export function makeTile(role:Role):Tile|undefined{
 const out=cache.get(role);if(out)return out;
 const t=recipes[role];if(!t.repeat)return;
 const [nx,ny]=t.repeat,N=256,A=new Uint8Array(N*N*4),p=roles.indexOf(role)+337;
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const u=(i+.5)/N,v=(j+.5)/N,H=grain(u,v,5,4,p),F=grain(u,v,23,17,p+8),G=grain(u,v,61,6,p+33),s=h(i,j,p+39);
  let b=1+.031*(H-.5)+.019*(F-.5)+.016*(G-.5)+.010*(s-.5),dh=0;
  if(t.rows&&t.cols){
   const r0=Math.floor(v*t.rows),X=u*t.cols+.5*(r0%2),e=mod(Math.floor(X),t.cols),a=f(X),c=f(v*t.rows);
   const w=nx/t.cols,L=ny/t.rows,tail=role==='ornamental'?(.029*(1-Math.sqrt(Math.max(0,1-(2*a-1)**2)))):0;
   const join=Math.min(a,1-a)*w+(.002*(.5-h(e,r0,p+72))),bottom=c*L-tail;
   const sideShadow=(1-ease(.001,.009,Math.abs(join)))*(role==='shingle'?.038:.073);
   const bedShadow=(1-ease(.001,.010,Math.abs(bottom)))*(role==='roof'?.105:.099);
   const ochre=(h(e,r0,p+21)-.5);
   b*=1-(sideShadow+bedShadow)+(role==='shingle'?.038:.053)*ochre+.021*ease(.009,.023,bottom);
   if(role==='roof')b*=.96+.14*H+.064*ochre;
   if(role==='stone')b*=1-.19*(1-ease(.004,.016,Math.min(Math.abs(join),Math.abs(bottom))))+.046*(F-.5);
   else dh=ochre*(role==='roof'?2.5:4);
  }
  if(role==='wood')b-=.02*(1-ease(.001,.016,Math.abs(f(u*6)*.166-.005)));
  const at=(j*N+i)*4;
  for(let k=0;k<3;k++)A[at+k]=Math.round(Math.min(255,Math.max(0,t.colour[k]*b+dh*[.6,.14,-.26][k])));
  A[at+3]=255;
 }
 const pre={size:N,scale:[1/nx,1/ny] as const,samples:A};cache.set(role,pre);return pre;
}
export function material(role:Role,withData=true):T.MeshStandardMaterial{
 const a=recipes[role],g=withData?makeTile(role):undefined;
 const c=new T.Color().setRGB(...a.colour.map(n=>n/255) as [number,number,number],T.SRGBColorSpace);
 const m=new T.MeshStandardMaterial({color:g?0xffffff:c,vertexColors:true,roughness:a.roughness,metalness:a.metalness});m.name=role;
 if(g){const map=new T.DataTexture(g.samples,g.size,g.size,T.RGBAFormat);map.name='original-st-davids-'+role;map.colorSpace=T.SRGBColorSpace;
  map.wrapS=T.RepeatWrapping;map.wrapT=T.RepeatWrapping;map.repeat.set(...g.scale);map.anisotropy=4;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;m.map=map;}
 if(role==='glass'||role.endsWith('Glass')){
  // Dark opaque-backed glazing gains directional reflected sky (no hidden interior/donor image).
  m.emissive.setRGB(.006,.009,.010);m.emissiveIntensity=.48;
  m.customProgramCacheKey=()=> 'st-davids-original-reflected-sky';
  m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    vec3 R=inverseTransformDirection(reflect(-normalize(vViewPosition),normal),viewMatrix);
    float V=.1+.90*pow(1.-max(dot(normal,normalize(vViewPosition)),0.),4.9);
    vec3 sky=mix(vec3(.017,.021,.016),vec3(.15,.21,.27),smoothstep(-.08,.78,R.y));
    totalEmissiveRadiance+=.38*V*sky;`)};
 }
 return m;
}
