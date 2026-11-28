/** Detached primitive builder, with supplied interpretation rather than a
 * guessed scene instance. This module contains NO East Point window layout. */
import * as T from 'three';
export type Wall=Readonly<{u:number;v0:number;v1:number;highEave:number;anchor:readonly[number,number];yaw:number}>;
export type Sash=Readonly<{along01:number;bottom:number;width:number;height:number;panes:readonly[2|3,2|3];historicalMeetingRail?:boolean}>;
const paint={frame:0x9b302a,pane:0x3c5157,mullion:0xd0ccc0,sill:0xede7da} as const;
type Part=keyof typeof paint;
const guard=(q:unknown,m:string)=>{if(!q)throw Error(m);};
export function detachedWindowPrimitive(w:Wall,window:Sash){
 const {u,v0,v1,yaw,anchor,highEave}=w,extent=v1-v0;
 const {along01,bottom,width,height,panes:[cx,cy]}=window;
 guard([u,v0,v1,yaw,highEave,...anchor,along01,bottom,width,height].every(Number.isFinite)&&extent>3&&extent<20,'authored wall domain');
 guard(along01>0&&along01<1&&[2,3].includes(cx)&&[2,3].includes(cy)&&width>=.5&&width<=1.7&&
  height>=.75&&height<=2.5&&bottom>=.45&&bottom+height<highEave-.32,'outside supported eave or bottom');
 const v=v0+extent*along01,l=v-width/2,r=v+width/2,Tt=bottom+height,s=.087,S=.036;
 guard(l>v0+.65&&r<v1-.65,'end margin');
 const p:number[]=[],n:number[]=[],c:number[]=[],clad:number[]=[];
 const spans:{kind:Part;first:number;end:number;uMin:number;uMax:number;paint:number}[]=[];
 const q=new T.Vector3(),N=new T.Vector3(),M=new T.Matrix4().makeRotationY(yaw).setPosition(anchor[0],0,anchor[1]);
 const wN=new T.Matrix3().getNormalMatrix(M);
 const emit=(kind:Part,front:number,back:number,a:number,b:number,low:number,high:number,ink:number=paint[kind])=>{
  guard(front<back&&a<b&&low<high&&front>=u-.095&&back<=u+.04,'authored shell depth');
  const shell=new T.BoxGeometry(back-front,high-low,b-a),pos=shell.getAttribute('position'),nr=shell.getAttribute('normal'),idx=shell.index!;
  const rgb=new T.Color(ink),start=p.length/3;
  for(let i=0;i<idx.count;i++){
   const j=idx.getX(i);
   q.fromBufferAttribute(pos,j).add(new T.Vector3((front+back)/2,(low+high)/2,(a+b)/2)).applyMatrix4(M);
   N.fromBufferAttribute(nr,j).applyNormalMatrix(wN);
   p.push(q.x,q.y,q.z);n.push(N.x,N.y,N.z);c.push(rgb.r,rgb.g,rgb.b);clad.push(0);
  }
  shell.dispose();spans.push({kind,first:start,end:p.length/3,uMin:front,uMax:back,paint:ink});
 };
 // Each visible element has thickness. Casing penetrates the new wall;
 // glass reads as dark opaque panes, inside the front edge of the red frame.
 const facing=u-.091,body=u+.033,glassFront=u-.046,bar=u-.067,inside=u+.01;
 for(const [a,b] of [[l,l+s],[r-s,r]])emit('frame',facing,body,a,b,bottom,Tt);
 for(const [a,b] of [[bottom,bottom+s],[Tt-s,Tt]])emit('frame',facing,body,l+s,r-s,a,b);
 const clearV=r-l-2*s, clearY=Tt-bottom-2*s;
 const V0=l+s,Y0=bottom+s;
 if(!window.historicalMeetingRail){
 for(let i=1;i<cx;i++){
  const mid=V0+i*clearV/cx;emit('mullion',bar,inside,mid-S/2,mid+S/2,Y0,Tt-s);
 }
 for(let y=1;y<cy;y++){
  const mid=Y0+y*clearY/cy;
  for(let j=0;j<cx;j++)emit('mullion',bar,inside,V0+j*clearV/cx+(j?S/2:0),
   V0+(j+1)*clearV/cx-(j+1<cx?S/2:0),mid-S/2,mid+S/2);
 }
 for(let i=0;i<cx;i++)for(let j=0;j<cy;j++)
  emit('pane',glassFront,inside,V0+i*clearV/cx+(i?S/2:0),V0+(i+1)*clearV/cx-(i+1<cx?S/2:0),
   Y0+j*clearY/cy+(j?S/2:0),Y0+(j+1)*clearY/cy-(j+1<cy?S/2:0));
 }else{
  // Explicit authored interpretation of the dated upper six lights:
  // two rows of three pale panes, a stronger meeting rail, and a darker
  // divided lower section. None of the colors are reflectance estimates.
  const middle=Y0+clearY*.51, meeting=.084,upper=middle+meeting*.5,lower=middle-meeting*.5;
  emit('mullion',bar,inside,V0,r-s,lower,upper);
  const cv=clearV/3,tall=(Tt-s-upper)*.5;
  for(let i=0;i<3;i++){
   const lo=V0+cv*i+(i?S/2:0),hi=V0+cv*(i+1)-(i<2?S/2:0);
   if(i)for(const [b,t] of [[Y0,lower],[upper,Tt-s]])emit('mullion',bar,inside,V0+cv*i-S*.5,V0+cv*i+S*.5,b,t);
   emit('mullion',bar,inside,lo,hi,upper+tall-S*.5,upper+tall+S*.5);
   emit('pane',glassFront,inside,lo,hi,Y0,lower,0x35484a);
   emit('pane',glassFront,inside,lo,hi,upper,upper+tall-S*.5,0x728585);
   emit('pane',glassFront,inside,lo,hi,upper+tall+S*.5,Tt-s,0x728585);
  }
 }
 emit('sill',u-.093,body,l-.035,r+.035,bottom-.071,bottom);
 const g=new T.BufferGeometry();
 for(const [name,count,words] of [['position',3,p],['normal',3,n],['color',3,c],['clad',1,clad]]as const)
  g.setAttribute(name,new T.Float32BufferAttribute(words,count));
 g.computeBoundingSphere();return {geometry:g,spans};
}

/** Conservative posed study, at most two separated non-overlapping
 * apertures. Caller supplies independently accepted positions. */
export function detachedLocatedSashes(w:Wall,accepted:readonly Sash[]){
 guard(accepted.length===1||accepted.length===2,'one or two source-supported apertures only');
 const cells=[...accepted].sort((a,b)=>a.along01-b.along01);
 if(cells.length===2){
  const [left,right]=cells;
  guard((right.along01-left.along01)*(w.v1-w.v0)-(left.width+right.width)/2>=.25,
   'separated apertures must leave clear wall');
 }
 const attrs=['position','normal','color','clad'] as const;
 const sets:ReturnType<typeof detachedWindowPrimitive>[]=[],geometry=new T.BufferGeometry();
 try{
  for(const c of cells)sets.push(detachedWindowPrimitive(w,c));
  for(const [i,k] of attrs.entries()){
   const n=i===3?1:3,streams=sets.map(s=>s.geometry.getAttribute(k).array);
   const out=new Float32Array(streams.reduce((a,b)=>a+b.length,0));let x=0;
   for(const stream of streams){out.set(stream,x);x+=stream.length;}
   geometry.setAttribute(k,new T.BufferAttribute(out,n));
  }
  geometry.computeBoundingSphere();
  return {geometry,studyScope:'detached opaque windows, no facade holes',apertures:sets.length};
 }catch(e){geometry.dispose();throw e;}
 finally{sets.forEach(s=>s.geometry.dispose());}
}
