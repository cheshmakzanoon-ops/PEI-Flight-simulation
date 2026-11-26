import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildDatedCap,datedCapGeometry,type DatedCap} from '../tools/art/souris-pond-warehouse-study/dated-cap.ts';

const data=JSON.parse(readFileSync(new URL('../tools/art/souris-pond-warehouse-study/dated-cap.json',import.meta.url),'utf8')) as DatedCap;
type P=readonly [number,number,number];
const dataKey=(p:P)=>p.join(',');
function at(a:Float32Array,i:number):P{return [a[i],a[i+1],a[i+2]];}
const norm=(a:P,b:P,c:P)=>{
 const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],u=c[0]-a[0],v=c[1]-a[1],w=c[2]-a[2];
 return [y*w-z*v,z*u-x*w,x*v-y*u] as const;
};

test('closed typed original-footprint study pairs every directed edge and retains all eighteen foot heights',()=>{
 const cap=buildDatedCap(data);assert.deepEqual([cap.roof.length,cap.floor.length,cap.wall.length],[4096*9,4096*9,576*9]);
 const edges=new Map<string,[number,number]>();
 const feet=new Set(data.corners.map(([x,z,y])=>dataKey([Math.fround(x/1e5),Math.fround(y),Math.fround(z/1e5)])));
 const unique=new Set<string>();
 for(const [name,verts] of Object.entries({roof:cap.roof,floor:cap.floor,wall:cap.wall})){
  for(let i=0;i<verts.length;i+=9){
   const f=[at(verts,i),at(verts,i+3),at(verts,i+6)],n=norm(f[0],f[1],f[2]);
   assert.ok(Math.hypot(...n)>1e-7);
   if(name==='roof')assert.ok(n[1]>0);else if(name==='floor')assert.ok(n[1]<0);
   const ks=f.map(dataKey);for(const item of ks)unique.add(item);
   if(name==='floor')for(const item of ks)feet.delete(item);
   for(let j=0;j<3;j++){
    const a=ks[j],b=ks[(j+1)%3],r=a<b?[a,b]:[b,a],key=r.join(':');
    const v=edges.get(key)??[0,0];v[a<b?0:1]++;edges.set(key,v);
   }
  }
 }
 assert.equal(unique.size,4386);assert.equal(edges.size,13152);assert.equal(feet.size,0);
 for(const v of edges.values())assert.deepEqual(v,[1,1]);
});
test('renderer-ready study is separate from gameplay and can omit its hidden underside in a studio',()=>{
 const cap=buildDatedCap(data),full=datedCapGeometry(cap),studio=datedCapGeometry(cap,false);
 try{
  assert.equal(full.getAttribute('position').count,8768*3);
  assert.equal(studio.getAttribute('position').count,4672*3);
  for(const x of [full,studio])assert.ok(x.boundingSphere?.radius&&x.getAttribute('normal').count>0);
  const fewer={...data,relativeMillimetres:data.relativeMillimetres.slice(1)};
  assert.throws(()=>buildDatedCap(fewer),/unsupported/i);
  const outOfBounds={...data,relativeMillimetres:[10000,...data.relativeMillimetres.slice(1)]};
  assert.throws(()=>buildDatedCap(outOfBounds),/unsupported/i);
 }finally{full.dispose();studio.dispose();}
});
