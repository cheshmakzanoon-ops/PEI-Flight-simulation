import * as THREE from 'three';
import {project} from '../sim/geo.ts';
import {BASIN_CANNERY as S} from './basin-cannery.generated.ts';

type P=readonly [u:number,v:number,y:number];
type Layer='cladding'|'roof'|'harbourRoof'|'timber'|'trim'|'glass'|'door'|'gallery';
const pts=S.worldFrameLonLat.map(([lon,lat])=>project(lon,lat));
const cx=pts.reduce((a,b)=>a+b.x,0)*.25,cz=pts.reduce((a,b)=>a+b.z,0)*.25;
const [NW,NE,SW,SE]=pts;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const xyz=([u,v,y]:P)=>[lerp(lerp(NW.x,NE.x,u),lerp(SW.x,SE.x,u),v)-cx,y,lerp(lerp(NW.z,NE.z,u),lerp(SW.z,SE.z,u),v)-cz];
const shot=(right:boolean,u:number,v:number)=>{const c=right?S.east:S.west;return c[0]+c[1]*u+c[2]*v;};
const ridge=(v:number)=>(S.east[0]-S.west[0]+(S.east[2]-S.west[2])*v)/(S.west[1]-S.east[1]);
const flare=(right:boolean,u:number,v:number)=>{const t=right?S.eastFlare:S.westFlare;return t[0]+t[1]*u+t[2]*v;};
const edge=(right:boolean,v:number)=>{const c=right?S.east:S.west,d=right?S.eastFlare:S.westFlare;return (d[0]-c[0]+(d[2]-c[2])*v)/(c[1]-d[1]);};
const toe=(right:boolean)=>right?S.eastToe:S.westToe;
const wall=(right:boolean,_v:number)=>toe(right)+(right?-.015:.017);
const wallTop=(right:boolean,v:number)=>flare(right,toe(right),v)-.032;
export function canneryRoofAt(u:number,v:number){
 const east=u>=ridge(v);
 return (east&&u>edge(true,v)||!east&&u<edge(false,v))?flare(east,u,v):shot(east,u,v);
}

function makeLayer(layer:Layer){
 const colors={cladding:0xc9c8b8,roof:0xb0ab9a,harbourRoof:0xaca89c,timber:0x736858,trim:0x4c6556,glass:0x425149,door:0x874743,gallery:0xa69c87};
 const m=new THREE.MeshStandardMaterial({color:colors[layer],side:THREE.DoubleSide,roughness:layer==='glass'?.4:.83,
   metalness:layer==='glass'?.12:0});
 if(layer==='cladding'||layer==='roof'||layer==='harbourRoof'||layer==='door'||layer==='gallery'){
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec2 canneryGrain;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncanneryGrain=uv;');
   shader.fragmentShader='varying vec2 canneryGrain;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    vec2 p=canneryGrain*vec2(${layer==='roof'||layer==='harbourRoof'?'5.4,4.1':layer==='gallery'?'1.6,6.0':'4.8,5.6'});
    p.x+=.5*mod(floor(p.y),2.);
    vec2 span=max(fwidth(p),vec2(.002));
    float fade=1.-smoothstep(.15,.52,max(span.x,span.y));
    float seam=(1.-smoothstep(.019,.080+span.y,fract(p.y)))*.15+(1.-smoothstep(.024,.060+span.x,fract(p.x)))*.071;
    float tone=fract(sin(dot(floor(p),vec2(93.5,27.2)))*4137.2)-.5;
    float grain=sin(canneryGrain.x*60.8+sin(canneryGrain.y*18.4)*.35)*.014;
    float bleach=sin(canneryGrain.x*.98+sin(canneryGrain.y*.94))*sin(canneryGrain.y*.65-canneryGrain.x*.37);
    diffuseColor.rgb*=.985+${layer==='harbourRoof'?'.064':'.046'}*bleach+fade*(tone*.08+grain-seam);
   `);
  };
  m.customProgramCacheKey=()=>'basin-cannery-v1-'+layer;
 }
 return m;
}

/** The two large gable faces use measured geometry. Piles, sash and
 * dormers are original period interpretation, not engineering detail. */
export function createBasinCannery(visibleGrade?:(x:number,z:number)=>number){
 const g=new THREE.Group();g.name='Historic Cannery at Basin Head';g.position.set(cx,0,cz);
 const bins=new Map<Layer,{p:number[];uv:number[]}>();
 const tri=(kind:Layer,a:P,b:P,c:P)=>{
  let part=bins.get(kind);if(!part){part={p:[],uv:[]};bins.set(kind,part);}
  const asRoof=kind==='roof'||kind==='harbourRoof'||kind==='gallery',runsV=Math.abs(a[1]-b[1])+Math.abs(a[1]-c[1])>Math.abs(a[0]-b[0])+Math.abs(a[0]-c[0]);
  for(const v of [a,b,c]){
   part.p.push(...xyz(v));part.uv.push(asRoof||!runsV?v[0]*S.lengthU:v[1]*S.lengthV,asRoof?v[1]*S.lengthV:v[2]);
  }
 };
 const quad=(k:Layer,a:P,b:P,c:P,d:P)=>{tri(k,a,b,c);tri(k,a,c,d);};
 const box=(k:Layer,u0:number,u1:number,v0:number,v1:number,b:number,t:number)=>{
  quad(k,[u0,v0,b],[u1,v0,b],[u1,v0,t],[u0,v0,t]);
  quad(k,[u1,v0,b],[u1,v1,b],[u1,v1,t],[u1,v0,t]);
  quad(k,[u1,v1,b],[u0,v1,b],[u0,v1,t],[u1,v1,t]);
  quad(k,[u0,v1,b],[u0,v0,b],[u0,v0,t],[u0,v1,t]);
  quad(k,[u0,v0,t],[u1,v0,t],[u1,v1,t],[u0,v1,t]);
  quad(k,[u0,v1,b],[u1,v1,b],[u1,v0,b],[u0,v0,b]);
 };
 const floor=S.authoredFloor,v0=.016,v1=.977;
 // Follow the independently measured kick in the lower part of the roof.
 for(const v of [v0,v1]){
  const us=[wall(false,v),edge(false,v),ridge(v),edge(true,v),wall(true,v)];
  for(let i=1;i<us.length;i++){
   const a=us[i-1],b=us[i],y=canneryRoofAt(a,v)-.034,z=canneryRoofAt(b,v)-.034;
   quad('cladding',[a,v,floor],[b,v,floor],[b,v,z],[a,v,y]);
   const q=v===v0?v-.004:v+.004;
   quad('trim',[a,q,y-.09],[b,q,z-.09],[b,q,z+.003],[a,q,y+.003]);
  }
 }
 for(const east of [false,true]){
  const shifted=toe(east)+(east?.001:-.001),material=east?'harbourRoof':'roof';
  quad('cladding',[wall(east,v0),v0,floor],[wall(east,v1),v1,floor],
   [wall(east,v1),v1,wallTop(east,v1)],[wall(east,v0),v0,wallTop(east,v0)]);
  const section=(v:number)=>[toe(east),edge(east,v),ridge(v)];
  const a=section(v0),b=section(v1);
  for(let i=1;i<a.length;i++)quad(material,
   [a[i-1],v0,canneryRoofAt(a[i-1],v0)],[b[i-1],v1,canneryRoofAt(b[i-1],v1)],
   [b[i],v1,canneryRoofAt(b[i],v1)],[a[i],v0,canneryRoofAt(a[i],v0)]);
  quad('trim',[shifted,v0,wallTop(east,v0)-.08],[shifted,v1,wallTop(east,v1)-.08],
   [shifted,v1,wallTop(east,v1)+.037],[shifted,v0,wallTop(east,v0)+.037]);
 }
 box('timber',wall(false,.50)-.008,wall(true,.50)+.008,v0-.009,v1+.010,floor-.224,floor-.008);
 for(const east of [false,true]){
  const piles=east?16:9;
  for(let i=0;i<piles;i++){
   const v=.041+.92*i/piles;
   const u=wall(east,v)+(east?-.018:.018);
   box('timber',u-.011,u+.011,v-.009,v+.009,-.21,floor-.19);
  }
 }
 const frontDoor=(v:number)=>wall(true,v)+.003;
 for(const v of [.15,.29,.44,.59,.74]){
  const a=v-.027,b=v+.027;
  quad('door',[frontDoor(a),a,floor+.10],[frontDoor(b),b,floor+.10],
    [frontDoor(b),b,floor+2.25],[frontDoor(a),a,floor+2.25]);
  for(const t of [a-.003,b+.003])box('trim',frontDoor(t),frontDoor(t)+.005,t-.004,t+.004,floor+.085,floor+2.28);
 }
 for(const v of [v0-.004,v1+.004])for(const u of [.41,.65]){
  box('trim',u-.041,u+.041,v-.004,v+.004,3.10,4.47);
  box('glass',u-.031,u+.031,v-.006,v+.006,3.18,4.38);
  for(const j of [-.012,.012])box('trim',u+j-.002,u+j+.002,v-.007,v+.007,3.17,4.39);
  for(const h of [3.56,4.00])box('trim',u-.033,u+.033,v-.007,v+.007,h-.017,h+.017);
 }
 for(const [lo,hi] of [[.04,.39],[.58,.94]] as const){
  const a=.035,b=edge(false,(lo+hi)*.5)-.032;
  box('cladding',a,b,lo,hi,floor,4.48);
  quad('roof',[a-.009,lo-.016,4.53],[a-.009,hi+.016,4.53],[b,hi+.016,5.67],[b,lo-.016,5.67]);
  for(const v of [lo,hi])tri('cladding',[a,v,4.48],[b,v,5.66],[b,v,4.48]);
 }
 for(const east of [false,true])for(const [order,v] of (east?[.228,.710]:[.249,.850]).entries()){
  const dir=east?1:-1,a=east?.984:.142,top=east?(order?7.675:7.645):(order?7.686:7.705);
  const h=top-.58,l=v-.080,r=v+.080;
  const backHeight=top-.34,plane=east?S.east:S.west;
  const b=(backHeight-plane[0]-plane[2]*v)/plane[1];
  const base=canneryRoofAt(a,v)-.08,p=a+dir*.006,q=p+dir*.004;
  quad('cladding',[a,l,base],[a,r,base],[a,r,h],[a,l,h]);tri('cladding',[a,l,h],[a,r,h],[a,v,top]);
  for(const j of [l,r]){
   tri('cladding',[a,j,base],[a,j,h],[b,j,canneryRoofAt(b,j)]);
   quad('roof',[a,j,h],[a,v,top],[b,v,canneryRoofAt(b,v)+.09],[b,j,canneryRoofAt(b,j)]);
   quad('trim',[p,j,h-.066],[p,v,top-.075],[p,v,top+.016],[p,j,h+.016]);
  }
  const bottom=h-1.02,upper=h-.14;
  quad('trim',[p,v-.034,bottom],[p,v+.034,bottom],[p,v+.034,upper],[p,v-.034,upper]);
  quad('glass',[q,v-.027,bottom+.045],[q,v+.027,bottom+.045],[q,v+.027,upper-.045],[q,v-.027,upper-.045]);
  for(const j of [v-.009,v+.009])box('trim',q-.003,q+.003,j-.002,j+.002,bottom+.03,upper-.03);
  for(const fraction of [.26,.5,.74]){
   const y=lerp(bottom,upper,fraction);
   box('trim',q-.003,q+.003,v-.028,v+.028,y-.012,y+.012);
  }
 }
 // The bounded seaward apron is modelled within the 2020 level
 // return swath and seats at the building's existing exterior threshold.
 const deckU0=.978,deckU1=1.188,deckV0=.024,deckV1=.966,deckY=S.probedEastWalkHeight+.148;
 box('gallery',deckU0,deckU1,deckV0,deckV1,deckY-.11,deckY);
 // This witness is an interior portion of a farther-reaching mapped
 // wharf, not its true retaining edge. Keep an open seated support.
 for(let j=1;j<10;j++){
  const v=deckV0+(deckV1-deckV0)*j/10;
  let bottom=.62;
  if(visibleGrade)for(const u of [deckU1-.018,deckU1-.006])for(const d of [v-.009,v+.009]){
   const q=xyz([u,d,0]),floor=visibleGrade(q[0]+cx,q[2]+cz);
   if(Number.isFinite(floor))bottom=Math.min(bottom,floor-.055);
  }
  box('timber',deckU1-.018,deckU1-.006,v-.009,v+.009,bottom,deckY-.09);
 }
 box('timber',deckU1-.013,deckU1+.005,deckV0,deckV1,deckY+.80,deckY+.87);
 for(let j=0;j<=14;j++){
  const v=deckV0+(deckV1-deckV0)*j/14;
  box('timber',deckU1-.012,deckU1+.004,v-.004,v+.004,deckY-.16,deckY+.86);
 }
 box('timber',deckU1-.011,deckU1+.002,deckV0,deckV1,deckY+.42,deckY+.46);
 const u=ridge(.543);
 box('timber',u-.039,u+.039,.496,.590,9.22,9.77);
 for(const v of [.491,.595])tri('trim',[u-.045,v,9.76],[u+.045,v,9.76],[u,v,10.03]);
 for(const j of [-1,1])quad('roof',[u,.491,10.03],[u,.595,10.03],[u+j*.054,.595,9.76],[u+j*.054,.491,9.76]);
 for(const [k,a] of bins){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(a.p,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,makeLayer(k));mesh.name='Cannery '+k;g.add(mesh);
 }
 return g;
}

/** Survey-frame point for the offline checks; no gameplay contact. */
export function basinCanneryWorld(u:number,v:number,y:number){
 const p=xyz([u,v,y]);return {x:p[0]+cx,y:p[1],z:p[2]+cz};
}
