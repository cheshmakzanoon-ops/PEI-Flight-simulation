/** A downward triangle query on actual Three.js world vertices, not a terrain/grid sampler.
 * The geometric seam probe compares adjacent triangle *planes at the edge itself* to
 * distinguish a crack from the legitimate slope over the 8 mm probe spacing. */
export class GroundIndex {
  constructor(bounds, step = 6) {
    this.bounds = bounds; this.step = step;
    this.nx = Math.ceil((bounds.x1 - bounds.x0) / step) + 1;
    this.nz = Math.ceil((bounds.z1 - bounds.z0) / step) + 1;
    this.bins = new Map(); this.tris = [];
  }
  col(x) { return Math.floor((x - this.bounds.x0) / this.step); }
  row(z) { return Math.floor((z - this.bounds.z0) / this.step); }
  add(a,b,c) {
    const {x0,x1,z0,z1} = this.bounds;
    const xmin = Math.min(a.x,b.x,c.x), xmax = Math.max(a.x,b.x,c.x);
    const zmin = Math.min(a.z,b.z,c.z), zmax = Math.max(a.z,b.z,c.z);
    if (xmin > x1 || xmax < x0 || zmin > z1 || zmax < z0) return;
    const bx=b.x-a.x,bz=b.z-a.z,cx=c.x-a.x,cz=c.z-a.z, det=bx*cz-bz*cx;
    if (Math.abs(det)<1e-10) return;
    // World ground uses FrontSide and counterclockwise winding as seen from above.
    // Record backfaces separately; Three.Raycaster cross-checks the actual material.
    const t={a,b,c,uX:cz/det,uZ:-cx/det,vX:-bz/det,vZ:bx/det,
      dyU:b.y-a.y,dyV:c.y-a.y,up:det<0};
    if(!t.up) {this.backfaces=(this.backfaces||0)+1;return;}
    this.tris.push(t);
    for(let k=Math.max(this.row(zmin),0);k<=Math.min(this.row(zmax),this.nz-1);k++)
      for(let i=Math.max(this.col(xmin),0);i<=Math.min(this.col(xmax),this.nx-1);i++){
        const key=k*this.nx+i;let bin=this.bins.get(key);if(!bin)this.bins.set(key,bin=[]);bin.push(t);
      }
  }
  hits(x,z) {
    const i=this.col(x),j=this.row(z),out=[];
    if(i<0||j<0||i>=this.nx||j>=this.nz)return out;
    for(const t of this.bins.get(j*this.nx+i)||[]){
      const dx=x-t.a.x,dz=z-t.a.z,u=t.uX*dx+t.uZ*dz,v=t.vX*dx+t.vZ*dz;
      if(u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9)
        out.push({t,y:t.a.y+t.dyU*u+t.dyV*v,inside:Math.min(u,v,1-u-v)>1e-8});
    }
    return out;
  }
}
export function planeY(t,x,z) {
  const dx=x-t.a.x,dz=z-t.a.z;
  return t.a.y+t.dyU*(t.uX*dx+t.uZ*dz)+t.dyV*(t.vX*dx+t.vZ*dz);
}
export function auditEdges(index) {
  const {x0,x1,z0,z1}=index.bounds, seen=new Set();
  let profiles=0,gaps=0,overlaps=0,maxJump=0, worst=null;
  // Canonical string keys deduplicate EXACT endpoints only; a T junction's short
  // segments still get probes even when the opposing edge spans several of them.
  const key=p=>p.x+','+p.z;
  for(const t of index.tris)for(const [a,b] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]){
    const ak=key(a),bk=key(b),edge=ak<bk?ak+';'+bk:bk+';'+ak;
    if(seen.has(edge))continue;seen.add(edge);
    const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    if(length<.05)continue;
    const offset=Math.min(.004,length*.001),ox=-dz/length*offset,oz=dx/length*offset;
    for(const f of [.213,.571,.873]){
      const x=a.x+f*dx,z=a.z+f*dz;
      if(x<x0+1||x>x1-1||z<z0+1||z>z1-1)continue;
      const left=index.hits(x+ox,z+oz),right=index.hits(x-ox,z-oz);
      profiles++;
      if(!left.length||!right.length){gaps++;continue;}
      if(left.filter(h=>h.inside).length>1||right.filter(h=>h.inside).length>1)overlaps++;
      let jump=0;
      for(const l of left)for(const r of right)
        jump=Math.max(jump,Math.abs(planeY(l.t,x,z)-planeY(r.t,x,z)));
      if(jump>maxJump){maxJump=jump;worst=[x,z];}
    }
  }
  return {trianglesInProbe:index.tris.length,backfaces:index.backfaces||0,profiles,gaps,overlaps,
    maxEdgeJumpM:+maxJump.toFixed(6),worstXZ:worst&&worst.map(x=>+x.toFixed(3))};
}
