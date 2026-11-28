import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Matrix4,PerspectiveCamera,Vector3} from 'three';
import {makeNorthCapeDetachedStudy} from '../north-cape-lens-draft.ts';
import {capeAperture,capeStudyLevel} from './screen-lod.ts';
const min=[-4.4,0,-4.4],max=[4.4,19.5,4.4];
const V=(h,w=2*h)=>({viewportWidth:w,viewportHeight:h,min,max});
function viewing(distance,height=700,{cx=0,cy=9.75,fov=53,off=0}={}){
 const q=V(height),c=new PerspectiveCamera(fov,q.viewportWidth/q.viewportHeight,.08,100000);
 c.position.set(off,cy,distance);c.lookAt(cx,9.75,0);c.updateMatrixWorld(true);
 return {...q,localToClip:new Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).elements};
}
test('the study envelope contains exact signed near, middle and dated authored positions',()=>{
 for(const [near,detail] of [[true,'baseline'],[false,'baseline'],[true,'dated-exterior']]){
  const x=makeNorthCapeDetachedStudy(near,detail);
  try{for(const g of [x.exterior.geometry,x.panes.geometry]){
   const p=g.attributes.position;
   for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every((v,j)=>min[j]<=v&&v<=max[j]));
  }}finally{x.dispose();}
 }
});
test('same actual aspect scales the aperture in pixels and cannot remove a seven-pixel 4K landmark',()=>{
 const a=capeAperture(viewing(5200));
 const b=capeAperture(viewing(5200,2160));
 assert.ok(a.kind==='visible'&&a.spanPx>2.5&&a.spanPx<2.8);
 assert.ok(b.kind==='visible'&&b.spanPx>7.7&&b.spanPx<8.3);
 assert.ok(Math.abs(b.spanPx-a.spanPx*2160/700)<1e-7);
 assert.deepEqual(capeStudyLevel('middle',b),{level:'middle',mayDraw:true});
 assert.equal(capeStudyLevel('middle',capeAperture(viewing(55000,2160))).level,'not-drawn');
 assert.equal(capeAperture(viewing(5200,2160,{fov:45})).spanPx>b.spanPx,true);
});
test('eight bounding vertices form a conservative frame, even off-axis',()=>{
 const q=viewing(1800,1200,{off:1000,cx:150});
 const a=capeAperture(q);assert.equal(a.kind,'visible');
 // Rays through interior positions cannot project outside vertex extremes with w positive.
 const p=[];for(let x=-4;x<=4;x+=.5)for(let y=.25;y<19.5;y+=.35)for(let z=-4;z<=4;z+=.5)
  p.push(new Vector3(x,y,z).applyMatrix4(new Matrix4().fromArray(q.localToClip)));
 const extrema=(k)=>p.reduce(([l,u],v)=>[Math.min(l,v[k]),Math.max(u,v[k])],[Infinity,-Infinity]);
 const range=(a)=>a[1]-a[0];
 assert.ok(range(extrema('x'))*q.viewportWidth/2<=a.spanPx+1e-8);
 assert.ok(range(extrema('y'))*q.viewportHeight/2<=a.spanPx+1e-8);
});
test('transitions are stable around both bands and refuse unsupported optics',()=>{
 const a=p=>({kind:'visible',spanPx:p});
 assert.equal(capeStudyLevel('near',a(16)).level,'near');
 assert.equal(capeStudyLevel('middle',a(16)).level,'middle');
 assert.equal(capeStudyLevel('near',a(15)).level,'middle');
 assert.equal(capeStudyLevel('middle',a(19)).level,'near');
 assert.equal(capeStudyLevel('middle',a(1)).level,'middle');
 assert.equal(capeStudyLevel('not-drawn',a(1)).level,'not-drawn');
 assert.equal(capeStudyLevel('middle',a(.8)).level,'not-drawn');
 assert.equal(capeStudyLevel('not-drawn',a(1.35)).level,'middle');
 const q=viewing(800);assert.deepEqual(capeStudyLevel('middle',capeAperture({...q,viewportHeight:NaN})),{level:'near',mayDraw:true});
 assert.deepEqual(capeStudyLevel('middle',capeAperture(viewing(150,-1))),{level:'near',mayDraw:true});
 assert.deepEqual(capeStudyLevel('middle',{kind:'outside',spanPx:0}),{level:'middle',mayDraw:false});
});
