/** Cape Egmont detached outer shape from training-only 2020 brackets and
 * post-relocation reference photographs. No installed scene or true azimuth. */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const exteriorTraining=Object.freeze({gradeDatum:8.82,gallery:18.687,mainRoof:21.6618,
 baseApothem:3.4486,taper:.1593,sameSurveyOnly:true,heldChecks:false});
const s=exteriorTraining, deck=s.gallery-s.gradeDatum, cap=s.mainRoof-s.gradeDatum;
const buff=new T.Vector3();
type Role='white'|'red'|'iron'|'louver'|'door'|'deck'|'glass'|'lining';
const face=(i:number,q:number,y:number,size:number)=>new T.Vector3(size,y,q).applyAxisAngle(new T.Vector3(0,1,0),i*Math.PI/2);
const ap=(h:number)=>s.baseApothem-Math.max(h,0)*s.taper;
const frac=(x:number)=>x-Math.floor(x);
function shingles(){
 const w=384,data=new Uint8Array(w*w*4),elevation=new Uint8Array(w*w*4);
 const hash=(x:number,y:number)=>{
  let u=Math.imul((x+32)^12345,0x27d4eb2d)^Math.imul((y+32)^179,0x165667b1);
  u=Math.imul(u^(u>>>15),0x85ebca6b);return (u>>>0)/4294967296;
 };
 const sm=(x:number)=>x*x*(3-2*x),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
 function field(u:number,v:number,n:number){
  const x=u*n,y=v*n,i=Math.floor(x),j=Math.floor(y),a=sm(frac(x)),b=sm(frac(y)),wrap=(x:number)=>(x+n)%n;
  return mix(mix(hash(wrap(i),wrap(j)),hash(wrap(i+1),wrap(j)),a),mix(hash(wrap(i),wrap(j+1)),hash(wrap(i+1),wrap(j+1)),a),b);
 }
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){
  const v=(y+.5)/w,u=(x+.5)/w,row=Math.floor(v*33),lap=frac(v*33),chip=frac(u*24+row*.49+.11*Math.sin(row*16.7));
  const joint=1-Math.min(1,Math.min(chip,1-chip)/.043),lip=1-Math.min(1,lap/.16);
  const grain=.35*field(u,v,49)+.41*field(u,v,27)+.24*field(u,v,15);
  const stress=.58*field(u,v,10)+.42*field(u,v,22)+.017*Math.sin(31*u+row);
  const peel=Math.max(0,Math.min(.54,(stress-.66)*3.65))*(grain>.43?1:.32);
  const shingle=hash(Math.floor(u*24+row*.49)%24,row)-.5;
  const paint=.956-lip*.14-joint*.065+shingle*.048+(grain-.5)*.12;
  const rotted=Math.min(peel*.65,.61);
  const g=Math.round(255*Math.max(.20,Math.min(1,paint-rotted)));const i=4*(y*w+x);
  data[i]=Math.min(255,g+Math.floor(rotted*8));data[i+1]=g;data[i+2]=Math.max(0,g-Math.round(rotted*45));data[i+3]=255;
  const z=Math.round(Math.max(0,Math.min(255,197-lip*67-joint*39-peel*32+(grain-.5)*44)));
  elevation[i]=z;elevation[i+1]=z;elevation[i+2]=z;elevation[i+3]=255;
 }
 const t=(input:Uint8Array,colour=false)=>{
  const q=new T.DataTexture(input,w,w,T.RGBAFormat);q.generateMipmaps=true;q.minFilter=T.LinearMipmapLinearFilter;
  q.magFilter=T.LinearFilter;if(colour)q.colorSpace=T.SRGBColorSpace;
  q.wrapS=q.wrapT=T.RepeatWrapping;q.needsUpdate=true;return q;
 };
 return {paint:t(data,true),relief:t(elevation)};
}
function materials():Record<Role,T.Material>{
 const cedar=shingles();cedar.paint.anisotropy=4;cedar.relief.anisotropy=4;
 const w=new T.MeshStandardMaterial({color:0xe1ded0,roughness:.94,map:cedar.paint,bumpMap:cedar.relief,bumpScale:.012,vertexColors:true});
 const red=new T.MeshStandardMaterial({color:0x943d34,roughness:.65,metalness:.20});
 return {white:w,red,iron:new T.MeshStandardMaterial({color:0x58382e,roughness:.74,metalness:.29}),
  louver:new T.MeshStandardMaterial({color:0x583629,roughness:.87}),door:new T.MeshStandardMaterial({color:0x95887c,roughness:.92}),
  deck:new T.MeshStandardMaterial({color:0x9f9a86,roughness:.99}),
  glass:new T.MeshPhysicalMaterial({color:0xb4c1bd,roughness:.16,transmission:.52,thickness:.011,ior:1.50,clearcoat:.69,metalness:0,side:T.DoubleSide}),
  lining:new T.MeshStandardMaterial({color:0xbfb8a4,roughness:.58,metalness:.18})};
}
export function egmontTower(){
 const root=new T.Group();root.name='Uninstalled Cape Egmont lighthouse working model';
 const byMat=new Map<Role,T.BufferGeometry[]>(),m=materials();
 const add=(r:Role,g:T.BufferGeometry)=>{
  const q=g.index?g.toNonIndexed():g;
  if(g!==q)g.dispose();const a=byMat.get(r)??[];a.push(q);byMat.set(r,a);
 };
 const poly=(r:Role,p:T.Vector3[],uv?:[number,number][],t=1)=>{
  const order=p.length===4?[0,1,2,0,2,3]:[0,1,2];
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(order.flatMap(i=>p[i].toArray()),3))
   .setAttribute('uv',new T.Float32BufferAttribute(order.flatMap(i=>uv?.[i]??[[0,0],[1,0],[1,1],[0,1]][i]),2));
  g.computeVertexNormals();
  if(r==='white')g.setAttribute('color',new T.Float32BufferAttribute(order.flatMap(()=>[t,t,t]),3));
  add(r,g);
 };
 const beam=(r:Role,a:T.Vector3,b:T.Vector3,width:number,depth=width)=>{
  const u=b.clone().sub(a),p=a.clone().lerp(b,.5),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),u.clone().normalize());
  add(r,new T.BoxGeometry(u.length(),width,depth).applyMatrix4(new T.Matrix4().compose(p,q,buff.set(1,1,1))));
 };
 const section=(r:Role,y0:number,y1:number,sa:number,sb:number,t=1)=>{
  for(let i=0;i<4;i++)poly(r,[face(i,sa,y0,sa),face(i,-sa,y0,sa),face(i,-sb,y1,sb),face(i,sb,y1,sb)],undefined,t);
 };
 const starts=[{lo:.08,hi:2.13,w:.56,door:true},{lo:3.28,hi:4.73,w:.34,door:false},{lo:5.76,hi:7.23,w:.33,door:false}];
 for(let i=0;i<4;i++){
  const breaks=Array.from(new Set([0,deck-.4,...(i===0?starts.flatMap(r=>[r.lo,r.hi]):[])])).sort((a,b)=>a-b);
  for(let k=1;k<breaks.length;k++){
   const a=breaks[k-1],b=breaks[k],left=ap(a),right=ap(b);
   const hole=i===0&&starts.find(p=>p.lo===a&&p.hi===b);
   if(hole){
    for(const sign of [-1,1]){
     const pts=[face(i,sign*left,a,left),face(i,sign*hole.w,a,left),face(i,sign*hole.w,b,right),face(i,sign*right,b,right)];
     if(sign<0)pts.reverse();
     poly('white',pts,pts.map((p,j)=>[(j===1||j===2?hole.w:(j===0?left:right))*sign/5.10,p.y/5.00]),.995);
    }
   }else{
    const pts=[face(i,left,a,left),face(i,-left,a,left),face(i,-right,b,right),face(i,right,b,right)];
    poly('white',pts,[[left/5.10,a/5.00],[-left/5.10,a/5.00],[-right/5.10,b/5.00],[right/5.10,b/5.00]],1-.015*(i%2));
   }
  }
 }
 for(const o of starts){
  const {lo,hi,w}=o,at=(q:number,y:number,offs=0)=>face(0,q,y,ap(y)+offs);
  const mid=(lo+hi)*.50;
  poly(o.door?'door':'louver',[at(w,lo,-.085),at(-w,lo,-.085),at(-w,hi,-.085),at(w,hi,-.085)]);
  for(const z of [-w,w])beam('red',at(z,lo,.027),at(z,hi,.027),.093,.085);
  beam('red',at(-w-.045,lo,.024),at(w+.045,lo,.024),.082,.09);
  const a=at(-w-.15,hi+.04,.051),b=at(0,hi+(o.door?.36:.22),.058),c=at(w+.15,hi+.04,.051);
  poly('white',[c,a,b],undefined,.96);
  beam('red',a,b,.055,.077);beam('red',b,c,.055,.077);
  if(o.door){
   beam('iron',at(-.37,mid-.18,-.045),at(-.29,mid-.18,-.045),.033,.057);
   for(const h of [lo+.22,hi-.22])beam('iron',at(.42,h,-.039),at(.50,h,-.037),.040,.075);
  }else for(let y=lo+.136;y<hi-.03;y+=.103)beam('louver',at(-w+.029,y,-.030),at(w-.029,y,-.030),.044,.051);
 }
 section('red',deck-.60,deck-.51,ap(deck-.60)+.044,ap(deck-.51)+.065);
 section('white',deck-.51,deck-.23,2.00,2.33,.95);
 section('white',deck-.23,deck-.12,2.33,2.53,1.);
 section('white',deck-.12,deck,2.53,2.58,.99);
 section('deck',-.028,.057,3.466,3.458);
 poly('deck',[new T.Vector3(-2.58,deck,-2.58),new T.Vector3(-2.58,deck,2.58),new T.Vector3(2.58,deck,2.58),new T.Vector3(2.58,deck,-2.58)]);
 for(let k=0;k<4;k++){const f=(q:number,h:number)=>face(k,q,deck+h,2.49);
  for(const y of [.45,.92])for(let lane=0;lane<4;lane++)beam('red',f(-2.49+lane*1.245,y),f(-2.49+(lane+1)*1.245,y),.037,.035);
  for(let l=0;l<4;l++)beam('red',f(-2.49+l*1.245,0),f(-2.49+l*1.245,.97),.041,.046);}
 const oct=(k:number,y:number,t:number)=>new T.Vector3(Math.cos((k+.5)*Math.PI/4)*t,y,Math.sin((k+.5)*Math.PI/4)*t);
 const sill=deck+.56, glassTop=cap-.70, eave=cap-.56;
 for(let k=0;k<8;k++){
  const j=k+1,R=1.44,H=1.58;
  poly('red',[oct(j,deck+.038,R),oct(k,deck+.038,R),oct(k,sill,R),oct(j,sill,R)]);
  poly('glass',[oct(j,sill,R),oct(k,sill,R),oct(k,glassTop,R),oct(j,glassTop,R)]);
  poly('red',[oct(j,glassTop,R),oct(k,glassTop,R),oct(k,eave,H),oct(j,eave,H)]);
  poly('red',[oct(j,eave,H),oct(k,eave,H),new T.Vector3(0,cap,0)]);
  beam('red',oct(k,sill,R+.012),oct(k,glassTop+.08,R+.012),.035,.044);
  beam('iron',oct(j,eave-.019,H+.012),oct(k,eave-.019,H+.012),.026,.040);
  beam('red',oct(j,sill,R+.015),oct(k,sill,R+.015),.050,.053);
 }
 add('lining',new T.CylinderGeometry(1.06,1.12,.065,16).translate(0,glassTop-.22,0));
 add('iron',new T.CylinderGeometry(.28,.32,.13,12).translate(0,sill+.10,0));
 add('red',new T.CylinderGeometry(.098,.162,.28,12).translate(0,cap+.13,0));
 const direction=new T.Vector3(-.61,.47,.51).normalize(),turn=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction);
 const shape=[[.026,-.26],[.101,-.14],[.152,.03],[.203,.15],[.211,.188],[.184,.193],[.163,.175],[.124,.016],[.047,-.13]];
 const vent=new T.LatheGeometry(shape.map(([x,y])=>new T.Vector2(x,y)),18);
 vent.applyQuaternion(turn).translate(0,cap+.35,0);add('red',vent);
 for(const [r,parts] of byMat){
  if(r==='glass'){for(const p of parts)root.add(new T.Mesh(p,m[r]));continue;}
  const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  if(!g)throw new Error(r);g.computeBoundingSphere();root.add(new T.Mesh(g,m[r]));
 }
 return root;
}
