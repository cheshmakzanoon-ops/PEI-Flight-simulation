/** Detached only. No geographic registration or app loader in this package. */
export type P2=readonly [number,number];
export type P3=readonly [number,number,number];
export type Plane=readonly [number,number,number]; // h + u*dx + v*dz, absolute CGVD2013
export const DATUM=13.10;
export const PLAN:readonly P2[]=[[-4.48475764904585,14.26521957813721],[-1.7613158078555449,14.25672725300742],[-1.7945380716219739,12.740375363410473],[4.525140002988429,12.748867689297498],[4.52155995801195,0],[-4.52155995801195,0]];
export const ROOF_SURVEY:readonly Plane[]=[
 [25.553284186,.009182647,.00292305],
 [23.51350559,.062498194,1.80406497],
 [31.72701181,1.72136966,-.082383049],
 [30.81694910,-1.31177323,.038239252],
 [35.6184123,-.019865192,-1.58685521],
 [24.0815957,1.79881558,-.0656],
 [18.02,0,0], // held rear low join. Placeholder in detached art, not measurably supported by these roof targets.
];
// Bounded street-facing authored gable. Outer date stone/photo silhouette not native height control.
// Rotating or fitting the separate actual elevated east returns into this gable is not permitted.
export const GABLE:readonly Plane[]=[[25.92,1.04,-.98],[25.92,-1.04,-.98]];
export const ALL= [...ROOF_SURVEY,...GABLE];
export const at=(a:Plane,[u,v]:P2)=>a[0]+a[1]*u+a[2]*v;
export function activePlane(p:P2,withGable=true){
 const z=ALL.map(a=>at(a,p));
 let inner=4;for(let i=5;i<7;i++)if(z[i]>z[inner])inner=i;
 let j=inner;for(let i=0;i<4;i++)if(z[i]<z[j])j=i;
 if(withGable){const g=z[7]<z[8]?7:8;if(z[g]>z[j])j=g;}
 return j;
}
export const roofAt=(p:P2,withGable=true)=>at(ALL[activePlane(p,withGable)],p);
export function cp(poly:readonly P2[],n:Plane){
 const res:P2[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],qa=at(n,a),qb=at(n,b);
  if(qa>=-1e-10)res.push(a);
  if((qa<-1e-10&&qb>1e-10)||(qa>1e-10&&qb<-1e-10)){
    const f=qa/(qa-qb);res.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
  }
 }
 return res;
}
export const area=(z:readonly P2[])=>.5*z.reduce((a,p,i)=>{const q=z[(i+1)%z.length];return a+p[0]*q[1]-q[0]*p[1];},0);
export function roofCells(tris:readonly (readonly P2[])[],withGable:boolean){
 let zones=tris.map(q=>[...q]);
 const bu=withGable?ALL:ROOF_SURVEY;
 for(let i=0;i<bu.length;i++)for(let j=i+1;j<bu.length;j++){
  const dif=bu[i].map((n,k)=>n-bu[j][k]) as unknown as Plane;
  const minus=dif.map(a=>-a) as unknown as Plane;
  if(Math.abs(dif[1])+Math.abs(dif[2])<1e-8)continue;
  zones=zones.flatMap(q=>q.some(p=>at(dif,p)>1e-8)&&q.some(p=>at(dif,p)<-1e-8)?[cp(q,dif),cp(q,minus)]:[q]);
 }
 return zones.filter(q=>q.length>=3&&Math.abs(area(q))>1e-9).map(q=>{
  const c:P2=q.reduce(([u,v],[a,b])=>[u+a/q.length,v+b/q.length],[0,0] as P2);
  return {q,plane:activePlane(c,withGable)};
 });
}
export function partitions(a:P2,b:P2,withGable=true){
 const cuts=[0,1],pool=withGable?ALL:ROOF_SURVEY;
 for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
  const s=at(pool[i],a)-at(pool[j],a),e=at(pool[i],b)-at(pool[j],b);
  if(s*e>=0||Math.abs(s-e)<1e-10)continue;
  const t=s/(s-e);if(t>1e-7&&t<1-1e-7)cuts.push(t);
 }
 return cuts.sort((a,b)=>a-b).filter((n,i,q)=>!i||n-q[i-1]>1e-7).map(t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t] as P2);
}
