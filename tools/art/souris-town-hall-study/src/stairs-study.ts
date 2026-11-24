/** Detached exterior appearance experiment; no gameplay, route or access data. */
import * as T from 'three';
import {DATUM,type P2,type P3} from './survey.ts';
export type StairRun=Readonly<{label:'west'|'east';center:number;width:number;base:number;ends:readonly number[];tops:readonly number[]}>;
const absolute=(u:number,y:number,v:number):P3=>[u,y-DATUM,-v];
type B={P:number[];C:number[];U:number[]};
const B0=():B=>({P:[],C:[],U:[]});const vector=(u:P3)=>new T.Vector3(u[0],u[1],u[2]);
function triangle(b:B,p:P3,q:P3,r:P3,n:P3,tone:number){
 const a=vector(q).sub(vector(p)).cross(vector(r).sub(vector(p)));if(a.lengthSq()<1e-15)return;
 if(a.dot(vector(n))<0)[q,r]=[r,q];a.normalize();
 const u=(v:P3):P2=>Math.abs(a.y)>.6?[v[0],-v[2]]:Math.abs(a.z)>.6?[v[0],v[1]]:[-v[2],v[1]];
 for(const x of [p,q,r]){b.P.push(...x);b.C.push(tone,tone,tone);b.U.push(...u(x));}
}
function quad(b:B,x:P3,y:P3,z:P3,v:P3,n:P3,tone=1){triangle(b,x,y,z,n,tone);triangle(b,x,z,v,n,tone);}
function skin(b:B,r:readonly P2[],x:number,positive:boolean,t=.93){
 const ix=T.ShapeUtils.triangulateShape(r.map(p=>new T.Vector2(...p)),[]),n:P3=[positive?1:-1,0,0];
 const c=(s:P2)=>absolute(x,s[1],s[0]);for(const [a,j,k]of ix)triangle(b,c(r[a]),c(r[j]),c(r[k]),n,t);
}
function volume(b:B,r:readonly P2[],lo:number,hi:number,tone=.92){
 skin(b,r,lo,false,tone*.94);skin(b,r,hi,true,tone*.96);
 const area=r.reduce((a,v,i)=>a+v[0]*r[(i+1)%r.length][1]-v[1]*r[(i+1)%r.length][0],0),s=Math.sign(area);
 for(const [i,a]of r.entries()){
  const p=r[(i+1)%r.length],d=p[0]-a[0],dy=p[1]-a[1];
  quad(b,absolute(lo,a[1],a[0]),absolute(hi,a[1],a[0]),absolute(hi,p[1],p[0]),absolute(lo,p[1],p[0]),[0,-d*s,-dy*s],tone);
 }
}
function cuboid(b:B,x0:number,x1:number,y0:number,y1:number,v0:number,v1:number,tone:number){
 volume(b,[[v0,y0],[v1,y0],[v1,y1],[v0,y1]],x0,x1,tone);
}
function rail(b:B,pts:readonly P2[],u:number,w:number,depth:number,tone:number){
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],q=pts[i];if(q[0]-a[0]<1e-5)continue;
  volume(b,[[a[0],a[1]-depth],[q[0],q[1]-depth],[q[0],q[1]],[a[0],a[1]]],u-w/2,u+w/2,tone);
 }
}
function mesh(name:string,geo:B,mat:T.Material){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(geo.P,3));g.setAttribute('color',new T.Float32BufferAttribute(geo.C,3));g.setAttribute('uv',new T.Float32BufferAttribute(geo.U,2));g.computeVertexNormals();g.computeBoundingSphere();
 const m=new T.Mesh(g,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;return m;
}
// Each run is a separate solid from the visible first riser to independent
// post-flight provisional landing. No center terrace and no reuse of source pixels.
export function buildDetachedEntrySteps(runs:readonly StairRun[],sharedStone:T.Material,includeIron=true){
 const treads=B0(),cheeks=B0(),iron=B0();
 for(const r of runs){
  if(r.ends.length!==r.tops.length+1||r.tops.some((y,i)=>!Number.isFinite(y)||i>0&&y<=r.tops[i-1]))throw Error('Invalid explicit study slots');
  const a=r.center-.5*r.width,z=r.center+.5*r.width,lo=r.ends[0],high=r.ends.at(-1)!,y0=r.base;
  const history:P2[]=[[lo,y0],[high,y0],[high,r.tops.at(-1)!]];
  for(let i=r.tops.length-1;i>=0;i--){
   history.push([r.ends[i],r.tops[i]]);if(i)history.push([r.ends[i],r.tops[i-1]]);
  }
  volume(treads,history,a+.105,z-.105,.97);
  const upper=r.tops.at(-1)!,start=r.tops[0]+.184,landing=r.ends.at(-2)!,outer=lo+.052;
  const plinth:readonly P2[]=[[lo,y0],[high,y0],[high,upper+.14],[landing+.05,upper+.14],[outer+.155,start+.055],[outer,start+.055],[lo,start-.024]];
  for(const x of [a+.055,z-.055]){
   volume(cheeks,plinth,x-.055,x+.055,.92);
   if(!includeIron)continue;
   const heel=landing+.035,landingEnd=high-.124,toe=lo+.226;
   const offset0=start+.075,height0=offset0+.566,height1=upper+.782;
   const railP:readonly P2[]=[[toe,height0],[heel,height1],[landingEnd,height1]];
   rail(iron,railP,x,.038,.046,1.0);
   const top=(v:number)=>v<heel?height0+(height1-height0)*(v-toe)/(heel-toe):height1;
   const outerLip:readonly P2[]=[[lo,start-.024],[outer,start+.055],[outer+.155,start+.055],
        [landing+.05,upper+.14],[high,upper+.14]];
   const cheek=(v:number)=>{
    for(let j=1;j<outerLip.length;j++)if(v<=outerLip[j][0]+1e-12){
     const a=outerLip[j-1],b=outerLip[j],t=Math.max(0,Math.min(1,(v-a[0])/(b[0]-a[0])));
     return a[1]+(b[1]-a[1])*t;
    }
    return upper+.14;
   };
   const risers=Math.max(5,Math.floor((heel-toe)/.218));
   for(let j=0;j<=risers;j++){
    const v=toe+(heel-toe)*j/risers,wide=j===0||j===risers||j===Math.floor(risers/2),w=wide?.023:.010;
    cuboid(iron,x-w,x+w,Math.min(cheek(v-w),cheek(v+w))-.016,top(v)-.029,v-w,v+w,wide?.99:.92);
   }
   cuboid(iron,x-.020,x+.02,Math.min(cheek(landingEnd-.019),cheek(landingEnd+.019))-.016,height1-.029,landingEnd-.019,landingEnd+.019,.97);
  }
 }
 const g=new T.Group();g.name='Two detached reconstructed entrance runs';
 // Same original freestone shader and microtexture are reused without a new map generation pass.
 const black=new T.MeshPhysicalMaterial({color:0x333132,metalness:.52,roughness:.62,vertexColors:true});
 g.add(mesh('stoneTreads',treads,sharedStone),mesh('stoneCheeks',cheeks,sharedStone));
 if(iron.P.length)g.add(mesh('surfaceRail',iron,black));else black.dispose();
 g.userData={detached:true,constructionClaim:false,clearanceOrAccessClaim:false,sourceRole:'both dated visible front flights, separately authenticated same-site dry N112 approach and aggregate 2020 rise; exact dimensions and hidden layout not claimed'};
 return g;
}
