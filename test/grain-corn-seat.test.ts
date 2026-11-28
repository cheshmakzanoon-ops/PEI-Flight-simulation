import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeFieldSeat,translatedFieldSeat} from '../tools/geodata/province-fields/corn-seat/native-field-seat.ts';
const u=[-38.75,-34.25,-25.5], v=[21.5,32.25,42],h=[1,19,-1,10,75,16,8,-7,172];
const pos=Float32Array.from(v.flatMap((z,j)=>u.flatMap((x,i)=>[x,h[j*3+i],z])));
const idx=Uint16Array.from([0,3,1,3,4,1,1,4,2,4,5,2,3,6,4,6,7,4,4,7,5,7,8,5]);
const close=(actual:number|undefined,want:number)=>assert.ok(actual!==undefined&&Math.abs(actual-want)<1e-12,[actual,want].join('/'));
test('sample true EBO triangles on both diagonal sides and all intersections',()=>{
 const seat=nativeFieldSeat(pos,idx,2);
 for(let j=0;j<3;j++)for(let i=0;i<3;i++)close(seat(u[i],v[j]),h[j*3+i]);
 close(seat((u[0]+u[1])/2,(v[0]+v[1])/2),14.5);
 close(seat(u[0]*.25+u[1]*.75,v[0]*.25+v[1]*.75),44.75);
 close(seat(u[0]*.75+u[1]*.25,v[0]*.75+v[1]*.25),7.75);
 assert.notEqual(seat((u[0]+u[1])/2,(v[0]+v[1])/2),(1+19+10+75)/4);
});
test('mismatch and invalid queries are not turns into unpinned ground',()=>{
 const seat=nativeFieldSeat(pos,idx,2);
 assert.equal(seat(Infinity,21.5),undefined);
 assert.equal(seat(-38.751,21.5),undefined);
 const flipped=idx.slice();flipped[3]=0;
 assert.throws(()=>nativeFieldSeat(pos,flipped,2));
 const twisted=pos.slice();twisted[3*4]-=.125;
 assert.throws(()=>nativeFieldSeat(twisted,idx,2));
});

test('actual model translation is applied before choosing a triangle; rotation and shears are refused',()=>{
 const sample=nativeFieldSeat(pos,idx,2);
 const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,-21325.607421875,3,-5153.83203125,1];
 const world=translatedFieldSeat(sample,matrix);
 close(world(u[2]+matrix[12],v[2]+matrix[14]),175);
 assert.equal(world(u[2],v[2]),undefined);
 const m2=matrix.slice();m2[4]=.005;
 assert.throws(()=>translatedFieldSeat(sample,m2),RangeError);
});
