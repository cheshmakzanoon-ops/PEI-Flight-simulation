// Detached cutaway of positively identified exterior vocabulary, not an as-built survey.
// X runs along the facade; +Z points out toward a hypothetical platform; dimensions are sketch proportions.
import * as T from 'three';
import {cedarSurface} from './timber-surface.ts';
type V=[number,number,number]; type UV=[number,number];
type Bucket='shingles'|'plinth'|'joinery'|'soffit'|'roof'|'deck'|'bed'|'glass'|'iron';
const seed=(i:number)=>{let t=Math.imul(i^(i>>>16),0x45d9f3b);t=Math.imul(t^(t>>>16),0x45d9f3b);return ((t^(t>>>16))>>>0)/4294967296;};
const v=(x:number,y:number,z:number):V=>[x,y,z];
const plus=(a:V,b:V):V=>v(a[0]+b[0],a[1]+b[1],a[2]+b[2]);
const scale=(a:V,n:number):V=>v(a[0]*n,a[1]*n,a[2]*n);
const length=(a:V)=>Math.hypot(...a);
class Batch{
 p:number[]=[];colors:number[]=[];uvs:number[]=[];
 tri(a:V,b:V,c:V,color:T.Color,ar:UV,br:UV,cr:UV){
  for(const [i,p] of [a,b,c].entries()){this.p.push(...p);this.colors.push(color.r,color.g,color.b);this.uvs.push(...[ar,br,cr][i]);}
 }
 quad(a:V,b:V,c:V,d:V,color:T.Color,u:UV=[0,0],v:UV=[1,1]){
  const coords=[u,[v[0],u[1]],v,u,v,[u[0],v[1]]];
  for(const [i,k] of [a,b,c,a,c,d].entries()){this.p.push(...k);this.colors.push(color.r,color.g,color.b);this.uvs.push(...coords[i]);}
 }
 box(c:V,dx:V,dy:V,dz:V,col:T.Color,uv:UV=[0,0],end:UV=[1,1]){
  const p=(a:number,b:number,e:number):V=>plus(c,plus(scale(dx,a*.5),plus(scale(dy,b*.5),scale(dz,e*.5))));
  const pp=p(-1,-1,1),qp=p(1,-1,1),rp=p(1,1,1),sp=p(-1,1,1),pn=p(-1,-1,-1),qn=p(1,-1,-1),rn=p(1,1,-1),sn=p(-1,1,-1);
  this.quad(pp,qp,rp,sp,col,uv,end);this.quad(qn,pn,sn,rn,col,uv,end);this.quad(qp,qn,rn,rp,col,uv,end);this.quad(pn,pp,sp,sn,col,uv,end);this.quad(sp,rp,rn,sn,col,uv,end);this.quad(pn,qn,qp,pp,col,uv,end);
 }
}
export function buildElmiraTrackside(){
 const g=new T.Group();g.name='Elmira bracket and sash: detached';
 const keys:Bucket[]=['shingles','plinth','joinery','soffit','roof','deck','bed','glass','iron'];
 const batch=Object.fromEntries(keys.map(k=>[k,new Batch()])) as Record<Bucket,Batch>;
 const co=(hex:number,drift=0,i=1)=>new T.Color(hex).multiplyScalar(1+drift*(seed(i)-.5));
 function box(k:Bucket,x:number,y:number,z:number,w:number,h:number,d:number,c:number,drift=0,i=1){
  if(w<=0||h<=0||d<=0)return;
  batch[k].box(v(x,y,z),v(w,0,0),v(0,h,0),v(0,0,d),co(c,drift,i),[seed(i+37),seed(i+91)],[seed(i+37)+w*.87,seed(i+91)+h*.82]);
 }
 // Shaped timber cheek under a deep eave. Upper and lower bearing ends flare into
 // the ledger and wall plate; the straight load-carrying midsection remains legible.
 // Both side profiles use the SAME outline. No hole is replaced by black paint.
 function bracket(x:number,i:number){
  const yz: [number,number][]=[
   [2.28,.105],[2.28,.158],[2.34,.176],[2.41,.196],[2.47,.229],
   [2.59,.352],[2.76,.568],[2.86,.702],[2.892,.770],[2.907,.853],
   [2.918,.918],[2.971,.918],[2.972,.692],[2.945,.621],[2.915,.576],
   [2.87,.542],[2.70,.403],[2.57,.279],[2.49,.188],[2.46,.105]
  ];
  const contour=yz.map(([y,z])=>new T.Vector2(z,y));
  const faces=T.ShapeUtils.triangulateShape(contour,[]);
  if(faces.length!==yz.length-2)throw new Error('untriangulated eave bracket');
  const x1=x-.048,x2=x+.048,base=co(0x3d5141,.055,i);
  for(const [a,b,c] of faces){
   // Shape triangulation normal in (z,y) points -X; switch winding for +X face.
   const at=(x:number,n:number)=>v(x,yz[n][0],yz[n][1]);
   const uv=(n:number):UV=>[.12+yz[n][1]*.81,.19+yz[n][0]*.91];
   const tri=(x:number,a:number,b:number,c:number)=>batch.joinery.tri(at(x,a),at(x,b),at(x,c),base,uv(a),uv(b),uv(c));
   const A=contour[a],B=contour[b],C=contour[c],sign=(B.x-A.x)*(C.y-A.y)-(B.y-A.y)*(C.x-A.x);
   if(sign>0){tri(x1,a,b,c);tri(x2,c,b,a)}else{tri(x2,a,b,c);tri(x1,c,b,a)}
  }
  const area=T.ShapeUtils.area(contour);
  for(let j=0;j<yz.length;j++){
   const k=(j+1)%yz.length,a=v(x1,...yz[j]),b=v(x2,...yz[j]),c=v(x2,...yz[k]),d=v(x1,...yz[k]);
   if(area>0)batch.joinery.quad(a,b,c,d,base);else batch.joinery.quad(d,c,b,a,base);
  }
 }
 const W=3.80,A=-W/2,B=W/2,windowX=-.24,L=windowX-.51,R=windowX+.51,low=.857,top=2.56;
 box('bed',0,1.56,-.092,W,3.10,.11,0x665f4d);
 // Each exposed shingle gets its own varying butt width, lap taper, riven face and undercut.
 // A real portal is cut out, instead of drawing glass over a course that continues inside it.
 for(let row=0;row<20;row++){
  const y=.72+row*.119,outer=.000+.0007*(row%2),c=0xd1c8ae;
  let x=A-.37*seed(row*19+4);
  for(let j=0;x<B;j++){
   const i=713*row+j*13+51,w=.147+.155*seed(i),x0=Math.max(A,x+.0008),x1=Math.min(B,x+w-.0008);
   const pieces:[[number,number]]|[number,number][]=(y<top+.042&&y+.120>low-.057)?[[x0,Math.min(x1,L-.005)],[Math.max(x0,R+.005),x1]]:[[x0,x1]];
   for(const [s,e] of pieces)if(e>s+.004){
    // The head tucks behind the next exposed course. A slight skew and individual butt
    // position prevent the end grain from becoming a mortar-like rectangular grid.
    const yy=y+.007*(seed(i+81)-.5),zs=outer+.015+.0065*seed(i+74),hi=y+.134;
    const sl=.0037*(seed(i+42)-.5),sr=.0037*(seed(i+959)-.5),lean=.0018*(seed(i+278)-.5);
    const color=co(c,.098,i),o:UV=[seed(i+27),seed(i+77)],uR=o[0]+(e-s)*1.8,vh=o[1]+.36;
    const split=seed(i+162)>.79&&(e-s)>.070,m=s+(e-s)*(.34+.30*seed(i+154));
    const t1=v(s,yy+sl,zs+.0025*seed(i+28)),t2=v(e,yy+sr,zs+.0025*seed(i+31));
    const b1=v(s+lean,hi,.006),b2=v(e+lean,hi,.006);
    if(split){
     const um=o[0]+(m-s)*1.8,lip=v(m,yy+.0003-.0032*seed(i+764),zs+.003),head=v(m+lean,hi,.006);
     batch.shingles.quad(t1,lip,head,b1,color,o,[um,vh]);batch.shingles.quad(lip,t2,b2,head,color.clone().multiplyScalar(.990),[um,o[1]],[uR,vh]);
    }else batch.shingles.quad(t1,t2,b2,b1,color,o,[uR,vh]);
    const back1=v(s,yy+sl+.001,.009),back2=v(e,yy+sr+.001,.009);
    batch.shingles.quad(back1,back2,t2,t1,color.clone().multiplyScalar(.89));
    if(seed(i+82)>.69&&e-s>.06){
     // Narrow end grain on the higher side, tapered to vanishing under the shingle above.
     batch.shingles.tri(t2,back2,b2,color.clone().multiplyScalar(.93),[0,0],[.014,0],[.014,.25]);
    }
   }
   x+=w;
  }
 }
 // Narrow vertical boards below the belt, not a repeated second shingle material.
 for(let i=0;i<31;i++){
  const w=W/31,x=A+(i+.5)*w;
  box('plinth',x,.365,.013,w-.0018,.70,.024,0x9d9e88,.076,308+i);
 }
 // Sloping slip-sill with drip undercut; verge cap at the break of the paired finishes.
 box('joinery',0,.729,.044,W,.092,.112,0x3c4a3d);
 box('joinery',0,.777,.063,W,.022,.139,0x525a45);
 box('joinery',0,.047,.047,W,.089,.097,0x3a493b);
 // The glazing is dark because it reflects its conditions under the deep eave, not because it is black paint.
 const innerL=L+.097,innerR=R-.097,innerB=low+.081,innerT=top-.079,meet=(innerB+innerT)/2;
 const win: {cx:number; cy:number; col:number; row:number; }[]=[];
 box('bed',windowX,(low+top)/2,-.014,R-L,top-low,.012,0x242b26);
 for(const [i,x]of [L,R].entries()){
  box('joinery',x,(low+top)/2,.061,.096,top-low+.16,.109,0x344a3c);
  box('joinery',x+(i?-.049:.049),(low+top)/2,.077,.022,top-low+.015,.031,0x536350);
 }
 box('joinery',windowX,top+.036,.069,R-L+.104,.112,.125,0x3d5140);
 box('joinery',windowX,top+.100,.087,R-L+.135,.024,.159,0x566650);
 box('joinery',windowX,low-.052,.068,R-L+.117,.076,.123,0x374939);
 box('joinery',windowX,low-.003,.101,R-L+.195,.046,.188,0x55634e);
 // Two stepped, operable-looking frames, each nine panes. Physical putty bevels border the lights.
 for(const [sash,cy0,cy1] of [[0,innerB,meet],[1,meet,innerT]]){
  const z=sash?.052:.066,xc=(innerL+innerR)/2,wx=innerR-innerL,ch=(cy1-cy0)/3,cw=wx/3;
  for(let rr=0;rr<3;rr++)for(let cc=0;cc<3;cc++){
   const px=innerL+(cc+.5)*cw,py=cy0+(rr+.5)*ch;
   box('glass',px,py,z-.013,cw-.009,ch-.009,.005,0x5b6660,.12,rr*79+cc*13+sash);
   win.push({cx:px,cy:py,col:cc,row:rr+sash*3});
  }
  for(let k=0;k<=3;k++){
   const left=innerL+cw*k,w=k===0||k===3?.045:.019;
   box('joinery',left,(cy0+cy1)/2,z+.013,w,cy1-cy0+.023,.038,0x455a47);
   if(k===1||k===2)box('joinery',left+.001,(cy0+cy1)/2,z+.034,.009,cy1-cy0+.011,.010,0x68745c);
  }
  for(let k=0;k<=3;k++){
   const yy=cy0+k*ch,h=k===0||k===3?.045:.019;
   box('joinery',xc,yy,z+.015,wx+.045,h,.041,0x465a45);
   if(k!==0)box('joinery',xc,yy+.003,z+.037,wx+.023,.009,.012,0x63715b);
  }
 }
 box('joinery',windowX,meet,.094,innerR-innerL+.060,.047,.058,0x3e513f);
 // Wide, lapped canopy slice: fascia, board underside, sawn diagonal support, a shingled apron on top.
 for(const [n,x]of [-1.42,1.15].entries()){
  box('joinery',x,2.60,.080,.124,.79,.110,0x35473a);
  box('joinery',x,2.25,.077,.086,.158,.092,0x364638);
  bracket(x,100+n);
  box('joinery',x,2.955,.497,.120,.119,1.02,0x3b4b3c);
  for(const y of [2.34,2.865]){
   const zz=y<2.5?.139:.143,rad=.010,head=co(0x606452),center=v(x,y,zz+.007);
   for(let k=0;k<6;k++){
    const ang=Math.PI*k/3,a=v(x+rad*Math.cos(ang),y+rad*Math.sin(ang),zz+.006),b=v(x+rad*Math.cos(ang+Math.PI/3),y+rad*Math.sin(ang+Math.PI/3),zz+.006);
    batch.iron.tri(center,a,b,head,[.5,.5],[0,1],[1,1]);
   }
  }
 }
 for(let i=0;i<10;i++){
  const z=-.01+(i+.5)*.112,h=3.117-.148*z;
  batch.soffit.box(v(0,h,z),v(W+.123,0,0),v(0,.048,0),v(0,-.0167,.110),co(0x656858,.115,990+i),[.1,i*.14],[4.0,i*.14+.1]);
 }
 box('joinery',0,2.987,1.115,W+.17,.164,.075,0x414c40);
 box('joinery',0,3.059,1.124,W+.185,.035,.083,0x62705a);
 for(let row=0;row<8;row++){
  const z1=1.177-row*.157, z0=z1-.168;
  const Y=(z:number)=>3.166-.111*z+.041*(1-z)*(1-z);
  let x=A-.06-.25*seed(row*19+894);
  for(let j=0;x<B+.081;j++){
   const i=2880+row*89+j,w=.114+.105*seed(i),s=Math.max(A-.083,x+.0015),e=Math.min(B+.083,x+w-.0015);
   if(e>s){
    // Individually weathered ends are not eight straight bars. Each piece has an
    // independent butt offset, slight crown and occasional shallow split; the
    // overlap behind remains continuous, with no dark holes in the roof sheet.
    const zL=z1+.017*(seed(i+106)-.5),zR=z1+.017*(seed(i+892)-.5),yb=Y(z0)-.013,
     wet=seed(i+197),tilt=.0042*(seed(i+97)-.5),yL=Y(zL)+.0032*wet-tilt,yR=Y(zR)+.0032*wet+tilt,
     tipL=v(s,yL,zL),tipR=v(e,yR,zR),headL=v(s,yb,z0),headR=v(e,yb,z0),um=seed(i+35),vm=seed(i+715),
     color=co(0x91877b,.38,i),edge=color.clone().multiplyScalar(.76+.11*seed(i+258)),mid=s+(e-s)*(.33+.31*seed(i+145));
    const frac=(mid-s)/(e-s),uM=um+(mid-s)*1.93,uB=um+(e-s)*1.93;
    if(seed(i+641)>.43&&(e-s)>.05){
     const td=seed(i+13)>.88?-.012:.0024,tip=v(mid,yL+(yR-yL)*frac+.0007,zL+(zR-zL)*frac+td),hb=v(mid,yb,z0);
     batch.roof.quad(tipL,tip,hb,headL,color,[um,vm],[uM,vm+.54]);batch.roof.quad(tip,tipR,headR,hb,color.clone().multiplyScalar(.985),[uM,vm],[uB,vm+.54]);
     batch.roof.quad(v(s,yL-.008,zL),v(mid,tip[1]-.007,tip[2]),tip,tipL,edge);
     batch.roof.quad(v(mid,tip[1]-.007,tip[2]),v(e,yR-.009,zR),tipR,tip,edge);
    }else{
     batch.roof.quad(tipL,tipR,headR,headL,color,[um,vm],[uB,vm+.54]);
     batch.roof.quad(v(s,yL-.008,zL),v(e,yR-.009,zR),tipR,tipL,edge);
    }
    // The edge reveal disappears under the next course; partially shadowed seam, not a black grout line.
    batch.roof.tri(tipR,v(e,yR-.008,zR),headR,edge,[0,0],[.009,0],[.005,.3]);
   }
   x+=w;
  }
 }
 // Continuous sawn barge-cut edges close the profiled apron and hide side views through the
 // underside. This is a bounded section of an overhang, not a model of a freestanding roof.
 for(const x of [A-.067,B+.067]){
  const y=(z:number)=>3.166-.111*z+.041*(1-z)*(1-z)-.013;
  for(let j=0;j<10;j++){
   const za=-.135+j*.1313,zb=za+.1313,lo=(z:number)=>3.081-.148*z,xa=x-.014,xb=x+.014;
   const c=co(0x53604b,.055,j+82),A=v(xa,lo(za),za),B=v(xb,lo(za),za),C=v(xb,y(za),za),D=v(xa,y(za),za);
   const E=v(xa,lo(zb),zb),F=v(xb,lo(zb),zb),G=v(xb,y(zb),zb),H=v(xa,y(zb),zb);
   batch.joinery.quad(E,A,D,H,c);batch.joinery.quad(B,F,G,C,c);batch.joinery.quad(D,C,G,H,c);batch.joinery.quad(A,E,F,B,c);
  }
 }
 // The sill nose and casing have a tiny bevel that catches glancing sky, rather than a white stripe.
 box('joinery',windowX,low+.022,.181,R-L+.158,.011,.022,0x68745c);
 box('joinery',windowX,top+.111,.142,R-L+.120,.009,.021,0x76816a);
 // A short strip of worn platform anchors the sill without asserting track, platforms or station placement.
 for(let i=0;i<31;i++){
  const w=(W+.18)/31,x=-(W+.18)*.5+w*(i+.5);
  batch.deck.box(v(x,-.012,.692),v(w-.004,0,0),v(0,.082,0),v(0,0,1.72),co(0xa89b82,.19,880+i),[seed(i),.1+seed(i+154)],[seed(i)+w,.1+seed(i+154)+1.72]);
 }
 box('deck',0,-.091,1.51,W+.21,.141,.085,0x8e7f67,.02);
 const surf=cedarSurface(),weathered=cedarSurface(true);
 for (const k of keys){
  const b=batch[k];if(!b.p.length)continue;
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(b.p,3));geo.setAttribute('color',new T.Float32BufferAttribute(b.colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(b.uvs,2));geo.computeVertexNormals();geo.computeBoundingSphere();
  let mat:T.Material;
  if(k==='glass')mat=new T.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,metalness:0,roughness:.115,ior:1.51,specularIntensity:1.0,clearcoat:.94,clearcoatRoughness:.085,envMapIntensity:1.65});
  else if(k==='iron'||k==='bed')mat=new T.MeshStandardMaterial({vertexColors:true,roughness:k==='iron'?.70:.91,metalness:k==='iron'?.16:0});
  else mat=new T.MeshStandardMaterial({vertexColors:true,...(k==='roof'||k==='deck'?weathered:surf),normalScale:new T.Vector2(k==='roof'?.68:k==='deck'?.45:.17,k==='roof'?.68:k==='deck'?.45:.17),roughness:k==='deck'?.98:.93});
  const mesh=new T.Mesh(geo,mat);mesh.name=k;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
 }
 g.userData.glassCenters=win;return g;
}
