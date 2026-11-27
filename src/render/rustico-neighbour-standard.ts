import {BufferAttribute,BufferGeometry,DoubleSide,LessEqualDepth,Mesh,NormalBlending,Scene,ShaderMaterial} from 'three';
import {project} from '../sim/geo.ts';
import {RUSTICO_NEIGHBOUR as R} from './rustico-neighbour.generated.ts';
import {emitRusticoMassing,matchesRusticoMassing} from './rustico-neighbour.ts';
import {rusticoHarbourRoofAtlasAllows} from './rustico-harbour-roof.ts';

export const RUSTICO_NEIGHBOUR_DRAW={
 count:37950,from:18351,to:18417,replacement:183,
} as const;
type Tile=Parameters<typeof rusticoHarbourRoofAtlasAllows>[1]&{sha256?:string};
type Row={
 footprint:readonly (readonly [number,number])[];height:number;minHeight?:number;
 holes?:readonly (readonly (readonly [number,number])[])[];
};
export function standardRusticoNeighbourTile(atlas:string|undefined,tile:Tile){
 // Same transport owner as /377, independent of its palette or query.
 return rusticoHarbourRoofAtlasAllows(atlas,tile)&&tile.sha256===R.chunk;
}
export function standardRusticoNeighbourSource(atlas:string|undefined,tile:Tile,chunk:string|undefined,rows:readonly Row[]){
 if(!standardRusticoNeighbourTile(atlas,tile)||rows.length!==tile.count)return false;
 const q=rows[R.ordinal];
 return !!q&&q.holes===undefined&&q.footprint.every(p=>p.length===2)&&
  matchesRusticoMassing(atlas,chunk,tile.id,R.ordinal,q.footprint,q.height,q.minHeight,q.holes);
}

const ABI={
 position:3,uv:2,color:3,topFlag:1,facadeStyle:1,normal:3,
} as const;
type Abi=keyof typeof ABI;
type Point={x:number;z:number};
const names=Object.keys(ABI) as Abi[];
const {count,from,to,replacement}=RUSTICO_NEIGHBOUR_DRAW;
const originalRing=R.record.footprint.map(([lon,lat])=>project(lon,lat));
const stockShape=(g:BufferGeometry,n:number)=>g.index===null&&g.groups.length===0&&
 g.drawRange.start===0&&g.drawRange.count===Infinity&&Object.keys(g.attributes).length===names.length&&names.every(k=>{
  const a=g.getAttribute(k);
  return a instanceof BufferAttribute&&!a.normalized&&a.itemSize===ABI[k]&&a.count===n&&
   a.array.length===n*ABI[k]&&(k==='facadeStyle'?a.array instanceof Uint8Array:a.array instanceof Float32Array);
 });
function stockRaster(m:ShaderMaterial){
 return m.visible&&m.vertexColors&&m.side===DoubleSide&&m.depthTest&&m.depthWrite&&m.colorWrite&&
  m.depthFunc===LessEqualDepth&&m.blending===NormalBlending&&!m.transparent&&m.opacity===1&&
  !m.alphaTest&&!m.alphaHash&&!m.alphaToCoverage&&!m.polygonOffset&&!m.stencilWrite;
}
const sameBytes=(a:ArrayBufferView<ArrayBufferLike>,b:ArrayBufferView<ArrayBufferLike>)=>{
 const x=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),y=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);
 return x.length===y.length&&x.every((v,i)=>v===y[i]);
};
function stamp(g:BufferGeometry,n:number){
 const keys=names.map(k=>({k,attr:g.getAttribute(k) as BufferAttribute}));
 const snapshots=keys.map(({k,attr})=>({k,attr,array:attr.array,version:attr.version}));
 return ()=>stockShape(g,n)&&snapshots.every(s=>g.getAttribute(s.k)===s.attr&&s.attr.array===s.array&&s.attr.version===s.version);
}

/** This draw changes the measured cap and its necessary connecting wall
 * tops. Original lower feet, facade UV phase and stock tints are inherited.
 * No shader, material, atlas, contact or separate draw is replaced. */
function makeAlternate(owner:Mesh):BufferGeometry|undefined{
 const g=owner.geometry;
 if(!stockShape(g,count)||owner.position.y!==0)return;
 const p=g.getAttribute('position'),uv=g.getAttribute('uv'),flag=g.getAttribute('topFlag'),
  fc=g.getAttribute('facadeStyle'),cr=g.getAttribute('color'),roofStart=from+originalRing.length*6,
  ox=owner.position.x,oz=owner.position.z;
 if(!Number.isFinite(ox)||!Number.isFinite(oz)||roofStart>=to)return;
 const flat=(i:number)=>[cr.getX(i),cr.getY(i),cr.getZ(i)] as const;
 const wallTint=flat(from),roofTint=flat(roofStart);
 if(![...wallTint,...roofTint].every(Number.isFinite))return;
 for(let i=from;i<to;i++){
  if(fc.getX(i)!==0||flag.getX(i)!==Number(i>=roofStart)||
   !flat(i).every((x,j)=>x===(i<roofStart?wallTint:roofTint)[j]))return;
 }
 const edges=originalRing.map((a,i)=>{
  const b=originalRing[(i+1)%originalRing.length],d=from+i*6;
  const x=b.x-a.x,z=b.z-a.z,h=x*x+z*z,low=p.getY(d),high=p.getY(d+5),u=uv.getX(d+5);
  const at=(q:Point,j:number)=>p.getX(j)===Math.fround(q.x-ox)&&p.getZ(j)===Math.fround(q.z-oz);
  if(!at(a,d)||!at(b,d+5)||!at(a,d+1)||!at(b,d+2)||
   uv.getX(d)!==0||uv.getY(d)!==0||uv.getY(d+5)!==0||
   Math.fround(Math.sqrt(h))!==u||!Number.isFinite(low)||!Number.isFinite(high))return;
  return {a,x,z,h,low,high,u};
 });
 if(edges.some(e=>e===undefined))return;
 const E=edges.filter(e=>e!==undefined);
 const pos:number[]=[],xy:number[]=[],colour:number[]=[],top:number[]=[];
 const put=(q:Point,y:number,u:number,v:number,roof:boolean)=>{
  pos.push(q.x-ox,y,q.z-oz);xy.push(u,v);colour.push(...(roof?roofTint:wallTint));top.push(Number(roof));
 };
 let rejected=false;
 emitRusticoMassing(originalRing,{
  roof(a,b,c,y){
   [a,b,c].forEach((q,i)=>put(q,y[i],q.x-ox,q.z-oz,true));
  },
  wall(a,b,below,up){
   let ya:number,yb:number,ua:number,ub:number;
   if(below){[ya,yb]=below;ua=ub=0;}
   else{
    // The signed 2020 rim can add stations on an inherited wall edge.
    // Reuse that edge's original Float32 bottom line and continuous U,
    // rather than resampling terrain or restarting the legacy window grid.
    const locate=(q:Point,e:typeof E[number])=>{
     const t=((q.x-e.a.x)*e.x+(q.z-e.a.z)*e.z)/e.h;
     return t>=-.00001&&t<=1.00001&&
      Math.hypot(q.x-e.a.x-e.x*t,q.z-e.a.z-e.z*t)<=.00006?
      Math.max(0,Math.min(1,t)):undefined;
    };
    const matches=E.flatMap(e=>{
     const t=locate(a,e),s=locate(b,e);return t===undefined||s===undefined?[]:[{e,t,s}];
    });
    if(matches.length!==1){rejected=true;return;}
    const {e,t,s}=matches[0];
    ya=e.low+(e.high-e.low)*t;yb=e.low+(e.high-e.low)*s;ua=e.u*t;ub=e.u*s;
   }
   if(ya>up[0]||yb>up[1]){rejected=true;return;}
   // No unmeasured openings on the new roof steps: constant stock opaque
   // band coordinates there. The retained original perimeter is not repainted.
   const lowV=below?4:0,va=below?4:up[0]-ya,vb=below?4:up[1]-yb;
   put(a,ya,ua,lowV,false);put(b,up[1],ub,vb,false);put(a,up[0],ua,va,false);
   put(a,ya,ua,lowV,false);put(b,yb,ub,lowV,false);put(b,up[1],ub,vb,false);
  },
 });
 if(rejected||top.length!==replacement||![pos,xy,colour].every(a=>a.every(Number.isFinite)))return;
 const one=new BufferGeometry();
 one.setAttribute('position',new BufferAttribute(new Float32Array(pos),3));
 one.computeVertexNormals(); // Only author triangles; no recomputation of original siblings.
 const local={position:one.getAttribute('position').array,uv:new Float32Array(xy),color:new Float32Array(colour),
  topFlag:new Float32Array(top),facadeStyle:new Uint8Array(replacement),normal:one.getAttribute('normal').array};
 const alt=new BufferGeometry();
 for(const k of names){
  const old=g.getAttribute(k).array,s=ABI[k],q=local[k],N=count-to+from+replacement;
  if(q.length!==replacement*s){alt.dispose();return;}
  const a=k==='facadeStyle'?new Uint8Array(N*s):new Float32Array(N*s);
  a.set(old.subarray(0,from*s));a.set(q,from*s);a.set(old.subarray(to*s),(from+replacement)*s);
  if(!sameBytes(old.subarray(0,from*s),a.subarray(0,from*s))||
    !sameBytes(old.subarray(to*s),a.subarray((from+replacement)*s))){alt.dispose();return;}
  alt.setAttribute(k,new BufferAttribute(a,s));
 }
 alt.computeBoundingSphere();
 // An interior single-body substitution must not change tile-level culling.
 if(!g.boundingSphere||!alt.boundingSphere?.equals(g.boundingSphere)){alt.dispose();return;}
 return alt;
}

/** Offer the exact prepared owner before Begin only. Leaving, eviction,
 * invalidation and early Begin are not permission to rediscover it in-flight. */
export function prepareStandardRusticoNeighbour(owner:Mesh,scene:Scene,resident:()=>boolean){
 const stock=owner.geometry,material=owner.material;
 if(!(material instanceof ShaderMaterial)||!stockRaster(material)||owner.parent!==scene||!resident()||
  !owner.visible||owner.matrixAutoUpdate!==true||scene.overrideMaterial!==null)return;
 const alternate=makeAlternate(owner);if(!alternate)return;
 const stockStill=stamp(stock,count),altStill=stamp(alternate,count+replacement-(to-from));
 const origin=owner.position.clone(),rotation=owner.quaternion.clone(),scale=owner.scale.clone(),layers=owner.layers.mask,
  renderOrder=owner.renderOrder,frustum=owner.frustumCulled,vert=material.vertexShader,frag=material.fragmentShader,
  version=material.version,uniforms=material.uniforms,defines=material.defines,
  before=owner.onBeforeRender,after=owner.onAfterRender;
 let admitted=false,disposed=false;
 const intact=()=>!disposed&&resident()&&owner.parent===scene&&scene.overrideMaterial===null&&owner.visible&&
  owner.material===material&&stockRaster(material)&&material.version===version&&material.vertexShader===vert&&
  material.fragmentShader===frag&&material.uniforms===uniforms&&material.defines===defines&&
  owner.onBeforeRender===before&&owner.onAfterRender===after&&
  owner.matrixAutoUpdate===true&&owner.matrixWorldAutoUpdate===true&&owner.layers.mask===layers&&owner.renderOrder===renderOrder&&owner.frustumCulled===frustum&&
  owner.position.equals(origin)&&owner.quaternion.equals(rotation)&&owner.scale.equals(scale)&&stockStill()&&altStill();
 const restore=()=>{
  admitted=false;
  if(owner.geometry===alternate)owner.geometry=stock;
 };
 return {
  get ready(){return owner.geometry===stock&&intact();},
  get active(){return admitted&&owner.geometry===alternate&&intact();},
  begin(eligible:boolean){
   restore();
   if(!eligible||owner.geometry!==stock||!intact())return false;
   owner.geometry=alternate;admitted=true;return true;
  },
  sync(retain:boolean,ground?:()=>boolean){
   if(admitted&&(!retain||owner.geometry!==alternate||!intact()||(ground&&!ground())))restore();
  },
  dispose(){
   if(disposed)return;
   restore();disposed=true;alternate.dispose(); // Every alternate attribute is independently owned.
  },
 };
}
