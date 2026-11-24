/** Compress a power-of-two relative grade mesh. Stock triangles may share
 * a larger coplanar leaf, but the entire authored surface and perimeter
 * remain a welded partition. Edge rosters include every new neighbour
 * vertex, not only the vertices chosen by this side of a boundary. */
type P=readonly [number,number];
type Tr=readonly [P,P,P];
const mid=(a:P,b:P):P=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const cross=(a:P,b:P,c:P)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const eq=(a:P,b:P)=>a[0]===b[0]&&a[1]===b[1];
const along=(a:P,b:P,q:P)=>(a[0]-q[0])*(b[0]-q[0])+(a[1]-q[1])*(b[1]-q[1])<0;

export function sparseGradeIndex(nx:number,nz:number,split:number,moved:(i:number,j:number)=>boolean,
 vertex:(i:number,j:number)=>number){
 if(split<2||split&(split-1)||(nx-1)%split||(nz-1)%split)throw Error('Invalid sparse grade geometry');
 const accW=nx+1,acc=new Uint32Array(accW*(nz+1));
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const k=(j+1)*accW+i+1;
  acc[k]=Number(moved(i,j))+acc[k-1]+acc[k-accW]-acc[k-accW-1];
 }
 const any=(a:P,b:P,c:P)=>{
  const x=Math.min(a[0],b[0],c[0]),X=Math.max(a[0],b[0],c[0])+1;
  const y=Math.min(a[1],b[1],c[1]),Y=Math.max(a[1],b[1],c[1])+1;
  return acc[Y*accW+X]+acc[y*accW+x]!==acc[Y*accW+x]+acc[y*accW+X];
 };
 const splitTri=(a:P,b:P,c:P,n:number)=>{
  if(n<=1||!any(a,b,c)){leaf.push([a,b,c]);return;}
  const d=mid(a,b),e=mid(b,c),f=mid(c,a);
  splitTri(a,d,f,n/2);splitTri(d,b,e,n/2);splitTri(f,e,c,n/2);splitTri(d,e,f,n/2);
 };
 const leaf:Tr[]=[];
 for(let j=0;j<nz-1;j+=split)for(let i=0;i<nx-1;i+=split){
  const a:P=[i,j],b:P=[i,j+split],c:P=[i+split,j+split],d:P=[i+split,j];
  splitTri(a,b,d,split);splitTri(b,c,d,split);
 }
 const seen=new Uint8Array(nx*nz);
 const mark=([x,y]:P)=>{seen[y*nx+x]=1;};
 for(const f of leaf)for(const p of f)mark(p);
 // The untouched parent faces bordering this inset already split their
 // complete common edge. Keep the same roster at the corrected perimeter.
 for(let x=0;x<nx;x++){mark([x,0]);mark([x,nz-1]);}
 for(let y=1;y<nz-1;y++){mark([0,y]);mark([nx-1,y]);}
 const indices:number[]=[];
 const emit=(a:P,b:P,c:P)=>indices.push(vertex(...a),vertex(...b),vertex(...c));
 for(const f of leaf){
  const ring:P[]=[];
  for(let k=0;k<3;k++){
   const a=f[k],b=f[(k+1)%3],dx=Math.sign(b[0]-a[0]),dy=Math.sign(b[1]-a[1]);
   for(let x=a[0],y=a[1];x!==b[0]||y!==b[1];x+=dx,y+=dy)
    if(seen[y*nx+x])ring.push([x,y]);
  }
  // Convex triangular hull with collinear edge samples. Remove a
  // negative-turn ear only when the shortcut will not skip a boundary point.
  while(ring.length>3){
   let cut=false;
   for(let k=0;k<ring.length;k++){
    const a=ring[(k+ring.length-1)%ring.length],b=ring[k],c=ring[(k+1)%ring.length];
    if(cross(a,b,c)>=0||ring.some(q=>!eq(q,a)&&!eq(q,c)&&cross(a,c,q)===0&&along(a,c,q)))continue;
    emit(a,b,c);ring.splice(k,1);cut=true;break;
   }
   if(!cut)throw Error('Sparse grade partition could not preserve a shared edge');
  }
  if(cross(ring[0],ring[1],ring[2])>=0)throw Error('Collapsed grade leaf');
  emit(ring[0],ring[1],ring[2]);
 }
 return indices;
}
