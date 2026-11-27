type XZ=readonly [x:number,z:number];
// Each incident triangle was partitioned against all input sample-cell
// boundaries already; don't use this to paper over a nonconforming base.
type Triple=readonly [number,number,number];
type Pair=readonly [number,number];
export type SignedEnvelope={lower:readonly Pair[];triangles:readonly Triple[]};
export function sharedSignedEnvelope(points:readonly XZ[], triangles:readonly Triple[],
 samples:readonly Pair[], cross:readonly Pair[], reserve:Pair):SignedEnvelope|undefined {
 if(samples.length!==points.length||triangles.length!==cross.length||points.length===0||
   reserve.some(z=>!Number.isFinite(z)||z<=0)||samples.some(z=>z.some(q=>!Number.isFinite(q)))||
   points.some(z=>z.some(q=>!Number.isFinite(q))))return;
 const excess=Array.from({length:points.length},()=>[0,0]);
 for(let k=0;k<triangles.length;k++){
  const tri=triangles[k],d=cross[k];
  if(tri.some(n=>!Number.isInteger(n)||n<0||n>=points.length)||
     new Set(tri).size!==3||d.some(n=>!Number.isFinite(n)))return;
  const [A,B,C]=tri.map(n=>points[n]),area=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
  if(!Number.isFinite(area)||Math.abs(area)<=1e-13)return;
  const dx=Math.max(A[0],B[0],C[0])-Math.min(A[0],B[0],C[0]),dz=Math.max(A[1],B[1],C[1])-Math.min(A[1],B[1],C[1]);
  const v=dx*dz*.25;
  if(!Number.isFinite(v))return;
  for(const index of tri)for(let f=0;f<2;f++)excess[index][f]=Math.max(excess[index][f],Math.abs(d[f])*v);
 }
 const lower=samples.map(([a,b],i)=>[a-reserve[0]-excess[i][0],b-reserve[1]-excess[i][1]] as const);
 if(lower.some(z=>z.some(n=>!Number.isFinite(n))))return;
 return {lower,triangles};
}
