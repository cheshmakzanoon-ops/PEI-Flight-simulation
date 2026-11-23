import {facet} from './coastal-terrain.ts';
type Survey=(u:number,v:number)=>number|undefined;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
interface GridSpec{
 n:number; split:number;
 baseline:Float32Array;
 /** Exact previous render lattice. Existing geometry and seams stay authoritative at the tile edge. */
 canRefine:(col:number,row:number)=>boolean;
 /** Finite terrain height where the source and vetted cover jointly support it. */
 survey:Survey;
}
/**
 * Refine complete original cells rather than overlay a second mesh. At a
 * refined/coarse boundary, new vertices land on the precise original edge;
 * at a refined/refined boundary, both sides use identical source heights.
 */
export class AdaptiveRelief{
 readonly n:number;
 readonly split:number;
 readonly selected:Uint8Array;
 /** Per refined cell: absolute offset into a single packed row-first lattice. */
 readonly cellOffset:Int32Array;
 readonly positions:Float32Array; // u/y/v, prototype; renderer projects X/Z once.
 readonly indices:Uint32Array;
 readonly originalVertices:number;
 readonly refinedCells:number;
 constructor({n,split,baseline,canRefine,survey}:GridSpec){
  if(!Number.isInteger(n)||n<2||n>112||!Number.isInteger(split)||split<2||split>8||
     baseline.length!==(n+1)**2||baseline.some(h=>!Number.isFinite(h)))throw Error('Invalid adaptive relief lattice');
  this.n=n;this.split=split;
  const selected=this.selected=new Uint8Array(n*n);
  const offsets=this.cellOffset=new Int32Array(n*n);offsets.fill(-1);
  const parent=n+1,step=split+1,finePerCell=step*step;
  const selectedAt=(i:number,j:number)=>i>=0&&j>=0&&i<n&&j<n&&!!selected[j*n+i];
  let cells=0;
  // Keep the outer ring immutable, including existing coarse/fine sewn edges.
  for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++)if(canRefine(i,j)){selected[j*n+i]=1;cells++;}
  this.refinedCells=cells;
  const coarse=this.originalVertices=parent*parent;
  let free=coarse,extraFaces=0,centres=0;
  const stitch=(a:boolean,b:boolean)=>{
   const sides=Number(a)+Number(b);
   if(sides){centres++;extraFaces+=2+sides*(split-1);}
  };
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   if(selectedAt(i,j)){offsets[j*n+i]=free;free+=finePerCell;}
   else {stitch(selectedAt(i-1,j),selectedAt(i,j-1));stitch(selectedAt(i,j+1),selectedAt(i+1,j));}
  }
  const pos=this.positions=new Float32Array((free+centres)*3);
  const idx=this.indices=new Uint32Array(((n*n-cells)+cells*split*split)*6+extraFaces*3);
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
   const k=(j*parent+i)*3;
   pos[k]=i/n;pos[k+1]=baseline[j*parent+i];pos[k+2]=j/n;
  }
  let head=0,cursor=free;
  const tri=(a:number,b:number,c:number)=>{idx[head++]=a;idx[head++]=b;idx[head++]=c;};
  const face=(a:number,b:number,c:number,d:number)=>{
   // NW/SW/NE and SW/SE/NE. Matches Three PlaneGeometry rotated onto XZ.
   tri(a,c,b);tri(c,d,b);
  };
  const fine=(i:number,j:number,x:number,z:number)=>offsets[j*n+i]+z*step+x;
  const fan=(ring:number[],a:number,b:number,c:number)=>{
   if(ring.length===3){tri(a,b,c);return;}
   // Split coarse edges at their actual shared vertices. Every resulting
   // small triangle stays on the original plane; no raster T-junction.
   const centre=cursor++;
   for(let k=0;k<3;k++)pos[centre*3+k]=(pos[a*3+k]+pos[b*3+k]+pos[c*3+k])/3;
   for(let k=0;k<ring.length;k++)tri(ring[k],ring[(k+1)%ring.length],centre);
  };
  const highCorner=(i:number,j:number)=>selectedAt(i,j)&&selectedAt(i-1,j)&&selectedAt(i,j-1)&&selectedAt(i-1,j-1);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const k=j*parent+i;
   if(!selectedAt(i,j)){
    const sw=k+parent,ne=k+1,se=sw+1;
    const first=[k],second=[sw];
    if(selectedAt(i-1,j))for(let u=1;u<split;u++)first.push(fine(i-1,j,split,u));
    first.push(sw,ne);
    if(selectedAt(i,j-1))for(let u=split-1;u>0;u--)first.push(fine(i,j-1,u,split));
    if(selectedAt(i,j+1))for(let u=1;u<split;u++)second.push(fine(i,j+1,u,0));
    second.push(se);
    if(selectedAt(i+1,j))for(let u=split-1;u>0;u--)second.push(fine(i+1,j,0,u));
    second.push(ne);
    fan(first,k,sw,ne);fan(second,sw,se,ne);
    continue;
   }
   const next=offsets[j*n+i];
   const nw=baseline[k],ne=baseline[k+1],sw=baseline[k+parent],se=baseline[k+parent+1];
   for(let b=0;b<=split;b++)for(let a=0;a<=split;a++){
    // Form global integer sub-node indices before division: no competing rounding paths.
    const gi=i*split+a,gj=j*split+b,u=gi/(n*split),v=gj/(n*split);
    const onX=a===0||a===split,onZ=b===0||b===split;
    const covered=onX&&onZ?highCorner(gi/split,gj/split):
     onX?selectedAt(a===0?i-1:i+1,j):onZ?selectedAt(i,b===0?j-1:j+1):true;
    const measured=covered?survey(u,v):undefined;
    // Use an order-independent interpolation on shared unsupported edges.
    const x=a/split,z=b/split;
    const old=onX?(a===0?mix(nw,sw,z):mix(ne,se,z)):
     onZ?(b===0?mix(nw,ne,x):mix(sw,se,x)):facet(x,z,nw,ne,sw,se);
    let y=old;
    if(measured!==undefined&&Number.isFinite(measured)){
     // Blend correction on the measured side over half of an inherited
     // cell. The same canonical distance at a shared node keeps both
     // copies identical and leaves all protected sides on the old grade.
     const px=gi/split,pz=gj/split;
     let radius=.5;
     const cx=Math.floor(px),cz=Math.floor(pz);
     for(let iz=cz-1;iz<=cz+1;iz++)for(let ix=cx-1;ix<=cx+1;ix++)
      if(!selectedAt(ix,iz))radius=Math.min(radius,Math.hypot(Math.max(ix-px,px-ix-1,0),Math.max(iz-pz,pz-iz-1,0)));
     const w=radius*2;y=mix(old,measured,w*w*(3-2*w));
    }
    const q=(next+b*step+a)*3;
    pos[q]=u;pos[q+1]=y;pos[q+2]=v;
   }
   for(let b=0;b<split;b++)for(let a=0;a<split;a++){
    const j=next+b*step+a;face(j,j+1,j+step,j+step+1);
   }
  }
  if(head!==idx.length||cursor!==pos.length/3)throw Error('Adaptive relief topology accounting error');
 }
 /** Distance in base-cell units to a selected cell in the one-cell moat. */
 supportDistance(u:number,v:number){
  const n=this.n,x=Math.max(0,Math.min(n,u*n)),z=Math.max(0,Math.min(n,v*n));
  const a=Math.min(n-1,Math.floor(x)),b=Math.min(n-1,Math.floor(z));
  if(this.selected[b*n+a])return 0;
  let d=1;
  for(let j=Math.max(0,b-1);j<=Math.min(n-1,b+1);j++)for(let i=Math.max(0,a-1);i<=Math.min(n-1,a+1);i++){
   if(!this.selected[j*n+i])continue;
   d=Math.min(d,Math.hypot(Math.max(i-x,x-i-1,0),Math.max(j-z,z-j-1,0)));
  }
  return d;
 }
 /** Heights follow submitted triangles, not a detached bilinear texture. */
 height(u:number,v:number){
  const {n,split,positions:p,cellOffset:o}=this;
  const x=Math.max(0,Math.min(n,u*n)),z=Math.max(0,Math.min(n,v*n));
  const i=Math.min(n-1,Math.floor(x)),j=Math.min(n-1,Math.floor(z)),x0=x-i,z0=z-j;
  const start=o[j*n+i];
  const at=(k:number)=>p[k*3+1];
  if(start<0){
   const k=j*(n+1)+i;
   return facet(x0,z0,at(k),at(k+1),at(k+n+1),at(k+n+2));
  }
  const xf=x0*split,zf=z0*split,a=Math.min(split-1,Math.floor(xf)),b=Math.min(split-1,Math.floor(zf));
  const k=start+b*(split+1)+a;
  return facet(xf-a,zf-b,at(k),at(k+1),at(k+split+1),at(k+split+2));
 }
}
