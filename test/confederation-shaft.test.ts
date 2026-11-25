import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { addConfederationBridge } from '../src/render/confederation.ts';
import { bridgeAt, bridgeGirderDepth, BRIDGE_SUPPORTS } from '../src/sim/confederation.ts';

const near=(a:number,b:number,tolerance=1e-5)=>Math.abs(a-b)<tolerance;

test('main Confederation shafts are a closed 8 m to 10 × 5 m octagon-to-rectangle loft',()=>{
  const group=addConfederationBridge(new THREE.Scene());
  const main=group.getObjectByName('main bridge shafts') as THREE.InstancedMesh;
  const pos=main.geometry.attributes.position;
  const normal=main.geometry.attributes.normal;
  const edges=new Map<string,number>();
  const vertices=(index:number)=>[pos.getX(index),pos.getY(index),pos.getZ(index)] as const;
  const keys=(index:number)=>vertices(index).join(',');
  const row=(y:number)=>Array.from({length:pos.count},(_,i)=>vertices(i)).filter(v=>near(v[1],y));
  const cut=row(-.482), cap=row(.545);
  assert.equal(Math.max(...cut.map(v=>v[0]))-Math.min(...cut.map(v=>v[0])),8);
  assert.equal(Math.max(...cut.map(v=>v[2]))-Math.min(...cut.map(v=>v[2])),8);
  assert.ok(cut.every(([x,,z])=>near(Math.hypot(x,z),4/Math.cos(Math.PI/8))));
  assert.equal(Math.max(...cap.map(v=>v[0]))-Math.min(...cap.map(v=>v[0])),10,'local tangent');
  assert.equal(Math.max(...cap.map(v=>v[2]))-Math.min(...cap.map(v=>v[2])),5,'local across');
  let volume=0;
  for(let a=0;a<pos.count;a+=3){
    const [x,y,z]=[0,1,2].map(j=>new THREE.Vector3(...vertices(a+j)));
    volume+=x.dot(y.clone().cross(z))/6;
    const n=new THREE.Vector3().fromBufferAttribute(normal,a);
    assert.ok(near(n.length(),1),'no degenerate triangles');
    if(x.y===y.y&&y.y===z.y)assert.ok(near(n.y,x.y<0?-1:1),'caps face away from the shaft');
    if(a<32*3&&a%6===0){
      const other=new THREE.Vector3().fromBufferAttribute(normal,a+3);
      assert.ok(n.distanceTo(other)<1e-5,'both triangles of each wall share a plane normal');
    }
    for(let j=0;j<3;j++){
      const pair=[keys(a+j),keys(a+(j+1)%3)].sort().join('|');
      edges.set(pair,(edges.get(pair)??0)+1);
    }
  }
  assert.ok(volume>0,'outer normal orientation');
  assert.ok([...edges.values()].every(n=>n===2),'no hole or overlapping face');
  assert.equal(pos.count/3,44);
  assert.equal(main.count,44);
  assert.equal((group.getObjectByName('approach bridge shafts') as THREE.InstancedMesh).count,21);
});

test('all 44 shafts retain registration, exact ice-shield seating and buried soffit contact',()=>{
  const scene=new THREE.Scene(), bridge=addConfederationBridge(scene);
  scene.updateMatrixWorld(true);
  const main=bridge.getObjectByName('main bridge shafts') as THREE.InstancedMesh;
  const shields=bridge.getObjectByName('main bridge shields') as THREE.InstancedMesh;
  const soffit=bridge.children[2], deck=bridge.children[0];
  const position=main.geometry.attributes.position;
  const ray=new THREE.Raycaster(), direction=new THREE.Vector3(0,-1,0), m=new THREE.Matrix4();
  const center=new THREE.Vector3(), tangent=new THREE.Vector3(), p=new THREE.Vector3(), u=new THREE.Vector3();
  const capSamples:{foot:boolean,p:THREE.Vector3}[]=[];
  for(let j=0;j<position.count;j+=3){
    const y=position.getY(j);
    if((y!==-.5&&y<.5)||position.getY(j+1)!==y||position.getY(j+2)!==y)continue;
    const a=new THREE.Vector3().fromBufferAttribute(position,j);
    const b=new THREE.Vector3().fromBufferAttribute(position,j+1);
    const c=new THREE.Vector3().fromBufferAttribute(position,j+2);
    for(let i=0;i<=4;i++)for(let k=0;k<=4-i;k++)
      capSamples.push({foot:y<0,p:a.clone().multiplyScalar(1-(i+k)/4).addScaledVector(b,i/4).addScaledVector(c,k/4)});
  }
  assert.equal(capSamples.filter(s=>s.foot).length,90);
  assert.equal(capSamples.filter(s=>!s.foot).length,90);
  for(const [i,{id,station}] of BRIDGE_SUPPORTS.filter(p=>p.section==='main').entries()){
    main.getMatrixAt(i,m);
    const at=bridgeAt(station);
    center.set(0,.5,0).applyMatrix4(m);
    tangent.set(1,.5,0).applyMatrix4(m).sub(center);
    assert.ok(near(center.x,at.x,.004)&&near(center.z,at.z,.004),id);
    assert.ok(near(center.y,at.y-bridgeGirderDepth(station)+.35,.003),id);
    assert.ok(near(tangent.x,at.dx)&&near(tangent.z,at.dz),id);
    for(const s of capSamples){
      p.copy(s.p).applyMatrix4(m);
      ray.set(u.set(p.x,100,p.z),direction);
      if(s.foot){
        const shoulder=ray.intersectObject(shields,false)[0]?.point.y;
        assert.ok(shoulder!==undefined&&near(shoulder,p.y,.002),`${id}: shaft inside stock collar`);
      }else{
        const bottom=ray.intersectObject(soffit,false)[0]?.point.y;
        const surface=ray.intersectObject(deck,false)[0]?.point.y;
        assert.ok(bottom!==undefined&&p.y-bottom>.08,`${id}: top reaches the rising soffit`);
        assert.ok(surface!==undefined&&surface-p.y>10,`${id}: top never projects through the deck`);
      }
    }
  }
  const newBounds=new THREE.Box3().setFromObject(bridge);
  const previous=main.geometry;
  const cylinder=new THREE.CylinderGeometry(3.85,4.35,1,8);
  main.geometry=cylinder;
  main.computeBoundingBox();
  assert.ok(newBounds.equals(new THREE.Box3().setFromObject(bridge)),'whole bridge bounds unchanged');
  main.geometry=previous;
  cylinder.dispose();
});
