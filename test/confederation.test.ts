import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addConfederationBridge } from '../src/render/confederation.ts';
import { BRIDGE_LENGTH, NAV_SPAN, bridgeAt, isConfederationBridge, BRIDGE_SUPPORTS, BRIDGE_DECK_CONTROLS, bridgeGirderDepth } from '../src/sim/confederation.ts';

test('joined NRN centreline follows roughly 12.9 km of water and approach spans', ()=>{
  assert.ok(BRIDGE_LENGTH>12800&&BRIDGE_LENGTH<13080);
  assert.ok(NAV_SPAN>6000&&NAV_SPAN<7500);
  const start=bridgeAt(0),end=bridgeAt(BRIDGE_LENGTH),middle=bridgeAt(NAV_SPAN);
  assert.ok(start.y>=8&&start.y<=12&&end.y>=8&&end.y<=12);
  assert.ok(middle.y>58&&middle.y<=61);
  assert.ok(isConfederationBridge(middle.x,middle.z));
  assert.ok(!isConfederationBridge(middle.x+200,middle.z));
});

test('main supports align with published controls at both approaches and the channel',()=>{
  // Independent projected station fixtures from the TP 13681 control table.
  const stations:Record<string,number>={P44:1478.34,P43:1727.58,P42:1977.10,P22:6963.34,P21:7212.75,P5:11204.91,P4:11454.67,P3:11704.19};
  for(const [id,s] of Object.entries(stations)){
    const support=BRIDGE_SUPPORTS.find(p=>p.id===id)!;
    assert.equal(support.section,'main',id);
    assert.ok(Math.abs(support.station-s)<.02,id);
    assert.equal(bridgeGirderDepth(support.station),14,id);
  }
  const p=(id:string)=>BRIDGE_SUPPORTS.find(p=>p.id===id)!.station;
  assert.ok(Math.abs((p('P21')+p('P22'))/2-NAV_SPAN)<.01);
  assert.equal(bridgeGirderDepth(NAV_SPAN),4.5);
  assert.equal(BRIDGE_SUPPORTS.length,65);
  assert.equal(new Set(BRIDGE_SUPPORTS.map(p=>p.id)).size,65);
  assert.equal(BRIDGE_SUPPORTS.filter(p=>p.section==='main').length,44);
  assert.deepEqual(BRIDGE_SUPPORTS.filter(p=>p.section==='approach').map(p=>p.id[0]),
    [...Array(14).fill('W'),...Array(7).fill('E')]);
  for(let i=1;i<BRIDGE_SUPPORTS.length;i++)
    assert.ok(BRIDGE_SUPPORTS[i].station>BRIDGE_SUPPORTS[i-1].station);
  assert.ok(BRIDGE_SUPPORTS[0].station>0&&BRIDGE_SUPPORTS.at(-1)!.station<BRIDGE_LENGTH);
  for(const id of ['W14','E7']){
    assert.equal(bridgeGirderDepth(p(id)),3.3);
    assert.ok(Math.abs(bridgeGirderDepth(p(id)+.01)-bridgeGirderDepth(p(id)-.01))<.00001);
  }
});

test('all visible supports have positive shaft length in the approximate deck profile',()=>{
  for(const {station,id,section} of BRIDGE_SUPPORTS){
    const y=bridgeAt(station).y;
    assert.ok(y-bridgeGirderDepth(station)>=(section==='main'?3.6:2.1),id);
  }
});

test('visual deck meets the published MSL controls without seams or a second crest',()=>{
  const {westShoulder,crest,eastShoulder}=BRIDGE_DECK_CONTROLS;
  const station=(id:string)=>BRIDGE_SUPPORTS.find(p=>p.id===id)!.station;
  assert.equal(westShoulder,station('P26'));
  assert.equal(eastShoulder,station('P17'));
  assert.equal(bridgeAt(westShoulder).y,40.8);
  assert.equal(bridgeAt(eastShoulder).y,40.8);
  assert.equal(bridgeAt(crest).y,59.06);
  assert.equal(bridgeAt(station('P33')).y,40.8);
  assert.equal(bridgeAt(station('P8')).y,40.8);
  assert.equal(bridgeAt(0).y,9);
  assert.equal(bridgeAt(BRIDGE_LENGTH).y,9);
  for(const s of [station('W14'),station('P44'),westShoulder,crest,eastShoulder,station('P1'),station('E7')]){
    const y=bridgeAt(s).y,l=bridgeAt(s-.1).y,r=bridgeAt(s+.1).y;
    assert.ok(Math.abs((r-y)-(y-l))<1e-5,'a joined station must not kink');
  }
  for(const [lo,hi,direction] of [[westShoulder,crest,1],[crest,eastShoulder,-1]]){
    let prev=bridgeAt(lo).y;
    for(let i=1;i<=200;i++){
      const y=bridgeAt(lo+(hi-lo)*i/200).y;
      assert.ok(direction*(y-prev)>0);
      assert.ok(Math.abs(y-prev)/((hi-lo)/200)<.025,'the visual ramp must remain smooth');
      prev=y;
    }
  }
});

test('Three.js deck and pier mesh meet the vertical controls without changing surface scope',()=>{
  const scene=new THREE.Scene();
  const group=addConfederationBridge(scene);
  scene.updateMatrixWorld(true);
  const deck=group.children[0] as THREE.Mesh;
  const underside=group.children[2] as THREE.Mesh;
  const shafts=group.getObjectByName('main bridge shafts') as THREE.InstancedMesh;
  const ray=new THREE.Raycaster(), direction=new THREE.Vector3(0,-1,0);
  const {westShoulder,crest,eastShoulder}=BRIDGE_DECK_CONTROLS;
  for(const s of [westShoulder,crest,eastShoulder]){
    const p=bridgeAt(s);
    ray.set(new THREE.Vector3(p.x,100,p.z),direction);
    const y=ray.intersectObject(deck,false)[0]?.point.y;
    assert.ok(y!==undefined&&Math.abs(y-p.y)<.003,'matching deck mesh height');
    const bottom=ray.intersectObject(underside,false)[0]?.point.y;
    assert.ok(bottom!==undefined&&Math.abs(bottom-(p.y-bridgeGirderDepth(s)))<.003,'matching underside');
  }
  assert.equal(shafts.count,44);
  const matrix=new THREE.Matrix4();
  for(const id of ['P26','P22','P21','P17']){
    const i=44-Number(id.slice(1)),p=BRIDGE_SUPPORTS.filter(q=>q.section==='main')[i].station;
    shafts.getMatrixAt(i,matrix);
    const top=new THREE.Vector3(0,.5,0).applyMatrix4(matrix);
    const point=bridgeAt(p);
    assert.ok(Math.hypot(top.x-point.x,top.z-point.z)<.004,id);
    assert.ok(Math.abs(top.y-(point.y-bridgeGirderDepth(p)+.35))<.003,id);
  }
});

test('mirror-image bridge parapets stand 1.10 m above the existing road and have a sloping traffic face',()=>{
 const scene=new THREE.Scene(),group=addConfederationBridge(scene);
 scene.updateMatrixWorld(true);
 const walls=group.children[1] as THREE.Mesh,deck=group.children[0] as THREE.Mesh;
 const cast=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const stations=['W13','P31','P22','P3','E6'].map(id=>BRIDGE_SUPPORTS.find(p=>p.id===id)!.station);
 stations.push(BRIDGE_DECK_CONTROLS.crest);
 for (const station of stations) {
   const p=bridgeAt(station);
   function ray(w:number,object:THREE.Mesh){
    cast.set(new THREE.Vector3(p.x-p.dz*w,p.y+3,p.z+p.dx*w),down);
    return cast.intersectObject(object)[0]?.point.y;
   }
   assert.ok(Math.abs(ray(0,deck)!-p.y)<.003);
   assert.equal(ray(0,walls),undefined);
   for(const sign of [-1,1]){
    const toe=ray(sign*5.28,walls)!-p.y,knee=ray(sign*5.38,walls)!-p.y,taper=ray(sign*5.425,walls)!-p.y,cap=ray(sign*5.53,walls)!-p.y;
    assert.ok(toe>0&&toe<.15&&knee>.2&&knee<.34&&taper>.5&&taper<.82);
    assert.ok(Math.abs(cap-1.1)<.003,'documented parapet height');
    assert.equal(ray(sign*5.72,walls),undefined,'no expansion of model extent');
   }
 }
 assert.equal(group.children.length,8,'no new draw batches');
});
