import * as T from 'three';
export const roles=['stucco','timber','trim','stone','roof','flashing','brick','glass','back','soffit'] as const;
export type Role=typeof roles[number];
type RGB=readonly [number,number,number];
type TileSource={size:number,scale:readonly [number,number],samples:Uint8Array};
type Recipe={colour:RGB,mortar?:RGB,repeat?:readonly[number,number],rows?:number,cols?:number,roughness:number,metalness:number};
export const recipes:Record<Role,Recipe>={
 stucco:{colour:[202,194,171],repeat:[2.34,1.57],roughness:.93,metalness:0},
 timber:{colour:[74,53,43],repeat:[2.3,.40],roughness:.83,metalness:0},
 trim:{colour:[96,69,53],roughness:.76,metalness:0},
 stone:{colour:[137,126,110],roughness:.90,metalness:0},
 roof:{colour:[91,88,82],mortar:[75,73,66],repeat:[1.58,1.23],rows:7,cols:6,roughness:.84,metalness:.02},
 flashing:{colour:[66,64,59],roughness:.74,metalness:.15},
 brick:{colour:[130,77,62],mortar:[129,104,86],repeat:[1.89,1.19],rows:17,cols:8,roughness:.82,metalness:0},
 glass:{colour:[77,97,106],roughness:.24,metalness:.09},
 back:{colour:[54,53,49],roughness:.95,metalness:0},
 soffit:{colour:[124,110,90],roughness:.88,metalness:0},
};
const frac=(a:number)=>a-Math.floor(a);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const sat=(v:number)=>Math.min(1,Math.max(0,v));
const ramp=(a:number,b:number,v:number)=>{const t=sat((v-a)/(b-a));return t*t*(3-2*t)};
function hash(i:number,j:number,seed:number){
  let n=Math.imul(i,198491317)^Math.imul(j,6542989)^Math.imul(seed,7483);
  n=Math.imul(n^(n>>>13),1274126177);
  return (n>>>0)/4294967296;
}
const wrap=(x:number,n:number)=>(x%n+n)%n;
function periodicNoise(u:number,v:number,m:number,n:number,seed:number){
 const x=u*m,y=v*n,I=Math.floor(x),J=Math.floor(y),fx=ramp(0,1,frac(x)),fy=ramp(0,1,frac(y));
 const h=(i:number,j:number)=>hash(wrap(i,m),wrap(j,n),seed);
 return mix(mix(h(I,J),h(I+1,J),fx),mix(h(I,J+1),h(I+1,J+1),fx),fy);
}
const memory=new Map<Role,TileSource>();
export function makeTile(role:Role):TileSource|undefined{
 const have=memory.get(role);if(have)return have;
 const data=recipes[role];if(!data.repeat)return;
 const size=256,depth=4,samples=new Uint8Array(size*size*depth),id=roles.indexOf(role)+21;
 const [width,height]=data.repeat;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const u=(i+.5)/size,v=(j+.5)/size;
  const a=periodicNoise(u,v,5,4,id),b=periodicNoise(u,v,21,19,id+29),f=hash(i,j,id+91);
  let scale=.92+.13*a+.085*b+.075*(f-.5);
  let blend=0,chroma=0,seamShadow=0;
  if(data.rows&&data.cols){
   const rr=Math.floor(v*data.rows),slate=role==='roof',mem=false,shake=false;
   // Observed architectural bond rhythm, but with original per-brick albedo.
   const header=role==='brick'&&rr%5===4;
   const cols=data.cols*(header?2:1);
   const x=u*cols+(rr%2)*.5+(shake?(hash(rr,0,id+141)-.5)*.56:0);
   const w=frac(x),z=frac(v*data.rows),ix=wrap(Math.floor(x),cols);
   const jitter=(hash(ix,rr,id+114)-.5)*.035;
   const hEdge=Math.min(w,1-w)*width/cols;
   const vEdge=Math.min(z,1-z)*height/data.rows;
   const edge=slate?Math.min(hEdge*.62,z*height/data.rows+ .001):shake?Math.min(hEdge*1.52,z*height/data.rows+.0007):Math.min(hEdge,vEdge+jitter*.008);
   const line=slate?.011:mem?.012:shake?.0042:role==='stone'?.013:.0068;
   const a0=hash(ix,rr,id);
   scale*=.875+.24*a0;
   chroma=(hash(ix,rr,id+46)-.5)*(role==='brick'?10:5);
   blend=(1-ramp(line*.28,line*1.05,edge))*(mem?.51:slate?.80:.92);
   seamShadow=(1-ramp(line*.55,line*1.7,edge))*.095;
   if(slate){scale=.988+.285*(scale-.988)+.018*(z-.5);blend*=.54;seamShadow*=.53;chroma*=.42;}
   if(shake){blend*=.49;seamShadow*=.68;chroma*=.16;scale*=.983+.016*z;}
  }
  if(role==='stucco')scale=.961+.044*a+.028*b+.035*(f-.5);
 if(role==='timber')scale=.89+.16*periodicNoise(u,v,5,47,id+2)+.021*(f-.5);


  const t=(j*size+i)*4;
  for(let k=0;k<3;k++){
   const c=data.colour[k]*scale+chroma*(k===0?.8:k===1?.25:-.28);
   samples[t+k]=Math.round(Math.min(255,Math.max(0,mix(c*(1-seamShadow), (data.mortar??data.colour)[k]*(.86+.18*a),blend))));
  }
  samples[t+3]=255;
 }
 const out={size,scale:[1/width,1/height] as const,samples};memory.set(role,out);return out;
}
export function material(role:Role,tex=true):T.MeshStandardMaterial{
 const r=recipes[role];const tile=tex?makeTile(role):undefined;
 const color=tile?0xffffff:new T.Color().setRGB(...r.colour.map(c=>c/255) as [number,number,number],T.SRGBColorSpace);
 const m=new T.MeshStandardMaterial({color,vertexColors:true,roughness:r.roughness,metalness:r.metalness});
 m.name=role;
 if(tile){
  const map=new T.DataTexture(tile.samples,tile.size,tile.size,T.RGBAFormat);
  map.name='authored-summerside-rail-'+role;map.colorSpace=T.SRGBColorSpace;
  map.wrapS=T.RepeatWrapping;map.wrapT=T.RepeatWrapping;
  map.repeat.set(...tile.scale);map.anisotropy=4;
  map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;
  map.needsUpdate=true;m.map=map;
 }
 if(role==='glass'){
  m.emissive.setRGB(.021,.037,.044);m.emissiveIntensity=.65;
  m.customProgramCacheKey=()=> 'summerside-rail-study-inset-glazing-v1';
  m.onBeforeCompile=s=>{
   s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    vec3 I=reflect(-normalize(vViewPosition),normal);
    vec3 W=inverseTransformDirection(I,viewMatrix);
    float c = .11+.89*pow(1.-max(dot(normal,normalize(vViewPosition)),0.),5.);
    vec3 viewLight=mix(vec3(.05,.054,.045),vec3(.19,.27,.33),smoothstep(-.12,.78,W.y));
    totalEmissiveRadiance+=c*.44*viewLight;`);
  };
 }
 return m;
}
