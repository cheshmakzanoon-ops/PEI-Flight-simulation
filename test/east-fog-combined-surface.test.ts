import * as T from 'three';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeFogGableShell,exchangeOnlyFog} from '../tools/art/east-fog-study/east-fog-gable-shell.ts';
import {studyEastFogCornice} from '../tools/art/east-fog-study/east-fog-cornice-study.ts';
import {eastFogAuthoredSashes} from '../tools/art/east-fog-study/east-fog-authored-sashes.ts';
import {combineEastFogAuthoredSurface,EAST_FOG_COMBINED_ROLES as R} from '../tools/art/east-fog-study/east-fog-combined-surface.ts';
const plan=JSON.parse(readFileSync(new URL('../tools/art/east-fog-study/east-fog-bulk-v2.json',import.meta.url))).closedBodyPlan;
const schema=[['position',3],['normal',3],['color',3],['clad',1]] as const;
function intermediate(){
 const stock=new T.BufferGeometry();
 for(const [name,item] of schema)stock.setAttribute(name,new T.BufferAttribute(Float32Array.from({length:8727*item},(_,i)=>Math.fround(Math.sin(i*7.31))),item));
 const body=makeFogGableShell(plan).geo;
 const geo=exchangeOnlyFog(stock,body,true);
 stock.dispose();body.dispose();
 return geo;
}
const bytes=(a:Float32Array)=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
test('sash and cornice assembly appends precise vertices, leaves host and exhibit slots byte exact and creates no extra group',()=>{
 const corrected=intermediate(),sash=eastFogAuthoredSashes(plan).geometry,trim=studyEastFogCornice(plan);
 const result=combineEastFogAuthoredSurface(corrected,plan),g=result.geometry;
 assert.deepEqual(result.roles,{originals:[0,5853],envelope:[5055,5457],protectedExhibit:[5457,5853],
  sash2:[5853,6645],sash3:[6645,7437],cornice:[7437,8157],end:8157});
 assert.equal(g.index,null);assert.deepEqual(g.groups,[]);assert.equal(g.drawRange.count,Infinity);
 for(const [k,n] of schema){
  const a=g.getAttribute(k).array as Float32Array,q=corrected.getAttribute(k).array as Float32Array;
  const p=sash.getAttribute(k).array as Float32Array, c=trim.geometry.getAttribute(k).array as Float32Array;
  assert.equal(a.length,R.end*n);assert.notEqual(a.buffer,q.buffer);
  assert.deepEqual(bytes(a.subarray(0,R.sash2[0]*n)),bytes(q));
  assert.deepEqual(bytes(a.subarray(R.sash2[0]*n,R.cornice[0]*n)),bytes(p));
  assert.deepEqual(bytes(a.subarray(R.cornice[0]*n)),bytes(c.subarray(trim.base*n)));
 }
 const yy=g.getAttribute('position');
 const top=Math.max(...Array.from({length:R.cornice[0]-R.sash2[0]},(_,i)=>yy.getY(R.sash2[0]+i)));
 const bottom=Math.min(...Array.from({length:R.end-R.cornice[0]},(_,i)=>yy.getY(R.cornice[0]+i)));
 assert(bottom-top>.15&&Math.abs(bottom-top-.19806)<.00012,'cornice and sashes retain measured authored separation');
 assert([g.boundingSphere?.radius,...(g.boundingBox?.min.toArray()??[])].every(Number.isFinite));
 let callerDisposed=0;corrected.addEventListener('dispose',()=>callerDisposed++);
 g.dispose();assert.equal(callerDisposed,0);
 corrected.dispose();sash.dispose();trim.bulk.dispose();trim.geometry.dispose();
});
test('refuse stale envelope, indexed/grouped draw or overlapping/unsupported source ABI without mutating inputs',()=>{
 for(const [edit,msg] of [
  [(g:T.BufferGeometry)=>g.getAttribute('position').setX(5055,12),/envelope differs/],
  [(g:T.BufferGeometry)=>g.getAttribute('position').setX(5457,NaN),/ABI position/],
  [(g:T.BufferGeometry)=>g.setIndex([0,1,2]),/opaque draw/],
  [(g:T.BufferGeometry)=>g.addGroup(0,3),/opaque draw/],
  [(g:T.BufferGeometry)=>g.setAttribute('clad',new T.Float32BufferAttribute(new Float32Array(5853),1,true)),/ABI clad/],
  [(g:T.BufferGeometry)=>g.setAttribute('clad',new T.InstancedBufferAttribute(new Float32Array(5853),1)),/ABI clad/],
  [(g:T.BufferGeometry)=>g.morphAttributes.position=[g.getAttribute('position') as T.BufferAttribute],/opaque draw/],
  [(g:T.BufferGeometry)=>{
   const clipped=new T.Float32BufferAttribute((g.getAttribute('position').array as Float32Array).slice(0,5457*3),3);
   // Three's derived counter may be stale when a foreign caller swapped backing.
   Object.defineProperty(clipped,'count',{value:5853});g.setAttribute('position',clipped);
  },/ABI position/],
 ]as const){
  const g=intermediate();edit(g);
  const p=bytes(g.getAttribute('position').array as Float32Array),snapshot=Buffer.from(p);
  assert.throws(()=>combineEastFogAuthoredSurface(g,plan),msg);
  assert.deepEqual(p,snapshot);
  g.dispose();
 }
 const changed=structuredClone(plan);changed.planeBottom+=.14;
 const g=intermediate();assert.throws(()=>combineEastFogAuthoredSurface(g,changed),/envelope differs/);g.dispose();
});
