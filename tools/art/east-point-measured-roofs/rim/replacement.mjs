/** Offline seven-channel attribute rebuild; never changes the live mesh or mutable renderer. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {planEastRim} from './roof-rim.ts';
import {proof as actual,shapes} from './stock-owner.mjs';
const read=p=>readFileSync(new URL('../../../../'+p,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const fields={
 position:[Float32Array,3],uv:[Float32Array,2],color:[Float32Array,3],
 topFlag:[Float32Array,1],townWallFit:[Int16Array,3],normal:[Float32Array,3],facadeStyle:[Uint8Array,1],
};
const expected=actual;
const fullPins={
 position:'a5e6aaf4801b402f24490ed99e1288ae442c86d033108caa5838e190e281ba2b',
 uv:'7ca6ea7fd0c315981c6820515ab8e622f80da5ce6f012b6d0bc0d1c4435fcb05',
 color:'bfc91ca08b5ea3734fd7f3e72c06d5e9d3358ae6076e70cbcf6ee8cf27bb820d',
 topFlag:'2377a078ba4134ee374350179c76e526d35ca314f4e332c5e9bf0175bbf16aa4',
 townWallFit:'2f21446d2d58c325862075c9842671789e43b2e5d65f6734682d6cd4b0cfe2ba',
 normal:'825c004eff5dc57eb5b370d95f8a5a6ac9cdaf89d2e524e85024a63b84f772bf',
 facadeStyle:'80bd2470617d7fa1dc9f84db6d0354fd6b7f843dbb8bce01786ad1adb289d08c',
};
assert.deepEqual(actual.full,fullPins);
const source=Object.fromEntries(Object.entries(fields).map(([k,[Ctor,count]])=>{
 const v=shapes[k].array;
 assert.ok(v instanceof Ctor);assert.equal(v.length,11988*count);
 return [k,v];
}));
const groups=JSON.parse(read('data/east-point-roof-study/two-roof-hypotheses.json'));
const plans=groups.map(x=>planEastRim(x,{position:source.position,top:source.topFlag,fit:source.townWallFit}));
const result=Object.fromEntries(Object.keys(fields).map(k=>[k,[]]));
const emit=(k,x)=>result[k].push(...x);
const vertices=k=>fields[k][1];
function slice(k,start,stop){
 const n=vertices(k);return source[k].subarray(n*start,n*stop);
}
const ordinary=(lo,hi)=>{for(const k of Object.keys(fields))emit(k,slice(k,lo,hi));};
function exactTriangle(k,t){
 const n=vertices(k),i=t*3*n;
 const a=Array.from(source[k].subarray(i,i+n)),
       b=Array.from(source[k].subarray(i+n,i+2*n)),c=Array.from(source[k].subarray(i+2*n,i+3*n));
 return [a,b,c];
}
const norm=(a,b,c)=>{
 const x=b.map((v,i)=>v-a[i]),y=c.map((v,i)=>v-a[i]),q=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
 const m=Math.hypot(...q);assert.ok(m>1e-7&&q[1]>0);
 return q.map(f=>f/m);
};
const rooms=[];
let seen=0;
for(const p of plans){
 const [lo,hi]=p.originalVertices;
 ordinary(seen,lo);
 const begin=result.topFlag.length;
 for(const t of p.walls){
  for(let vi=0;vi<3;vi++){
   const w=t.weights[vi],P=t.positions[vi],basis=exactTriangle('position',t.oldTriangle);
   assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-8&&w.every(x=>Number.isFinite(x)&&x>=-1e-10));
   const diff=basis[0].map((_,j)=>basis.reduce((v,pos,i)=>v+w[i]*pos[j],0)-P[j]);
   assert.ok(Math.hypot(...diff)<.00027);
   emit('position',P);
   for(const k of ['normal','color','topFlag','townWallFit','facadeStyle','uv']){
    const a=exactTriangle(k,t.oldTriangle);
    if(k==='uv'){
     const y=a[0].map((_,j)=>a.reduce((f,pt,i)=>f+w[i]*pt[j],0));emit('uv',y);
    }else{
     assert.deepEqual(a[0],a[1],k+' original face lane unexpectedly varies');
     assert.deepEqual(a[1],a[2],k+' original face lane unexpectedly varies');
     emit(k,a[0]);
    }
   }
  }
 }
 const cap=result.topFlag.length;
 const roofLo=p.originalRoofVertices[0],roofHi=p.originalRoofVertices[1];
 const paint=Array.from(slice('color',roofLo,roofLo+1));
 for(let i=roofLo;i<roofHi;i++){
  assert.deepEqual(Array.from(slice('color',i,i+1)),paint);
  assert.deepEqual(Array.from(slice('townWallFit',i,i+1)),[0,0,0]);
  assert.equal(source.topFlag[i],1);assert.equal(source.facadeStyle[i],0);
 }
 for(const tri of p.roof){
  const n=norm(...tri);
  for(const [x,y,z] of tri){
   emit('position',[x,y,z]);emit('normal',n);emit('uv',[x,z]);
   emit('color',paint);emit('topFlag',[1]);emit('townWallFit',[0,0,0]);emit('facadeStyle',[0]);
  }
 }
 const end=result.topFlag.length;
 rooms.push({ordinal:p.sourceOrdinal,beforeRange:p.originalVertices,afterRange:[begin,end],stockCap:p.originalRoofVertices,
  replacementCap:[cap,end],oldSpanTriangles:(hi-lo)/3,newWallTriangles:p.walls.length,newCapTriangles:p.roof.length});
 seen=hi;
}
ordinary(seen,11988);
const final=Object.fromEntries(Object.entries(fields).map(([k,[Ctor,n]])=>{
 const a=new Ctor(result[k]);
 assert.equal(a.length,result.topFlag.length*n);
 // Recover all original bytes outside the two target intervals exactly;
 // the adjacent owner ranges are escalated separately, not a tile rewrite.
 let oldAt=0,newAt=0;const guards=[];
 for(const p of rooms){
  const old=source[k].subarray(oldAt*n,p.beforeRange[0]*n);
  const restored=a.subarray(newAt*n,p.afterRange[0]*n);
  assert.ok(bytes(old).equals(bytes(restored)));
  guards.push(sha(bytes(restored)));oldAt=p.beforeRange[1];newAt=p.afterRange[1];
 }
 assert.ok(bytes(source[k].subarray(oldAt*n)).equals(bytes(a.subarray(newAt*n))));
 return [k,{array:a,guards:[...guards,sha(bytes(a.subarray(newAt*n)))]}];
}));
const out={scope:'Offline full-source exact replacement bytes; no live installation, no model tenant or current survey claims. The old E fit refuses the altered full position/top signature; scoped material must be requalified if enabled with these roof meshes.',
 physical:{beforeVertices:11988,afterVertices:result.topFlag.length,beforeDraws:1,proposedDraws:1,originalWorldOrigin:expected.normalizingCenter},
 sources:expected.full,roles:rooms,outputs:Object.fromEntries(Object.entries(final).map(([k,q])=>[k,{sha256:sha(bytes(q.array)),untouchedPrefixMiddleSuffix:q.guards}])),
};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(out,null,2)+'\n',{flag:'wx'});
else console.log(JSON.stringify(out,null,2));
