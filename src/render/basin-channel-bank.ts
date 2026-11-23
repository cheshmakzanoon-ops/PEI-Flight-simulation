import {project} from '../sim/geo.ts';
import type {Cover} from '../sim/cover.ts';
import type {Terrain} from '../sim/terrain.ts';
import type {ShoreSegment} from '../sim/shoreline.ts';

/** A local rendering repair to the pinned simulation contour, not a new shore survey. */
const a=project(-62.1122,46.3815), b=project(-62.1015,46.3764);
export const BANK_TILE='29-13';
export const inBasinBank=(s:ShoreSegment)=>{
 const inside=(x:number,z:number)=>x>a.x&&x<b.x&&z>a.z&&z<b.z;
 return inside(s.ax,s.az)&&inside(s.bx,s.bz);
};
const mix=(a:number,b:number,r:number)=>a+(b-a)*r;
const smooth=(q:number)=>{const p=Math.max(0,Math.min(1,q));return p*p*(3-2*p);};
const endpointKey=(x:number,z:number)=>Math.round(x*1000)+','+Math.round(z*1000);
const windowMargin=(x:number,z:number)=>Math.min(x-a.x,b.x-x,z-a.z,b.z-z);
export function basinBankJoins(near:readonly ShoreSegment[],rest:readonly ShoreSegment[]){
 const known=new Set<string>();
 for(const s of rest)for(const [x,z] of [[s.ax,s.az],[s.bx,s.bz]]){
  if(windowMargin(x,z)>=-1)known.add(endpointKey(x,z));
 }
 const joins=new Map<string,Point>();
 for(const s of near)for(const [x,z] of [[s.ax,s.az],[s.bx,s.bz]]){
  const k=endpointKey(x,z);if(known.has(k))joins.set(k,{x,z});
 }
 return [...joins.values()];
}
const shoreWeight=(x:number,z:number,joins:readonly Point[])=>{
 let side=windowMargin(x,z);
 for(const p of joins)side=Math.min(side,Math.hypot(x-p.x,z-p.z));
 return smooth(side/62);
};

type Point={x:number;z:number};
type Ground=(x:number,z:number)=>number;
/** Trace the same pixel-centred, bilinear field as land and water. Keep both
 * inherited cell crossings exact. Degenerate source chords stay unmodified. */
export function traceBasinBank(c:Cover,t:Terrain,s:ShoreSegment):Point[]|undefined{
 const [u,v]=t.uv((s.ax+s.bx)*.5,(s.az+s.bz)*.5);
 const i=Math.floor(u*c.width-.5),j=Math.floor(v*c.height-.5);
 if(i<0||j<0||i>=c.width-1||j>=c.height-1)return;
 const dx=(t.right-t.left)/c.width,dz=(t.bottom-t.top)/c.height;
 const x=t.left+(i+.5)*dx,z=t.top+(j+.5)*dz;
 const p=(u:number,v:number)=>c.bytes[((j+v)*c.width+i+u)*2+1]-128;
 const base=p(0,0),a=p(1,0)-base,b=p(0,1)-base,d=p(1,1)-base-a-b;
 const X=(q:number)=> (q-x)/dx,Z=(q:number)=>(q-z)/dz;
 const bx=X(s.ax),ex=X(s.bx),bz=Z(s.az),ez=Z(s.bz);
 const alongX=Math.abs(s.bx-s.ax)>=Math.abs(s.bz-s.az);
 const steps=Math.min(160,Math.max(2,Math.ceil(Math.hypot(s.bx-s.ax,s.bz-s.az)/.55)));
 const pts:Point[]=[{x:s.ax,z:s.az}];
 const unit=(u:number)=>u>=-2e-7&&u<=1+2e-7;
 for(let k=1;k<steps;k++){
  const q=k/steps;
  let u=mix(bx,ex,q),v=mix(bz,ez,q);
  if(alongX){
   const den=b+d*u;
   if(Math.abs(den)<1e-9){if(Math.abs(base+a*u)>1e-8)return;}
   else v=-(base+a*u)/den;
  }else{
   const den=a+d*v;
   if(Math.abs(den)<1e-9){if(Math.abs(base+b*v)>1e-8)return;}
   else u=-(base+b*v)/den;
  }
  if(!unit(u)||!unit(v))return;
  pts.push({x:x+u*dx,z:z+v*dz});
 }
 pts.push({x:s.bx,z:s.bz});
 return pts;
}

/** A vertical separator from sea to actual visible terrain, rather than a
 * raised red barrier between approximate model and the sea plane. The
 * small top overlap covers raster/Float32 tolerance without imitating a cliff. */
export function basinBankGeometry(c:Cover,t:Terrain,segs:readonly ShoreSegment[],ground:Ground,joins:readonly Point[]=[]){
 const out:number[]=[];
 for(const s of segs){
  const cut=traceBasinBank(c,t,s)??[{x:s.ax,z:s.az},{x:s.bx,z:s.bz}];
  const top=(p:Point)=>{
   const q=shoreWeight(p.x,p.z,joins),old=t.meshElevation(p.x,p.z)+.72;
   const floor=ground(p.x,p.z);
   // Do not inherit a known legacy gap in the blend collar. All four
   // measured splices already clear the new floor, preserving exact Y.
   return Math.max(-.025,Number.isFinite(floor)?Math.max(mix(old,floor+.035,q),floor+.012):old);
  };
  for(let i=1;i<cut.length;i++){
   const p=cut[i-1],q=cut[i],py=top(p),qy=top(q);
   const bot=Math.min(-.14,py-.82,qy-.82);
   out.push(p.x,bot,p.z,q.x,bot,q.z,p.x,py,p.z,p.x,py,p.z,q.x,bot,q.z,q.x,qy,q.z);
  }
 }
 return Float32Array.from(out);
}
