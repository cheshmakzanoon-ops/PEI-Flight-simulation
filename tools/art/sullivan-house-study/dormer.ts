import * as T from 'three';
import {finish,r} from './finish.ts';
// Detached, normalized detail. +Z faces the viewer; nothing here establishes measured site position.
type V=[number,number,number];type P=[number,number];
type K='mansard-shingles'|'hood-shingles'|'roof-cut'|'shingle-cladding'|'painted-trim'|'painted-recess'|'sash'|'glazing'|'backing';
const tags:K[]=['mansard-shingles','hood-shingles','roof-cut','shingle-cladding','painted-trim','painted-recess','sash','glazing','backing'];
const plus=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a:V,s:number):V=>[s*a[0],s*a[1],s*a[2]];
const L=(a:number,b:number,t:number)=>a+(b-a)*t,len=(a:V)=>Math.hypot(...a);
const col=(h:number,k=1)=>new T.Color(h).multiplyScalar(k);
class B{
 p:number[]=[];uv:number[]=[];c:number[]=[];
 tri(a:V,b:V,d:V,c:T.Color,A:P,B:P,C:P,tones=[1,1,1]){
  const x=new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...d).sub(new T.Vector3(...a)));if(x.lengthSq()<1e-17)return;
  for(const [i,n]of [a,b,d].entries()){
   this.p.push(...n);this.uv.push(...[A,B,C][i]);this.c.push(c.r*tones[i],c.g*tones[i],c.b*tones[i]);
  }
 }
 quad(a:V,b:V,c:V,d:V,k:T.Color,u=0,v=0,l=1,h=1,w=[1,1,1,1]){
  const A:P=[u,v],I:P=[u+l,v],C:P=[u+l,v+h],D:P=[u,v+h];this.tri(a,b,c,k,A,I,C,[w[0],w[1],w[2]]);this.tri(a,c,d,k,A,C,D,[w[0],w[2],w[3]]);
 }
 box(O:V,X:V,Y:V,Z:V,c:T.Color,idx:number){
  const at=(a:number,b:number,d:number)=>plus(O,plus(mul(X,a*.5),plus(mul(Y,b*.5),mul(Z,d*.5))));
  const A=at(-1,-1,1),B=at(1,-1,1),C=at(1,1,1),D=at(-1,1,1),a=at(-1,-1,-1),b=at(1,-1,-1),z=at(1,1,-1),d=at(-1,1,-1),u=r(idx,7),v=r(idx,32),w=len(X),h=len(Y),l=len(Z);
  this.quad(A,B,C,D,c,u,v,w,h);this.quad(b,a,d,z,c,u,v,w,h);
  this.quad(B,b,z,C,c,u,v,l,h);this.quad(a,A,D,d,c,u,v,l,h);
  this.quad(D,C,z,d,c,u,v,w,l);this.quad(a,b,B,A,c,u,v,w,l);
 }
}
const py=.575, top=4.30, span=3.32, floor=1.11, entab=3.01;
const Bay: P[]=[[-1.089,.312],[-.691,.911],[.691,.911],[1.089,.312]];
const Y:V=[0,1,0];
const zSlope=(y:number)=>.329-.335*(y-.683)+.61*Math.exp(-2.66*(y-.683));
const clay=[0x857569,0x897869,0x8b7b6c,0x8d7c6d,0x857769,0x817368,0x8a7868,0x8e7c6c];
type Aperture={role:string; center:V; outward:V};
export function makeSullivanDormer(){
 const b=Object.fromEntries(tags.map(k=>[k,new B()])) as Record<K,B>,probes:Aperture[]=[];
 let id=17;
 const face=(ori:P,d:P,normal:P)=>(s:number,y:number,z:number):V=>[ori[0]+s*d[0]+z*normal[0],y,ori[1]+s*d[1]+z*normal[1]];
 // Sweep of the actual steep lower roof vocabulary, with its flare below the vertical dormer.
 const deep=(x:number,y:number,z:number):V=>[x,y,zSlope(y)+z];
 const cutOff=1.096;
 for(let row=0;row<30;row++){
  const y=py+row*(top-py)/30,y2=py+(row+1)*(top-py)/30+.022,h=y2-y,seed=row*353+97;
  // Keep the projected canted part free of speculative mansard tiles underneath it.
  const ranges=y2>floor+.001&&y<entab+.10?[[-span,-cutOff],[cutOff,span]]:[[-span,span]];
  for(const [a,e]of ranges){
   let x=a-.208*r(seed,23);
   for(let j=0;x<e;j++){
    const n=seed*23+j*113,w=.195+.212*r(n,35),l=Math.max(a,x+.0014),p=Math.min(e,x+w-.0014);
    if(p-l>.009){
     const j0=.014*(r(n,63)-.5),j1=.014*(r(n,122)-.5),rise=.009+.009*r(n,39),y0=y+j0,yy=y+j1,
      a=deep(l,y0,rise),c=deep(p,yy,rise+.002),d=deep(p,y2,0),e=deep(l,y2,0),cc=col(clay[Math.floor(r(n,167)*clay.length)],.972+.056*r(n,61));
     const u=r(n,17),v=r(n,51);b['mansard-shingles'].quad(a,c,d,e,cc,u,v,(p-l)*1.46,h*.9,[.99,.986,1.015,1.01]);
     b['mansard-shingles'].quad(deep(l,y0,.002),deep(p,yy,.002),c,a,cc.clone().multiplyScalar(.875),u,v,.16,.078);
    }
    x+=w;
   }
  }
 }
 // Continuous underlay. Tiny open joins must not reveal the sky; the rectangular
 // central cut exists for the supported dormer only, not an invented roof substructure.
 for(let i=0;i<36;i++){
  const a=py+(top-py)*i/36,t=py+(top-py)*(i+1)/36;
  for(const [x,y]of t>floor&&a<entab+.09?[[-span,-cutOff],[cutOff,span]]:[[-span,span]]){
   b['roof-cut'].quad(deep(x,a,-.013),deep(y,a,-.013),deep(y,t,-.013),deep(x,t,-.013),col(0x6b6054),.1,.1,3.4,.15);
  }
  for(const x of [-span,span]){
   const p=deep(x,a,-.06),q=deep(x,t,-.06),r=deep(x,a,.005),s=deep(x,t,.005);
   if(x<0)b['roof-cut'].quad(p,r,s,q,col(0x7f705d));else b['roof-cut'].quad(r,p,q,s,col(0x7f705d));
  }
 }
 function lineBox(tag:K,at:(s:number,y:number,z:number)=>V,d:P,n:P,s:number,y:number,z:number,w:number,h:number,depth:number,k:number){
  b[tag].box(at(s,y,z),[d[0]*w,0,d[1]*w],[0,h,0],[n[0]*depth,0,n[1]*depth],col(k,.976+.057*r(id,11)),id++);
 }
 // Three independently framed window faces in a canted bay. The normal of
 // each pane follows its face; every frame can be ray-tested from straight out.
 for(let i=0;i<Bay.length-1;i++){
  const a=Bay[i],p=Bay[i+1],width=Math.hypot(p[0]-a[0],p[1]-a[1]),d:P=[(p[0]-a[0])/width,(p[1]-a[1])/width],n:P=[-d[1],d[0]],at=face(a,d,n);
  const box=(k:K,s:number,y:number,z:number,w:number,h:number,l:number,c:number)=>lineBox(k,at,d,n,s,y,z,w,h,l,c);
  const primary=i===1,l=primary?.198:.095,ri=width-l,y0=1.264,y1=2.828,cy=2.101,br=ri-l;
  box('backing',width*.5,(floor+entab)/2,-.198,width+.018,entab-floor+.026,.050,0x514b42);
  // Lapped, shaped butt boards only where there is actual wall around the frames.
  for(let row=0;row<15;row++){
   const y=floor+.027+row*.126,upper=y+.136;if(upper>entab-.012)break;
   const courses=upper>=y0-.037&&y<=y1+.038?[[.008,l-.010],[ri+.011,width-.008]]:[[.007,width-.008]];
   for(const [start,end]of courses){
    for(let j=0,x=start;x<end;j++){
     const k=i*201+row*113+j*59,w=.115+.095*r(k,5),q=Math.min(end,x+w-.002);
     if(q>x+.003){
      const base=y+.0024*(r(k,93)-.5),h=r(k,50),z=.021+.004*h,c=col(0xd0c5ad,.965+.10*r(k,92));
      b['shingle-cladding'].quad(at(x,base,z),at(q,base+.003*(r(k,41)-.5),z*.98),at(q,upper,0),at(x,upper,0),c,r(k,15),r(k,67),(q-x)*1.8,.15);
      b['shingle-cladding'].quad(at(x,base,.002),at(q,base,.002),at(q,base,z),at(x,base,z),c.clone().multiplyScalar(.87));
     }
     x+=w;
    }
   }
  }
  const siding=0xdad1bb,trim=0xe5dcca;
  // Mitered-looking overlap covers cut ends, with small painted lip and profiled frame.
  for(const u of [.019,width-.019]){
   box('painted-trim',u,(floor+entab)/2,.023,.076,entab-floor+.006,.086,siding);
   box('painted-trim',u,(floor+entab)/2,.073,.035,entab-floor+.012,.023,trim);
  }
  for(const off of [l,ri]){
   box('painted-trim',off,(y0+y1)/2,.048,.080,y1-y0+.172,.119,0xded4be);
   box('painted-trim',off+(off===l?.018:-.018),(y0+y1)*.5,.100,.029,y1-y0+.13,.037,0xece4d0);
   box('painted-recess',off+(off===l?.041:-.041),(y0+y1)*.5,-.011,.029,y1-y0-.01,.111,0xb5ad99);
  }
  box('painted-trim',(l+ri)*.5,y1+.026,.067,br+.102,.102,.154,siding);
  box('painted-trim',(l+ri)*.5,y1+.068,.095,br+.128,.023,.156,trim);
  box('painted-recess',(l+ri)*.5,y1-.032,-.032,br-.015,.041,.094,0xb3a994);
  box('painted-trim',(l+ri)*.5,y0-.027,.071,br+.138,.074,.161,0xcabea4);
  box('painted-trim',(l+ri)*.5,y0+.007,.115,br+.154,.022,.193,0xe6dcc3);
  box('painted-recess',(l+ri)*.5,y0+.044,-.038,br-.006,.037,.093,0xbab099);
  const u0=l+.069,u1=ri-.067,sw=u1-u0;
  for(const [j,ylo,yhi,z]of [[0,y0+.075,cy,-.094],[1,cy,y1-.073,-.114]]){
   for(const u of [u0,u1])box('sash',u,(ylo+yhi)/2,z+.019,.025,yhi-ylo+.030,.038,0xd5d3bd);
   for(const y of [ylo,yhi])box('sash',(u0+u1)*.5,y,z+.019,sw+.018,.038,.040,0xe1dac3);
   box('glazing',(u0+u1)*.5,(ylo+yhi)*.5,z,sw-.015,yhi-ylo-.013,.005,0x46555d);
   probes.push({role:`face-${i}/${j}`,center:at((u0+u1)*.5,(ylo+yhi)*.5,z+.0025),outward:[n[0],0,n[1]]});
  }
  box('sash',(u0+u1)*.5,cy,-.055,sw+.036,.048,.061,0xc4c0ae);
  box('painted-trim',width*.5,floor+.054,.047,width+.052,.080,.135,0xd5cbb4);
  box('painted-trim',width*.5,floor+.092,.076,width+.063,.028,.141,0xe4d9bf);
  // Continuous painted soffit and modest apron between the head frames and the swept hood.
  box('painted-trim',width*.5,entab-.078,-.016,width+.100,.104,.153,0xc9c3ac);
  box('painted-recess',width*.5,floor+.004,-.014,width+.06,.079,.194,0xb9aa92);
  box('painted-trim',width*.5,floor-.020,.015,width+.044,.046,.149,0xcfc3a9);
  // Short projecting mouldings wrap each facet without floating ledges.
  for(const [dy,sz,w,dp,c]of [[-.014,.038,.061,.169,0xd8cbb2],[.033,.057,.039,.199,0xdacfb8],[.054,.099,.021,.230,0xe8dec5]])
   box('painted-trim',width*.5,entab+dy,sz,width+.088,w,dp,c);
 }
 // Thin lapped returns merge the new canted artwork to the exhibited cut roof,
 // not a guessed back facade. Both cheeks have depth but neither gets an extra window.
 for(const [i,x,z]of [[0,Bay[0][0],Bay[0][1]],[1,Bay[3][0],Bay[3][1]]]){
  const bottom=floor,dy=entab-bottom,depth=.94;
  b['roof-cut'].box([x,(bottom+entab)*.5,z-depth*.5],[.050,0,0],[0,dy,0],[0,0,depth],col(0xb2a58b),id++);
  const direction=i===0?-1:1;
  for(let row=0;row<15;row++){
   const yy=bottom+.015+row*.123,y2=yy+.138,q=row*191+i*31,draw=col(0xcfc1a7,.972+.069*r(row,31));
   for(let j=0,z0=z-depth;z0<z;j++){
    const w=.138+.057*r(q,j+19),end=Math.min(z,z0+w-.0016);
    const x0=x+direction*.032,x1=x+direction*(.045+.004*r(q,j)),u=r(row,j+7),v=r(row,98+j);
    if(direction===1)b['shingle-cladding'].quad([x1,yy,end],[x1,yy,z0],[x0,y2,z0],[x0,y2,end],draw,u,v,w*1.67,.21);
    else b['shingle-cladding'].quad([x1,yy,z0],[x1,yy,end],[x0,y2,end],[x0,y2,z0],draw,u,v,w*1.67,.21);
    z0+=w;
   }
  }
 }
 // Five canted and cheek surfaces curve inward to a short ridge. The slightly crowned peak is
 // a proportioned interface to the stock-cut mansard, not the building's roof height.
 const rim:P[]=[[-1.105,-.644],[-1.210,.295],[-.742,1.036],[.742,1.036],[1.210,.295],[1.105,-.644]],crest=[-.890,-.793,-.437,-.437,-.793,-.890],crestHeight=[4.365,4.425,4.48,4.48,4.425,4.365];
 function hood(j:number,u:number,t:number,delta=0):V{
  const q=Math.max(0,1-t),s=.57*q+.43*Math.pow(q,2.45),p=rim[j],n=rim[j+1];
  const tx=n[0]-p[0],tz=n[1]-p[1],d=Math.hypot(tx,tz),thickness=delta*Math.sqrt(q);
  const back=L(crest[j],crest[j+1],u),anchor=L(crestHeight[j],crestHeight[j+1],u);
  return [L(p[0],n[0],u)*s-tz*thickness/d,L(entab+.065,anchor,t),L(back,L(p[1],n[1],u),s)+tx*thickness/d];
 }
 for(let side=0;side<5;side++){
  for(let j=0;j<27;j++)b['roof-cut'].quad(hood(side,0,j/27,-.017),hood(side,1,j/27,-.017),hood(side,1,(j+1)/27,-.017),hood(side,0,(j+1)/27,-.017),col(0x756452));
  for(let row=0;row<19;row++){
   const y=row/19,top=Math.min(1,(row+1)/19+.022),n0=1553+row*123+side*561;
   const expected=Math.max(1,Math.round((1-y)*(side===2?7.4:5.6)));
   let u=-.086*r(n0,39);
   for(let k=0;u<1;k++){
    const id=n0+k*29,w=(.77+.47*r(id,77))/expected,s=Math.max(0,u+.0023),p=Math.min(1,u+w-.0023);
    if(p>s+.002){
     const da=(r(id,35)-.5)*.009,db=(r(id,89)-.5)*.009,a=hood(side,s,Math.max(0,y+da),.014),c=hood(side,p,Math.max(0,y+db),.011);
     const d=hood(side,p,top,-.002),e=hood(side,s,top,-.002),tone=col(clay[Math.floor(r(id,17)*clay.length)],.967+.052*r(id,79));
     const U=r(id,22),V=r(id,40);
     b['hood-shingles'].quad(a,c,d,e,tone,U,V,(p-s)*1.57,.18);
     b['hood-shingles'].quad(hood(side,s,Math.max(0,y+da)),hood(side,p,Math.max(0,y+db)),c,a,tone.clone().multiplyScalar(.86),U,V,.20,.065);
    }
    u+=w;
   }
  }
 }
 // The small sample's bottom shelf is a documented profile family, not a roof
 // above invented veranda dimensions. Model real joined strips and paired eave brackets.
 for(const [j,x,x2]of [[0,-1.077,-1.114],[4,1.077,1.114]]){
  const side=j===0?0:1,p=hood(j,side,0,-.003),q=[x2,entab+.044,p[2]]as V;
  b['painted-recess'].quad([x,entab-.035,.292],[x2,entab-.035,p[2]],q,[x,entab+.040,.292],col(0xaba48e),.3,.1,.76,.13);
 }
 const front=zSlope(py)-.017;
 for(const [i,h,d,z]of [[0,.106,.205,front-.042],[1,.039,.264,front-.041],[2,.031,.283,front-.038]]){
  b['painted-trim'].box([0,py-.045-i*.053,z],[span*2+.04,0,0],[0,h,0],[0,0,d],col(i===1?0xe7dbbf:0xd2c5a7),id++);
 }
 // A shallow backing and plank soffit make the lower sample read as construction,
 // not as floating profiles. These cuts stop short of the entire verandah.
 const cutY=py-.183,rear=front-.308;
 b['roof-cut'].box([0,cutY-.143,rear],[span*2-.006,0,0],[0,.297,0],[0,0,.166],col(0x8a806e),id++);
 for(let i=0;i<5;i++){
  const z=rear+i*.066+.030;
  b['painted-trim'].box([0,cutY+.014,z],[span*2+.022,0,0],[0,.039,0],[0,0,.064],col(0xbeb096,.98+.06*r(i,19)),id++);
 }
 const bracketShape:P[]=[[.023,.000],[.245,0],[.239,.054],[.208,.067],[.175,.091],[.151,.112],[.122,.167],[.120,.271],[.023,.281]];
 for(const x of [-2.38,-2.251,2.224,2.358]){
  const a=x-.034,z=x+.034;
  const at=(x:number,p:P):V=>[x,py-.173-p[1],front-.263+p[0]];
  const g=T.ShapeUtils.triangulateShape(bracketShape.map(([u,v])=>new T.Vector2(u,v)),[]);
  for(const [i,j,k]of g){
   const abc=[bracketShape[i],bracketShape[j],bracketShape[k]];
   b['painted-trim'].tri(at(a,abc[0]),at(a,abc[2]),at(a,abc[1]),col(0xd8cdb7),[.1,.1],[.2,.4],[.8,.8]);
   b['painted-trim'].tri(at(z,abc[0]),at(z,abc[1]),at(z,abc[2]),col(0xdfd3bc),[.1,.1],[.8,.8],[.2,.4]);
  }
  for(let j=0;j<bracketShape.length;j++){
   const q=bracketShape[(j+1)%bracketShape.length],p=bracketShape[j];
   b['painted-trim'].quad(at(a,q),at(z,q),at(z,p),at(a,p),col(0xcfc2a9),.1,.3,.22,.28);
  }
 }
 const materials={paint:finish('paint'),board:finish('siding'),roof:finish('granular')};
 const G=new T.Group();G.name='Sullivan House · physical canted dormer vocabulary, not parcel placement';
 for(const tag of tags){
  const v=b[tag],geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(v.p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(v.uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(v.c,3));geo.computeVertexNormals();geo.computeBoundingSphere();
  const roof=tag==='hood-shingles'||tag==='mansard-shingles',solid=tag==='backing'||tag==='roof-cut';
  const m=tag==='glazing'?new T.MeshPhysicalMaterial({vertexColors:true,roughness:.162,metalness:0,clearcoat:.66,clearcoatRoughness:.11,ior:1.52,envMapIntensity:1.43}):solid?new T.MeshStandardMaterial({vertexColors:true,roughness:.97,side:tag==='roof-cut'?T.DoubleSide:T.FrontSide}):new T.MeshStandardMaterial({vertexColors:true,roughness:.95,...(roof?materials.roof:tag==='shingle-cladding'?materials.board:materials.paint),normalScale:new T.Vector2(roof?.67:.29,roof?.54:.25)});
  const mesh=new T.Mesh(geo,m);mesh.name=tag;mesh.castShadow=tag!=='glazing'&&tag!=='backing';mesh.receiveShadow=true;G.add(mesh);
 }
 G.userData.apertures=probes;
 return G;
}
