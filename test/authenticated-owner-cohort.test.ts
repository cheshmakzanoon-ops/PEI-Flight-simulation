import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,Scene} from 'three';
import {authenticatedOwnerCohort} from '../src/render/authenticated-owner-cohort.ts';
function setup(){
 const root=new Scene(), g=new BufferGeometry(), object=new Mesh(g), a=new Group(),b=new Group();
 g.setAttribute('position',new Float32BufferAttribute(Array.from({length:54},(_,i)=>i),3));
 g.setAttribute('custom',new Float32BufferAttribute(Array.from({length:18},(_,i)=>i),1));
 root.add(object,a,b);
 const auth=authenticatedOwnerCohort(object)!;
 return {root,g,object,a,b,auth};
}
const proof=(start:number,end:number)=>({vertices:18,start,end});

test('each courthouse and church can activate and retire in either order without dropping neighbours',()=>{
 for(const reverse of [false,true]){
  const {g,object,a,b,auth}=setup();
  const A=auth.add(a,[3,6],proof(3,6))!;
  A.sync(true);
  assert.equal(a.visible,true);
  assert.equal(auth.stockForProof(),g);
  const B=auth.add(b,[12,15],proof(12,15))!;
  B.sync(true);
  assert.equal(a.visible&&b.visible,true);
  const both=object.geometry;
  assert.deepEqual([...both.index!.array],[0,1,2,6,7,8,9,10,11,15,16,17]);
  assert.equal(both.getAttribute('position'),g.getAttribute('position'));
  assert.equal(both.getAttribute('custom'),g.getAttribute('custom'));
  assert.equal(g.index,null);
  (reverse?B:A).dispose();
  const survivor=reverse?A:B;
  const expected=reverse?[0,1,2,6,7,8,9,10,11,12,13,14,15,16,17]:[0,1,2,3,4,5,6,7,8,9,10,11,15,16,17];
  assert.deepEqual([...object.geometry.index!.array],expected);
  assert.equal(survivor.visible,true);
  survivor.dispose();
  assert.equal(object.geometry,g);assert.equal(a.visible||b.visible,false);
 }
});

test('invalid spans stay inert and invisible masks never affect a foreign owner',()=>{
 const {g,object,a,b,auth}=setup();
 assert.equal(auth.add(a,[2,6],proof(2,6)),undefined);
 assert.equal(auth.add(a,[3,6],proof(3,9)),undefined);
 const own=auth.add(a,[3,9],proof(3,9))!;
 assert.equal(auth.add(b,[6,12],proof(6,12)),undefined);
 assert.ok(auth.add(b,[12,15],proof(12,15)));
 own.sync(true);
 assert.notEqual(object.geometry,g);
 const foreign=new BufferGeometry();object.geometry=foreign;
 own.sync(false);
 assert.equal(a.visible,false);
 assert.equal(auth.stockForProof(),undefined);
 auth.dispose();
 assert.equal(object.geometry,foreign);
});

test('removing an authored group restores only its own stock span and repeated sessions reuse masks',()=>{
 const {root,g,object,a,b,auth}=setup();
 const A=auth.add(a,[3,6],proof(3,6))!, B=auth.add(b,[12,15],proof(12,15))!;
 A.sync(true);const first=object.geometry;
 B.sync(true);const both=object.geometry;
 b.removeFromParent();B.sync(true);
 assert.equal(B.visible,false);assert.equal(object.geometry,first);
 root.add(b);B.sync(true);
 assert.equal(object.geometry,both);
 auth.dispose();
 assert.equal(object.geometry,g);
});

test('retiring one indexed view never disposes GPU attributes borrowed from stock',()=>{
 const {g,object,a,b,auth}=setup();
 const A=auth.add(a,[3,6],proof(3,6))!,B=auth.add(b,[12,15],proof(12,15))!;
 A.sync(true);B.sync(true);
 const both=object.geometry,position=g.attributes.position,epoch=auth.revision;
 let callbacks=0;
 both.addEventListener('dispose',()=>{
  callbacks++;
  assert.deepEqual(Object.keys(both.attributes),[]);
  assert.equal(g.attributes.position,position);
  assert.equal(object.geometry.attributes.position,position);
 });
 B.sync(true);
 assert.equal(auth.revision,epoch);
 B.dispose();
 assert.equal(callbacks,1);
 assert.equal(A.visible,true);
 assert.ok(auth.revision>epoch);
 auth.dispose();
 assert.equal(g.attributes.position,position);
});

test('two noncontiguous pier spans activate atomically and compose with an independent station',()=>{
 for(const reverse of [false,true]){
  const {g,object,a,b,auth}=setup();
  const p=(start:number,end:number)=>({span:[start,end] as const,proof:proof(start,end)});
  assert.equal(auth.addMany(b,[p(9,12),p(9,15)]),undefined);
  assert.equal(auth.addMany(b,[p(9,12),p(14,18)]),undefined);
  const pier=auth.addMany(b,[p(15,18),p(9,12)])!;
  assert.equal(auth.add(a,[6,12],proof(6,12)),undefined);
  const rail=auth.add(a,[3,6],proof(3,6))!;
  const [first,second]=reverse?[rail,pier]:[pier,rail];
  const railOnly=[0,1,2,6,7,8,9,10,11,12,13,14,15,16,17],pierOnly=[0,1,2,3,4,5,6,7,8,12,13,14];
  assert.equal(object.geometry,g);
  first.sync(true);
  assert.deepEqual([...object.geometry.index!.array],reverse?railOnly:pierOnly);
  second.sync(true);
  const combined=object.geometry;
  assert.deepEqual([...combined.index!.array],[0,1,2,6,7,8,12,13,14]);
  assert.equal(combined.attributes.custom,g.attributes.custom);
  first.dispose();
  assert.deepEqual([...object.geometry.index!.array],reverse?pierOnly:railOnly);
  assert.equal(first.visible,false);
  assert.equal(second.visible,true);
  second.dispose();
  assert.equal(object.geometry,g);
 }
});
