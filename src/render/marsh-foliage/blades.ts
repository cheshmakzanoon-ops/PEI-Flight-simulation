import {
 BufferGeometry,Float32BufferAttribute,Vector3,
} from 'three';

type P=readonly [number,number,number];
export type BladeGeometry={geometry:BufferGeometry;triangles:number;maxRadius:number;maxY:number;units:{leaf:number;stem:number;seed:number;mat:number}};

export function marshHash(a:number,b:number):number{
 let n=Math.imul(a+32207,0x2d51a69f)^Math.imul(b-281,0x51ec61c9);
 n=Math.imul(n^(n>>>13),0x16a6b7e9);n=Math.imul(n^(n>>>16),0x335bb53b);
 return ((n^(n>>>15))>>>0)/4294967296;
}
const PI2=Math.PI*2,clamp=(x:number)=>Math.min(1,Math.max(0,x));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

/** True cambered, repeatedly bent ribbons, a tapered closed culm cross
 * section and a few original seed-husk surfaces. No photographed images. */
export function marshBladeGeometry(near:boolean):BladeGeometry{
 const xyz:number[]=[],marks:number[]=[],faces:number[]=[];
 const units={leaf:0,stem:0,seed:0,mat:0};
 const v=(p:P,t:number,r:number,organ:number,seed:number)=>{
  const k=xyz.length/3;xyz.push(...p);marks.push(t,r,organ,seed);return k;
 };
 const tri=(a:number,b:number,c:number,organ:keyof typeof units)=>{
  faces.push(a,b,c);units[organ]++;
 };
 const quad=(a:number,b:number,c:number,d:number,organ:keyof typeof units)=>{
  tri(a,b,c,organ);tri(a,c,d,organ);
 };
 const h=(i:number,k:number)=>marshHash(i,k);
 const stemCount=near?3:2;
 const culmData=Array.from({length:stemCount},(_,i)=>{
  const n=i*41,A=h(n,11)*PI2;
  const rb=(i?1:.28)*(0.047+.097*h(n,32)),bx=rb*Math.cos(A),bz=rb*Math.sin(A);
  const hi=.52+.43*h(n,15),lean=.098+.162*h(n,37),sway=h(n,19)*PI2;
  return {n,hi,bx,bz,lean,sway,stem:(t:number):P=>[
   bx+(Math.cos(A)*lean*.34+.158)*Math.pow(t,1.72)+Math.cos(sway)*t*t*.047,
   -.005+hi*t-Math.max(0,t-.84)*t*.023,
   bz+Math.sin(A)*(.065+lean*.19)*t*t+.065*Math.sin(sway)*t*t,
  ]};
 });
 const leaf=(id:number,origin:P,az:number,length:number,rise:number,width:number,drop:number,twist:number,matted=false)=>{
  const ca=Math.cos(az),sa=Math.sin(az),ripple=(h(id,55)-.5)*.120,hook=(h(id,81)-.49)*.26;
  const b=.32+.54*h(id,36),span=near?4:3,rollSection=near&&!matted;
  const sample=(u:number):P=>{
   const f=u*u*(3-2*u),step=length*(.18*u+.82*f),cross=ripple*Math.sin(Math.PI*u)*u+hook*u*u*u;
   return [
    origin[0]+step*ca-cross*sa,
    origin[1]+rise*(1.-Math.pow(1.-u,1.76))-drop*Math.pow(u,2.42)-.020*u*u*Math.sin(u*PI2),
    origin[2]+step*sa+cross*ca,
   ];
  };
  let previous:number[]|undefined;
  for(let j=0;j<=span;j++){
   const u=j/span,C=sample(u),A=sample(clamp(u-.012)),B=sample(clamp(u+.012));
   const F=new Vector3(B[0]-A[0],B[1]-A[1],B[2]-A[2]).normalize();
   const across=new Vector3(-F.z,0,F.x).normalize(),normal=new Vector3().crossVectors(F,across).normalize();
   const t=(u-.23)*twist+.18*Math.sin(4.8*u+id)*u;
   across.multiplyScalar(Math.cos(t)).addScaledVector(normal,Math.sin(t)).normalize();
   const bend=new Vector3().crossVectors(F,across).normalize();
   // Sheath grows before the long taper. A small curl at the edges genuinely
   // changes its normals viewed across the rib rather than rotating a card.
   const w=width*(.62+.57*Math.sin(Math.PI*Math.pow(u,.58)))*Math.pow(1.-u,.83);
   const ids:number[]=[];
   if(j===span){
    const tail=v(C,u,0,0,b);
    if(previous)for(let k=1;k<previous.length;k++)tri(previous[k-1],previous[k],tail,'leaf');
    continue;
   }
   for(const side of rollSection?[-1,0,1]:[-1,1]){
    const roll=side===0? .155*w:(side<0?-.18:.019)*w*(1.+.75*u);
    ids.push(v([C[0]+across.x*w*side+bend.x*roll,C[1]+across.y*w*side+bend.y*roll,C[2]+across.z*w*side+bend.z*roll],u,side,0,b));
   }
   if(previous)for(let k=1;k<ids.length;k++)quad(previous[k-1],previous[k],ids[k],ids[k-1],'leaf');
   previous=ids;
  }
 };
 for(const c of culmData){
  const {n,stem,hi}=c;
  const len=near?4:2,facets=near?3:2;
  let prev:number[]|undefined;
  for(let j=0;j<=len;j++){
   const u=j/len,origin=stem(u);
   const size=(.0022+.00165*h(n,45))*(1.-.75*u);
   const ids=Array.from({length:facets},(_,k)=>{
    const a=(k*PI2/facets)+h(n,7);
    return v([origin[0]+Math.cos(a)*size,origin[1],origin[2]+Math.sin(a)*size],u,0,1,h(n,56));
   });
   if(prev){
    const loops=facets===2?1:facets;
    for(let k=0;k<loops;k++){const q=(k+1)%facets;quad(prev[k],prev[q],ids[q],ids[k],'stem');}
   }
   prev=ids;
  }
  const bolts=near?3:2;
  for(let j=0;j<bolts;j++){
   const id=n+j*7+1,Y=j===0?.011:.075+(.084+.108*h(id,11))*j;
   const a=.24*h(n,24)+j*2.395+(h(id,73)-.5)*1.18+(n%7)*.61;
   const original=stem(Y);
   const len=.18+.32*h(id,36)+.16*(j<2?1:0);
   const rise=.141+.264*h(id,61);
   const tip=.062+.186*h(id,18)+(j===0?.04:0);
   const breadth=.0031+.0092*h(id,88);
   leaf(id,original,a,len,rise,breadth,Math.min(tip,rise*.78),(h(id,8)-.50)*2.4);
  }
  if(near&&n===41){
   const tipCount=7;
   for(let i=0;i<tipCount;i++){
    const t=.795+i*.027,A=stem(t),az=Math.PI*2*h(n+i,63);
    const l=.024+.019*h(n+i,33),b=.0023+.0013*h(n,i*7);
    const c=Math.cos(az),s=Math.sin(az);
    const mid:P=[A[0]+l*.33*c,A[1]+l*.55,A[2]+l*.33*s];
    const tip:P=[A[0]+l*.73*c,A[1]+l,A[2]+l*.73*s];
    const oo=v(A,.80,0,2,h(n+i,318));
    const a=v([mid[0]-b*s,mid[1],mid[2]+b*c],.92,-1,2,h(n+i,318));
    const q=v([mid[0]+b*s,mid[1],mid[2]-b*c],.92,1,2,h(n+i,318));
    const u=v([mid[0]+b*c*.56,mid[1]+b*.25,mid[2]+b*s*.56],.93,0,2,h(n+i,318));
    const m=v(tip,1,0,2,h(n+i,318));
    tri(oo,a,u,'seed');tri(oo,u,q,'seed');tri(a,m,u,'seed');tri(u,m,q,'seed');
   }
  }
 }
 // Low, overlapping cohorts rather than identical upright brushes. In the
 // close mesh these are additional bends and distinct staggered root offsets.
 for(let j=0;j<(near?16:9);j++){
  const i=823+34*j,az=.68+h(i,66)*PI2,r=.029+.281*Math.sqrt(h(i,51));
  const power=h(i,88),rise=.069+.141*h(i,5),origin:P=[r*Math.cos(az),.001+.039*h(i,21),r*.91*Math.sin(az)];
  leaf(i,origin,az+(h(i,15)-.48)*2.48,
   .18+.18*h(i,4),rise,.0036+.0089*Math.pow(power,2.),Math.min(rise*.86,.048+.141*h(i,7)),-.58+1.04*h(i,8),true);
 }
 // Common basal canopy between LODs. Individual narrow drooping strips
 // overlap from staggered rooted starts, rather than sharing a radial crown.
 // The selected length fits a fixed author-space circle before world guard.
 // Low strips are identical in both detail levels, not billboards or decals.
 for(let i=0;i<(near?40:24);i++){
  const j=5723+53*i,sector=i%6,lined=(h(j,36)+sector)/6;
  const bx=-.487+.778*h(j,19);
  const bz=(lined-.5)*.995*(.81+.19*Math.cos(.9+2.7*bx));
  const tilt=(h(j,25)-.5)*(i%7===1?2.60:1.33)+.19*Math.sin(.54+i*.40);
  const turn=i%8===4?Math.PI:0;
  let ux=Math.cos(tilt+turn),uz=Math.sin(tilt+turn);
  const originRadius2=bx*bx+bz*bz,inside=.635**2;
  const leaving=bx*ux+bz*uz;
  let reach=-leaving+Math.sqrt(Math.max(0,leaving*leaving+inside-originRadius2));
  if(reach<.26){
   ux=-ux;uz=-uz;
   reach=leaving+Math.sqrt(Math.max(0,leaving*leaving+inside-originRadius2));
  }
  const vx=-uz,vz=ux,bud=.22+.72*h(j,91);
  const range=Math.min(reach,.412+.282*h(j,40));
  const bow=(h(j,59)-.48)*.083,hook=(h(j,51)-.5)*.039;
  const crest=.044+.097*h(j,14),foot=.009+.015*h(j,50),twist=(h(j,17)-.5)*1.43;
  const w=.011+.014*Math.pow(h(j,99),.77),blank=h(j,81);
  const steps=[0,.286+.098*blank,.64+.081*blank,1] as const;
  let last:number[]|undefined;
  for(let k=0;k<steps.length;k++){
   const u=steps[k],adv=range*(.76*u+.24*u*u);
   const slip=bow*Math.sin(Math.PI*u)+hook*u*u;
   const cup=Math.sin(Math.PI*u);
   const rise=foot+crest*Math.pow(cup,.84)+.017*blank*u-.007*u*u;
   const wide=w*(.44+.67*Math.sin(Math.PI*Math.pow(u,.81)))*Math.pow(1-u,.45);
   const section=(edge:number):P=>[
    bx+ux*adv+vx*(slip+edge*wide),
    rise+twist*edge*wide*(.24+.76*cup),
    bz+uz*adv+vz*(slip+edge*wide),
   ];
   if(k===steps.length-1){
    const tip=v(section(0),1.,0,3,bud);
    if(last)tri(last[0],last[1],tip,'mat');
    continue;
   }
   const q=[-1,1].map(side=>v(section(side),u,side,3,bud));
   if(last)quad(last[0],last[1],q[1],q[0],'mat');
   last=q;
  }
 }

 const geom=new BufferGeometry();
 geom.setAttribute('position',new Float32BufferAttribute(xyz,3));
 geom.setAttribute('marshBlade',new Float32BufferAttribute(marks,4));
 geom.setIndex(faces);geom.computeVertexNormals();geom.computeBoundingSphere();geom.computeBoundingBox();
 let maxRadius=0,maxY=0;
 const at=geom.getAttribute('position');
 for(let i=0;i<at.count;i++){
  maxRadius=Math.max(maxRadius,Math.hypot(at.getX(i),at.getZ(i)));maxY=Math.max(maxY,at.getY(i));
 }
 return {geometry:geom,triangles:faces.length/3,maxRadius,maxY,units};
}
