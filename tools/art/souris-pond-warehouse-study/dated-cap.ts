import {BufferGeometry, Float32BufferAttribute} from 'three';

export type DatedCap = Readonly<{
 schema:1;origin:readonly number[];subdivisions:number;
 corners:readonly (readonly number[])[];
 triangles:readonly (readonly number[])[];
 relativeMillimetres:readonly number[];
}>;
type Key=readonly [number,number];
type Zone='roof'|'floor'|'wall';
type Node={key:Key;floor:number;roof:number};
type Face=readonly [Node,Node,Node];
export type RoofStudy=Readonly<{origin:readonly number[];roof:Float32Array;floor:Float32Array;wall:Float32Array}>;
const key=(n:Key)=>n.join(',');
function even(x:number){
 const whole=Math.floor(x);
 return x-whole===.5?whole+Number(whole%2!==0):Math.round(x);
}
const cross=(a:Key,b:Key,c:Key)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
/** Rebuild a dated relative surface from the compact allowlisted exhibit.
 * The output intentionally has no path to the game's scene or contacts. */
export function buildDatedCap(data:DatedCap):RoofStudy{
 const n=data.subdivisions;
 if(data.schema!==1||n!==16||data.origin.length!==2||!data.origin.every(Number.isFinite)||
    data.corners.length!==18||data.triangles.length!==16||data.relativeMillimetres.length!==2193||
    data.corners.some(row=>row.length!==3||!row.slice(0,2).every(Number.isSafeInteger)||!Number.isFinite(row[2]))||
    data.relativeMillimetres.some(v=>!Number.isInteger(v)||v<2600||v>9500))throw Error('Unsupported dated geometry');
 const hull=new Map<string,{a:Key;b:Key;uses:number}>();
 const points=new Map<string,Node>(),faces:Face[]=[];
 let read=0;
 function sample(a:readonly number[],b:readonly number[],c:readonly number[],i:number,j:number){
  const v=a.map((q,k)=>(q*(n-i-j)+b[k]*i+c[k]*j)/n);
  const at=[even(v[0]),even(v[1])] as const,tag=key(at),old=points.get(tag);
  if(old){if(Math.abs(old.floor-v[2])>1e-7)throw Error('Discontinuous virtual floor');return old;}
  const h=data.relativeMillimetres[read++];
  if(h===undefined)throw Error('Incomplete relative source heights');
  const p={key:at,floor:v[2],roof:v[2]+.6+h/1000};points.set(tag,p);return p;
 }
 for(const row of data.triangles){
  if(row.length!==3||new Set(row).size!==3||row.some(i=>!Number.isInteger(i)||i<0||i>=18))
   throw Error('Foreign cap triangle');
  const [a,b,c]=row.map(i=>data.corners[i]);
  const nodes:Node[][]=[];
  for(let i=0;i<=n;i++){
   const line:Node[]=[];nodes.push(line);
   for(let j=0;j<=n-i;j++)line.push(sample(a,b,c,i,j));
  }
  const abc=[nodes[0][0],nodes[n][0],nodes[0][n]];
  if(cross(...abc.map(x=>x.key) as [Key,Key,Key])>0)abc.reverse();
  for(let k=0;k<3;k++){
   const a=abc[k].key,b=abc[(k+1)%3].key;
   const x=[key(a),key(b)].sort().join(':'),prev=hull.get(x);
   if(prev)prev.uses++;else hull.set(x,{a,b,uses:1});
  }
  for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
   faces.push([nodes[i][j],nodes[i+1][j],nodes[i][j+1]]);
   if(i+j<n-1)faces.push([nodes[i+1][j],nodes[i+1][j+1],nodes[i][j+1]]);
  }
 }
 if(read!==2193||faces.length!==4096||[...hull.values()].some(e=>e.uses>2))throw Error('Invalid dated cap topology');
 const buckets:Record<Zone,number[]>={roof:[],floor:[],wall:[]};
 const xyz=(out:number[],node:Node,y:number)=>out.push(node.key[0]/1e5,y,node.key[1]/1e5);
 for(const group of faces){
  const [a,b,c]=cross(group[0].key,group[1].key,group[2].key)>0?[...group].reverse():group;
  for(const v of [a,b,c])xyz(buckets.roof,v,v.roof);
  for(const v of [c,b,a])xyz(buckets.floor,v,v.floor);
 }
 const lookup=(a:Key,b:Key,i:number)=>{
  const k=[even((a[0]*(n-i)+b[0]*i)/n),even((a[1]*(n-i)+b[1]*i)/n)] as const;
  const ans=points.get(key(k));if(!ans)throw Error('A perimeter edge cannot close outside its cap');return ans;
 };
 for(const {a,b,uses} of hull.values())if(uses===1)for(let i=0;i<n;i++){
  const l=lookup(a,b,i),r=lookup(a,b,i+1),w=buckets.wall;
  xyz(w,r,r.roof);xyz(w,l,l.roof);xyz(w,l,l.floor);
  xyz(w,r,r.roof);xyz(w,l,l.floor);xyz(w,r,r.floor);
 }
 if(buckets.wall.length!==576*9)throw Error('Unsupported wall polygon');
 return {origin:data.origin,roof:new Float32Array(buckets.roof),floor:new Float32Array(buckets.floor),wall:new Float32Array(buckets.wall)};
}
export function datedCapGeometry(study:RoofStudy,closed=true){
 const pieces=closed?[study.roof,study.wall,study.floor]:[study.roof,study.wall];
 const pos=new Float32Array(pieces.reduce((n,p)=>n+p.length,0));
 let k=0;
 for(const a of pieces){pos.set(a,k);k+=a.length;}
 const geo=new BufferGeometry();
 geo.setAttribute('position',new Float32BufferAttribute(pos,3));
 geo.computeVertexNormals();geo.computeBoundingSphere();
 return geo;
}
