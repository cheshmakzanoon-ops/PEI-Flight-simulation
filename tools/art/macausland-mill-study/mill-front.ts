import * as T from 'three';
import { Batch } from './fabrication.ts';
import type {Plane} from './fabrication.ts';
import { finish, seed } from './finish.ts';
type P=[number,number,number];
type Hole={name:string;x0:number;x1:number;y0:number;y1:number;bays:number;cols:number;top:number;bottom:number};
const F:Plane=(x,y,z)=>[x,y,z], E:Plane=(u,y,d)=>[-5.0-d,y,-u];
const N:P=[0,0,1], East:P=[-1,0,0], Up:P=[0,1,0];
// Detached authoring units across the photographed front. Not measured height, tied grade, or location.
export const silhouette=[[-5,1.96],[-1.62,3.32],[-.025,4.626],[1.54,3.360],[5,1.962]];
const gable=(x:number)=>{
 for(let j=1;j<silhouette.length;j++){const [a,b]=silhouette[j-1],[c,d]=silhouette[j];if(x<=c+1e-8)return b+(d-b)*(x-a)/(c-a);}
 return silhouette.at(-1)![1];
};
export const frontGlazing:Hole[]=[
 {name:'upper',x0:-.994,x1:.987,y0:2.703,y1:3.669,bays:3,cols:4,top:2,bottom:2},
 {name:'lower-bank',x0:-1.697,x1:-.418,y0:.595,y1:1.541,bays:2,cols:4,top:2,bottom:2},
 {name:'lower-sash',x0:3.096,x1:3.735,y0:.602,y1:1.536,bays:1,cols:4,top:2,bottom:2},
];
export const returnGlazing:Hole[]=[
 {name:'east-sash-1',x0:.647,x1:1.177,y0:.541,y1:1.529,bays:1,cols:3,top:2,bottom:2},
 {name:'east-sash-2',x0:1.812,x1:2.347,y0:.582,y1:1.561,bays:1,cols:1,top:1,bottom:1},
 {name:'east-sash-3',x0:2.986,x1:3.519,y0:.606,y1:1.575,bays:1,cols:1,top:1,bottom:1},
 {name:'east-sash-4',x0:4.184,x1:4.712,y0:.642,y1:1.589,bays:1,cols:1,top:1,bottom:1},
];
const slider:Hole={name:'slider',x0:.002,x1:1.397,y0:.035,y1:1.345,bays:0,cols:0,top:0,bottom:0};
const eastDepth=5.63,northSkinDepth=2.63,rearRoofLimit=5.71;
const outfacing=(n:P)=>n.map(c=>-c) as P;

function ribs(x:number,origin:number,pitch:number,size:number){
 const w=(x-origin)/pitch,j=Math.floor(w+1e-10),u=w-j;
 const q=Math.min(Math.max(0,u),1),v=q<.050?.33+q*13.4:q<.104?1-(q-.050)*9.3:q<.181?.498-(q-.104)*6.45:q<.942?.003: .003+(q-.942)*5.6379;
 return size*v*(.8+.36*seed(j,78));
}
function series(from:number,to:number,pitch:number,origin:number,hard:number[]=[]){
 const points=[from,to,...hard.filter(x=>x>from&&x<to)];
 for(let i=Math.floor((from-origin)/pitch);i*pitch+origin<to+pitch;i++)
  for(const a of [0,.05,.104,.181,.942]){const x=origin+(i+a)*pitch;if(x>from&&x<to)points.push(x);}
 return points.sort((a,b)=>a-b).filter((x,i,p)=>i===0||x-p[i-1]>1e-7);
}
function siding(part:Batch,plane:Plane,normal:P,lo:number,hi:number,yAt:(x:number)=>number,holes:Hole[],origin:number,lowest:(x:number)=>number=()=>.021){
 const P=series(lo,hi,.162,origin,[...holes.flatMap(o=>[o.x0,o.x1]),...silhouette.map(o=>o[0])]);
 for(let i=1;i<P.length;i++){
  const a=P[i-1],b=P[i],m=(a+b)*.5,A=ribs(a,origin,.162,.018),B=ribs(b,origin,.162,.018);
  const o=holes.filter(v=>m>v.x0&&m<v.x1).sort((a,b)=>a.y0-b.y0);
  const gaps:[[number,number],[number,number]][]=[];
  let y0=lowest(a),Y0=lowest(b);for(const h of o){gaps.push([[y0,Y0],[h.y0,h.y0]]);y0=Y0=h.y1;}
  gaps.push([[y0,Y0],[yAt(a),yAt(b)]]);
  const seam=Math.floor((m-origin)/.162),shade=.929+.064*seed(seam,12)+.035*seed(seam>>1,158);
  for(const [[y0,Y0],[y1,Y1]]of gaps){
   if(y1-y0<1e-5||Y1-Y0<1e-5)continue;
   const e0=.151*(a+5.125),e1=.151*(b+5.125),f=(y:number)=>y*.43+.045;
   part.quad(plane(a,y0,A),plane(b,Y0,B),plane(b,Y1,B),plane(a,y1,A),normal,shade,
    [[e0,f(y0)],[e1,f(Y0)],[e1,f(Y1)],[e0,f(y1)]]);
  }
 }
}
function perf(name:string,col:number,metal=0,rough=.7){
 return new T.MeshStandardMaterial({name,color:col,metalness:metal,roughness:rough,vertexColors:true});
}
function coat(name:string,id:Parameters<typeof finish>[0],metalness:number,scale:number,materials:boolean){
 const sample=materials?finish(id):{};
 return new T.MeshStandardMaterial({name,metalness,roughness:1,vertexColors:true,normalScale:new T.Vector2(scale,scale),...sample});
}
function rim(B:Batch,pl:Plane,n:P,o:Pick<Hole,'x0'|'x1'|'y0'|'y1'>,w:number,b:number,f:number,s=1){
 const{x0,x1,y0,y1}=o;
 B.roundBox(pl,x0-w,x1+w,y1-w*.20,y1+w,b,f,n,s,.0059);
 B.roundBox(pl,x0-w,x1+w,y0-w,y0+w*.20,b,f,n,s*.92,.0059);
 B.roundBox(pl,x0-w,x0+w*.20,y0+w*.2,y1-w*.2,b,f,n,s*.94,.0059);
 B.roundBox(pl,x1-w*.20,x1+w,y0+w*.2,y1-w*.2,b,f,n,s*.96,.0059);
}
export type Light={opening:string;row:number;col:number;bay:number;center:P;axis:P};
function sash(o:Hole, pl:Plane,n:P, trim:Batch, dark:Batch, glass:Batch, lights:Light[]){
 const{x0,x1,y0,y1,bays,cols,top,bottom}=o;
 rim(trim,pl,n,o,.049,-.114,.037);
 rim(dark,pl,n,{x0:x0+.011,x1:x1-.011,y0:y0+.011,y1:y1-.011},.028,-.142,-.039,.80);
 // Thin projection and drip shadow; never replace a real opening with a decal.
 trim.roundBox(pl,x0-.060,x1+.063,y0-.053,y0-.035,-.016,.060,n,.81,.0048);
 dark.roundBox(pl,x0-.057,x1+.059,y0-.062,y0-.050,-.021,.028,n,.65,.002);
 const a=x0+.035,b=x1-.035,l=y0+.032,h=y1-.031,m=(y0+y1)*.5;
 const w=(b-a)/bays,mid=.0335,rail=.033;
 trim.roundBox(pl,a,b,m-rail,m+rail,-.107,.021,n,.93);
 for(let k=1;k<bays;k++){const p=a+w*k;trim.roundBox(pl,p-mid,p+mid,l-.012,h+.012,-.102,.028,n,.92);}
 for(let k=0;k<bays;k++){
  const u=a+k*w+(k>0?mid:0),v=a+(k+1)*w-(k+1<bays?mid:0);
  for(const [L,H,c,r]of [[l,m-rail,bottom,0],[m+rail,h,top,bottom]]){
   const bar=r===0?.0069:.0091,level=r===0?.643:.861,barDepth=r===0?-.070:-.063;
   for(let i=1;i<cols;i++){const x=T.MathUtils.lerp(u,v,i/cols);trim.roundBox(pl,x-bar*.5,x+bar*.5,L-.009,H+.009,-.086,barDepth,n,level+.045*seed(i+k*11,r));}
   for(let j=1;j<c;j++){const y=T.MathUtils.lerp(L,H,j/c);trim.roundBox(pl,u-.008,v+.008,y-bar*.5,y+bar*.5,-.087,barDepth-.001,n,level+.038*seed(j+k*11,r));}
   for(let i=0;i<cols;i++)for(let j=0;j<c;j++){
    const p=T.MathUtils.lerp(u,v,i/cols),q=T.MathUtils.lerp(u,v,(i+1)/cols);
    const s=T.MathUtils.lerp(L,H,j/c),t=T.MathUtils.lerp(L,H,(j+1)/c),Z=-.084;
    glass.quad(pl(p,s,Z),pl(q,s,Z),pl(q,t,Z),pl(p,t,Z),n,.85+.15*seed(i+k*26+o.name.length,j+r));
    lights.push({opening:o.name,col:i,row:j+r,bay:k,center:pl((p+q)*.5,(s+t)*.5,Z),axis:n});
   }
  }
 }
 // This backplate is behind the whole sash, not a surrogate for panes or framing.
 dark.box(pl,x0-.012,x1+.012,y0-.012,y1+.012,-.193,-.166,n,.62);
}
function slantedTrim(B:Batch,x1:number,y1:number,x2:number,y2:number,za:number,zb:number,s:number){
 const a=new T.Vector2(x1,y1),b=new T.Vector2(x2,y2),side=new T.Vector2(-(b.y-a.y),b.x-a.x).normalize();
 const pl:Plane=(u,y,d)=>[a.x+(b.x-a.x)*u+side.x*y,a.y+(b.y-a.y)*u+side.y*y,d];
 B.roundBox(pl,-.0007,1.0007,-.094,.023,za,zb,N,s,.006);
 B.roundBox(pl,-.0006,1.0006,.015,.043,za+.014,zb+.013,N,s*.96,.004);
}
function profileRoof(B:Batch,A:Batch){
 const xs=[-5.105,-1.62,-.025,1.54,5.10],zs=series(-northSkinDepth,.112,.153,.061);
 for(let j=1;j<xs.length;j++)for(let i=1;i<zs.length;i++){
  const a=xs[j-1],b=xs[j],z0=zs[i-1],z1=zs[i],c=ribs(z0,.061,.153,.019),d=ribs(z1,.061,.153,.019);
  const Y=(u:number,k:number)=>gable(u)+.026+k;
  const ca=(z:number)=>Math.floor((z-.061)/.153),s=.81+.17*seed(ca((z0+z1)*.5),j+18);
  B.quad([a,Y(a,c),z0],[b,Y(b,c),z0],[b,Y(b,d),z1],[a,Y(a,d),z1],Up,s,
   [[a*.29,z0*.53],[b*.29,z0*.53],[b*.29,z1*.53],[a*.29,z1*.53]]);
 }
 // Distinct interlocked caps at the ridge and two slope-breaks. Yard ends remain cut at the study border.
 for(const i of [1,2,3]){
  const x=xs[i],w=i===2?.118:.035,y=xs[i],part=i===2?A:B;
  const q=(u:number,z:number,h:number)=>[u,gable(u)+h,z]as P;
  for(const [a,b]of [[x-w,y],[y,x+w]]){
   part.quad(q(a,-northSkinDepth,.043),q(b,-northSkinDepth,.058),q(b,.122,.058),q(a,.122,.043),Up,.89,[[.1,0],[.13,0],[.13,1.0],[.1,1.]]);
  }
 }
}
// A different, shallower and deeper roof volume positively visible behind the front crest.
// The setback and heights here are detailed authoring proportions, not measurements or an annex.
const rearGable=(x:number)=>4.933-.3465*Math.abs(x+.021);
const BuriedFront:Plane=(x,y,d)=>[x,y,-northSkinDepth+d];
const BuriedEast:Plane=(u,y,d)=>[-4.67-d,y,-u];
const BuriedWest:Plane=(u,y,d)=>[4.882+d,y,-u];
function higherShell(R:Batch,body:Batch,band:Batch){
 siding(body,BuriedFront,N,-4.67,4.88,rearGable,[],-4.67,x=>Math.min(rearGable(x)-.01,gable(x)+.013));
 const eRoof=rearGable(-4.67),wRoof=rearGable(4.88);
 siding(body,BuriedEast,East,northSkinDepth,rearRoofLimit,()=>eRoof,[],-.07,()=>1.94);
 siding(body,BuriedWest,[1,0,0],northSkinDepth,rearRoofLimit,()=>wRoof,[],.019,()=>1.94);
 const x=[-4.77,-.021,4.964],z=series(-rearRoofLimit,-northSkinDepth+.081,.148,-.011);
 for(let j=1;j<x.length;j++)for(let i=1;i<z.length;i++){
  const a=x[j-1],b=x[j],c=z[i-1],d=z[i],S=(x:number,z:number)=>rearGable(x)+.028+ribs(z,-.011,.148,.017);
  R.quad([a,S(a,c),c],[b,S(b,c),c],[b,S(b,d),d],[a,S(a,d),d],Up,.87+.12*seed(i,j+77),
   [[a*.26,c*.48],[b*.26,c*.48],[b*.26,d*.48],[a*.26,d*.48]]);
 }
 for(let i=1;i<x.length;i++){
  const a=x[i-1],b=x[i],P=(u:number,t:number,d:number)=>[a+(b-a)*u,rearGable(a+(b-a)*u)+t,-northSkinDepth+d]as P;
  band.roundBox(P,-.001,1.001,-.056,.066,.016,.102,N,.91,.005);
 }
 band.roundBox(BuriedEast,northSkinDepth-.093,rearRoofLimit,eRoof-.061,eRoof+.045,.024,.113,East,.91,.006);
 band.roundBox(BuriedWest,northSkinDepth-.093,rearRoofLimit,wRoof-.061,wRoof+.045,.024,.113,[1,0,0],.91,.006);
 for(const [a,b]of [[-.125,-.021],[-.021,.095]]){
  const q=(x:number,z:number)=>[x,rearGable(x)+.057,z]as P;
  band.quad(q(a,-rearRoofLimit),q(b,-rearRoofLimit),q(b,-northSkinDepth+.06),q(a,-northSkinDepth+.06),Up,.89);
 }
}
function apronRoof(B:Batch){
 const z=series(-eastDepth,-northSkinDepth+.008,.153,.061),a=-5.105,b=-4.653;
 for(let i=1;i<z.length;i++){
  const c=z[i-1],d=z[i],Y=(x:number,z:number)=>gable(x)+.026+ribs(z,.061,.153,.019);
  B.quad([a,Y(a,c),c],[b,Y(b,c),c],[b,Y(b,d),d],[a,Y(a,d),d],Up,.88+.09*seed(i,111),
    [[a*.29,c*.53],[b*.29,c*.53],[b*.29,d*.53],[a*.29,d*.53]]);
 }
}
function curve(B:Batch,path:T.Curve<T.Vector3>,r:number,segments=40,t=14){B.attach(new T.TubeGeometry(path,segments,r,t,false));}
function conduit(B:Batch,D:Batch){
 const x=-2.277,z=.108,start=B.data.length,tail=D.data.length;
 const line=new T.CurvePath<T.Vector3>();
 line.add(new T.LineCurve3(new T.Vector3(x,1.127,z+.016),new T.Vector3(x,2.872,z)));
 line.add(new T.CubicBezierCurve3(new T.Vector3(x,2.872,z),new T.Vector3(x,3.095,z),new T.Vector3(-2.194,3.176,z-.003),new T.Vector3(-1.981,3.237,z+.003)));
 line.add(new T.CubicBezierCurve3(new T.Vector3(-1.981,3.237,z+.003),new T.Vector3(-1.771,3.304,z+.003),new T.Vector3(-1.533,3.338,z+.007),new T.Vector3(-1.487,3.435,z+.005)));
 line.add(new T.CubicBezierCurve3(new T.Vector3(-1.487,3.435,z+.005),new T.Vector3(-1.465,3.503,z+.005),new T.Vector3(-1.472,3.515,.065),new T.Vector3(-1.493,3.488,.016)));
 curve(B,line,.0126,48,10);
 const sub=new T.CurvePath<T.Vector3>();
 sub.add(new T.LineCurve3(new T.Vector3(x+.108,1.127,z+.014),new T.Vector3(x+.108,2.838,z+.015)));
 sub.add(new T.CubicBezierCurve3(new T.Vector3(x+.108,2.838,z+.015),new T.Vector3(x+.106,3.025,z+.016),new T.Vector3(-2.086,3.117,z+.021),new T.Vector3(-1.905,3.174,z+.02)));
 sub.add(new T.CubicBezierCurve3(new T.Vector3(-1.905,3.174,z+.02),new T.Vector3(-1.741,3.239,z+.014),new T.Vector3(-1.535,3.302,.112),new T.Vector3(-1.494,3.389,.053)));
 curve(B,sub,.0108,45,10);
 const wrap=new T.CubicBezierCurve3(new T.Vector3(x,1.13,z+.015),new T.Vector3(x,1.036,z+.014),new T.Vector3(x+.108,1.039,z+.014),new T.Vector3(x+.108,1.13,z+.014));
 curve(B,wrap,.0114,12,10);

 const P=(X:number,y:number,z:number)=>new T.Vector3(X,y,z);
 for(const y of [1.434,2.424,2.804]){
  D.roundBox(F,x-.023,x+.024,y-.014,y+.015,.006,.108,N,.81,.003);
  for(const [tx,r]of [[x,.016],[x+.108,.014]]){const collar=new T.CylinderGeometry(r,r,.022,10,1,false);collar.translate(tx,y,.12);B.attach(collar,.82);}
  D.roundBox(F,x+.086,x+.133,y-.014,y+.015,.004,.108,N,.79,.003);
 }
 const cyl=new T.CylinderGeometry(.057,.059,.032,18);cyl.rotateX(Math.PI/2);cyl.translate(-1.494,3.480,.033);D.attach(cyl,.68);
 D.roundBox(F,x-.046,x+.045,1.116,1.164,.004,.105,N,.62,.0035);
 for(const [data,n]of [[B.data,start],[D.data,tail]]as const)for(let i=n;i<data.length;i+=3){data[i+1]-=.241*T.MathUtils.smoothstep(data[i+1],2.62,3.42);data[i+2]*=.72;}
}
function compressor(x:number,y:number,C:Batch,D:Batch){
 const cStart=C.data.length,dStart=D.data.length;
 const X=x+.319,Y=y+.253;
 D.roundBox(F,x+.021,X-.024,y-.017,Y-.012,-.005,.069,N,.74,.006);
 for(const e of [x+.045,X-.053])D.roundBox(F,e-.014,e+.014,y-.085,Y+.011,.016,.054,N,.59,.004);
 C.roundBox(F,x,X,y,Y,.052,.202,N,.94,.012);
 D.roundBox(F,x+.033,X-.061,y+.029,Y-.029,.202,.208,N,.78,.004);
 // Dark recessed fan behind a raised simple louver guard without logos or wiring claims.
 const wheel=new T.CircleGeometry(.087,24);wheel.translate(x+.137,y+.129,.209);D.attach(wheel,.62);
 const ring=new T.RingGeometry(.087,.096,32);ring.translate(x+.137,y+.129,.214);C.attach(ring,.73);
 for(let i=0;i<13;i++){
  const xx=x+.062+i*.0125,yy=Math.sqrt(Math.max(0,.084*.084-(xx-x-.137)**2));
  C.roundBox(F,xx-.0019,xx+.0019,y+.129-yy,y+.129+yy,.212,.218,N,.83,.0007);
 }
 for(let i=0;i<8;i++){
  const yy=y+.059+i*.019,xx=Math.sqrt(Math.max(0,.084*.084-(yy-y-.129)**2));
  C.roundBox(F,x+.137-xx,x+.137+xx,yy-.0021,yy+.0021,.211,.218,N,.86,.00055);
 }
 C.roundBox(F,X-.044,X-.014,y+.039,Y-.034,.202,.215,N,.81,.003);
 for(const [data,start]of [[C.data,cStart],[D.data,dStart]]as const)for(let i=start;i<data.length;i+=3){data[i]=x+(data[i]-x)*1.56;data[i+1]=y+(data[i+1]-y)*1.52;data[i+2]*=.84;}
}
export function makeMillFront(materials=true){
 const group=new T.Group();group.name='Original MacAusland mill frontage and stepped roof fragment';
 const wall=coat('Painted chocolate roll-formed steel','wall',.10,.43,materials);
 wall.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 paintLoc;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\npaintLoc=position;');
  const f=(n:number)=>n.toFixed(6);
  const shadow=(A:Hole[],orientation:string,w:string)=>A.map(({x0,x1,y0,y1})=>`
   contacts=max(contacts,${w}*smallContact(${orientation},vec4(${[x0,x1,y0,y1].map(f).join(',')})));
  `).join('');
  s.fragmentShader=`varying vec3 paintLoc;
   float smallContact(vec2 uv,vec4 b){
    vec2 center=(b.xz+b.yw)*.5,halfWidth=(b.yw-b.xz)*.5;
    vec2 p=abs(uv-center)-(halfWidth+vec2(.041,.034));
    float outer=length(max(p,vec2(0.)))+min(0.,max(p.x,p.y));
    float around=1.-smoothstep(.005,.128,abs(outer));
    float blot=.53+.27*sin(uv.x*99.7+.8*cos(18.3*uv.y))+.20*sin(uv.x*38.0+1.91);
    float drip=(1.-smoothstep(.05,.49,b.z-uv.y))*smoothstep(.01,.125,b.z-uv.y)
      *smoothstep(b.x-.11,b.x+.11,uv.x)*(1.-smoothstep(b.y-.10,b.y+.14,uv.x))*blot;
    return around*.68+drip*.21;
   }
   float bracketRun(vec2 uv,vec2 bolt){
    float down=bolt.y-uv.y,x=uv.x-bolt.x-.007*sin(22.*uv.y+5.*bolt.x);
    return exp(-abs(x)*46.)*smoothstep(-.036,.021,down)*(1.-smoothstep(.19,.54,down))*.44;
   }\n`+s.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   float q=paintLoc.x*.93+paintLoc.z*.86;
   float drip=.50+.20*sin(q*12.+.7*sin(5.*q))+.14*cos(q*19.3+.61)+.09*cos(q*47.4);
   float damp=(1.-smoothstep(.028,.188+drip*.122,paintLoc.y))*(.56+drip*.43);
   float contacts=0.,front=1.-smoothstep(.026,.152,abs(paintLoc.z)),side=1.-smoothstep(.020,.11,abs(paintLoc.x+5.));
   ${shadow([...frontGlazing,slider],'paintLoc.xy','front')}
   ${shadow(returnGlazing,'vec2(-paintLoc.z,paintLoc.y)','side')}
   float mounting=front*(bracketRun(paintLoc.xy,vec2(-2.277,2.421))+bracketRun(paintLoc.xy,vec2(-4.477,.851))
               +bracketRun(paintLoc.xy,vec2(4.377,.851)));
   diffuseColor.rgb*=1.-.28*damp-.19*contacts-.23*mounting;
  `);
 };wall.customProgramCacheKey=()=> 'MacAusland handmade kick weathering';
 const roof=coat('Cool gray seamed mill roofing','roof',.31,.42,materials);
 const trim=coat('Folded off-white paint','trim',.13,.4,materials);
 const door=coat('Old white-painted sliders','door',.074,.55,materials);
 door.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 sliderLoc;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsliderLoc=position;');
  s.fragmentShader='varying vec3 sliderLoc;\n'+s.fragmentShader.replace('#include <color_fragment>',`
   #include <color_fragment>
   float l=sliderLoc.x,y=sliderLoc.y;
   float streak=.57+.27*cos(13.7*l+.51*sin(12.*y))+.14*sin(98.3*l+5.4);
   float shoe=(1.-smoothstep(.044,.16+.067*streak,y))*.77;
   float a=exp(-abs(l-.083)*32.)+exp(-abs(l-1.336)*48.);
   float b=exp(-abs(l-.718)*28.)+(1.-smoothstep(.016,.087,abs(l-1.390)));
   float halo=(a*.165+b*.073)*smoothstep(.57,1.26,y)*streak;
   diffuseColor.rgb*=1.-.181*shoe-.43*halo;
   diffuseColor.rgb+=halo*vec3(.038,.016,.004);
  `);
 };door.customProgramCacheKey=()=> 'Mill slider rain-dulled paint';

 const copper=coat('Weathered warm conduit','copper',.52,.51,materials);
 const backing=perf('Visible edge cavities',0x352b25,.02,.91);
 const pale=perf('Pressed warm-gray cooler casing',0xb0aea2,.19,.69);
 const glassMat=new T.MeshPhysicalMaterial({name:'Neutral glazed mill sash',color:0x2d3736,vertexColors:true,metalness:.02,roughness:.213,ior:1.5,clearcoat:.67,clearcoatRoughness:.14,envMapIntensity:.78});
 const front=new Batch('front-roll-formed-skin',wall),ret=new Batch('east-return-roll-formed-skin',wall);
 const R=new Batch('near-folded-metal-roof',roof), rearRoof=new Batch('higher-folded-gable-roof',roof),rearWall=new Batch('setback-upper-roll-formed-shell',wall),trims=new Batch('folded-eave-and-crest',trim);
 const windows=new Batch('white-window-joinery',trim), cavity=new Batch('sash-reveals-and-backing',backing), panes=new Batch('real-glazing',glassMat);
 const leaves=new Batch('industrial-slider-leaves',door), guides=new Batch('slider-head-and-threshold',backing);
 const conduits=new Batch('service-conduit',copper),straps=new Batch('conduit-mounting',backing);
 const cases=new Batch('unmarked-cooler-casings',pale),caseD=new Batch('cooler-fan-and-backing',backing);
 const lights:Light[]=[];
 siding(front,F,N,-5,5,gable,[...frontGlazing,slider],-5);
 siding(ret,E,East,.0001,eastDepth,()=>1.961,returnGlazing,-.022);
 for(const w of frontGlazing)sash(w,F,N,windows,cavity,panes,lights);
 for(const w of returnGlazing)sash(w,E,East,windows,cavity,panes,lights);
 profileRoof(R,trims);apronRoof(R);higherShell(rearRoof,rearWall,trims);
 for(let j=1;j<silhouette.length;j++)slantedTrim(trims,...silhouette[j-1] as [number,number],...silhouette[j] as [number,number],.047,.138,.94-j*.019);
 trims.roundBox(E,-.085,eastDepth,1.889,1.958,.029,.128,East,.93,.007);
 // Protected underside flange across the shallow front eave.
 for(let i=1;i<silhouette.length;i++){const[a,b]=silhouette[i-1],[c,d]=silhouette[i];trims.quad([a,b-.048,-.003],[c,d-.048,-.003],[c,d-.048,.125],[a,b-.048,.125],[0,-1,0],.72);}
 trims.roundBox(F,-5.038,-4.958,.020,1.862,.009,.077,N,.86,.005);
 trims.roundBox(F,4.962,5.032,.022,1.897,.007,.06,N,.86,.005);
 trims.roundBox(E,-.022,.044,.019,1.881,.012,.072,East,.88,.004);
 // A shadowed cutaway termination, not a geographically placed building rear.
 const cap=new Batch('non-site-cutaway-edge',backing),rearZ=-eastDepth;
 for(let i=1;i<silhouette.length;i++){
  const[a,b]=silhouette[i-1],[c,d]=silhouette[i];
  cap.quad([a,.024,rearZ],[c,.024,rearZ],[c,rearGable(c),rearZ],[a,rearGable(a),rearZ],outfacing(N),.79);
 }
 const west:Plane=(u,h,d)=>[5+d,h,-u];cap.box(west,0,eastDepth,.019,1.961,-.027,-.006,[1,0,0],.81);
 // The white door sheets are recessed, partially overlapping, and separately shaded.
 const{x0,x1,y0,y1}=slider;
 guides.box(F,x0-.016,x1+.025,y0-.007,y1+.014,-.190,-.142,N,.84);
 guides.roundBox(F,x0-.049,x1+.053,y1-.031,y1+.023,-.064,.007,N,.77,.004);
 guides.roundBox(F,x0-.048,x1+.037,y0-.012,y0+.028,-.04,.026,N,.66,.002);
 const L=[x0-.023,.712],G=[.682,x1+.018];
 for(const [i,[l,h]]of [L,G].entries()){
  const q=i===0?.011:-.039;
  leaves.roundBox(F,l,h,y0+.006,y1-.022,q-.036,q+.009,N,.89+i*.037,.007);
  leaves.roundBox(F,l+.022,h-.024,y0+.018,y0+.052,q+.009,q+.018,N,.83,.0035);
  leaves.roundBox(F,l+.022,h-.024,y1-.065,y1-.039,q+.009,q+.019,N,.95,.0035);
  for(const a of [l+.024,h-.033])leaves.roundBox(F,a,a+.015,y0+.047,y1-.060,q+.01,q+.017,N,.92,.0029);
  if(i===1)leaves.roundBox(F,l+.043,h-.045,.688,.729,q+.012,q+.028,N,.93,.004);
 }
 trims.roundBox(F,x0-.075,x1+.076,y1+.006,y1+.048,-.016,.069,N,.88,.006);
 guides.roundBox(F,.737,.765,.484,.616,.011,.031,N,.77,.005);
 conduit(conduits,straps);compressor(-4.73,.63,cases,caseD);compressor(4.13,.62,cases,caseD);
 for(const b of [front,ret,R,rearWall,rearRoof,trims,windows,cavity,panes,leaves,guides,conduits,straps,cases,caseD,cap])b.emit(group,b!==panes);
 group.userData.normalizedGlazingCenters=lights;
 group.userData.study='Independently authored frontage and eastern return. Detached, normalized; not surveyed geometry.';
 return group;
}
