/** Original detached Main Street east massing; no placement or app runtime. */
import * as T from 'three';
import {NEIGHBOUR as R} from './nearby-recipe.ts';
type Point=readonly [number,number];
type Face = readonly [Point,Point,Point];
type Affine=readonly [number,number,number];
type PlaneRole=keyof typeof R.roofPlanes;
type Layer='bodyUpper'|'porch'|'rearLower'|'forwardRake';
type ColourRole='roofBrown'|'lowRoof'|'painted'|'fascia'|'glass';
const DATUM=R.pointDatum, plan=R.plan as readonly Point[];
const nv=R.anchor;
const c=(a:Affine,p:Point)=>a[0]+(p[0]-nv[0])*a[1]+(p[1]-nv[1])*a[2];
const sub=(a:Affine,b:Affine,j=0):Affine=>[a[0]-b[0]-j,a[1]-b[1],a[2]-b[2]];
const opp=(a:Affine):Affine=>[-a[0],-a[1],-a[2]];
const forward:Affine=[nv[1]-R.joinRoles.front[0],-R.joinRoles.front[1],1],rear:Affine=[nv[1]+.034*(nv[0]-11.1)-R.joinRoles.rear[0],-R.joinRoles.rear[1],1], lip:Affine=[nv[1]-R.joinRoles.forwardLip[0],-R.joinRoles.forwardLip[1],1];
const {mainFront:front, mainBack:back, faceSlopeWest:west,faceSlopeEast:east, porch, rearLean:lean}=R.roofPlanes;
const funcs={mainFront:front,mainBack:back,faceSlopeWest:west,faceSlopeEast:east,porch,rearLean:lean};
const pa=(a:Point,b:Point,t:number):Point=>[T.MathUtils.lerp(a[0],b[0],t),T.MathUtils.lerp(a[1],b[1],t)];
const absArea=(a:readonly Point[])=>Math.abs(a.reduce((s,p,i)=>s+p[0]*a[(i+1)%a.length][1]-p[1]*a[(i+1)%a.length][0],0))*.5;
function clip(poly:readonly Point[],f:Affine){
 if(poly.length<3)return [];
 const out:Point[]=[];
 let a=poly.at(-1)!,x=c(f,a);
 for(const p of poly){
  const y=c(f,p);
  if((x>=0)!==(y>=0)&&Math.abs(x-y)>1e-15)out.push(pa(a,p,x/(x-y)));
  if(y>=0)out.push(p);a=p;x=y;
 }
 return out.filter((p,i)=>i===0||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>1e-8);
}
function withCuts(P:readonly Point[],...f:Affine[]){return f.reduce((a,x)=>clip(a,x),[...P]);}
const h=(p:Point,role:PlaneRole)=>c(funcs[role],p);
const upper=(p:Point)=>Math.max(Math.min(c(front,p),c(back,p)),Math.min(c(west,p),c(east,p),c(back,p)));
const crown=(p:Point)=>c(forward,p)<0?c(porch,p):c(rear,p)>0?c(lean,p):upper(p);
const hasOver=(p:Point)=>c(forward,p)<=1e-7&&c(lip,p)>=-1e-7&&Math.min(c(west,p),c(east,p),c(back,p))>=c(front,p)+.23-1e-7;
const overAt=(p:Point)=>Math.min(c(west,p),c(east,p),c(back,p));
function oxz(p:Point,y:number):T.Vector3{return new T.Vector3(p[0],y-DATUM,-p[1]);}
type B={P:number[];C:number[];uv:number[]};
type RoofPatch={layer:Layer;plane:PlaneRole;poly:Point[]};
const roles:readonly ColourRole[]=['roofBrown','lowRoof','painted','fascia','glass'];
export const NEIGHBOUR_VISUALS={
 roofBrown:{rgb:[89,76,69] as const,rough:.88,metal:0},
 lowRoof:{rgb:[112,98,88] as const,rough:.94,metal:0},
 painted:{rgb:[198,196,183] as const,rough:.83,metal:0},
 fascia:{rgb:[198,195,180] as const,rough:.75,metal:0},
 glass:{rgb:[59,64,62] as const,rough:.37,metal:.10}
};
const newB=():B=>({P:[],C:[],uv:[]});
const ownRecord=<K extends string,V>(keys:readonly K[],make:(k:K)=>V):Record<K,V>=>{
 const result=Object.create(null) as Record<K,V>;
 for(const key of keys)result[key]=make(key);return result;
};
function triangle(b:B,x:T.Vector3,y:T.Vector3,z:T.Vector3,n:T.Vector3,shade=1,wallUV?:T.Vector3){
 const N=y.clone().sub(x).cross(z.clone().sub(x));
 if(N.lengthSq()<1e-16)return;
 if(N.dot(n)<0)[y,z]=[z,y];N.normalize();
 for(const a of [x,y,z]){b.P.push(a.x,a.y,a.z);
  const t=shade*(1+.007*Math.sin(a.x*.791+a.y*.074+a.z*.623));b.C.push(t,t,t);
  if(wallUV){b.uv.push(a.dot(wallUV),a.y+DATUM);}else if(Math.abs(N.y)>.48){b.uv.push(a.x,-a.z);}else if(Math.abs(N.z)>.48){b.uv.push(a.x,a.y+DATUM);}else{b.uv.push(-a.z,a.y+DATUM);}
 }
}
function panel(b:B,a:Point,z:Point,l0:number,l1:number,z0:number,z1:number,n:T.Vector3,shade=1){
 if(Math.max(z0-l0,z1-l1)<=1e-9||Math.hypot(a[0]-z[0],a[1]-z[1])<1e-8)return;
 const p=oxz(a,l0),q=oxz(z,l1),r=oxz(z,z1),s=oxz(a,z0);
 const uv=q.clone().sub(p);uv.y=0;uv.normalize();
 triangle(b,p,q,r,n,shade,uv);triangle(b,p,r,s,n,shade,uv);
}
const boundaryRules=[forward,rear,lip,sub(front,back),sub(west,east),sub(west,front),sub(east,front),sub(west,back),sub(east,back),sub(west,front,.23),sub(east,front,.23),sub(back,front,.23)];
const allBreaks=(a:Point,b:Point,rules:readonly Affine[]=boundaryRules)=>{
 const marks=[0,1];for(const rule of rules){const x=c(rule,a),y=c(rule,b);if((x>0)!==(y>0)&&Math.abs(x-y)>1e-11)marks.push(x/(x-y));}
 return marks.sort((a,b)=>a-b).filter((m,i,z)=>i===0||m-z[i-1]>1e-7);
};
function planePoints(a:readonly Point[],f:Affine):Point[]{
 const crossings:Point[]=[];
 for(const [i,p]of a.entries()){const q=a[(i+1)%a.length],u=c(f,p),v=c(f,q);
  if(Math.abs(u)<1e-8)crossings.push(p);
  else if((u>=0)!==(v>=0))crossings.push(pa(p,q,u/(u-v)));
 }
 return crossings.sort((a,b)=>a[0]-b[0]).filter((p,i)=>i===0||Math.hypot(p[0]-crossings[i-1][0],p[1]-crossings[i-1][1])>1e-7);
}
export function registeredRoofPatches():RoofPatch[]{
 const seed=T.ShapeUtils.triangulateShape(plan.map(p=>new T.Vector2(...p)),[]).map(ids=>ids.map(i=>plan[i]) as unknown as Face);
 const out:RoofPatch[]=[];
 const add=(layer:Layer,plane:PlaneRole,poly:Point[])=>{
  if(poly.length>=3&&absArea(poly)>1e-8)out.push({layer,plane,poly});
 };
 for(const B of seed){
   const P=withCuts(B,opp(forward)),D=withCuts(B,forward,opp(rear));
   const R0=withCuts(B,forward,rear);
   add('porch','porch',P);add('rearLower','rearLean',R0);
   add('bodyUpper','mainBack',withCuts(D,sub(front,back)));
   const frontRegion=withCuts(D,sub(back,front));
   for(const z of ['faceSlopeWest','faceSlopeEast'] as const){
    const g=funcs[z],other=z==='faceSlopeWest'?east:west;
    const G=withCuts(frontRegion,sub(other,g));
    add('bodyUpper','mainFront',withCuts(G,sub(front,g)));
    add('bodyUpper',z,withCuts(G,sub(g,front),sub(back,g)));
    add('bodyUpper','mainBack',withCuts(G,sub(g,front),sub(g,back)));
    const W0=withCuts(P,lip,sub(other,g),sub(g,front,.23),sub(back,front,.23));
    add('forwardRake',z,withCuts(W0,sub(back,g)));
    add('forwardRake','mainBack',withCuts(W0,sub(g,back)));
   }
 }
 return out;
}
function tintData(role:ColourRole){
 if(role==='glass'||role==='fascia')return undefined;
 const d=64,b=new Uint8Array(d*d*4);
 for(let y=0;y<d;y++)for(let x=0;x<d;x++){
  const run=x/d,rise=y/d;
  const board=role==='painted';
  const i=(y*d+x)*4;
  let k:number;
  if(board){
    // Lap lies only along world-height V. Fine weathering stays diffuse:
    // no coherent X–Y stripes, sinusoidal fibre or high-contrast grooves.
    // Soft shoulders survive trilinear minification without painting a
    // diagonal grain pattern across the 2024-visible weatherboards.
    const v=rise*8.,row=Math.floor(v),r=v-row;
    const lap=-.035*Math.exp(-(((r-.93)/.097)**2))+.011*Math.exp(-(((r-.73)/.18)**2));
    const soften=(f:number)=>f*f*(3.-2.*f);
    const rnd=(ix:number,iy:number)=>((Math.imul(ix+1,0x045d9f3b)^Math.imul(iy+1,0x27d4eb2d))>>>24)/255.;
    const xx=run*4.,yy=rise*4.,ix=Math.floor(xx),iy=Math.floor(yy),ux=soften(xx-ix),uy=soften(yy-iy);
    const n=T.MathUtils.lerp(T.MathUtils.lerp(rnd(ix%4,iy%4),rnd((ix+1)%4,iy%4),ux),T.MathUtils.lerp(rnd(ix%4,(iy+1)%4),rnd((ix+1)%4,(iy+1)%4),ux),uy)-.5;
    const tone=(rnd(2,row)-.5)*.012;
    k=.858+lap+n*.016+tone;
  }else{
    const stripes=Math.sin(2*Math.PI*6*rise);
    const grain=.018*Math.cos(2*Math.PI*(run*19+rise*23))+.014*Math.sin(2*Math.PI*(rise*7+run*31))+.026*Math.sin(2*Math.PI*(run*4.0+rise*2.0));
    const notch=-.057*Math.pow(Math.max(0,-stripes),17);
    const tabs=-.040*Math.pow(Math.max(0,Math.sin(2*Math.PI*(run*8.0+.5*(Math.floor(rise*6)%2)))),22);
    k=.86+grain+notch+tabs;
  }
  b.set([Math.round(255*k),Math.round(255*k),Math.round(255*k),255],i);
 }
 const tex=new T.DataTexture(b,d,d);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(role==='painted'?.68:.71,role==='painted'?1.45:1.1);tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
 return tex;
}
function surfaceMaterial(k:ColourRole,textured=true){
 const p=NEIGHBOUR_VISUALS[k],rgba=p.rgb.map(a=>a/255);
 const m=new T.MeshPhysicalMaterial({color:new T.Color().setRGB(rgba[0],rgba[1],rgba[2],T.SRGBColorSpace),roughness:p.rough,metalness:p.metal,vertexColors:true});
 if(k==='glass'){m.clearcoat=.32;m.clearcoatRoughness=.30;m.envMapIntensity=.65;}
 if(textured){const tex=tintData(k);if(tex)m.map=tex;}
 return m;
}
function geo(b:B){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(b.P,3));g.setAttribute('color',new T.Float32BufferAttribute(b.C,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
const addMesh=(out:T.Group,b:B,name:string,mat:T.Material)=>{
 if(!b.P.length)return;
 const mesh=new T.Mesh(geo(b),mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;out.add(mesh);
};
const targetInside = (a:Point,b:Point)=>new T.Vector3(b[1]-a[1],0,b[0]-a[0]).normalize();
// Front glazing only, a low band of sheltered light from the two dated
// perspectives. Nominal band divisions, not a tenancy/door/access model.
function paintPorchFace(a:Point,p:Point,feet:[number,number],Y:[number,number],b:Record<ColourRole,B>){
 const n=targetInside(a,p).negate(), f=(t:number)=>pa(a,p,t),len=Math.hypot(p[0]-a[0],p[1]-a[1]);
 const ground=(t:number)=>T.MathUtils.lerp(feet[0],feet[1],t),top=(t:number)=>T.MathUtils.lerp(Y[0],Y[1],t);
 const lb=.18,rb=.84,lo=14.60,hi=16.25;
 const flat=(t:number,d:number)=>{const P=f(t);return [P[0]-n.x*d,P[1]+n.z*d] as Point;};
 panel(b.painted,a,p,feet[0],feet[1],lo,lo,n,.97);
 panel(b.painted,a,p,hi,hi,Y[0]-.12,Y[1]-.12,n,.95);
 panel(b.fascia,a,p,Y[0]-.12,Y[1]-.12,Y[0],Y[1],n,.91);
 const along=[0,.12,lb,.285,.426,.484,.545,.695,.774,rb,.95,1];
 for(let i=0;i<along.length-1;i++){
  const j=along[i], k=along[i+1], glass=(i>=2&&i<=3)||(i>=6&&i<=8);
  if(!glass){panel(b.painted,f(j),f(k),lo,lo,hi,hi,n,.96);continue;}
  const m= Math.min((k-j)*.21,.045/len),l=j+m,r=k-m;
  const w=.11;
  panel(b.fascia,f(j),f(l),lo,lo,hi,hi,n,.95);
  panel(b.fascia,f(r),f(k),lo,lo,hi,hi,n,.95);
  panel(b.fascia,f(l),f(r),lo,lo,lo+.11,lo+.11,n,.95);
  panel(b.fascia,f(l),f(r),hi-.115,hi-.115,hi,hi,n,.95);
  panel(b.glass,flat(l-.001,w),flat(r+.001,w),lo+.104,lo+.104,hi-.11,hi-.11,n,.94);
  const P0=oxz(f(l),lo+.11),P1=oxz(flat(l,w+.001),lo+.11),P2=oxz(flat(l,w+.001),hi-.115),P3=oxz(f(l),hi-.115);
  const Q0=oxz(f(r),lo+.11),Q1=oxz(flat(r,w+.001),lo+.11),Q2=oxz(flat(r,w+.001),hi-.115),Q3=oxz(f(r),hi-.115);
  const t=Q0.clone().sub(P0).normalize(), down=new T.Vector3(0,-1,0),up=new T.Vector3(0,1,0);
  triangle(b.fascia,P0,P1,P2,t,.75);triangle(b.fascia,P0,P2,P3,t,.75);
  triangle(b.fascia,Q0,Q1,Q2,t.clone().negate(),.75);triangle(b.fascia,Q0,Q2,Q3,t.clone().negate(),.75);
  triangle(b.fascia,P0,P1,Q1,up,.81);triangle(b.fascia,P0,Q1,Q0,up,.81);
  triangle(b.fascia,P3,P2,Q2,down,.75);triangle(b.fascia,P3,Q2,Q3,down,.75);
 }
}
// Archive visibly gives a centered pair in the gable. Apertures are
// protected cuts with simple muntins; positions/dimensions remain nominal.
const attic= [
 {a:13.42,b:14.015,lo:18.965,hi:20.395},
 {a:14.065,b:14.660,lo:18.965,hi:20.395},
] as const;
function smallRecess(a:Point,b:Point,lo:number,hi:number,n:T.Vector3,buf:Record<ColourRole,B>){
 const depth=.092, w=.078, y=lo+w, Y=hi-w, A=pa(a,b,.095),B=pa(a,b,.905);
 const push=(a:Point,k=depth):Point=>[a[0]-n.x*k,a[1]+n.z*k];
 panel(buf.fascia,a,A,lo,lo,hi,hi,n,.97);panel(buf.fascia,B,b,lo,lo,hi,hi,n,.97);
 panel(buf.fascia,A,B,lo,lo,y,y,n,.97);panel(buf.fascia,A,B,Y,Y,hi,hi,n,.97);
 const z=push(A,depth+.001),q=push(B,depth+.001);
 panel(buf.glass,z,q,y-.002,y-.002,Y+.002,Y+.002,n,.90);
 const tangent=oxz(B,y).sub(oxz(A,y)).normalize(),up=new T.Vector3(0,1,0);
 const liner=(a:Point,b:Point,Y:number,n:T.Vector3,sign:number)=>{
  const p=oxz(a,Y),q=oxz(b,Y),r=oxz(push(b,depth+.003),Y),s=oxz(push(a,depth+.003),Y);
  triangle(buf.fascia,p,q,r,n,sign);triangle(buf.fascia,p,r,s,n,sign);
 };
 panel(buf.fascia,A,z,y,y,Y,Y,tangent,.83);panel(buf.fascia,B,q,y,y,Y,Y,tangent.clone().negate(),.80);
 liner(A,B,y,up,.88);liner(A,B,Y,up.clone().negate(),.77);
}
export type SourisEastFront='none'|'observed-2024';
export function buildDetachedSourisEastNeighbour(
 {textured=true,frontTreatment,archivalGlazing}:{textured?:boolean;frontTreatment?:SourisEastFront;archivalGlazing?:boolean}={},
){
 const showFront=(frontTreatment??(archivalGlazing===false?'none':'observed-2024'))==='observed-2024';
 const out=new T.Group(), P=registeredRoofPatches();
 const mats=ownRecord(roles,n=>surfaceMaterial(n,textured));
 const roofs=ownRecord(['bodyUpper','porch','rearLower','forwardRake'] as const,newB);
 const b=ownRecord(roles,newB);
 const up=new T.Vector3(0,1,0),dn=new T.Vector3(0,-1,0);
 for(const {layer,plane,poly}of P){
  const q=poly.map(p=>oxz(p,h(p,plane)));
  for(let i=1;i<q.length-1;i++)triangle(roofs[layer],q[0],q[i],q[i+1],up,plane==='mainBack'?.982:1);
  if(layer==='forwardRake'){
   const r=poly.map(p=>oxz(p,h(p,plane)-.112));
   for(let i=1;i<r.length-1;i++)triangle(b.fascia,r[0],r[i],r[i+1],dn,.82);
  }
 }
 for(const [i,a]of plan.entries()){
   const p=plan[(i+1)%plan.length], y0=R.wallFeet[i],y1=R.wallFeet[(i+1)%plan.length];
   const n=targetInside(a,p).negate();
   if(i===4&&showFront){paintPorchFace(a,p,[y0,y1],[c(porch,a),c(porch,p)],b);continue;}
   const stops=allBreaks(a,p);
   for(let j=0;j<stops.length-1;j++){
    const u=stops[j],v=stops[j+1],m=pa(a,p,(u+v)*.5);
    const y= c(forward,m)<0?(p0:Point)=>c(porch,p0):c(rear,m)>0?(p0:Point)=>c(lean,p0):upper;
    const x=pa(a,p,u),z=pa(a,p,v),t0=y(x),t1=y(z);
    const shade=.928+.011*(i%3);
    panel(b.painted,x,z,T.MathUtils.lerp(y0,y1,u),T.MathUtils.lerp(y0,y1,v),t0-.143,t1-.143,n,shade);
    panel(b.fascia,x,z,t0-.143,t1-.143,t0,t1,n,.945);
   }
 }
 // Opaque continuous steps at the two separated cover bands. Rake overhang
 // remains a thin soffit, so the return geometry beneath it isn't plugged.
 for(const [cut,near,isOver]of [[forward,porch,false],[rear,lean,false],[lip,porch,true]] as const){
  const sec=planePoints(plan,cut);
  for(let i=0;i+1<sec.length;i+=2){
   const a=sec[i],z=sec[i+1],ss=allBreaks(a,z);
   const gableFront=cut===forward&&showFront;
   const windowStops=gableFront?attic.filter(s=>s.a>a[0]+.01&&s.b<z[0]-.01):[];
   for(const slot of windowStops)for(const q of [slot.a,slot.b])ss.push((q-a[0])/(z[0]-a[0]));
   ss.sort((u,v)=>u-v);
   const normal = new T.Vector3(-cut[1],0,cut[2]).normalize();
   if(cut===rear)normal.negate();
   for(const slot of windowStops){
    const p=pa(a,z,(slot.a-a[0])/(z[0]-a[0])),q=pa(a,z,(slot.b-a[0])/(z[0]-a[0]));
    if(slot.hi>=Math.min(upper(p),upper(q))-.17||slot.lo<=Math.max(c(porch,p),c(porch,q))+.17)throw Error('Unmeasured window beyond gable reserve');
    smallRecess(p,q,slot.lo,slot.hi,normal,b);
   }
   for(let i=0;i+1<ss.length;i++){
    const p=pa(a,z,ss[i]),q=pa(a,z,ss[i+1]),m=pa(p,q,.5);
    if(isOver){
     if(!hasOver(m))continue;
     panel(b.fascia,p,q,overAt(p)-.112,overAt(q)-.112,overAt(p),overAt(q),normal,.90);
    }else{
     const Y=upper(p),H=upper(q);
     const lower0=c(near,p),lower1=c(near,q);
     const slot=windowStops.find(s=>m[0]>s.a&&m[0]<s.b);
     if(slot){
      panel(b.painted,p,q,Math.min(lower0,Y),Math.min(lower1,H),slot.lo,slot.lo,normal,.91);
      panel(b.painted,p,q,slot.hi,slot.hi,Math.max(lower0,Y),Math.max(lower1,H),normal,.91);
     }else panel(b.painted,p,q,Math.min(lower0,Y),Math.min(lower1,H),Math.max(lower0,Y),Math.max(lower1,H),normal,.91);
    }
   }
  }
 }
 // Seal the two short angled returns of the approximate rake overlap. The
 // original valley joins carry no separate opaque face in the main body.
 for(const p of P.filter(t=>t.layer==='forwardRake')){
  for(const [i,a]of p.poly.entries()){
   const z=p.poly[(i+1)%p.poly.length],m=pa(a,z,.5);
   if(Math.abs(c(forward,m))<1e-6||Math.abs(c(lip,m))<1e-6)continue;
   if(Math.abs(Math.min(c(west,m),c(east,m),c(back,m))-c(front,m)-.23)>.0001)continue;
   const e=([west,east,back] as const).find(r=>Math.abs(c(r,m)-overAt(m))<1e-7)!;
   const sk=sub(e,front,.23);
   const n=new T.Vector3(-sk[1],0,sk[2]).normalize();
   panel(b.fascia,a,z,overAt(a)-.112,overAt(z)-.112,overAt(a),overAt(z),n,.83);
  }
 }
 for(const [layer,d]of Object.entries(roofs))addMesh(out,d,layer,layer==='porch'||layer==='rearLower'?mats.lowRoof:mats.roofBrown);
 for(const key of ['painted','fascia','glass'] as const)addMesh(out,b[key],key,mats[key]);
 out.name='Detached east Main Street roof and exterior volume';
 out.userData={registeredOwner:R.owner,frontTreatment:showFront?'observed-2024':'none',approval:'detached photograph and registered rooftop massing only; nominal surface joins, no live data, no occupancy or current material claim'};
 return out;
}
export function expectedCeiling(u:number,v:number){
 const p:Point=[u,v],y=crown(p);
 return hasOver(p)?[overAt(p),y]:[y];
}
