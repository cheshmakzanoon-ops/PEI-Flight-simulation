import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,type Material} from 'three';

/** Original DETACHED UPPER Kent-facing gable specimen. The two clear
 * published exterior observations inform forms, not a surveyed elevation.
 * Local X is image-left→right, Y nominal display metres, Z outward. */
export const INN_KENT_STUDY=Object.freeze({
 subject:'Georgetown Historic Inn / Kent-facing upper gable study',
 corpus:'2016 Province C. Stewart; 2026 traveller publication (shutter not established)',
 scope:'No world placement. Ground floor, porch, lower annex, and unobserved elevations held.',
 sourceOwnerHint:'q11220/182',installAuthority:false,
 bayWidthM:11.3, eaveY:5.75, riseM:3.05, displayCutY:2.52,
} as const);
export type InnKentRole='blueLap'|'charcoalRoof'|'paintedCase'|'friezeAccent'|'reveal'|'glass'|'displaySlice';
type V=readonly [number,number,number];
type XY=readonly [number,number];
type Streams={p:number[];uv:number[]};
type Shelf=Map<InnKentRole,Streams>;
type Window={label:string;minX:number;maxX:number;minY:number;maxY:number};
const B=5.65, Y=5.75, R=3.05, K=R/B, LOW=2.52;
const OUT:V=[0,0,1], BACK:V=[0,0,-1], UP:V=[0,1,0], DOWN:V=[0,-1,0];
const rears=-.54, glassSeat=-.143, face=.044;
const frontUV=(p:V):XY=>[p[0],p[1]];
const vec=(a:V,b:V):V=>[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mul=(a:V,k:number):V=>[k*a[0],k*a[1],k*a[2]];
const norm=(a:V):V=>mul(a,1/Math.hypot(...a));
const uniq=(a:number[])=>[...new Set(a)].sort((a,b)=>a-b);
const named=(label:string,x:number,b:number,t:number,w:number):Window=>({label,minX:x-w*.5,maxX:x+w*.5,minY:b,maxY:t});
const apertures=[
 named('middle-left',-3.39,3.44,4.83,.91),
 named('middle-center',-.52,3.48,4.88,.89),
 named('middle-right',2.65,3.52,4.94,.96),
 named('attic-left',-1.97,6.05,6.99,.89),
 named('attic-right',1.37,6.14,7.10,.89),
];
export function kentGableObservedOpenings(){return apertures.map(a=>({...a}));}
function planeUV(a:V,b:V,c:V){
 const u=norm(vec(a,b)),v=norm(cross(cross(u,vec(a,c)),u));
 return (p:V):XY=>[dot(vec(a,p),u),dot(vec(a,p),v)];
}
function poly(s:Shelf,r:InnKentRole,p:readonly V[],out:V,uv=frontUV){
 const st=s.get(r)??{p:[],uv:[]};s.set(r,st);
 for(let j=1;j<p.length-1;j++){
  const q=p[0],a=p[j],b=p[j+1],n=cross(vec(q,a),vec(q,b));
  if(Math.hypot(...n)<1e-8)continue;
  for(const v of (dot(n,out)<0?[q,b,a]:[q,a,b])){
   st.p.push(...v);st.uv.push(...uv(v));
  }
 }
}
function rect(s:Shelf,r:InnKentRole,l:number,d:number,h:number,t:number,z:number,n=OUT){
 poly(s,r,[[l,d,z],[h,d,z],[h,t,z],[l,t,z]],n);
}
/** Closed short timber cross-section, rods and bevels not global geometry. */
function box(s:Shelf,r:InnKentRole,l:number,d:number,h:number,t:number,z0:number,z1:number){
 rect(s,r,l,d,h,t,z1);rect(s,r,l,d,h,t,z0,BACK);
 for(const x of [l,h]){
  const p:V[]=[[x,d,z0],[x,d,z1],[x,t,z1],[x,t,z0]];
  poly(s,r,p,[x===l?-1:1,0,0],planeUV(p[0],p[1],p[2]));
 }
 for(const y of [d,t]){
  const p:V[]=[[l,y,z0],[h,y,z0],[h,y,z1],[l,y,z1]];
  poly(s,r,p,y===d?DOWN:UP,planeUV(p[0],p[1],p[2]));
 }
}
function clipped(input:XY[],metric:(v:XY)=>number){
 const out:XY[]=[];
 for(let j=0;j<input.length;j++){
  const a=input[j],b=input[(j+1)%input.length],u=metric(a),v=metric(b);
  if(u>=0)out.push(a);
  if((u<0&&v>0)||(u>0&&v<0)){
   const t=u/(u-v);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
  }
 }
 return out;
}
const expanded=(x:Window):Window=>({...x,minX:x.minX-.069,maxX:x.maxX+.069,minY:x.minY-.073,maxY:x.maxY+.073});
function skin(s:Shelf){
 const openings=apertures.map(expanded);
 const xs=uniq([-B,0,B,...openings.flatMap(w=>[w.minX,w.maxX])]);
 for(let i=1;i<xs.length;i++){
  const l=xs[i-1],h=xs[i],x=(l+h)*.5;
  const holes=openings.filter(q=>x>q.minX&&x<q.maxX);
  const ys=uniq([LOW,Y,Y+R,...holes.flatMap(w=>[w.minY,w.maxY])]);
  for(let j=1;j<ys.length;j++){
   const d=ys[j-1],t=ys[j],y=(d+t)*.5;
   if(holes.some(q=>y>q.minY&&y<q.maxY))continue;
   const w=clipped(clipped([[l,d],[h,d],[h,t],[l,t]],([q,p])=>Y+R-K*q-p),([q,p])=>Y+R+K*q-p);
   if(w.length>=3)poly(s,'blueLap',w.map(([x,y])=>[x,y,0]),OUT);
  }
 }
 const profile=[[-B,LOW],[B,LOW],[B,Y],[0,Y+R],[-B,Y]] as XY[];
 poly(s,'displaySlice',profile.map(([x,y])=>[x,y,rears]),BACK);
 for(let i=0;i<profile.length;i++){
  const [a,b]=[profile[i],profile[(i+1)%profile.length]],p:V[]=[[...a,0],[...b,0],[...b,rears],[...a,rears]];
  poly(s,'displaySlice',p,[b[1]-a[1],a[0]-b[0],0],planeUV(p[0],p[1],p[2]));
 }
}
function glazing(s:Shelf,w:Window){
 const b=expanded(w), l=w.minX,h=w.maxX,d=w.minY,t=w.maxY;
 // Actual trim/cut: a casing at +44mm; reveals span to a dark glazing
 // plane -.143m behind lap. Pane is opaque; does not invent an inside.
 rect(s,'paintedCase',b.minX,b.minY,l,b.maxY,face);
 rect(s,'paintedCase',h,b.minY,b.maxX,b.maxY,face);
 rect(s,'paintedCase',l,b.minY,h,d,face);
 rect(s,'paintedCase',l,t,h,b.maxY,face);
 const outer:XY[]=[[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]];
 const inner:XY[]=[[l,d],[h,d],[h,t],[l,t]];
 const aimed:V[]=[DOWN,[1,0,0],UP,[-1,0,0]];
 for(let i=0;i<4;i++){
  const a=outer[i],b=outer[(i+1)%4],c=inner[i],d=inner[(i+1)%4];
  const p:V[]=[[...a,0],[...b,0],[...b,face],[...a,face]];
  const q:V[]=[[...c,face],[...d,face],[...d,glassSeat],[...c,glassSeat]];
  poly(s,'paintedCase',p,aimed[i],planeUV(p[0],p[1],p[2]));
  poly(s,'reveal',q,mul(aimed[i],-1),planeUV(q[0],q[1],q[2]));
 }
 rect(s,'glass',l,d,h,t,glassSeat);
 const y=d+.509*(t-d),z=glassSeat+.035;
 // One lower rail, a cross sash and small inward pale edge. Views of
 // exterior paint, not an exact muntin schedule.
 rect(s,'paintedCase',l,y-.025,h,y+.025,z);
 rect(s,'paintedCase',l,d,h,d+.040,z);
 rect(s,'paintedCase',l,d,l+.026,t,z);
 rect(s,'paintedCase',h-.026,d,h,t,z);
 const sill:V[]=[[l-.053,d-.036,.088],[h+.053,d-.036,.088],[h+.053,d-.005,-.022],[l-.053,d-.005,-.022]];
 poly(s,'paintedCase',sill,UP,planeUV(sill[0],sill[1],sill[2]));
}
function disk(s:Shelf,role:InnKentRole,x:number,y:number,z:number,rx:number,ry:number,count=12){
 const p:V[]=[];
 for(let k=0;k<count;k++){const a=2*Math.PI*k/count;p.push([x+rx*Math.cos(a),y+ry*Math.sin(a),z]);}
 poly(s,role,p,OUT);
}
function cornice(s:Shelf,ornament:boolean){
 for(const k of [-1,1]){
  const cx=k*(B-.142);
  box(s,'paintedCase',cx-.119,LOW,cx+.119,Y-.156,.014,.078);
  box(s,'paintedCase',cx-.143,Y-.289,cx+.143,Y-.156,.015,.089);
 }
 for(const [i,y] of [2.836,5.505].entries()){
  box(s,'paintedCase',-B-.045,y-.123,B+.045,y+.135,.007,.078);
  box(s,'paintedCase',-B-.067,y+.119,B+.067,y+.164,.018,.115);
  box(s,'reveal',-B-.051,y-.149,B+.051,y-.125,.012,.058);
  if(ornament){
   // Both real photos show quiet reddish circular frieze ornaments.
   // This is an original cadence and mounting depth, no reconstructed count.
   for(let j=-9;j<=9;j++){
    const x=j*(i===0?.533:.548)+.029;
    disk(s,'friezeAccent',x,y+.005,.084,.071,.066,10);
   }
  }
 }
 // The round attic detail is opaque and deliberately unlabelled.
 disk(s,'paintedCase',-.292,6.67,.066,.239,.207,20);
 disk(s,'reveal',-.292,6.67,.074,.167,.142,18);
}
function roof(s:Shelf){
 const UV=(p:V):XY=>[p[2],Math.abs(p[0])*Math.hypot(K,1)];
 const far=rears-.048, near=.273,W=B+.254,ap=Y+R+.105;
 const rY=(x:number)=>ap-K*Math.abs(x);
 for(const side of [-1,1]){
  const x=W*side;
  const q:V[]=[[0,ap,far],[x,rY(x),far],[x,rY(x),near],[0,ap,near]];
  poly(s,'charcoalRoof',q,UP,UV);
  poly(s,'reveal',q.map(v=>[v[0],v[1]-.105,v[2]]),DOWN,UV);
  for(const z of [far,near]){
   const drip:V[]=[[0,ap,z],[x,rY(x),z],[x,rY(x)-.020,z],[0,ap-.020,z]];
   poly(s,z===near?'charcoalRoof':'displaySlice',drip,z===near?OUT:BACK);
   const p:V[]=[[0,ap-.020,z],[x,rY(x)-.020,z],[x,rY(x)-.119,z],[0,ap-.119,z]];
   poly(s,z===near?'paintedCase':'displaySlice',p,z===near?OUT:BACK);
  }
  const p:V[]=[[x,rY(x),far],[x,rY(x),near],[x,rY(x)-.105,near],[x,rY(x)-.105,far]];
  poly(s,'paintedCase',p,[side,0,0],planeUV(p[0],p[1],p[2]));
  // The visible return knees are separate from any unverified porch.
  // There is a horizontal layered wrap and a small opaque weathering cap.
  const L=side<0?-B-.20:B-.91,H=side<0?-B+.91:B+.20;
  box(s,'paintedCase',L,Y-.228,H,Y-.118,-.007,.294);
  box(s,'paintedCase',L-.021,Y-.129,H+.021,Y-.074,-.006,.316);
  const cap:V[]=[[L-.024,Y+.017,.027],[H+.024,Y+.017,.027],
   [H+.024,Y-.059,.315],[L-.024,Y-.059,.315]];
  poly(s,'charcoalRoof',cap,UP,planeUV(cap[0],cap[1],cap[2]));
  const profile:V[]=[cap[3],cap[2],[cap[2][0],Y-.102,.315],[cap[3][0],Y-.102,.315]];
  poly(s,'reveal',profile,OUT,planeUV(profile[0],profile[1],profile[2]));
 }
}
const palette:Readonly<Record<InnKentRole,[number,number]>>={
 blueLap:[0x244c6f,.86],charcoalRoof:[0x45464a,.95],paintedCase:[0xdadbd6,.82],
 friezeAccent:[0x754246,.87],reveal:[0x56626c,.88],glass:[0x32424e,.27],displaySlice:[0x616b73,.91],
};
export function makeKentGableSpecimen(options:{ornament?:boolean;materialFor?:(role:InnKentRole)=>Material|undefined}={}){
 const shell=new Map<InnKentRole,Streams>();
 skin(shell);for(const w of apertures)glazing(shell,w);
 cornice(shell,options.ornament!==false);roof(shell);
 const g=new Group();g.name=INN_KENT_STUDY.subject;
 g.userData={...INN_KENT_STUDY,placement:false,apertureRole:'observed upper only, lower is not modeled'};
 for(const [role,p]of shell){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(p.p,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(p.uv,2));geometry.computeVertexNormals();
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const [color,roughness]=palette[role];
  const mesh=new Mesh(geometry,options.materialFor?.(role)??new MeshStandardMaterial({name:'Inn upper / '+role,color,roughness,metalness:0}));
  mesh.name='Kent-facing display gable / '+role;mesh.userData={role,artOnly:true};g.add(mesh);
 }
 return g;
}
