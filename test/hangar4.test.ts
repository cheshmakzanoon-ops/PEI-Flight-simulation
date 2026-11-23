import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HANGAR4 as site} from '../src/render/hangar4.generated.ts';
import {emitHangar4,matchesHangar4} from '../src/render/hangar4.ts';

test('Hangar 4 only selects its pinned, ordered atlas record',()=>{
 const {atlasSha,tile,row,footprint}=site;
 assert.ok(matchesHangar4(atlasSha,tile,row,footprint,[]));
 assert.ok(!matchesHangar4(undefined,tile,row,footprint));
 assert.ok(!matchesHangar4(atlasSha,tile+'1',row,footprint));
 assert.ok(!matchesHangar4(atlasSha,tile,row+1,footprint));
 assert.ok(!matchesHangar4(atlasSha,tile,row,[...footprint].reverse()));
 assert.ok(!matchesHangar4(atlasSha,tile,row,footprint,[footprint]));
});

test('Hangar 4 measured roofs stay absolute when the wall footing grade changes',()=>{
 type Sample={x:number;z:number;y:number;role:number;style:number;uv:number[];tone:number[]};
 const at=(ground:number)=>{
  const out:Sample[]=[];
  emitHangar4(()=>ground,[.4,.41,.42],(p,y,c,u,v,role,style)=>{
   out.push({...p,y,role,style,uv:[u,v],tone:[c.r,c.g,c.b]});
  });
  return out;
 };
 const a=at(19),b=at(19.2);
 assert.equal(a.length/3,148);
 assert.deepEqual(a.filter(u=>u.role===1),b.filter(u=>u.role===1));
 assert.ok(a.filter(u=>u.role===1).every(({tone,style})=>style===0&&tone[0]===.4));
 assert.ok(a.some(u=>u.role===0&&u.style===73&&u.y>32));
 let base=0;
 for(let i=0;i<a.length;++i){
  const old=a[i],next=b[i];
  assert.ok(old.y<=next.y,[old,next]);
  if(old.y===18.35){
   assert.ok(Math.abs(next.y-18.55)<1e-10);
   ++base;
  }
 }
 assert.ok(base>30);
});
