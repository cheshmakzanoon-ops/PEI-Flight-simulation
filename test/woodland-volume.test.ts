import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene, Vector3} from 'three';
import {WOODLAND_VOLUME_LIMIT, WoodlandVolume} from '../src/render/woodland-volume.ts';
import {branchedCrown} from '../src/render/woodland-volume-geometry.ts';

test('the four bounded original volumes have finite rooted three-dimensional geometry',()=>{
 for(let i=0;i<4;i++){
  const geo=branchedCrown(i),p=geo.getAttribute('position'),n=geo.getAttribute('normal'),index=geo.index!;
  assert.ok(index.count/3>1000&&index.count/3<2000);
  assert.ok(p.count<=3400);
  assert.ok(n.array.every(Number.isFinite)&&p.array.every(Number.isFinite));
  let cross=0,h=0,min=1;
  const a=new Vector3(),b=new Vector3(),c=new Vector3();
  for(let j=0;j<index.count;j+=3){
   a.fromBufferAttribute(p,index.getX(j));b.fromBufferAttribute(p,index.getX(j+1));c.fromBufferAttribute(p,index.getX(j+2));
   h=Math.max(h,a.y,b.y,c.y);min=Math.min(min,a.y,b.y,c.y);
   assert.ok(b.sub(a).cross(c.sub(a)).length()>1e-9);cross++;
  }
  assert.ok(min<=.015&&h>.84&&h<1.12&&cross>1000);
 }
});

test('bounded rescan does not omit stems that can enter the 50m fade before the next frame',()=>{
 const positions=[],shapes=[];
 for(let j=-9;j<=9;j++)for(let i=-9;i<=9;i++){
  positions.push(i*12+(i+j*7+5)**2%12,58+(i**2+j**2)%5,j*12+(j-i*5+4)**2%12);
  shapes.push(11,10,(i*j)&3,1.0);
 }
 const p=Float32Array.from(positions),s=Float32Array.from(shapes),sc=new Scene();
 const volume=new WoodlandVolume(sc,p.length/3);
 const eligible=(x:number,z:number)=>p.length/3-Array.from({length:p.length/3},(_,k)=>k)
  .filter(k=>Math.hypot(x-p[k*3],z-p[k*3+2])>=50||volume.mask.getX(k)===1).length;
 for(const [x,z] of [[0,0],[6.9,0],[0,7.49],[22.1,17.1],[27.6,20.2],[-4.2,22.7]]){
  volume.update(p,s,p.length/3,x,z,28,4);
  assert.equal(eligible(x,z),0);
  assert.ok(volume.count<=WOODLAND_VOLUME_LIMIT&&volume.count>0);
 }
 volume.update(p,s,p.length/3,27.6,20.2,133,4);
 assert.equal(volume.count,0);assert.equal(volume.fade.value.z,0);
 assert.ok(sc.children.every(child=>!child.visible));
});
