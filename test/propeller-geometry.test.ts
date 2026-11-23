import test from 'node:test';
import assert from 'node:assert/strict';
import {propellerBlades} from '../src/render/propeller.ts';
import {PROPELLER} from '../src/sim/propeller-spec.ts';

test('the three solid blades sweep the specified prop disk, without an oversize chord at the tip',()=>{
  const g=propellerBlades(), p=g.getAttribute('position'), n=g.getAttribute('normal'), c=g.getAttribute('color');
  assert.equal(PROPELLER.bladeCount,3);assert.equal(p.count%3,0);assert.equal(n.count,p.count);assert.equal(c.count,p.count);
  const step=p.count/3, cos=Math.cos(2*Math.PI/3), sin=Math.sin(2*Math.PI/3);
  const radii=Array(3).fill(0);
  for(let b=0;b<3;b++)for(let i=0;i<step;i++){
    const a=b*step+i,next=((b+1)%3)*step+i, x=p.getX(a),y=p.getY(a);
    radii[b]=Math.max(radii[b],Math.hypot(x,y));
    assert.ok(Math.abs(x*cos+y*sin-p.getX(next))<2e-6);
    assert.ok(Math.abs(y*cos-x*sin-p.getY(next))<2e-6);
    assert.ok(Math.abs(p.getZ(a)-p.getZ(next))<1e-8);
    assert.ok(Math.abs(Math.hypot(n.getX(a),n.getY(a),n.getZ(a))-1)<1e-4);
  }
  // Check an independently converted POH value, not just a value imported from the renderer.
  for(const radius of radii)assert.ok(Math.abs(2*radius-2.0066)<2e-6);
  assert.ok(Math.abs(PROPELLER.groundClearanceM-.276225)<1e-9);
  // Every undirected mesh edge is shared by exactly two triangles, with opposite orientations.
  const indices=g.getIndex()!.array,edges=new Map<string,{n:number,net:number}>();
  for(let i=0;i<indices.length;i+=3){
    for(let k=0;k<3;k++){
      const a=indices[i+k],b=indices[i+(k+1)%3];assert.notEqual(a,b);
      const key=a<b?a+','+b:b+','+a, e=edges.get(key)??{n:0,net:0};
      e.n++;e.net+=a<b?1:-1;edges.set(key,e);
    }
  }
  for(const e of edges.values())assert.deepEqual(e,{n:2,net:0});
  assert.ok(indices.length/3<1800);
  g.dispose();
});
