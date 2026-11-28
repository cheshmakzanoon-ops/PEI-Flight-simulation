/** Original, detached visual study. Not a world site, nautical aid, or survey. */
import * as T from 'three';
export const northCapeReference=Object.freeze({
 light:1036, lon:-(63+59/60+48.8/3600), lat:47+3/60+27.7/3600,
 structureHeightMetres:19.5, historicReportedHeightMetres:62*.3048, historicSideMetres:10.75*.3048,
});
const N=8,TH=Math.PI/4,R=northCapeReference.historicSideMetres/(2*Math.sin(Math.PI/8));
const META=Object.freeze({bodyTop:14.91,roofTop:18.71,finial:19.5,topRadius:R*.57,deckRadius:R*.65});
const pale=new T.Color('#ded7ca'),seam=new T.Color('#c7bfb3'),warm=new T.Color('#eae4d5'),
 wine=new T.Color('#722e32'),shade=new T.Color('#4f2428'),dark=new T.Color('#22282d'),iron=new T.Color('#586371'),
 amber=new T.Color('#ce9645');
type V=T.Vector3;
const p=(r:number,y:number,k:number)=>new T.Vector3(r*Math.cos(k*TH-Math.PI/8),y,r*Math.sin(k*TH-Math.PI/8));
const towerR=(y:number)=>R+(META.topRadius-R)*(y/META.bodyTop);
// +X is the center of the unassigned study face, not an azimuth.
export const studyFaceXAtHeight=(y:number)=>towerR(y)*Math.cos(Math.PI/8);
type TrimSeat=Readonly<{height:number;first:number;end:number}>;
type FacadeDetail=Readonly<{kind:'vent'|'hooded-entry';face:0|1;first:number;end:number}>;
class ModelWords {
 private pos:number[]=[];private colour:number[]=[];
 tri(a:V,b:V,c:V,k:T.Color){for(const q of [a,b,c]){this.pos.push(q.x,q.y,q.z);this.colour.push(k.r,k.g,k.b);}}
 quad(a:V,b:V,c:V,d:V,k:T.Color){this.tri(a,b,c,k);this.tri(a,c,d,k);}
 walls(r0:number,y0:number,r1:number,y1:number,k:T.Color){
  for(let i=0;i<N;i++)this.quad(p(r0,y0,i),p(r1,y1,i),p(r1,y1,i+1),p(r0,y0,i+1),k);
 }
 disc(r:number,y:number,k:T.Color,top:boolean){
  for(let i=0;i<N;i++){
   const center=new T.Vector3(0,y,0),a=p(r,y,i),b=p(r,y,i+1);
   if(top)this.tri(center,b,a,k);else this.tri(center,a,b,k);
  }
 }
 collar(a:number,b:number,c:number,d:number,k:T.Color){this.walls(a,b,c,d,k);}
 bar(a:V,b:V,width:number,depth:number,c:T.Color){
  const q=b.clone().sub(a),n=q.length();
  const box=new T.BoxGeometry(width,n,depth),g=box.toNonIndexed(),v=g.getAttribute('position');box.dispose();
  const rot=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),q.normalize());
  const m=a.clone().add(b).multiplyScalar(.5),s=new T.Vector3();
  for(let i=0;i<v.count;i++){s.fromBufferAttribute(v,i).applyQuaternion(rot).add(m);this.pos.push(s.x,s.y,s.z);this.colour.push(c.r,c.g,c.b);}
  g.dispose();
 }
 get vertices(){return this.pos.length/3;}
 faceVolume(y:number,height:number,span:number,back:number,front:number,c:T.Color,center=0,face:0|1=0){
  const lo=y-height/2,hi=y+height/2,z=span/2;
  const point=(yy:number,zz:number,off:number)=>facePoint(face,yy,center+zz,off);
  const a=[point(lo,-z,front),point(hi,-z,front),point(hi,z,front),point(lo,z,front)];
  const b=[point(lo,-z,back),point(hi,-z,back),point(hi,z,back),point(lo,z,back)];
  this.quad(a[0],a[1],a[2],a[3],c);this.quad(b[3],b[2],b[1],b[0],c);
  for(let i=0;i<4;i++){
   const next=(i+1)%4;this.quad(a[i],b[i],b[next],a[next],c);
  }
 }
 finish(){
  const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(this.pos,3))
    .setAttribute('color',new T.Float32BufferAttribute(this.colour,3));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
}
function tower(b:ModelWords,near:boolean){
 const seats:TrimSeat[]=[];
 b.disc(R,0,seam,false);
 const rows=near?91:1;
 for(let j=0;j<rows;j++){
  const y=j*META.bodyTop/rows,Y=(j+1)*META.bodyTop/rows,h=Y-y;
  if(!near){b.walls(R,0,META.topRadius,META.bodyTop,pale);continue;}
  // Small authored lap with no copied photo/pixel texture. Pitch is visual.
  b.walls(towerR(y),y,towerR(y+h*.076)+.024,y+h*.076,seam);
  const t=(Math.imul(j+13,889523)>>>8&15)/15;
  b.walls(towerR(y+h*.076)+.024,y+h*.076,towerR(Y),Y,pale.clone().lerp(warm,t*.24));
 }
 const a=META.topRadius,d=META.deckRadius;
 b.collar(a,14.91,a+.13,15.02,warm);b.collar(a+.13,15.02,a+.11,15.12,seam);
 b.collar(a+.11,15.12,d,15.46,pale);b.collar(d,15.46,d+.11,15.545,wine);
 b.collar(d+.11,15.545,d+.07,15.616,shade);b.collar(d+.07,15.616,d+.07,15.72,wine);
 b.disc(d+.07,15.72,seam,true);
 if(near){
  // The reference view supports three trimmed openings on one face;
  // this view-local +X facade is not an asserted compass orientation.
  for(const y of [4.93,8.98,12.72]){
   const first=b.vertices;
   // All backs follow the shaft's taper. The casing remains buried by
   // 4.5 cm at all heights while its face clears the small shingle lap.
   b.faceVolume(y,1.54,1.03,-.045,.095,shade);
   b.faceVolume(y,1.36,.84,.094,.118,iron);
   b.faceVolume(y,1.23,.72,.117,.136,dark);
   b.faceVolume(y+.02,.053,.735,.135,.162,seam);
   b.faceVolume(y-.72,.09,1.14,-.015,.174,wine);
   seats.push(Object.freeze({height:y,first,end:b.vertices}));
  }
 }
 return Object.freeze(seats);
}
function facePoint(face:0|1,y:number,tangent:number,offset:number){
 const x=studyFaceXAtHeight(y)+offset,c=face===0?1:Math.SQRT1_2,s=face===0?0:Math.SQRT1_2;
 return new T.Vector3(c*x-s*tangent,y,s*x+c*tangent);
}
/** Visible in the dated views, but neither face is assigned a geographic bearing. */
function datedFacade(b:ModelWords):readonly FacadeDetail[]{
 const out:FacadeDetail[]=[];
 let first=b.vertices;
 // Small raised pale hood, with the dark line below it instead of a fourth sash.
 b.faceVolume(4.20,.27,.33,-.028,.085,iron,.90,0);
 b.faceVolume(4.25,.21,.39,-.029,.125,seam,.90,0);
 out.push(Object.freeze({kind:'vent',face:0,first,end:b.vertices}));
 first=b.vertices;
 b.faceVolume(1.17,1.84,1.08,-.055,.066,shade,0,1);
 b.faceVolume(1.17,1.67,.85,.065,.080,seam,0,1);
 b.faceVolume(.255,.083,1.09,-.022,.162,iron,0,1);
 for(const t of [-.50,.50]){
  const lower=facePoint(1,2.105,t,-.043),ridge=facePoint(1,2.425,0,-.043);
  const lip=facePoint(1,2.079,t,.38),peak=facePoint(1,2.399,0,.38);
  if(t>0)b.quad(lower,lip,peak,ridge,wine);else b.quad(ridge,peak,lip,lower,wine);
  b.bar(lip,peak,.043,.043,seam);
 }
 // Front hood gable fills its silhouette; never a projecting false dormer.
 b.tri(facePoint(1,2.079,-.50,.379),facePoint(1,2.399,0,.379),facePoint(1,2.079,.50,.379),shade);
 out.push(Object.freeze({kind:'hooded-entry',face:1,first,end:b.vertices}));
 return Object.freeze(out);
}
function gallery(b:ModelWords,near:boolean){
 const r=META.deckRadius+.015,lantern=r*.63;
 const posts:{first:number;end:number}[]=[];
 for(let i=0;i<N;i++){
  const a=p(r,15.69,i),z=p(r,15.69,i+1),A=p(r,16.62,i),Z=p(r,16.62,i+1);
  const first=b.vertices;b.bar(a,A,.14,.14,warm);posts.push(Object.freeze({first,end:b.vertices}));
  b.bar(A,Z,.11,.13,pale);
  if(near){
   const c=a.clone().lerp(A,.10),d=z.clone().lerp(Z,.87);
   b.bar(c,d,.060,.087,warm);b.bar(z.clone().lerp(Z,.10),a.clone().lerp(A,.87),.060,.087,pale);
   b.bar(a.clone().lerp(A,.17),z.clone().lerp(Z,.17),.073,.091,seam);
  }
  b.bar(p(lantern,15.71,i),p(lantern,18.16,i),.11,.11,wine);
 }
 b.collar(lantern,15.74,lantern,16.39,wine);
 b.collar(lantern,16.39,lantern+.065,16.45,shade);
 b.collar(lantern+.08,18.10,lantern+.09,18.22,wine);
 b.collar(lantern+.09,18.22,.288,META.roofTop,shade);
 b.collar(.288,META.roofTop,.144,19.30,wine);
 b.collar(.144,19.30,.033,META.finial,shade);
 b.disc(.033,META.finial,shade,true);
 // Lantern backing is illustrative; not a flashing navigational signal.
 b.quad(p(lantern-.028,16.45,5),p(lantern-.028,18.10,5),p(lantern-.028,18.10,6),p(lantern-.028,16.45,6),wine);
 b.collar(.30,16.63,.265,17.40,amber);
 b.disc(.265,17.4,amber,true);
 return {radius:lantern,posts:Object.freeze(posts)};
}
export function makeNorthCapeDetachedStudy(near=true,detail:'baseline'|'dated-facade'='baseline'){
 const b=new ModelWords(),g=new ModelWords();
 const trimSeats=tower(b,near),deck=gallery(b,near),r=deck.radius-.031;
 for(let i=0;i<N;i++)if(i!==5)g.quad(p(r,16.46,i),p(r,18.095,i),p(r,18.095,i+1),p(r,16.46,i+1),warm);
 const facadeDetails=near&&detail==='dated-facade'?datedFacade(b):Object.freeze([]);
 const solid=b.finish(),glass=g.finish();
 const paint=new T.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.02});
 const glazing=new T.MeshPhysicalMaterial({color:'#8fa6a6',roughness:.21,metalness:.025,
  transparent:true,opacity:.49,depthWrite:false,side:T.FrontSide});
 const exterior=new T.Mesh(solid,paint),panes=new T.Mesh(glass,glazing),group=new T.Group();
 exterior.name='North Cape tower, authored timber and gallery';panes.name='North Cape tower, illustrative lantern glazing';
 group.name='North Cape Light · detached historically guided study';group.add(exterior,panes);
 return {group,exterior,panes,near,trimSeats,facadeDetails,galleryPosts:deck.posts,ringEdges:N,glassFaces:N-1,
  triangles:solid.getAttribute('position').count/3+glass.getAttribute('position').count/3,
  dispose(){solid.dispose();glass.dispose();paint.dispose();glazing.dispose();}};
}
