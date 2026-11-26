import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,type Material} from 'three';

/** Original historical display coupon only. X is photo-left/right, Y display
 * floor, Z outward. Not a q113 owner transform. No logos/signs, measured
 * dimensions or complete aperture count. The left extent is a study cut. */
export const DOIRON_ENTRY_STUDY=Object.freeze({
 scope:'Doiron Fisheries · detached historical storefront segment',
 depiction:'Documented window / glazed leaf / window sequence, not a centered door across the full building.',
 dimensionsM:[8.18,5.45,1.069],nominalFront:0,canopyProjectionM:.817,
 unsupported:['precise station on the north face','upper openings','full hood length','neighbor stair and landing','modern extent or finish','terrain and water'],
} as const);
type Role='lap'|'shingle'|'trim'|'sill'|'door'|'glass'|'canopy'|'soffit'|'back';
type Pt=readonly [number,number,number];
type UV=readonly [number,number];
type Field={P:number[];T:number[]};
type Recipe=Map<Role,Field>;
type Opening={role:'window'|'door';x0:number;x1:number;y0:number;y1:number};
const B=4.09,H=5.45,S=3.70;
const opening:readonly Opening[]=[
 {role:'window',x0:-2.74,x1:-1.11,y0:.91,y1:2.00},
 {role:'door',x0:-.46,x1:.53,y0:.045,y1:2.13},
 {role:'window',x0:1.21,x1:2.89,y0:.94,y1:2.03},
];
export function doironEntryOpeningCue(){return opening.map(q=>({...q}));}
const shell=-.252, RECESS=-.135, casingThickness=.038;
const pts=(x:number,y:number,z:number):Pt=>[x,y,z];
const U=(p:Pt):UV=>[p[0],p[1]];
const A=(a:Pt,b:Pt)=>[b[0]-a[0],b[1]-a[1],b[2]-a[2]] as Pt;
const C=(a:Pt,b:Pt):Pt=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const D=(a:Pt,b:Pt)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const M=(a:Pt,k:number):Pt=>[a[0]*k,a[1]*k,a[2]*k];
const X=(a:Pt,b:Pt):Pt=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=(a:Pt)=>M(a,1/Math.hypot(...a));
const projected=(a:Pt,b:Pt,c:Pt)=>{
 const v=norm(A(a,b)),r=A(a,c),w=norm(X(r,M(v,D(v,r))));
 return (p:Pt):UV=>{
  const d=A(a,p);return [D(v,d),D(w,d)];
 };
};
function poly(g:Recipe,k:Role,p:readonly Pt[],aim:Pt,uv=U){
 const block=g.get(k)??{P:[],T:[]};g.set(k,block);
 for(let i=1;i+1<p.length;i++){
  const a=p[0],b=p[i],c=p[i+1],n=C(A(a,b),A(a,c));
  if(Math.hypot(...n)<1e-9)continue;
  const ordered=D(n,aim)<0?[a,c,b]:[a,b,c];
  for(const q of ordered){block.P.push(...q);block.T.push(...uv(q));}
 }
}
const OUT:Pt=[0,0,1], IN:Pt=[0,0,-1];
const YUP:Pt=[0,1,0], YDN:Pt=[0,-1,0];
function rect(g:Recipe,k:Role,x0:number,y0:number,x1:number,y1:number,z:number,a=OUT){
 const p=[pts(x0,y0,z),pts(x1,y0,z),pts(x1,y1,z),pts(x0,y1,z)];poly(g,k,p,a);
}
function plinth(g:Recipe){
 for(const x of [-B,B]){
  const p=[pts(x,0,0),pts(x,0,shell),pts(x,H,shell),pts(x,H,0)];
  poly(g,'back',p,[Math.sign(x),0,0],projected(p[0],p[1],p[2]));
 }
 for(const y of [0,H]){
  const p=[pts(-B,y,shell),pts(B,y,shell),pts(B,y,0),pts(-B,y,0)];
  poly(g,'back',p,[0,y===0?-1:1,0],projected(p[0],p[1],p[2]));
 }
 rect(g,'back',-B,0,B,H,shell,IN);
}
const expanded=(q:Opening)=>({...q,x0:q.x0-.065,x1:q.x1+.065,y0:Math.max(.008,q.y0-.061),y1:q.y1+.061});
const sc=(g:Recipe,q:Opening)=>{
 const o=expanded(q),i=.037,z=casingThickness;
 rect(g,'trim',o.x0,o.y0,q.x0,o.y1,z);rect(g,'trim',q.x1,o.y0,o.x1,o.y1,z);
 rect(g,'trim',q.x0,o.y0,q.x1,q.y0,z);rect(g,'trim',q.x0,q.y1,q.x1,o.y1,z);
 const bok=[pts(o.x0,o.y0,0),pts(o.x1,o.y0,0),pts(o.x1,o.y1,0),pts(o.x0,o.y1,0)];
 const slot=[pts(q.x0,q.y0,z),pts(q.x1,q.y0,z),pts(q.x1,q.y1,z),pts(q.x0,q.y1,z)];
 for(let j=0;j<4;j++){
  const k=(j+1)%4;
  const a=bok[j],b=bok[k],A0=pts(a[0],a[1],z),B0=pts(b[0],b[1],z);
  const p=[a,b,B0,A0];
  const aim:Pt=j===0?YDN:j===2?YUP:j===1?[1,0,0]:[-1,0,0];
  poly(g,'trim',p,aim,projected(p[0],p[1],p[2]));
  const h=slot[j],l=slot[k],p2=[h,l,pts(l[0],l[1],RECESS),pts(h[0],h[1],RECESS)];
  // Bound actual reveal faces, oriented toward the depression.
  poly(g,'sill',p2,M(aim,-1),projected(p2[0],p2[1],p2[2]));
 }
 const x0=q.x0,x1=q.x1,y0=q.y0,y1=q.y1;
 if(q.role==='door'){
  const h=y0+(y1-y0)*.53;
  rect(g,'door',x0,y0,x1,h,RECESS);rect(g,'glass',x0,h,x1,y1,RECESS);
  const d=RECESS+.017;
  rect(g,'door',x0,h-.038,x1,h+.028,d);
  rect(g,'door',x0,h,x0+.075,y1,d);rect(g,'door',x1-.075,h,x1,y1,d);
  rect(g,'door',x0+.075,y1-.080,x1-.075,y1,d);
 }else{
  rect(g,'glass',x0,y0,x1,y1,RECESS);
  const d=RECESS+.039,c=(x0+x1)*.5;
  rect(g,'trim',c-i*.5,y0,c+i*.5,y1,d);
  rect(g,'trim',x0,y0,x1,y0+.049,d+.005);
  // Small physical white sill cut; no glazing stickers or modern mould claims.
  const sh=[pts(x0-.04,y0-.04,.065),pts(x1+.04,y0-.04,.065),
   pts(x1+.04,y0+.005,RECESS+.015),pts(x0-.04,y0+.005,RECESS+.015)];
  poly(g,'trim',sh,YUP,projected(sh[0],sh[1],sh[2]));
 }
};
function facade(g:Recipe,neutralCut:boolean){
 const cut=opening.map(expanded);
 const unique=(v:number[])=>[...new Set(v)].sort((a,b)=>a-b);
 const xs=unique([-B,-B+.118,-S,S,B-.118,B,...cut.flatMap(h=>[h.x0,h.x1])]);
 for(let i=1;i<xs.length;i++){
  const a=xs[i-1],b=xs[i],m=(a+b)*.5;
  const blocked=cut.filter(q=>m>q.x0&&m<q.x1);
  const ys=unique([0,.115,2.71,H-.115,H,...blocked.flatMap(q=>[q.y0,q.y1])]);
  for(let j=1;j<ys.length;j++){
   const c=ys[j-1],d=ys[j],y=(c+d)*.5;
   if(blocked.some(q=>y>q.y0&&y<q.y1))continue;
   const kind=Math.abs(m)>B-.118||y>H-.115?(neutralCut?'back':'trim'): y<.115?'sill':Math.abs(m)<S&&y<2.71?'shingle':'lap';
   rect(g,kind,a,c,b,d,0);
  }
 }
 for(const q of opening)sc(g,q);
}
const lipY=2.459;
function shallowCanopy(g:Recipe){
 // One hip is observed. Far left is a bounded segment cut, not a survey.
 const n=pts(-3.80,2.994,-.028),e=pts(3.938,2.994,-.028),
  a=pts(-3.80,2.542,.817),b=pts(3.506,2.542,.817),c=pts(3.990,2.542,-.028);
 poly(g,'canopy',[n,a,b,e],YUP,projected(n,e,a));
 poly(g,'canopy',[e,b,c],YUP,projected(e,b,c));
 // Lower plan is closed, with stable dark underside and thin opaque front fascia.
 const ring=[n,a,b,c,e],floor=ring.map(v=>pts(v[0],lipY,v[2]));
 poly(g,'soffit',floor,YDN,projected(floor[0],floor[1],floor[2]));
 for(let i=0;i<ring.length;i++){
  const j=(i+1)%ring.length,p=ring[i],q=ring[j],d=A(p,q);
  const panel=[floor[i],floor[j],q,p];
  poly(g,(i===1||i===2)?'trim':'soffit',panel,[-d[2],0,d[0]],projected(panel[0],panel[1],panel[2]));
 }
}
const Palette:Readonly<Record<Role,[number,number]>>={
 lap:[0x87949e,.86],shingle:[0x756f67,.93],trim:[0xd7d7cd,.81],sill:[0x777a76,.83],
 door:[0x384a50,.78],glass:[0x383b41,.21],canopy:[0x55524f,.94],soffit:[0x686663,.91],back:[0x8d9394,.92],
};
const hash=`
varying vec2 vDoironEntryUV;
float doironEntryHash(vec2 a){
 a=fract(a*vec2(.1037,.1131));a+=dot(a,a.yx+19.31);return fract((a.x+a.y)*a.x);
}
float doironEntryNoise(vec2 f){
 vec2 i=floor(f),q=fract(f);q*=q*(3.-2.*q);
 return mix(mix(doironEntryHash(i),doironEntryHash(i+vec2(1,0)),q.x),
            mix(doironEntryHash(i+vec2(0,1)),doironEntryHash(i+vec2(1,1)),q.x),q.y);
}
float doironEntryLap(float p,float w){
 float j=max(fwidth(p),.002);
 return (1.-smoothstep(max(0.,w-.35*j),w+.55*j,abs(fract(p+.5)-.5)))*(1.-smoothstep(.19,.74,j));
}
`;
const recipe:Partial<Record<Role,string>>={
 lap:`
  float wide=doironEntryNoise(p*vec2(.76,1.16));
  float vertical=doironEntryNoise(p*vec2(2.20,.49));
  float groove=doironEntryLap(p.y/.177,.067);
  c*=.97+.079*wide+.064*(vertical-.5)-.155*groove;
 `,
 shingle:`
  float r=floor(p.y/.142);
  vec2 q=p/vec2(.179,.142);q.x+=.49*mod(r,2.)+.085*sin(r*2.11);
  float clear=1.-smoothstep(.16,.66,max(fwidth(q.x),fwidth(q.y)));
  float streak=doironEntryNoise(p*vec2(4.2,.49))*.61+doironEntryNoise(p*vec2(11.1,.68))*.39;
  float cell=doironEntryHash(floor(q));
  c*=.91+.197*streak+.13*(cell-.5)*clear-.142*doironEntryLap(q.y,.058)-.081*doironEntryLap(q.x,.037);
 `,
 canopy:`
  vec2 q=p/vec2(.275,.151);q.x+=.5*mod(floor(q.y),2.);
  float clear=1.-smoothstep(.16,.73,max(fwidth(q.x),fwidth(q.y)));
  c*=1.+.13*(doironEntryHash(floor(q))-.5)*clear+.087*(doironEntryNoise(p*vec2(.9,1.9))-.5)-
    .141*doironEntryLap(q.y,.060)-.065*doironEntryLap(q.x,.032);
 `,
};
const once=(s:string,k:string)=>s.indexOf(k)>=0&&s.indexOf(k)===s.lastIndexOf(k);
export function patchDoironEntryFinish(vertex:string,fragment:string,role:Role){
 const c='#include <common>',u='#include <uv_vertex>',t='#include <color_fragment>',r=recipe[role];
 if(!r||!once(vertex,c)||!once(vertex,u)||!once(fragment,c)||!once(fragment,t)||vertex.includes('vDoironEntryUV')||fragment.includes('vDoironEntryUV'))return;
 return {vertex:vertex.replace(c,c+'\nvarying vec2 vDoironEntryUV;').replace(u,u+'\nvDoironEntryUV=uv;'),
  fragment:fragment.replace(c,c+'\n'+hash).replace(t,t+'\n{vec2 p=vDoironEntryUV;vec3 c=diffuseColor.rgb;'+r+'diffuseColor.rgb=max(vec3(0.),c);}')};
}
function material(role:Role,refine=true,ashShingles=false){
 const [baseColor,roughness]=Palette[role];
 const color=ashShingles&&role==='shingle'?0x747570:baseColor;
 const m=new MeshStandardMaterial({name:'Doiron entry / '+role,color,roughness,metalness:0,transparent:false});
 if(refine&&recipe[role]){
  m.onBeforeCompile=q=>{
   const next=patchDoironEntryFinish(q.vertexShader,q.fragmentShader,role);
   if(next){q.vertexShader=next.vertex;q.fragmentShader=next.fragment;}
  };
  m.customProgramCacheKey=()=> 'pei-doiron-detached-2014-entry/'+role;
 }
 return m;
}
export function makeDoironEntryStudy(options:{hood?:boolean;finish?:boolean;neutralCut?:boolean;ashShingles?:boolean;materialFor?:(role:Role)=>Material|undefined}={}){
 const shell=new Map<Role,Field>();plinth(shell);facade(shell,options.neutralCut===true);
 if(options.hood!==false)shallowCanopy(shell);
 const g=new Group();g.name=DOIRON_ENTRY_STUDY.scope;g.userData={...DOIRON_ENTRY_STUDY,mountAuthority:false,depth:'detached display only',displayCut:options.neutralCut===true?'neutral display edge':'legacy comparison edge'};
 for(const [role,q]of shell){
  const a=new BufferGeometry();
  a.setAttribute('position',new Float32BufferAttribute(q.P,3));a.setAttribute('uv',new Float32BufferAttribute(q.T,2));a.computeVertexNormals();
  a.computeBoundingSphere();
  const m=new Mesh(a,options.materialFor?.(role)??material(role,options.finish,options.ashShingles));m.name='frontage / '+role;m.userData.role=role;
  g.add(m);
 }
 return g;
}
