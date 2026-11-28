import {
 BufferGeometry, Float32BufferAttribute, FrontSide, GLSL3, Group, Mesh, RawShaderMaterial, ShapeUtils, Vector2,
} from 'three';

/**
 * Detached, unplaced representative visitor-centre frontage.
 *
 * No world coordinate, reverse-elevation inventory, sign, actual
 * opening positions, surveyed foundation, contact, or old mesh lease.
 * Width/depth, eaves, overhang, bays and join choices are artistic;
 * overall height and two broad main slopes are constrained by the local
 * signed HRDEM DSM/DTM proof. Never add to the gameplay scene directly.
 */
type P = [number, number, number];
type Bounds = [number,number,number,number,number,number];
const sub = (a: P,b: P):P=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross = (a:P,b:P):P=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a:P,b:P)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit = (p:P):P=>{
 const m=Math.hypot(...p);
 if(!(m>1e-8))throw Error('degenerate frontage');
 return [p[0]/m,p[1]/m,p[2]/m];
};
const stockProof={
 rise: .24673148996413063, fall: .3068586792694685, groundMedian:5.682473182678223,
 localDSMMaximum:13.694601058959961, maxInterpretiveHeight:8.14,
};
const BODY_X0=-14.38, BODY_X1=13.04, BODY_Z0=-9.9, BODY_Z1=7.92;
const X0=-14.58,X1=13.24,Z0=-10.14,Z1=8.18,RIDGE_Z=-1.36,RIDGE_Y=7.59;
const eave=(z:number)=>RIDGE_Y-(z>RIDGE_Z?(z-RIDGE_Z)*stockProof.rise:(RIDGE_Z-z)*stockProof.fall);
const SHOULDER_X=-7.60, RECESSED_Z=7.02, RECESSED_EDGE=7.28;
const soffitY=(z:number)=>eave(Z0)+(eave(Z1)-eave(Z0))*(z-Z0)/(Z1-Z0)-.128;
const CEDAR=1, STEEL_X=2, STEEL_Z=3, TRIM=4, GLASS=5, PLINTH=6, SOFFIT=7, PORCH=8, STOP=9, ROOF_FOLD=10;
export const VISITOR_STUDY_TRIANGLE_LIMIT=1280;

export const visitorVertex=`
 precision highp float;precision highp int;
 layout(location=0) in vec3 position;
 layout(location=1) in vec3 normal;
 layout(location=2) in float finish;
 uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix;
 out vec3 locPos,wp,nw;flat out int role;
 void main(){
   locPos=position;
   wp=(modelMatrix*vec4(position,1.)).xyz;
   nw=mat3(modelMatrix)*normal;
   role=int(finish+.5);
   gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
 }
`;
export const visitorFragment=`
 precision highp float;precision highp int;
 in vec3 locPos,wp,nw;
 flat in int role;
 uniform vec3 cameraPosition;
 layout(location=0) out vec4 rgba;
 float h12(vec2 p){ vec3 q=fract(p.xyx*vec3(.1031,.1030,.0973));
   q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
 float cloudNoise(vec2 p){vec2 i=floor(p),q=fract(p);q=q*q*(3.-2.*q);
   return mix(mix(h12(i),h12(i+vec2(1,0)),q.x),
              mix(h12(i+vec2(0,1)),h12(i+1.),q.x),q.y);}
 vec3 srgb(vec3 c){
   c=max(c,vec3(0.));
   return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
 }
 float resolved(float px,float period){return 1.-smoothstep(.29,1.03,px/period);}
 void main(){
   vec3 p=locPos,n=normalize(nw),v=normalize(cameraPosition-wp);
   vec3 dx=dFdx(p),dy=dFdy(p);
   vec3 fp=abs(dx)+abs(dy);
   vec3 sun=normalize(vec3(-.41,.77,.47));
   float sky=clamp(n.y*.68+.40,0.,1.);
   float diffuse=max(dot(n,sun),0.);
   float trimSeat=smoothstep(-.05,.80,p.y);
   float shade=.54+.15*sky+.35*diffuse;
   vec3 col=vec3(.149,.128,.105);
   if(role==1){
     // Only close phases reveal staggered courses; no reference image or splotch decal.
     float flatx=abs(n.x)>abs(n.z)?p.z:p.x, ufp=abs(n.x)>abs(n.z)?fp.z:fp.x;
     float row=floor((p.y+.013)/.153);
     float x=(flatx+(h12(vec2(row,7.))-0.5)*.245)/.195;
     float edge=1.-smoothstep(.028,.115,fract((p.y+.013)/.153));
     float vertical=1.-smoothstep(.045,.117,fract(x));
     float field=cloudNoise(vec2(flatx*.41,p.y*.73));
     float fixedv=(h12(vec2(floor(x),row))-.5)*resolved(max(fp.y,ufp),.155);
     float grain=resolved(ufp,.037)*(h12(vec2(floor(flatx/.037),row))-.5)*.023;
     float carving=edge*.059*resolved(fp.y,.153)+vertical*.022*resolved(ufp,.195);
     col=vec3(.197,.168,.132)*(.91+field*.16+fixedv*.10+grain-carving);
     float belowEave=smoothstep(3.8,5.45,p.y);
     shade*=mix(.89,.98,trimSeat)*(1.-.14*belowEave);
   }else if(role==2||role==3||role==10){
     // Analytic standing-seam suggestion, filtered in true study metres.
     float axis=role==2?p.x:p.z, af=role==2?fp.x:fp.z;
     float wav=fract((axis+.029)/.46);
     float rib=1.-smoothstep(.022,.073,min(wav,1.-wav));
     float seam=resolved(af,.46)*rib;
     float panel=(h12(vec2(floor((axis+.029)/.46),2.))-.5)*resolved(af,.46);
     float faded=cloudNoise(p.xz*.145);
     col=vec3(.218,.068,.059)*(.95+faded*.102+panel*.05+seam*.095);
     col+=vec3(.022,.019,.015)*pow(max(dot(n,normalize(v+sun)),0.),26.);
     if(role==10) col*=.84;
   }else if(role==4){
     col=mix(vec3(.382,.364,.312),vec3(.657,.628,.557),trimSeat);
   }else if(role==5){
     // Opaque proxy, not actual glazing or an interior. Neutral environment;
     // directional sky/ground values retain mullion contrast at flight scale.
     float fr=pow(1.-max(dot(n,v),0.),4.);
     vec3 rdir=reflect(-v,n);
     float r=clamp(rdir.y*.72+.42,.02,.96);
     float h=cloudNoise(vec2(p.x+p.z,p.y)*.49);
     vec3 ground=vec3(.024,.033,.029), sk=vec3(.136,.191,.222);
     float row=smoothstep(2.38,4.87,p.y);
     float brow=.45+cloudNoise((rdir.xz-rdir.y*.22)*vec2(3.8,2.4))*.55;
     float knee=smoothstep(-.29,.32,rdir.y+row*.27);
     float amount=clamp(.11+(.30+.31*row)*r+.26*fr+.18*knee*brow,0.,1.);
     col=mix(ground,sk,amount)*mix(.91,1.02,h);
     col*=1.-.14*(1.-smoothstep(.28,.86,p.y));
     shade=.87;
   }else if(role==6){
     col=mix(vec3(.143,.140,.126),vec3(.188,.179,.148),cloudNoise(p.xz*.85));
   }else if(role==7){
     col=vec3(.342,.325,.264);
     shade*=.77;
   }else if(role==8){
     col=mix(vec3(.195,.166,.131),vec3(.258,.221,.180),cloudNoise(p.xz*.67));
   }else if(role==9){
     col=vec3(.061,.053,.039);
     shade*=.88;
   }
   rgba=vec4(srgb(col*shade),1.);
 }
`;
interface Part {first: number, count: number, name: string, bounds: Bounds;}
interface Face {i:number[],role:number;}
class Batch {
 private readonly p:number[]=[];
 private readonly n:number[]=[];
 private readonly r:number[]=[];
 readonly parts:Part[]=[];
 add(name:string,pts:P[],faces:Face[],windingKnown=false){
   const ctr=pts.reduce<P>((a,p)=>[a[0]+p[0]/pts.length,a[1]+p[1]/pts.length,a[2]+p[2]/pts.length],[0,0,0]);
   const first=this.p.length/3;
   for(const {i,role} of faces){
     const us=i.map(k=>pts[k]);
     let x=unit(cross(sub(us[1],us[0]),sub(us[2],us[0])));
     if(!windingKnown&&dot(x,sub(us[0],ctr))<0){us.reverse();x=unit(cross(sub(us[1],us[0]),sub(us[2],us[0])));}
     for(const z of us)if(Math.abs(dot(x,sub(z,us[0])))>1e-8)throw Error('nonplanar shell face');
     for(let t=1;t<us.length-1;t++)for(const z of [us[0],us[t],us[t+1]]){
       this.p.push(...z); this.n.push(...x); this.r.push(role);
     }
   }
   const bounds=[0,1,2].flatMap(ax=>[Math.min(...pts.map(q=>q[ax])),Math.max(...pts.map(q=>q[ax]))]) as Bounds;
   this.parts.push({first,count:this.p.length/3-first,name,bounds});
 }
 ramp(name:string,x0:number,x1:number,z0:number,z1:number,y0:number,yFront:number,yRear:number,role:number,top=role){
   if(!(x1>x0&&z1>z0&&Math.min(yFront,yRear)>y0))throw Error(name);
   this.add(name,[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,yRear,z0],[x1,yRear,z0],[x1,yFront,z1],[x0,yFront,z1]],
     [[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0],[4,7,6,5]]
       .map((i,j)=>({i,role:j===5?top:role})));
 }
 box(name:string,b:Bounds,r:number){this.ramp(name,b[0],b[1],b[4],b[5],b[2],b[3],b[3],r);}
 geometry(){
   const g=new BufferGeometry();
   g.setAttribute('position',new Float32BufferAttribute(this.p,3));
   g.setAttribute('normal',new Float32BufferAttribute(this.n,3));
   g.setAttribute('finish',new Float32BufferAttribute(this.r,1));
   g.computeBoundingBox();g.computeBoundingSphere();
   if(g.attributes.position.count/3>VISITOR_STUDY_TRIANGLE_LIMIT)throw Error('frontage budget');
   return g;
 }
}
/** Triangulate only within a locally authored *exact planar* crown. */
function horizontal(pts:P[],ids:number[],up:boolean,role:number):Face[]{
 const tris=ShapeUtils.triangulateShape(ids.map(k=>new Vector2(pts[k][0],pts[k][2])),[]);
 if(tris.length!==ids.length-2)throw Error('roof plan failed');
 return tris.map(t=>{
  const i=t.map(j=>ids[j]);const a=pts[i[0]],b=pts[i[1]],c=pts[i[2]];
  if((cross(sub(b,a),sub(c,a))[1]>0)!==up)i.reverse();
  return {i,role};
 });
}
function mainHip(b:Batch){
 const L=[[X0,Z0],[X1,Z0],[X1,Z1],[SHOULDER_X,Z1],[SHOULDER_X,RECESSED_EDGE],[X0,RECESSED_EDGE]] as const;
 const top:P[]=L.map(([x,z])=>[x,eave(z),z]);
 const lip:P[]=L.map(([x,z])=>[x,eave(z)-.111,z]);
 const bottom:P[]=L.map(([x,z])=>[x,soffitY(z),z]);
 const pts:P[]=[...top,...lip,...bottom,[-10.18,RIDGE_Y,RIDGE_Z],[8.44,RIDGE_Y,RIDGE_Z]];
 const faces=[
  ...horizontal(pts,[0,1,19,18],true,STEEL_X),
  ...horizontal(pts,[1,2,19],true,STEEL_Z),
  ...horizontal(pts,[2,3,4,5,18,19],true,STEEL_X),
  ...horizontal(pts,[5,0,18],true,STEEL_Z),
  ...horizontal(pts,[12,13,14,15,16,17],false,SOFFIT),
 ];
 for(let k=0;k<L.length;k++){
  const j=(k+1)%L.length;
  faces.push({i:[k+6,k,j,j+6],role:TRIM},{i:[k+12,k+6,j+6,j+12],role:SOFFIT});
 }
 // Closed roof slab with a single photographed relative break. Its returns
 // are an interpretation; the recess has deliberately no position on game land.
 b.add('closed main roof',pts,faces,true);
 // Small, folded cap at the actual authored ridge. Both skirts sit inside
 // the two measured-slope roof planes. No photographer trace or precise
 // metal seam inventory claimed.
 const w=.101,x0=-10.16,x1=8.42;
 const q0=RIDGE_Z-w,q1=RIDGE_Z+w, y0=RIDGE_Y-.067,z=RIDGE_Z;
 b.add('seated steel ridge fold',[
  [x0,y0,q0],[x0,7.589,q0],[x0,7.647,z],[x0,7.588,q1],[x0,y0,q1],
  [x1,y0,q0],[x1,7.589,q0],[x1,7.647,z],[x1,7.588,q1],[x1,y0,q1],
 ],[[0,1,2,3,4],[5,9,8,7,6],[0,5,6,1],[1,6,7,2],[2,7,8,3],[3,8,9,4],[4,9,5,0]]
  .map(i=>({i,role:ROOF_FOLD})));
}
function showcase(b:Batch,front:boolean,wall:number,start:number,end:number,n:number){
 const yLo=.29,yHi=4.93,mid=3.36,h=.060,paneInset=.034;
 const run=(name:string,u0:number,u1:number,y0:number,y1:number,d0:number,d1:number,r:number)=>(
  front?b.box(name,[u0,u1,y0,y1,wall+d0,wall+d1],r):
  b.box(name,[wall-d1,wall-d0,y0,y1,u0,u1],r));
 // This is the two-band *relative design*, with no claimed count.
 // Glazing is deliberately opaque, over a real inset dark stop with
 // a continuous backstop/no visible interior. The whites stand 9 cm
 // proud of the glazing. No glass lighting or texture from any photo.
 run('deep opaque glazing backing',start,end,yLo,yHi,-.008,.022,STOP);
 run('showcase pane',start+.027,end-.027,yLo+.032,yHi-.033,.020,paneInset,GLASS);
 run('recessed sill',start-.042,end+.042,yLo-.078,yLo+.071,-.025,.135,TRIM);
 run('continuous upper head',start-.042,end+.042,yHi-.059,yHi+.064,-.025,.129,TRIM);
 run('warm sash rebate',start,end,mid-.065,mid+.065,.011,.060,STOP);
 run('shared transom',start,end,mid-.045,mid+.045,.044,.121,TRIM);
 for(let k=0;k<=n;k++){
  const u=start+(end-start)*k/n;
  run('vertical glazing stop',u-h-.026,u+h+.026,yLo+.057,yHi-.051,.018,.052,STOP);
  run('mullion',u-h,u+h,yLo+.055,yHi-.050,.037,.126,TRIM);
 }
}
function decorate(b:Batch){
 b.ramp('body shell',SHOULDER_X,BODY_X1,BODY_Z0,BODY_Z1,.12,
   soffitY(BODY_Z1)+.096,soffitY(BODY_Z0)+.096,CEDAR);
 b.ramp('recessed glazing shoulder',BODY_X0,SHOULDER_X,BODY_Z0,RECESSED_Z,.12,
   soffitY(RECESSED_Z)+.096,soffitY(BODY_Z0)+.096,CEDAR);
 b.box('seated study plinth',[SHOULDER_X,BODY_X1+.028,.015,.245,BODY_Z0-.028,BODY_Z1+.023],PLINTH);
 b.box('seated shoulder plinth',[BODY_X0-.028,SHOULDER_X,.015,.245,BODY_Z0-.028,RECESSED_Z+.023],PLINTH);
 mainHip(b);
 showcase(b,true,RECESSED_Z,BODY_X0+.095,SHOULDER_X-.100,4);
 showcase(b,true,BODY_Z1,SHOULDER_X+.105,-.61,4);
 showcase(b,false,BODY_X0,-2.66,RECESSED_Z-.070,5);
 showcase(b,false,SHOULDER_X,RECESSED_Z+.107,BODY_Z1-.096,1);
 // Low entry shelter collides intentionally with the solid body at its rear and
 // with the post heads. No inferred site stairs, wheelchair ramp or rail.
 b.box('porch landing',[-.73,13.35,.016,.187,7.66,10.56],PORCH);
 b.ramp('porch soffit',-.86,13.47,7.63,10.57,2.725,2.818,3.044,SOFFIT);
 b.ramp('closed low steel porch cover',-.94,13.53,7.61,10.64,2.792,2.903,3.251,TRIM,STEEL_X);
 for(const x of [-.61,1.71,4.46,8.47,10.78,13.19])
  b.box('seated porch column',[x-.084,x+.084,.168,2.854,10.14,10.31],TRIM);
 // Recessed-looking portal (opaque glazing, no interior or sign).
 b.box('entry reveal',[4.84,8.12,.19,2.62,BODY_Z1-.012,BODY_Z1+.046],SOFFIT);
 b.box('entry glazing',[5.14,7.82,.244,2.482,BODY_Z1+.016,BODY_Z1+.058],GLASS);
 for(const x of [5.13,6.48,7.83])b.box('entry vertical trim',[x-.059,x+.059,.207,2.489,BODY_Z1+.045,BODY_Z1+.095],TRIM);
 for(const y of [.291,1.824,2.482])
  b.box('entry horizontal trim',[5.084,7.884,y-.059,y+.059,BODY_Z1+.047,BODY_Z1+.096],TRIM);
 for(const x of [1.72,10.75]){
  b.box('restrained side pane',[x-.57,x+.57,1.09,2.345,BODY_Z1-.015,BODY_Z1+.037],GLASS);
  for(const off of [-.59,.59])b.box('pane return',[x+off-.05,x+off+.05,1.04,2.40,BODY_Z1+.015,BODY_Z1+.072],TRIM);
  for(const y of [1.06,2.40])b.box('pane head/sill',[x-.56,x+.56,y-.054,y+.054,BODY_Z1+.016,BODY_Z1+.082],TRIM);
 }
 // Raised rectangular welcome-centre silhouette, solid and buried into the
 // principal hip; no real sign or precise port sizes. The opposite small
 // elevated cap/complex and equipment haven't been numerically registered.
 b.ramp('seated raised cedar head',1.42,7.41,2.68,5.79,5.09,7.88,7.69,CEDAR);
 b.ramp('raised overhanging steel head',1.21,7.61,2.44,6.06,7.61,8.109,7.922,TRIM,STEEL_X);
 // Its left cheek has a high short glazing band in the reference, not a sign.
 b.box('monitor recessed opaque light',[1.382,1.431,7.08,7.55,3.48,4.99],GLASS);
 for(const z of [3.49,4.22,4.98])
  b.box('monitor jamb',[1.345,1.426,7.055,7.574,z-.047,z+.047],TRIM);
 for(const y of [7.074,7.556])
  b.box('monitor sill and head',[1.335,1.423,y-.047,y+.047,3.443,5.026],TRIM);
}
export function createVisitorStudy(){
 const b=new Batch();decorate(b);
 const geometry=b.geometry();
 const material=new RawShaderMaterial({
  glslVersion:GLSL3,vertexShader:visitorVertex,fragmentShader:visitorFragment,
  depthTest:true,depthWrite:true,transparent:false,side:FrontSide,toneMapped:false,
 });
 const mesh=new Mesh(geometry,material);
 mesh.name='North Cape representative frontage (unplaced, no contact)';
 const group=new Group();group.name='North Cape detached architecture';group.add(mesh);
 let disposed=false;
 return {group,mesh,parts:Object.freeze(b.parts.map(p=>Object.freeze({...p,bounds:Object.freeze(p.bounds)}))),
  dispose(){if(disposed)return;disposed=true;group.remove(mesh);geometry.dispose();material.dispose();}};
}
