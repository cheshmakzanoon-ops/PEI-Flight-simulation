// Upper-surface metric witness. Local coordinates retain meaningful Float32 precision
// at eastern PEI's large world X; the parent group restores the absolute scene datum.
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
export type UV=[number,number];export type Coeff=[number,number,number]; // elevation = c + du*u + dv*v
export const BASE_KEYS=['track','back','westHip','eastHip'] as const;
export const HOOD_KEYS=['westCheek','eastCheek','cap','trackApron'] as const;
export type BaseKey=typeof BASE_KEYS[number];export type HoodKey=typeof HOOD_KEYS[number];
export interface RoofInputs{
 schema:1;owner:'q1331/195';world:{worldXZAtUV00:UV;worldXZPerU:UV;worldXZPerV:UV};
 ringUV:UV[];yOrigin:number;main:Record<BaseKey,Coeff>;hood:Record<HoodKey,Coeff>;hoodMask:{u:UV;v:UV}
}
type Key=`main/${BaseKey}`|`hood/${HoodKey}`;
type Batch={positions:number[];uv:number[];area:number;minNormalY:number};
const eps=1e-10;
const ev=(p:Coeff,q:UV)=>p[0]+p[1]*q[0]+p[2]*q[1];
const minus=(a:Coeff,b:Coeff):Coeff=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const flip=(a:Coeff):Coeff=>[-a[0],-a[1],-a[2]];
const coincident=(a:UV,b:UV)=>(a[0]-b[0])**2+(a[1]-b[1])**2<1e-18;
const twiceArea=(a:UV,b:UV,c:UV)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
// Half-space clipping of the actual four-vertex envelope: no AABB growth or outside dormer triangles.
function clip(poly:UV[],line:Coeff){
 const out:UV[]=[];const push=(p:UV)=>{if(!out.length||!coincident(p,out[out.length-1]))out.push(p)};
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=ev(line,a),db=ev(line,b);
  if(da<=eps)push(a);
  if((da<-eps&&db>eps)||(db<-eps&&da>eps)){
   const t=da/(da-db);push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
  }
 }
 if(out.length>1&&coincident(out[0],out[out.length-1]))out.pop();
 return out.length>=3?out:[];
}
function minimumCell<T extends string>(p:UV[],planes:Record<T,Coeff>,keys:readonly T[],k:T){
 for(const j of keys)if(k!==j)p=clip(p,minus(planes[k],planes[j]));return p;
}
const tint:Record<Key,number>={'main/track':0x858176,'main/back':0x8b8276,'main/westHip':0x827c72,'main/eastHip':0x8d877b,'hood/westCheek':0x8d877d,'hood/eastCheek':0x8d867a,'hood/cap':0x8a8579,'hood/trackApron':0x8c867d};
export function makeElmiraRoof(proof:RoofInputs){
 if(proof.schema!==1||proof.owner!=='q1331/195'||proof.ringUV.length!==4)throw Error('Wrong Elmira proof');
 const {main,hood,hoodMask:m,world}=proof,group=new Group();
 group.name='Elmira / sealed roof / q1331 195';group.position.set(world.worldXZAtUV00[0],proof.yOrigin,world.worldXZAtUV00[1]);
 const batches=new Map<Key,Batch>();
 const toLocal=(q:UV,p:Coeff)=>new Vector3(world.worldXZPerU[0]*q[0]+world.worldXZPerV[0]*q[1],ev(p,q)-proof.yOrigin,world.worldXZPerU[1]*q[0]+world.worldXZPerV[1]*q[1]);
 const put=(poly:UV[],plane:Coeff,tag:Key)=>{
  if(poly.length<3)return;
  let batch=batches.get(tag);if(!batch){batch={positions:[],uv:[],area:0,minNormalY:1};batches.set(tag,batch)}
  for(let i=1;i+1<poly.length;i++){
   const uv:[UV,UV,UV]=[poly[0],poly[i],poly[i+1]],a2=Math.abs(twiceArea(...uv));if(a2<1e-10)continue;
   const vertices=uv.map(q=>toLocal(q,plane)),norm=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
   if(norm.y<0){[vertices[1],vertices[2]]=[vertices[2],vertices[1]];[uv[1],uv[2]]=[uv[2],uv[1]];norm.negate();}
   batch.minNormalY=Math.min(batch.minNormalY,norm.normalize().y);batch.area+=.5*a2;
   for(let j=0;j<3;j++){const v=vertices[j];batch.positions.push(v.x,v.y,v.z);batch.uv.push(...uv[j]);}
  }
 };
 // The surveyed central hood is a raised envelope. Select only the physically upper
 // surface: do not leave a concealed duplicate main-roof sheet under the hood.
 const mask:Coeff[]=[[m.u[0],-1,0],[-m.u[1],1,0],[m.v[0],0,-1],[-m.v[1],0,1]];
 for(const k of BASE_KEYS){
  let region=minimumCell(proof.ringUV,main,BASE_KEYS,k);
  for(const line of mask){put(clip(region,flip(line)),main[k],`main/${k}`);region=clip(region,line);}
  if(!region.length)continue;
  for(const h of HOOD_KEYS){
   const cell=minimumCell(region,hood,HOOD_KEYS,h);if(!cell.length)continue;
   put(clip(cell,minus(hood[h],main[k])),main[k],`main/${k}`);
   put(clip(cell,minus(main[k],hood[h])),hood[h],`hood/${h}`);
  }
 }
 for(const [tag,batch] of batches){
  if(!batch.positions.length)continue;
  const geom=new BufferGeometry();geom.setAttribute('position',new Float32BufferAttribute(batch.positions,3));geom.setAttribute('uv',new Float32BufferAttribute(batch.uv,2));geom.computeVertexNormals();geom.computeBoundingSphere();
  const object=new Mesh(geom,new MeshStandardMaterial({color:new Color(tint[tag]),roughness:.88}));
  object.name=tag;object.userData={projectedAreaUV:batch.area,minNormalY:batch.minNormalY};object.castShadow=object.receiveShadow=true;group.add(object);
 }
 group.updateMatrixWorld(true);
 return group;
}
