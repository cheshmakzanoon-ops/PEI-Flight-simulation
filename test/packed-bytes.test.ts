import test from 'node:test';
import assert from 'node:assert/strict';
import {PackedBytes} from '../src/sim/packed-bytes.ts';

const expected=Uint8Array.from({length:101},(_,i)=>i);
const range=(init:RequestInit|undefined)=>new Headers(init?.headers).get('Range');
const list=(value:ArrayBuffer)=>[...new Uint8Array(value)];
test('fast concurrent range requests transfer just their bytes',async()=>{
 const seen:string[]=[];
 const pack=new PackedBytes('/atlas',101,async(_url,init)=>{
   const r=range(init)!;seen.push(r);
   const [a,b]=r.slice(6).split('-').map(Number);
   return new Response(expected.slice(a,b+1),{status:206,headers:{'Content-Range':`bytes ${a}-${b}/101`}});
 });
 const result=await Promise.all([pack.read(0,1),pack.read(80,4),pack.read(100,1)]);
 assert.deepEqual(result.map(list),[[0],[80,81,82,83],[100]]);
 assert.deepEqual(seen,['bytes=0-0','bytes=80-83','bytes=100-100']);
});
test('an ignored range shares a single full pack even with several callers',async()=>{
 const seen:string[]=[];
 const pack=new PackedBytes('/atlas',101,async(_url,init)=>{
   seen.push(range(init)!);await new Promise(r=>setTimeout(r,10));
   return new Response(expected);
 });
 const result=await Promise.all([pack.read(0,2),pack.read(80,2),pack.read(100,1)]);
 assert.deepEqual(result.map(list),[[0,1],[80,81],[100]]);
 assert.deepEqual(list(await pack.read(9,1)),[9]);
 assert.deepEqual(seen,['bytes=0-1']);
});
test('rejects incomplete, mislabeled and out-of-bounds data, but a failed probe can retry',async()=>{
 let n=0;
 const pack=new PackedBytes('/atlas',101,async()=>{
   n++;
   if(n===1)return new Response(expected.slice(3,5),{status:206,headers:{'Content-Range':'bytes 2-3/101'}});
   if(n===2)return new Response(expected.slice(3,4),{status:206,headers:{'Content-Range':'bytes 3-4/101'}});
   if(n===3)return new Response(expected.slice(3,5));
   return new Response(expected);
 });
 await assert.rejects(pack.read(3,2),/content range/);
 await assert.rejects(pack.read(3,2),/response length/);
 await assert.rejects(pack.read(3,2),/response length/);
 for(const [start,length] of [[100,2],[-1,1],[1,0],[.5,1],[0,Infinity]])await assert.rejects(pack.read(start,length),/bounds/);
 assert.deepEqual(list(await pack.read(3,2)),[3,4]);assert.equal(n,4);
});
