import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {BufferGeometry,BufferAttribute,DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {project} from '../src/sim/geo.ts';
import {SOURIS_MCLEAN as M} from '../src/render/souris-mclean.generated.ts';
import {emitSourisMclean,sourisMcleanModel,sourisMcleanRoofHeight,MCLEAN_STYLE,MCLEAN_ROLES as R} from '../src/render/souris-mclean.ts';

const tilePack=()=>new URL('../public/world/buildings/',import.meta.url);
function owner(){
 const f=readFileSync(new URL('index.json',tilePack()),'utf8'),m=JSON.parse(f);
 const q=m.tiles.find((x:{id:string})=>x.id===M.tile);
 const b=readFileSync(new URL('tiles.pack',tilePack())).subarray(q.offset,q.offset+q.bytes);
 const chunkHash=createHash('sha256').update(b).digest('hex');
 assert.equal(chunkHash,'a7ee1263f0c19b2b570f24cf1874c0e882b895d778ad63ab3939d8adcaca7d55');
 return {record:JSON.parse(gunzipSync(b).toString()).features[M.ordinal],atlas:m.sha256 as string};
}
test('only the exact streamed AEB owner activates the exterior',()=>{
 const {record,atlas}=owner();
 assert.equal(sourisMcleanModel(atlas,M.tile,M.ordinal,record.footprint,record.holes),M);
 assert.equal(sourisMcleanModel('',M.tile,M.ordinal,record.footprint),undefined);
 assert.equal(sourisMcleanModel(atlas,'q131',M.ordinal,record.footprint),undefined);
 assert.equal(sourisMcleanModel(atlas,M.tile,M.ordinal+1,record.footprint),undefined);
 assert.equal(sourisMcleanModel(atlas,M.tile,M.ordinal,[...record.footprint].reverse()),undefined);
 assert.equal(sourisMcleanModel(atlas,M.tile,M.ordinal,record.footprint,[record.footprint]),undefined);
});

const localRing=M.source.map(([lon,lat])=>{const p=project(lon,lat);return [p.x-M.originXZ[0],p.z-M.originXZ[1]] as const;});
function measuredShell(){
 const P:number[]=[],S:number[]=[],roof:number[]=[];
 emitSourisMclean(M.source.map(([p,q])=>project(p,q)),()=>16.05,(p,y,_,u,v,r,f)=>{
  assert.equal(f,MCLEAN_STYLE);assert.ok([p.x,p.z,y,u,v].every(Number.isFinite));
  const item=[p.x-M.originXZ[0],y,p.z-M.originXZ[1]];
  P.push(...item);S.push(r);
  if(r>=R.roof&&r<=R.annexRoof)roof.push(...item);
 });
 return {P,S,roof};
}
function inside(x:number,z:number){
 let parity=false,min=Infinity;
 for(let i=0;i<localRing.length;i++){
  const [a,c]=localRing[i],[b,d]=localRing[(i+1)%localRing.length],dx=b-a,dz=d-c;
  if((c>z)!==(d>z)&&x<a+dx*(z-c)/dz)parity=!parity;
  const t=Math.max(0,Math.min(1,((x-a)*dx+(z-c)*dz)/(dx*dx+dz*dz)));
  min=Math.min(min,Math.hypot(x-a-t*dx,z-c-t*dz));
 }
 return parity?min:-min;
}
const quantile=(q:number[],p:number)=>{const a=q.slice().sort((x,y)=>x-y),k=(a.length-1)*p,i=Math.floor(k);return a[i]*(1-k+i)+a[Math.min(i+1,a.length-1)]*(k-i);};

test('actual cut roof mesh holds the native survey and covers precisely the same plan',()=>{
 const {roof}=measuredShell();
 const g=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(roof),3));
 const m=new Mesh(g,new MeshBasicMaterial({side:DoubleSide}));
 const ray=new Raycaster(),down=new Vector3(0,-1,0);
 const trace=(x:number,z:number)=>{ray.set(new Vector3(x,70,z),down);return ray.intersectObject(m,false);};
 let n=0,covered=0,observedArea=0;
 for(let j=0;j<roof.length;j+=9)observedArea+=Math.abs((roof[j+3]-roof[j])*(roof[j+8]-roof[j+2])-(roof[j+5]-roof[j+2])*(roof[j+6]-roof[j]))*.5;
 let twiceSource=0;
 for(let j=0;j<localRing.length;j++){
  const [x,z]=localRing[j],[a,b]=localRing[(j+1)%localRing.length];twiceSource+=x*b-z*a;
 }
 assert.ok(Math.abs(observedArea-Math.abs(twiceSource)*.5)<.000008,observedArea);
 for(let z=-22;z<21;z+=.47)for(let x=-10;x<38;x+=.49){
  if(Math.abs(inside(x,z))<1e-5)continue;
  const want=inside(x,z)>0,hit=trace(x,z);
  assert.equal(hit.length,want?1:0,[x,z].join(','));n++;if(want)covered++;
 }
 const points=JSON.parse(readFileSync(new URL('../data/souris-main/mclean-native-holdout.json',import.meta.url),'utf8')) as number[][];
 const R0=JSON.parse(readFileSync(new URL('../data/souris-main/mclean-source.json',import.meta.url),'utf8'));
 const err=points.map(([x,z,y])=>{
  const hits=trace(x-M.originXZ[0],z-M.originXZ[1]);
  assert.equal(hits.length,1);
  return Math.abs(hits[0].point.y-y);
 });
 assert.equal(err.length,66);
 const p90=quantile(err,.90),max=Math.max(...err);
 assert.ok(Math.abs(p90-R0.rawHeldOutAbsErrorMetres.new[1])<.00015,String(p90));
 assert.ok(p90<.20&&max<.29&&covered>1200&&n>8000);
 console.log(`Souris native held-out: ${err.length} real roof rays, old p90 ${R0.rawHeldOutAbsErrorMetres.old[1]}m, new ${p90.toFixed(5)}m, max ${max.toFixed(5)}m. ${n} projected plan probes.`);
});

test('facade returns, brackets, sashes, and added parapet remain inside the same supported outline',()=>{
 const {P,S}=measuredShell();
 assert.ok(P.length/9<5500&&P.length/9>1000,String(P.length/9));
 assert.ok(P.length%9===0&&S.length===P.length/3);
 for(let k=0;k<P.length;k+=9){
  let x=0,z=0;
  for(let q=k;q<k+9;q+=3){
   assert.ok(inside(P[q],P[q+2])>=-1e-6,`${P[q]}, ${P[q+2]}, ${S[q/3]}`);
   x+=P[q];z+=P[q+2];
  }
  assert.ok(inside(x/3,z/3)>=-1e-5,[x/3,z/3,S[k/3]].join(','));
 }
 for(const r of Object.values(R))assert.ok(S.includes(r),String(r));
});


test('west corbel noses actually cover the parapet face without leaving the building plan',()=>{
 const {P,S}=measuredShell(),mesh=new Mesh(new BufferGeometry().setAttribute('position',
  new BufferAttribute(new Float32Array(P),3)),new MeshBasicMaterial({side:DoubleSide}));
 const start=localRing[15],end=localRing[14],l=Math.hypot(end[0]-start[0],end[1]-start[1]);
 const u=new Vector3((end[0]-start[0])/l,0,(end[1]-start[1])/l),n=new Vector3(u.z,0,-u.x);
 const point=(x:number)=>new Vector3(start[0]+x*u.x,0,start[1]+x*u.z);
 const world=(p:Vector3)=>({x:p.x+M.originXZ[0],z:p.z+M.originXZ[1]});
 const h=(x:number)=>sourisMcleanRoofHeight(world(point(x)));
 // Locate the observed transition on the front independently from the
 // facade triangles, by finding where its measured rise first exceeds .45.
 let a=8.8,b=11.6;
 for(let j=0;j<32;j++){const x=(a+b)*.5;if((h(x+.0001)-h(x-.0001))/.0002>.45)b=x;else a=x;}
 const join=(a+b)*.5+.205;
 const ray=new Raycaster();
 for(let i=0;i<17;i++){
  const x=.55+.52*i,y=h(join)-.018*(join-x)-.184-.012-.181;
  ray.set(point(x).setY(y).addScaledVector(n,-.42),n);
  const hit=ray.intersectObject(mesh)[0];
  assert.equal(S[hit.face!.a],R.trim,'West corbel obscured at '+x.toFixed(3)+' metres');
  assert.ok(Math.abs(hit.distance-.42)<.00005,String(hit.distance));
 }
});
