/** Separate fictional dimensional assembly: no game mount or measured/current claim. */
import {
  BoxGeometry, BufferGeometry, Float32BufferAttribute, FrontSide, Group,
  Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
import {makeKensingtonBayStudy} from '../bay/bay-joinery.ts';
import fit from '../fit/fit-sealed.json';

type UV = readonly [number,number];
type P = readonly [number,number,number];
type Tag = 'main-roof'|'bay-roof'|'roof-soffit'|'shelter-SW'|'shelter-NE'|'stone-wall'|'support-SW'|'support-NE'|'neutral-inner'|'charcoal-gable'|'pale-timber'|'long-fascia';
type A={p:number[];n:number[];uv:number[]};
const tags:Tag[]=['main-roof','bay-roof','roof-soffit','shelter-SW','shelter-NE','stone-wall','support-SW','support-NE','neutral-inner','charcoal-gable','pale-timber','long-fascia'];
const epsilon=1e-9;
export const STUDIO = {
  eaveU:10.68, eaveV:.18, eaveBack:9.82, bodyU:10.33, bodyFront:2.78, bodyBack:9.48,
  bayFace:1.93, bayBodyHalf:2.88, bayRake:3.04, roofT:.135, bayLift:4.68,
  archScale:1.25, archPanelY:.13, archPanelHalf:2.75, archDepth:.475,
  shelters:[
    {role:'SW',outer:-16.75,inner:-10.30,lo:.31,hi:5.47,crestV:2.96,peak:6.73,eave:3.86,hipRun:2.32,pierU:-15.53},
    {role:'NE',outer:16.94,inner:10.30,lo:.33,hi:5.36,crestV:2.93,peak:6.61,eave:3.79,hipRun:2.40,pierU:15.70},
  ] as const,
} as const;
const S=STUDIO;
const [a,du,riseV,sl0,sl1]=fit.main.coefficients, D=fit.worldAdapter.localOriginY;
export const mainRidgeV = riseV;
export const mainHeight=(u:number,v:number)=>a-D+du*u+(v<=riseV?sl0*(v-riseV):-sl1*(v-riseV));
export const bayHeight=(u:number)=>mainHeight(u,S.eaveV)+S.bayLift*(1-Math.abs(u)/S.bayRake);
export const bayJunctionV=(u:number)=>S.eaveV+S.bayLift*(1-Math.abs(u)/S.bayRake)/sl0;
export const surfaceHeight=(u:number,v:number)=>Math.abs(u)<=S.bayRake&&v<=bayJunctionV(u)?bayHeight(u):mainHeight(u,v);
const p=(u:number,y:number,v:number):P=>[u,y,-v];
const vec=(p:P)=>new Vector3(...p);
const cv=(a:P,b:P)=>vec(a).sub(vec(b));
const xyEqual=(a:UV,b:UV)=>Math.hypot(a[0]-b[0],a[1]-b[1])<epsilon;
const xyzEqual=(a:P,b:P)=>Math.hypot(...a.map((v,i)=>v-b[i]))<epsilon;
const data=()=>Object.fromEntries(tags.map(k=>[k,{p:[],n:[],uv:[]}])) as unknown as Record<Tag,A>;
function prep(){
 const source=data();
 function face(tag:Tag,points:P[],normal:P,uv:(v:P)=>UV=(v)=>[v[0],v[1]]){
  const P:P[]=[];
  for(const q of points)if(!P.length||!xyzEqual(P.at(-1)!,q))P.push(q);
  if(P.length>2&&xyzEqual(P[0],P.at(-1)!))P.pop();
  for(let i=1;i<P.length-1;i++){
   let m=[P[0],P[i],P[i+1]];
   const n=cv(m[1],m[0]).cross(cv(m[2],m[0]));
   if(n.lengthSq()<1e-15) continue; // explicit joins can end at an exact zero-length patch
   if(n.dot(vec(normal))<0){m=[m[0],m[2],m[1]];n.negate();}
   n.normalize();
   for(const v of m){source[tag].p.push(...v);source[tag].n.push(n.x,n.y,n.z);source[tag].uv.push(...uv(v));}
  }
 }
 function appendGeometry(tag:Tag,b:BufferGeometry){
  const q=b.index?b.toNonIndexed():b;
  const pos=q.getAttribute('position'), nor=q.getAttribute('normal');
  const paint=tag==='support-SW'||tag==='support-NE';
  for(let k=0;k<pos.count;k++){source[tag].p.push(pos.getX(k),pos.getY(k),pos.getZ(k));
   source[tag].n.push(nor.getX(k),nor.getY(k),nor.getZ(k));
   source[tag].uv.push(paint?pos.getX(k)+pos.getZ(k):0,paint?pos.getY(k):0);}
  if(q!==b)q.dispose();b.dispose();
 }
 function rod(tag:Tag,p0:P,p1:P,width:number,depth:number){
  const d=vec(p1).sub(vec(p0)), mid=vec(p1).add(vec(p0)).multiplyScalar(.5);
  if(d.length()<.01)throw Error('bad post or brace');
  const g=new BoxGeometry(width,d.length(),depth);
  const rotation=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.normalize());
  g.applyMatrix4(new Matrix4().compose(mid,rotation,new Vector3(1,1,1)));
  appendGeometry(tag,g);
 }
 const fullU=[-S.eaveU,-S.bayRake,0,S.bayRake,S.eaveU];
 type Patch={tag:'main-roof'|'bay-roof';uv:UV[]};
 const patches:Patch[]=[];
 const newPatch=(tag:Patch['tag'],uv:UV[])=>patches.push({tag,uv});
 for(let i=0;i+1<fullU.length;i++){
  const [l,h]=[fullU[i],fullU[i+1]],q=i===1||i===2;
  const [lo,hi]=q?[bayJunctionV(l),bayJunctionV(h)]:[S.eaveV,S.eaveV];
  newPatch('main-roof',[[l,lo],[h,hi],[h,riseV],[l,riseV]]);
  newPatch('main-roof',[[l,riseV],[h,riseV],[h,S.eaveBack],[l,S.eaveBack]]);
  if(q)newPatch('bay-roof',[[l,S.eaveV],[h,S.eaveV],[h,hi],[l,lo]]);
 }
 const crown=(c:UV,y=0)=>p(c[0],surfaceHeight(...c)+y,c[1]);
 for(const {tag,uv} of patches){
  face(tag,uv.map(e=>crown(e)),[0,1,0]);
  face('roof-soffit',uv.map(e=>crown(e,-S.roofT)),[0,-1,0]);
 }
 const fas=(a:UV,b:UV,n:P)=>face('long-fascia',[crown(a),crown(b),crown(b,-S.roofT),crown(a,-S.roofT)],n);
 for(let i=0;i+1<fullU.length;i++){
  fas([fullU[i],S.eaveV],[fullU[i+1],S.eaveV],[0,0,1]);
  fas([fullU[i],S.eaveBack],[fullU[i+1],S.eaveBack],[0,0,-1]);
 }
 for(const u of [-S.eaveU,S.eaveU]) for(const [b,c] of [[S.eaveV,riseV],[riseV,S.eaveBack]])fas([u,b],[u,c],[Math.sign(u),0,0]);

 // A stepped footprint forms a visibly projecting stone room, not a facade decal.
 const b=S.bayBodyHalf,u=S.bodyU, v0=S.bodyFront,vb=S.bayFace,v1=S.bodyBack;
 const archS=S.archScale,L=S.archPanelY,H=L+3.18*archS,archY=L-.08*archS,h=S.archPanelHalf;
 const crossU=(v:number)=>S.bayRake*(1-(v-S.eaveV)*sl0/S.bayLift);
 type Edge={from:UV;to:UV;d:P;bay?:true};
 const exterior:Edge[]=[];
 const segment=(data:readonly UV[],d:P,bay?:true)=>{
  for(let i=0;i+1<data.length;i++)exterior.push({from:data[i],to:data[i+1],d,bay});
 };
 const k=crossU(vb);
 segment([[-u,v0],[-b,v0]],[0,0,1]);
 segment([[-b,v0],[-b,vb]],[-1,0,0]);
 segment([[-b,vb],[-h,vb],[-k,vb],[0,vb],[k,vb],[h,vb],[b,vb]],[0,0,1],true);
 segment([[b,vb],[b,v0]],[1,0,0]);
 segment([[b,v0],[u,v0]],[0,0,1]);
 segment([[u,v0],[u,riseV],[u,v1]],[1,0,0]);
 segment([[u,v1],[0,v1],[-u,v1]],[0,0,-1]);
 segment([[-u,v1],[-u,riseV],[-u,v0]],[-1,0,0]);
 // Node all cap and wall boundaries against each other to close panel
 // slots and along-ridge transitions at exact Float32 edges, without altering
 // the finished roof shell or adding a visible arch/surface treatment.
 type Cut=[number,number,number];
 function clip(poly:UV[],cut:Cut){
  const val=(p:UV)=>p[0]*cut[0]+p[1]*cut[1]+cut[2];
  const out:UV[]=[];
  const add=(p:UV)=>{if(!out.length||!xyEqual(p,out.at(-1)!))out.push(p);};
  for(let i=0;i<poly.length;i++){
   const p=poly[i],q=poly[(i+1)%poly.length],d=val(p),e=val(q);
   if(d>=-epsilon)add(p);
   if(d*e<0&&Math.abs(d)>epsilon&&Math.abs(e)>epsilon){const t=d/(d-e);add([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }
  if(out.length>1&&xyEqual(out[0],out.at(-1)!))out.pop();
  return out;
 }
 const topPatches:UV[][]=[];
 for(const {uv} of patches)for(const [hh,vv0,vv1] of [[u,S.bodyFront,S.bodyBack],[b,S.bayFace,S.bodyFront]]){
  const top=([[1,0,hh],[-1,0,hh],[0,1,-vv0],[0,-1,vv1]] as Cut[]).reduce(clip,uv);
  if(top.length>=3)topPatches.push(top);
 }
 const possible=topPatches.flat().concat(exterior.map(x=>x.from));
 function atSplit(a:UV,b:UV){
  const d=[b[0]-a[0],b[1]-a[1]],ss=d[0]*d[0]+d[1]*d[1];
  const all=possible.map(p=>({p,t:((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/ss,
    off:Math.abs((p[1]-a[1])*d[0]-(p[0]-a[0])*d[1])/Math.sqrt(ss)}))
    .filter(q=>q.t>1e-9&&q.t<1-1e-9&&q.off<2e-9).sort((a,b)=>a.t-b.t);
  const pts=[a];
  for(const {p} of all)if(!xyEqual(p,pts.at(-1)!))pts.push(p);
  pts.push(b);return pts;
 }
 for(const poly of topPatches){
  const rim=poly.flatMap((a,i)=>atSplit(a,poly[(i+1)%poly.length]).slice(0,-1));
  const center:UV=[poly.reduce((s,p)=>s+p[0],0)/poly.length,poly.reduce((s,p)=>s+p[1],0)/poly.length];
  for(let i=0;i<rim.length;i++)face('neutral-inner',[crown(center,-S.roofT),crown(rim[i],-S.roofT),crown(rim[(i+1)%rim.length],-S.roofT)],[0,1,0]);
 }
 const weldedEdges=exterior.flatMap(e=>{
  const p=atSplit(e.from,e.to);return p.slice(0,-1).map((from,i)=>({...e,from,to:p[i+1]}));
 });
 const st=(e:Edge)=>(q:P):UV=>e.bay?[q[0]/archS,(q[1]-archY)/archS]:[Math.abs(e.d[0])>.5?e.d[0]*q[2]:e.d[2]*q[0],q[1]];
 for(const e of weldedEdges){
  const at=e.from,to=e.to, open=e.bay&&at[0]>=-h-epsilon&&to[0]<=h+epsilon;
  const t0=surfaceHeight(...at)-S.roofT,t1=surfaceHeight(...to)-S.roofT;
  const A=(y:number)=>p(at[0],y,at[1]),B=(y:number)=>p(to[0],y,to[1]);
  const levels=[[0,0],[L,L],[H,H],[t0,t1]];
  for(let i=0;i<3;i++){
   if(i===1&&open) continue;
   face('stone-wall',[A(levels[i][0]),B(levels[i][1]),B(levels[i+1][1]),A(levels[i+1][0])],e.d,st(e));
  }
  face('neutral-inner',[p(0,0,5),A(0),B(0)],[0,-1,0]);
  if(open){
   const front=(u:number,y:number)=>p(u,y,vb), back=(u:number,y:number)=>p(u,y,vb+S.archDepth);
   const l=at[0],r=to[0];
   face('neutral-inner',[back(l,L),back(r,L),back(r,H),back(l,H)],[0,0,1]);
   face('neutral-inner',[front(l,L),front(r,L),back(r,L),back(l,L)],[0,1,0]);
   face('neutral-inner',[front(l,H),front(r,H),back(r,H),back(l,H)],[0,-1,0]);
   if(Math.abs(l+h)<epsilon)face('neutral-inner',[front(l,L),back(l,L),back(l,H),front(l,H)],[1,0,0]);
   if(Math.abs(r-h)<epsilon)face('neutral-inner',[front(r,L),back(r,L),back(r,H),front(r,H)],[-1,0,0]);
  }
 }

 // Generic timber relief in the projection; all geometry original and not a
 // measured pattern. Pediment cap rests behind the opaque forward fascia.
 const gv=S.eaveV+.064,low=(u:number)=>mainHeight(u,S.eaveV)+.012,high=(u:number)=>bayHeight(u)-S.roofT-.018;
 const gU=S.bayRake-.135;
 face('charcoal-gable',[p(-gU,low(-gU),gv),p(gU,low(gU),gv),p(gU,high(gU),gv),
     p(0,high(0),gv),p(-gU,high(-gU),gv)],[0,0,1]);
 const timber=(a:UV,b:UV,w=.112)=>rod('pale-timber',p(a[0],a[1],gv-.055),p(b[0],b[1],gv-.055),w,.112);
 const frame=2.78, beam=low(0)+.092;
 timber([-frame,beam],[frame,beam-.013],.125);
 timber([-frame,high(-frame)-.035],[0,high(0)-.108],.128);
 timber([0,high(0)-.108],[frame,high(frame)-.035],.128);
 timber([0,beam+.02],[0,high(0)-.136],.110);
 for(const n of [-1,1]){
  timber([n*2.12,beam+.06],[n*.23,beam+2.87],.109);
  timber([n*1.17,beam+.055],[n*.08,beam+1.72],.103);
 }

 for(const s of S.shelters){
  const {role,outer:o,inner:i,lo,hi,peak,eave,crestV:c,hipRun, pierU}=s;
  const sign=Math.sign(i-o), t=o+sign*hipRun;
  const ep=(u:number,v:number)=>p(u,eave,v), rp=(u:number)=>p(u,peak,c);
  const shell:Tag=role==='SW'?'shelter-SW':'shelter-NE';
  const roof=(p0:P[])=>{
   face(shell,p0,[0,1,0]);
   face(shell,p0.map(([u,y,z]):P=>[u,y-S.roofT,z]),[0,-1,0]);
  };
  const A=ep(o,lo),B=ep(i,lo),C=ep(i,hi),E=ep(o,hi),J=rp(t),I=rp(i);
  roof([A,B,I,J]); roof([J,I,C,E]); roof([A,J,E]);
  const cap=(a:P,b:P,dir:P)=>face(shell,[a,b,[b[0],b[1]-S.roofT,b[2]],[a[0],a[1]-S.roofT,a[2]]],dir,()=>[0,0]);
  cap(A,B,[0,0,1]);cap(C,E,[0,0,-1]);cap(E,A,[-sign,0,0]);
  cap(B,I,[sign,0,0]);cap(I,C,[sign,0,0]);
  const topAt=(u:number,v:number)=>Math.min(
   eave+(peak-eave)*Math.min(1,(u-o)*sign/hipRun),
   v<=c?eave+(peak-eave)*(v-lo)/(c-lo):eave+(peak-eave)*(hi-v)/(hi-c)
  )-S.roofT;
  const r=.215, R=.162;
  const ep0=(x:number,z:number)=>p(pierU+x,0,c+z), ep1=(x:number,z:number)=>p(pierU+x,topAt(pierU+x,c+z)+.004,c+z);
  const q0=[ep0(-r,-r),ep0(r,-r),ep0(r,r),ep0(-r,r)],q1=[ep1(-R,-R),ep1(R,-R),ep1(R,R),ep1(-R,R)];
  const mat:Tag=role==='SW'?'support-SW':'support-NE';
  face(mat,q0,[0,-1,0]);
  face(mat,q1,[0,1,0]);
  for(let k=0;k<4;k++){const j=(k+1)%4,N=[[0,0,1],[1,0,0],[0,0,-1],[-1,0,0]] as P[]; face(mat,[q0[k],q0[j],q1[j],q1[k]],N[k],p=>[Math.abs(N[k][0])>.5?p[2]:p[0],p[1]]);}
  // Local inward diagonal seen only under each shelter; top nodes enter the
  // generic roof slightly but not its visible upper face.
  for(const d of [-1,1]){
   const x=pierU+d*.45, z=c-.04;
   rod('pale-timber',p(pierU,topAt(pierU,c)-.55,c),p(x,topAt(x,z)+.009,z),.080,.089);
  }
 }
 return {source,archShift:p(0,archY,S.bayFace+.307*archS)};
}

export const silhouetteFacts = Object.freeze({
  use:'independent approximate historical appearance classes only; no surveyed/current/in-game claim',
  newGeometryNeverMounted:'isolated art on artificial stage, not a second owner or release path',
  evidenceHolds:['SW crown profile','both true central bay planes and placement','NE roof-end facet and supports','all roof product','all field grade and feet'],
  archiveBytesRetained:true, completeOldTownUnmodified:true,
});
const mat=(name:string,color:number,roughness=.92)=>new MeshStandardMaterial({name,color,roughness,metalness:0,side:FrontSide});
export function createKensingtonApproximateSilhouette(){
 const owner=new Group();owner.name='Approximate Kensington architectural study - do not mount';owner.visible=false;
 const art=new Group();art.name='Hypothetical 2025 silhouette in synthetic metres';
 const arch=makeKensingtonBayStudy();
 const stone=arch.children.find(i=>i.name==='Kensington fieldstone');
 if(!(stone instanceof Mesh)||!(stone.material instanceof MeshStandardMaterial))throw Error('arch source material');
 const variants={
  'main-roof':mat('muted slate-grey (neutral proof only)',0x626568),
  'bay-roof':mat('cross gable study, generic grey',0x66696b),
  'shelter-SW':mat('SW end lower hip study',0x64676a),
  'shelter-NE':mat('NE end lower hip study — actual tip held',0x64676a),
  'roof-soffit':mat('weather-neutral underside',0x827f74),
  'long-fascia':mat('pale slight fascia edge',0xc8c5b8),
  'pale-timber':mat('generic pale brace relief (not measured)',0xe4ddc9,.82),
  'charcoal-gable':mat('recessed neutral gable backing',0x444a4a),
  'neutral-inner':mat('closed mechanical floor and recess',0x302d28),
 };
 const f=prep();arch.scale.setScalar(S.archScale);arch.position.set(...f.archShift);
 arch.name='Original archived arch, uniform hypothetical presentation scale only';
 for(const k of tags){
  const q=f.source[k];
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(q.p,3));
  g.setAttribute('normal',new Float32BufferAttribute(q.n,3));
  g.setAttribute('uv',new Float32BufferAttribute(q.uv,2));g.computeBoundingSphere();
  const m=new Mesh(g,k==='stone-wall'||k==='support-SW'||k==='support-NE'?stone.material:variants[k]);
  m.name='Approximate scene: '+k;m.userData.role=k;
  m.castShadow=k!=='neutral-inner';m.receiveShadow=true;art.add(m);
 }
 owner.add(art,arch);
 let done=false;
 return {owner,art,arch,facts:silhouetteFacts,
  dispose(){
   if(done)return;done=true;owner.removeFromParent();
   for(const m of [...art.children,...arch.children])if(m instanceof Mesh)m.geometry.dispose();
   for(const m of Object.values(variants))m.dispose();
   if(arch.children[7] instanceof Mesh)arch.children[7].material.dispose();
  }
 };
}
