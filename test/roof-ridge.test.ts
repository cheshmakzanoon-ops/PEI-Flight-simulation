import test from 'node:test';
import assert from 'node:assert/strict';
import {ridgeOffset,roofHeight,splitRoofEdge,splitRoofTriangle,type Triangle,type RoofRidge} from '../src/sim/roof-ridge.ts';
const ridge:RoofRidge={origin:{x:0,z:0},normal:{x:1,z:0},peakM:7,leftSlope:.47,rightSlope:.36};
const P=(x:number,z:number)=>({x,z});
const area=([a,b,c]:Triangle)=>((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
test('a roof ridge splits both windings without losing or adding area',()=>{
  const triangle:Triangle=[P(-2,0),P(3,4),P(3,-2)];
  for(const corners of [triangle,[triangle[0],triangle[2],triangle[1]] as Triangle]){
    const split=splitRoofTriangle(corners,ridge);
    assert.equal(split.length,3);
    assert.ok(Math.abs(split.map(area).reduce((s,v)=>s+v,0)-area(corners))<1e-9);
    for(const t of split){
      assert.equal(Math.sign(area(t)),Math.sign(area(corners)));
      const ds=t.map(p=>ridgeOffset(p,ridge));
      assert.ok(ds.every(v=>v>=-1e-9)||ds.every(v=>v<=1e-9));
    }
  }
});
test('joining roof, wall and ridge agree exactly at the wall crossing',()=>{
  const a=P(-2,0),b=P(2,4),[l,c,r]=splitRoofEdge(a,b,ridge);
  assert.deepEqual([l,c,r],[a,P(0,2),b]);
  assert.equal(roofHeight(c,ridge),7);
  assert.ok(Math.abs(roofHeight(l,ridge)-6.06)<1e-9);
  assert.ok(Math.abs(roofHeight(r,ridge)-6.28)<1e-9);
  const [one,two]=splitRoofTriangle([a,b,P(0,4)],ridge);
  assert.ok(one.some(p=>p.x===c.x&&p.z===c.z)&&two.some(p=>p.x===c.x&&p.z===c.z));
  assert.equal(splitRoofEdge(a,c,ridge).length,2);
  assert.equal(splitRoofTriangle([a,P(-2,6),P(0,4)],ridge).length,1);
});
test('clipping does not fill a courtyard or open a seam at a world-scale origin',()=>{
  const x=83_000,z=-39_000;
  const at=(u:number,v:number)=>P(x+u,z+v);
  const offsetRidge={...ridge,origin:at(0,0),normal:P(.8,.6)};
  const strip=(x0:number,x1:number,y0:number,y1:number):Triangle[]=>[
    [at(x0,y0),at(x1,y0),at(x1,y1)],[at(x0,y0),at(x1,y1),at(x0,y1)]
  ];
  const mesh=[...strip(-10,-4,-10,10),...strip(4,10,-10,10),...strip(-4,4,-10,-3),...strip(-4,4,3,10)];
  const output=mesh.flatMap(t=>splitRoofTriangle(t,offsetRidge));
  assert.ok(Math.abs(output.map(area).reduce((s,v)=>s+v,0)-(400-48))<1e-8);
  for(const t of output) {
    const cx=t.reduce((s,p)=>s+p.x-x,0)/3,cz=t.reduce((s,p)=>s+p.z-z,0)/3;
    assert.ok(Math.abs(cx)>=4||Math.abs(cz)>=3,'intrusion into courtyard');
  }
});
