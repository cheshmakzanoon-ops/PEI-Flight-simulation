import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {BASIN_GROUND} from '../src/sim/basin-bank-relief.generated.ts';
import {loadBasinGround,NativeBank} from '../src/sim/basin-bank-relief.ts';
import {Terrain} from '../src/sim/terrain.ts';
import {GROUND_LIFT} from '../src/sim/coastal-terrain.ts';
import {insertCoastalGrid} from '../src/render/coastal-patch.ts';
import {nativeBankMesh} from '../src/render/native-bank-mesh.ts';

test('every covered native bank vertex/normal survives sparse close relief without splitting inactive land',async()=>{
 const world=new URL('../public/world/',import.meta.url),get=(p:string)=>new Uint8Array(readFileSync(new URL(p,world)));
 const spec=JSON.parse(new TextDecoder().decode(get('terrain.json'))),a=Uint8Array.from(gunzipSync(get(spec.file)));
 const t=new Terrain(spec,new Int16Array(a.buffer));
 const b=await loadBasinGround('/',async()=>new Response(get(BASIN_GROUND.asset)));assert(b);
 const bank=new NativeBank(t,b),p=bank.grid,n=112,W=(t.right-t.left)/32,D=(t.bottom-t.top)/22;
 const x=t.left+BASIN_GROUND.tileX*W,z=t.top+BASIN_GROUND.tileZ*D,xc=x+W*.5,zc=z+D*.5;
 const original=()=>{const g=new THREE.PlaneGeometry(W,D,n,n);g.rotateX(-Math.PI/2);
  const pos=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<pos.count;i++){
   const q=pos.getX(i)+xc,r=pos.getZ(i)+zc,[u,v]=t.uv(q,r);
   pos.setY(i,t.atlasElevation(q,r)+GROUND_LIFT);uv.setXY(i,u,v);
  }
  return g;
 };
 const dense=original();insertCoastalGrid(dense,n,{x,z,w:W,d:D},t,p);
 const base=original(),sparse=nativeBankMesh(base,bank,t,x,z,W,D);
 assert.equal(dense.index!.count/3,81898);
 assert.equal(sparse.index!.count/3,41618);
 const qa=dense.getAttribute('position'),qb=sparse.getAttribute('position');
 const na=dense.getAttribute('normal'),nb=sparse.getAttribute('normal');
 const weights=sparse.getAttribute('surveyWeight');
 const placed=new Set<number>();
 let worstXZ=0,worstY=0;
 for(let k=0;k<qb.count;k++){
  if(k<base.getAttribute('position').count){
   assert.equal(qb.getX(k),base.getAttribute('position').getX(k));
   assert.equal(qb.getY(k),base.getAttribute('position').getY(k));
   assert.equal(qb.getZ(k),base.getAttribute('position').getZ(k));
  }
  if(!weights.getX(k))continue;
  const i=Math.round((qb.getX(k)+xc-p.x0)/p.stepX),j=Math.round((qb.getZ(k)+zc-p.z0)/p.stepZ);
  assert(i>=0&&i<p.nx&&j>=0&&j<p.nz);
  const k0=j*p.nx+i,v=base.getAttribute('position').count+k0;placed.add(k0);
  worstXZ=Math.max(worstXZ,Math.hypot(qb.getX(k)-qa.getX(v),qb.getZ(k)-qa.getZ(v)));
  worstY=Math.max(worstY,Math.abs(qb.getY(k)-qa.getY(v)));
  assert.equal(weights.getX(k),b.weights[k0]/255);
  assert.deepEqual([nb.getX(k),nb.getY(k),nb.getZ(k)],[na.getX(v),na.getY(v),na.getZ(v)]);
 }
 assert.equal(placed.size,4252);
 assert(worstXZ<.0007 && worstY<.00005,JSON.stringify({worstXZ,worstY}));
});
