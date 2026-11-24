import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sparseGradeIndex} from '../src/render/sparse-grade-index.ts';

test('sparse subdivision keeps moved microtriangles, every welded edge and correct winding',()=>{
 const S=16,N=33,changed=(i:number,j:number)=>
  (i>=7&&i<=10&&j>=8&&j<=10)||(i===20&&j===21)||(i===16&&j===16);
 const wire=sparseGradeIndex(N,N,S,changed,(i,j)=>j*N+i);
 assert(wire.length/3<550&&wire.length/3>50,'fewer triangles than the dense 2048');
 const seen=new Map<string,number>(),faces=new Set<string>();
 const vertex=(i:number)=>[i%N,Math.floor(i/N)]as const, faceId=(xs:number[])=>xs.sort((a,b)=>a-b).join('-');
 const edge=(a:number,b:number)=>a<b?a+'-'+b:b+'-'+a;
 let area=0;
 for(let t=0;t<wire.length;t+=3){
  const [a,b,c]=wire.slice(t,t+3),[x,y]=vertex(a),[u,v]=vertex(b),[r,s]=vertex(c);
  const z=(u-x)*(s-y)-(v-y)*(r-x);
  assert(z<0);area-=z/2;
  for(const k of [edge(a,b),edge(b,c),edge(c,a)])seen.set(k,1+(seen.get(k)??0));
  faces.add(faceId([a,b,c]));
 }
 assert.equal(area,32*32);
 for(const [e,n]of seen){
  const [a,b]=e.split('-').map(Number),[x,y]=vertex(a),[u,v]=vertex(b);
  if(n===2)continue;
  assert.equal(n,1);
  assert(((x===u&&(x===0||x===32)&&Math.abs(y-v)===1)
    ||(y===v&&(y===0||y===32)&&Math.abs(x-u)===1)),'one boundary edge per fine segment; no T junction '+e);
 }
 for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){
  const a=j*N+i,b=a+N,d=a+1,c=b+1;
  for(const face of [[a,b,d],[b,c,d]])if(face.some(id=>changed(...vertex(id))))assert(faces.has(faceId(face)));
 }
 assert.throws(()=>sparseGradeIndex(33,33,3,changed,(i,j)=>j*N+i),/Invalid sparse grade/);
});
