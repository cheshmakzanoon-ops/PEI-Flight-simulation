// Local rendering candidates, not a botanical survey or placement authority.
// Source ownership is the already established 10.10m square per nonzero
// texture support. Every authored descendant and gust stays inside it.
const MAX_DISTANCE=108,MAX_INPUT=360,HALF_SUPPORT=5.05,STRATA=24;
const hash=(a:number,b:number,s:number)=>{
 const k=(Math.imul(a,374761393)+Math.imul(b,668265263)+s)>>>0;
 const h=Math.imul(k^(k>>>13),1274126177)>>>0;return ((h^(h>>>16))>>>0)/4294967296;
};
export type MarshFieldRoot=Readonly<{
 id:number;x:number;z:number;cellI:number;cellJ:number;
 permittedRadius:number;gain:number;height:number;spread:number;damp:number;age:number;
}>;
export type MarshFieldSpec=Readonly<{origin:readonly [number,number];width:number;height:number;step:number;cells:number}>;
export class MarshRootField{
 private readonly x0:number;
 private readonly z0:number;
 private readonly points:Uint8Array;
 readonly width:number;
 readonly height:number;
 constructor(s:MarshFieldSpec,m:Uint8Array){
  const [x,z]=s.origin;
  if(!Number.isFinite(x)||!Number.isFinite(z)||s.step!==5||!Number.isSafeInteger(s.width)||!Number.isSafeInteger(s.height)||
   s.width<5||s.height<5||s.width*s.height>100000||s.width*s.height!==m.length)
   throw Error('Wrong marsh texture dimensions');
  let cells=0;
  for(let j=0;j<s.height;j++)for(let i=0;i<s.width;i++)if(m[j*s.width+i]){
   if(i<1||j<1||i>=s.width-1||j>=s.height-1)throw Error('Marsh texture perimeter must be neutral');
   cells++;
  }
  if(cells!==s.cells)throw Error('Unknown marsh authority count');
  this.x0=x;this.z0=z;this.width=s.width;this.height=s.height;this.points=m.slice();
 }
 private original(i:number,j:number,k:number):MarshFieldRoot|undefined{
  if(i<1||j<1||i>=this.width-1||j>=this.height-1||k<0||k>=STRATA||!Number.isInteger(k))return;
  const gain=this.points[j*this.width+i],cover=hash(i/3|0,j/3|0,17);
  if(gain<85)return;
  // Wet traces and drier banks appear as coherent mats/clumps instead of
  // a uniform pool of isolated seedlings. The numbers are authored, not a survey.
  const chance=cover<.14?.19:cover<.28?.58:.95;
  if(hash(i*13+k,j*11,37)>chance*(.56+.44*gain/255))return;
  const slot=(k*13+((7*i+11*j)%25))%25;
  const dx=(slot%5-2)*.81+(hash(i,j,391+k*29)-.5)*.58;
  const dz=(Math.floor(slot/5)-2)*.81+(hash(j,i,413+k*59)-.5)*.58;
  const x=this.x0+5*(i+.5)+dx,z=this.z0+5*(j+.5)+dz;
  const id=(j*this.width+i)*STRATA+k,permittedRadius=.62+.30*hash(i*11,j*11,481+k*53);
  const crown=hash(i*7+k,j*5,197);
  const track=.54*cover+.46*hash(i/5|0,j/5|0,359),tall=track>.48;
  const damp=Math.max(0,Math.min(1,.16+.52*track+.32*hash(j,i,79)));
  const age=Math.max(0,Math.min(1,.12+.59*(1-track)+.28*hash(i,j+k,163)));
  const height=tall?.48+.49*crown:.28+.36*crown;
  const spread=tall?.72+.33*hash(i+k,j,305):.90+.31*hash(i+k,j,305);
  return {id,x,z,cellI:i,cellJ:j,permittedRadius,gain,height,spread,damp,age};
 }
 query(x:number,z:number,dist=MAX_DISTANCE,cap=MAX_INPUT){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(dist)||dist<0||dist>MAX_DISTANCE||
   !Number.isInteger(cap)||cap<1||cap>MAX_INPUT)return [];
  // Small deterministic inner queries preserve the exact nearest roster
  // yet do not allocate all distant roots whenever the camera moves.
  let reach=Math.min(dist,15),previous=-1;
  const items:{d:number;r:MarshFieldRoot}[]=[];
  while(true){
   const i0=Math.max(1,Math.floor((x-reach-this.x0-2.0)/5)),i1=Math.min(this.width-2,Math.floor((x+reach-this.x0+2.0)/5));
   const j0=Math.max(1,Math.floor((z-reach-this.z0-2.0)/5)),j1=Math.min(this.height-2,Math.floor((z+reach-this.z0+2.0)/5));
   for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)for(let k=0;k<STRATA;k++){
    const r=this.original(i,j,k);
    if(r){
     const d=(r.x-x)**2+(r.z-z)**2;
     if(d>previous&&d<=reach**2)items.push({d,r});
    }
   }
   if(reach===dist||items.length>=cap)break;
   previous=reach**2;reach=Math.min(dist,reach*1.72);
  }
  return items.sort((a,b)=>a.d-b.d||a.r.id-b.r.id).slice(0,cap).map(a=>a.r);
 }
 /** A close bank may not consume the entire middle-distance allowance.
  * Each candidate still has a known immutable source cell and envelope. */
 distributed(x:number,z:number){
  if(!Number.isFinite(x)||!Number.isFinite(z))return [];
  const close=this.query(x,z,17,136),seen=new Set(close.map(q=>q.id));
  const rings:{root:MarshFieldRoot;priority:number}[][][]=Array.from({length:2},()=>Array.from({length:8},()=>[]));
  const outer=54,off=2;
  const i0=Math.max(1,Math.floor((x-outer-this.x0-off)/5)),i1=Math.min(this.width-2,Math.floor((x+outer-this.x0+off)/5));
  const j0=Math.max(1,Math.floor((z-outer-this.z0-off)/5)),j1=Math.min(this.height-2,Math.floor((z+outer-this.z0+off)/5));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
   const dx=this.x0+5*(i+.5)-x,dz=this.z0+5*(j+.5)-z,centre=Math.hypot(dx,dz);
   if(centre>outer+3.1||centre<11)continue;
   const start=Math.floor(hash(i,j,449)*STRATA);
   // Up to three well-spaced skirt roots from any one source cell.
   let added=0;
   for(let k=0;k<STRATA&&added<3;k++){
    const root=this.original(i,j,(start+k*11)%STRATA);
    if(!root||seen.has(root.id))continue;
    const d=Math.hypot(root.x-x,root.z-z);
    if(d<14||d>outer)continue;
    const sector=Math.min(7,Math.floor((Math.atan2(root.z-z,root.x-x)/Math.PI+1)*4)),band=d<29?0:1;
    rings[band][sector].push({root,priority:.88*hash(root.id,i+j,757)+.12*d/outer});added++;
   }
  }
  const result=[...close];
  for(let band=0;band<2;band++){
   const limit=band===0?75:129,per=rings[band];let take=0;
   per.forEach(q=>q.sort((a,b)=>a.priority-b.priority||a.root.id-b.root.id));
   for(let j=0;take<limit;j++){
    let any=false;
    for(const sector of per)if(sector[j]&&take<limit){
     any=true;
     const r=sector[j].root;
     if(seen.has(r.id))continue;
     seen.add(r.id);result.push(r);take++;
    }
    if(!any)break;
   }
  }
  return result;
 }
 permits(x:number,z:number,r:number,id:number){
  if(!Number.isInteger(id)||id<0||!Number.isFinite(r)||r<0)return false;
  const cell=Math.floor(id/STRATA),i=cell%this.width,j=Math.floor(cell/this.width);
  const row=this.original(i,j,id%STRATA);if(!row||row.x!==x||row.z!==z||r>row.permittedRadius)return false;
  return Math.abs(x-this.x0-5*(i+.5))+r<=HALF_SUPPORT&&Math.abs(z-this.z0-5*(j+.5))+r<=HALF_SUPPORT;
 }
}
