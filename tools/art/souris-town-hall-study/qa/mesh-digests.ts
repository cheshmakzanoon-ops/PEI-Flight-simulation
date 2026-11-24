import {createHash} from 'node:crypto';
import type {Group,Mesh} from 'three';
export function meshDigests(model:Group){
 return (model.children as Mesh[]).map(m=>{
  const parts=Object.entries(m.geometry.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>{
   if(!('array'in a))throw Error('unexpected interleaved data');
   const data=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
   return {name,itemSize:a.itemSize,count:a.count,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex')};
  });
  return {name:m.name,parts};
 });
}
