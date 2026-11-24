import * as T from 'three';
import {Batch,Face,box,rect,spoke} from './geometry.ts';
import { DATUM,planes,ownerOutline,supportOutline, type UV,type Plane,type Pt } from './survey.ts';
import { addRoof,exteriorRoof,faces,clip,height,type Surface } from './roof-union.ts';
import { material,roles,type Role } from './materials.ts';
const P=planes;
const min=(p:readonly Plane[],uv:UV)=>Math.min(...p.map(s=>height(s,uv)));
const max=(p:readonly Plane[],uv:UV)=>Math.max(...p.map(s=>height(s,uv)));
const difference=(a:Plane,b:Plane):Plane=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const banks=[[P.longSouth,P.skirtSouth],[P.longNorth,P.skirtNorth],[P.longWest,P.skirtWest]] as const;
const xMin=-17.91,xShoulder=25.285,xFar=27.18;
const vMin=-5.115,vMax=9.68, base=2.638, plinthCap=3.96;
const vWallS=-3.28,vWallN=7.77,uWallW=-15.36,uWallE=25.085;
const crossLeft=8.36,crossRight=19.18,crossS=-5.36,crossN=9.77;
const gable=[P.crossWest,P.crossEast] as const;
const longHeight=(u:number,v:number)=>Math.min(...banks.map(p=>max(p,[u,v])));
const capHeight=(u:number,v:number)=>u>=crossLeft&&u<=crossRight&&v>=crossS&&v<=crossN?Math.max(longHeight(u,v),min(gable,[u,v])):longHeight(u,v);
const shed=(u:number,v:number)=>Math.min(height(P.skirtEast,[u,v]),max(banks[0],[u,v]),max(banks[1],[u,v]));
const variant=(g:string,domain:UV[],cs:(readonly Plane[])[])=>{
 const a:Surface[]=[];
 for(let mask=0;mask<(1<<cs.length);mask++){
  let q=domain;const selected:Plane[]=[];
  for(let i=0;i<cs.length;i++){const pick=(mask>>i)&1;
   const p=cs[i][pick]; if(cs[i].length>1)q=clip(q,difference(p,cs[i][1-pick]));selected.push(p);}
  if(q.length)a.push(...faces(g,q,selected));
 }
 return a;
};
const hipped=variant('main',rect(xMin,xShoulder,vMin,vMax),[...banks]);
const overhang=(()=>{
 const a:Surface[]=[];
 for(let i=0;i<4;i++){
  let q=rect(24.94,xFar,vMin,vMax);const south=banks[0][i&1],north=banks[1][i>>1];
  q=clip(q,difference(south,banks[0][1-(i&1)]));q=clip(q,difference(north,banks[1][1-(i>>1)]));
  if(q.length)a.push(...faces('lowEast',q,[south,north,P.skirtEast]));
 }
 return a;
})();
// Lower, independent triangulated roof protrusions where 2020 direct returns trace them.
// Their fine cheeks and glazing remain an artist interpretation, not a complete dormer survey.
const dormers=[{u:.14,l:-1.28,r:1.59,b:-2.60,t:1.492,edge:-2.54,dir:-1,z:9.967,slope:.028},
 {u:-1.58,l:-2.63,r:-.53,b:3.21,t:7.05,edge:7.013,dir:1,z:9.982,slope:-.021}] as const;
const dormRoof=(m:(typeof dormers)[number])=>{
 const a:Plane=[.820,m.slope,m.z-.820*m.u-m.slope*m.edge],b:Plane=[-.835,m.slope,m.z+.835*m.u-m.slope*m.edge];
 return [a,b] as const;
};
const untrimmed=exteriorRoof([...hipped,...overhang,...faces('cross',rect(crossLeft,crossRight,crossS,crossN),gable),...dormers.flatMap((d,i)=>faces('dormer'+i,rect(d.l,d.r,d.b,d.t),dormRoof(d)))]);
const spare=.13;
const hullEdges=supportOutline.map(([u,v],i):Plane=>{const [a,b]=supportOutline[(i+1)%supportOutline.length];return [v-b,a-u,b*u-v*a+spare*Math.hypot(a-u,b-v)];});
const roof=untrimmed.flatMap(f=>{let q=f.uv;for(const h of hullEdges)q=clip(q,h);return q.length?[{...f,uv:q}]:[];});
const fence=(x:number,axis:0|1,v:number,sg:1|-1)=>hullEdges.reduce((a,h)=>h[axis]*sg>=-1e-8?a:sg===1?Math.min(a,(-h[1-axis]*v-h[2])/h[axis]):Math.max(a,(-h[1-axis]*v-h[2])/h[axis]),x);
const covers=([u,v]:UV)=>roof.some(f=>f.uv.every(([a,b],i)=>{const [p,q]=f.uv[(i+1)%f.uv.length];return (p-a)*(v-b)-(q-b)*(u-a)>-1e-8;}));


// Local square-sawn structural bracing, with actual depth and faces.
function beam(out:Batch,a:Pt,b:Pt,width:number,depth:number,tone?:readonly[number,number,number]){
 const d=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]);if(d.length()<1e-4)return;d.normalize();
 const z=new T.Vector3(0,0,1);if(Math.abs(d.z)>.94)z.set(1,0,0);
 const q=d.clone().cross(z).normalize().multiplyScalar(width*.5),n=d.clone().cross(q).normalize().multiplyScalar(depth*.5);
 const pts=(p:Pt)=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([u,v]):Pt=>[p[0]+u*q.x+v*n.x,p[1]+u*q.y+v*n.y,p[2]+u*q.z+v*n.z]);
 const x=pts(a),y=pts(b);out.poly([x[3],x[2],x[1],x[0]],undefined,{tone});out.poly(y,undefined,{tone});
 for(let i=0;i<4;i++){const j=(i+1)%4;out.poly([x[i],x[j],y[j],y[i]],undefined,{tone});}
}

type Opening={s:number;y:number;w:number;h:number;door?:boolean;lights?:number};
export function buildRailStation(textured=true){
 const bm=Object.fromEntries(roles.map(x=>[x,new Batch()]))as Record<Role,Batch>;
 const G=new T.Group();G.name='192 Water Street · former railway station, detached';
 addRoof(bm.roof,roof);
 for(const f of roof){
  bm.soffit.poly(f.uv.map((uv):Pt=>[uv[0],height(f.p,uv)-.115,uv[1]]),[0,-1,0],{xy:f.uv});
  for(let i=0;i<f.uv.length;i++){
   const a=f.uv[i],b=f.uv[(i+1)%f.uv.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.007)continue;
   const [u,v]=[(b[1]-a[1])/L,(a[0]-b[0])/L];
   if(covers([(a[0]+b[0])*.5+u*.004,(a[1]+b[1])*.5+v*.004]))continue;
   const x=height(f.p,a),y=height(f.p,b);
   bm.timber.poly([[a[0],x-.143,a[1]],[b[0],y-.143,b[1]],[b[0],y-.003,b[1]],[a[0],x-.003,a[1]]],[u,0,v]);
   bm.flashing.poly([[a[0]+u*.014,x-.035,a[1]+v*.014],[b[0]+u*.014,y-.035,b[1]+v*.014],[b[0]+u*.014,y-.003,b[1]+v*.014],[a[0]+u*.014,x-.003,a[1]+v*.014]],[u,0,v]);
  }
 }

 const window=(f:Face,o:Opening)=>{
  const [l,r,d,h]=[o.s-o.w*.5,o.s+o.w*.5,o.y,o.y+o.h];
  const h0=rect(l,r,d,h),h1=rect(l+.05,r-.05,d+.055,h-.049),ring=rect(l-.082,r+.082,d-.075,h+.093);
  f.draw(bm.timber,ring,.049,[h0]);f.draw(bm.trim,h0,-.159,[h1]);f.draw(bm.back,rect(l-.21,r+.21,d-.21,h+.21),-.216);
  for(const [outline,wards]of [[ring,-1],[h0,1]] as const)for(let i=0;i<outline.length;i++){
   const a=outline[i],b=outline[(i+1)%outline.length],ds=b[0]-a[0],dy=b[1]-a[1];
   bm.timber.poly([f.at(...a,.049),f.at(...b,.049),f.at(...b,-.165),f.at(...a,-.165)],f.axis==='u'?[-dy*wards,ds*wards,0]:[0,ds*wards,-dy*wards]);
  }
  f.draw(bm.glass,h1,-.171,[],o.door?[.77,.82,.85]:[.79+.14*Math.sin(o.s*91),.89,.93]);
  if(o.door)f.extrude(bm.timber,rect(l+.041,r-.041,d+.043,d+.982),-.133,-.179);
  const n=o.lights??2;
  for(let i=1;i<n;i++){const x=l+o.w*i/n;f.extrude(bm.timber,rect(x-.026,x+.026,d+.043,h-.044),-.118,-.179);}
  for(const y of o.door?[d+.985,d+1.55]:[d+(h-d)*.48])f.extrude(bm.timber,rect(l+.035,r-.035,y-.027,y+.028),-.118,-.182);
  f.extrude(bm.stone,rect(l-.115,r+.11,d-.097,d-.043),.103,-.03);
 };
 const sideRim=(face:Face,a:number,b:number,h:(u:number)=>number,th=.151)=>{
  const x=h(a),y=h(b);face.extrude(bm.timber,[[a,x-th],[b,y-th],[b,y-.022],[a,x-.022]],.041,-.02);
  face.extrude(bm.flashing,[[a,x-.045],[b,y-.045],[b,y-.013],[a,x-.013]],.054,.019);
 };
 const stepwise=(a:number,b:number,y:(n:number)=>number,tol=.00045)=>{
  const points:UV[]=[[a,y(a)]];
  const go=(a:number,b:number,h:number,j:number)=>{
   const m=(a+b)*.5,hy=y(m);if(b-a>.025&&Math.abs(hy-(h+j)*.5)>tol){go(a,m,h,hy);go(m,b,hy,j);}else points.push([b,j]);
  };go(a,b,y(a),y(b));return points;
 };
 const skin=(f:Face,a:number,b:number,roofTop:(u:number)=>number,holes:Opening[],bottom=base,cutting=true)=>{
  const above=stepwise(a,b,v=>roofTop(v)+.007);
  const body:UV[]=[[a,bottom],[b,bottom],...above.reverse()];
  const cut=(o:Opening)=>rect(o.s-o.w*.5,o.s+o.w*.5,o.y,o.y+o.h);
  f.draw(bm.stucco,body,0,holes.map(cut));
  if(cutting){
   const sorted=holes.filter(o=>o.y<plinthCap).map(o=>[o.s-o.w*.5-.004,o.s+o.w*.5+.004]).sort((a,b)=>a[0]-b[0]);
   let last=a;
   for(const [l,r] of [...sorted,[b,b]]){
    if(l>last){f.extrude(bm.brick,rect(last,l,bottom,plinthCap-.086),.031,-.089);f.extrude(bm.stone,rect(last,l,plinthCap-.091,plinthCap+.019),.053,-.015);}
    last=Math.max(last,r);
   }
  }
  holes.forEach(k=>window(f,k));
 };
 const front=new Face('u',vWallN,1),back=new Face('u',vWallS,-1), west=new Face('v',uWallW,-1),east=new Face('v',uWallE,1);
 const w=(s:number,y:number,width:number,h:number,lights=2,door=false):Opening=>({s,y,w:width,h,lights,door});
 const aS=[-12.55,-9.75,-6.83,-3.66,1.34,4.06,6.61,20.45,23.0];
 const aN=[-13.45,-10.505,-7.64,-3.43,-.42,2.67,5.67,20.35,23.23];
 const positions=(a:number[],door:number)=>a.map((s,i)=>Math.abs(s-door)<.01?w(s,3.345,1.45,2.625,2,true):w(s,4.25+(i>=7?.02:0),i===2?1.56:1.33,1.33,i===2?3:2));
 const yS=(u:number)=>longHeight(u,vWallS),yN=(u:number)=>longHeight(u,vWallN);
 skin(front,uWallW,uWallE,yN,positions(aN,-.42));skin(back,uWallW,uWallE,yS,positions(aS,1.34));
 skin(west,vWallS,vWallN,v=>longHeight(uWallW,v),[w(-.76,4.198,1.46,1.33,2),w(3.47,4.198,1.31,1.32,2),w(6.08,4.171,1.08,1.35,2)]);
 skin(east,vWallS,vWallN,v=>longHeight(xShoulder,v),[w(1.98,4.06,1.64,1.58,3),w(5.4,4.21,1.28,1.37,2)]);
 // Framed raised cross wing as separately surveyed mass, with authored date-aware Tudor decoration.
 const usableL=9.06,usableR=18.52;
 const yG=(u:number,v:number)=>min(gable,[u,v]);
 const gy=(u:number,v:number)=>Math.max(yG(u,v),longHeight(u,v));
 const section = (vv:number,sg:1|-1)=>{
  const f=new Face('u',vv,sg),h=(u:number)=>gy(u,vv);
  const glass=[w(11.18,4.24,1.24,1.42),w(13.71,3.40,1.58,2.54,2,true),w(16.41,4.31,1.29,1.31),
    w(11.90,8.23,1.17,.68),w(13.70,8.22,1.22,.76),w(15.53,8.22,1.15,.68)];
  skin(f,usableL,usableR,h,glass);
  const ridge=(P.crossEast[2]-P.crossWest[2]+(P.crossEast[1]-P.crossWest[1])*vv)/(P.crossWest[0]-P.crossEast[0]);
  for(const u of [9.48,10.27,11.25,12.52,13.68,14.86,16.02,17.29,18.14]){
   const y=h(u)-.22;
   if(y>9.22)f.extrude(bm.timber,rect(u-.061,u+.061,9.095,y),.071,.003);
   if(u>=10.25&&u<=17.5&&!glass.some(a=>a.y>8&&Math.abs(a.s-u)<a.w*.5+.091)&&y>8.42)f.extrude(bm.timber,rect(u-.049,u+.050,7.88,Math.min(9.18,y)),.067,.007);
  }
  for(const u of [9.32,17.97])if(h(u)>8.30)spoke(bm.timber,f,[u,7.89],[u+(u<13?1.65:-1.30),Math.min(10.27,h(u+(u<13?1.65:-1.30))-.20)],.115,.067,.005);
  f.extrude(bm.timber,rect(usableL+.025,usableR-.028,7.832,8.033),.077,.003);
  for(const [a,b]of [[usableL,ridge],[ridge,usableR]]as const)sideRim(f,a,b,h,.265);

 };
 section(vWallS-.548,-1);section(vWallN+.57,1);
 for(const [u,sg]of [[usableL,-1],[usableR,1]]as const){
  const f=new Face('v',u,sg);for(const [l,r]of [[vWallS-.548,vWallS],[vWallN,vWallN+.57]]as const)
   skin(f,l,r,v=>gy(u,v),[],base);
 }
 // Known short two-level east eaves. Hide the top wall line under the actual higher roof, no invented wrap hip.
 const ew=new Face('v',xShoulder,1),lo=-3.9,hi=8.11;const e1=stepwise(lo,hi,v=>capHeight(xShoulder,v)+.005),e2=stepwise(lo,hi,v=>shed(xShoulder,v)-.08);
 ew.draw(bm.stucco,[...e2,...e1.reverse()]);
 for(const [s,v,sg]of [['south',vMin,-1],['north',vMax,1]] as const){

  // Source-described angled knee brackets create the real eave depth.
  const near=sg===1?vWallN:vWallS;
  for(const [i,u] of [-14.55,-11.78,-8.90,-6.02,-3.11,-.27,2.61,5.58,8.0,19.46,21.88,24.37].entries()){
   const outer=fence(v,1,u,sg);
   const eave=longHeight(u,outer)-.145,wall=longHeight(u,near)-.195;
   const endV=outer-sg*.116,Tone=[.85+.035*(i%4),.86+.035*(i%4),.85+.04*(i%4)]as const;
   beam(bm.timber,[u,wall,near],[u,eave,endV],.165,.17,Tone);
   beam(bm.timber,[u,eave-1.067,near+sg*.107],[u,eave-.05,endV],.125,.137,Tone);
   beam(bm.timber,[u,eave-1.10,near+sg*.071],[u,wall+.056,near+sg*.071],.153,.102,Tone);
  }
 }
 for(const [u,near,sg]of [[xMin,uWallW,-1],[xFar,uWallE,1]] as const){
  for(const v of [-2.7,.98,4.45,7.56]){
   const edge=fence(u,0,v,sg);
   const e=(sg===1?shed(edge,v):longHeight(edge,v))-.141,h=(sg===1?shed(near,v):longHeight(near,v))-.155;
   beam(bm.timber,[near,h,v],[edge-sg*.13,e,v],.161,.159);
   beam(bm.timber,[near+sg*.032,e-.965,v],[edge-sg*.199,e,v],.126,.127);
  }
 }
 for(const d of dormers){
  const pf=dormRoof(d),f=new Face('u',d.edge,d.dir===1?1:-1);const low=longHeight(d.u,d.edge)-.09,high=d.z-.06;
  const gh=clamp(d.z-low-.66,.31,.545),c=w(d.u,low+.105,.66,gh);
  f.draw(bm.stucco,[[d.l,low],[d.r,low],[d.u,high]],.009,[rect(c.s-c.w*.5,c.s+c.w*.5,c.y,c.y+c.h)]);
  f.extrude(bm.timber,rect(d.l+.09,d.r-.089,low-.065,low+.046),.037,.002);
  window(f,c);
  for(const [l,r]of [[d.l,d.u],[d.u,d.r]]as const)sideRim(f,l,r,u=>min(pf,[u,d.edge]),.101);
  for(const [u,s]of [[d.l,-1],[d.r,1]]as const){
   const ff=new Face('v',u,s),h=(v:number)=>min(pf,[u,v]),g=(v:number)=>longHeight(u,v)-.015;
   const w=stepwise(d.b,d.t,g);
   for(let i=1;i<w.length;i++){
    let [l,x]=w[i-1],[r,y]=w[i];let a=h(l),b=h(r);
    const d0=a-x,d1=b-y;
    if(d0<=0&&d1<=0)continue;
    if(d0<=0){const k=l+(r-l)*d0/(d0-d1);l=k;x=h(k);a=x+.002;}
    if(d1<=0){const k=l+(r-l)*Math.max(0,a-x)/(Math.max(0,a-x)-d1);r=k;y=h(k);b=y+.002;}
    if(r-l>.005)ff.draw(bm.flashing,[[l,x],[r,y],[r,b-.002],[l,a-.002]],.008);
   }
  }
 }
 for(const name of roles){const g=bm[name].geometry();if(!g)continue;const m=new T.Mesh(g,material(name,textured));m.name=name;m.castShadow=true;m.receiveShadow=true;G.add(m);}
 G.userData={roofPolygons:roof.length,sourceRole:'Detached epoch 2020 exterior roof; no game placement or implied modern premises.'};return G;
}
function clamp(x:number,a:number,b:number){return Math.min(b,Math.max(a,x));}

export function buildFlatControl(stockTop:number){
 const b=new Batch(),p=ownerOutline.map(([u,v]):UV=>[u,v]);
 b.poly(p.map(([u,v])=>[u,stockTop,v]),[0,1,0],{xy:p});
 const ccw=p.reduce((a,[x,y],i)=>a+x*p[(i+1)%p.length][1]-y*p[(i+1)%p.length][0],0)>0;
 for(let i=0;i<p.length;i++){const [u,v]=p[i],[a,z]=p[(i+1)%p.length],m=ccw?1:-1;b.poly([[u,base,v],[a,base,z],[a,stockTop,z],[u,stockTop,v]],[(z-v)*m,0,(u-a)*m]);}
 const m=new T.Mesh(b.geometry()!,new T.MeshStandardMaterial({color:0xa4a399,roughness:.91}));m.name='Prior exact owner plan and flat roof datum';return m;
}
