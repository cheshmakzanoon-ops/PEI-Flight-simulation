import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import data from '../src/sim/fitted-roofs.json' with {type:'json'};
import {lookupRoofFit,supportedRoofAtlas} from '../src/sim/fitted-roofs.ts';
import {project} from '../src/sim/geo.ts';
import {ridgeOffset,roofHeight} from '../src/sim/roof-ridge.ts';

type Outline=[number,number][];
const dir=new URL('../public/world/buildings/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('index.json',dir),'utf8'));
const pack=readFileSync(new URL('tiles.pack',dir));

test('screened roof surfaces match the pinned footprint pack and only one outline per county',()=>{
  const sha=createHash('sha256').update(pack).digest('hex');
  assert.ok(supportedRoofAtlas(index.sha256));
  assert.ok(supportedRoofAtlas(sha));
  assert.ok(!supportedRoofAtlas(undefined)&&!supportedRoofAtlas('different'));
  assert.deepEqual(data.roofs.map(v=>v.county).sort(),['Kings','Prince','Queens']);
  const cases:Array<{tile:string;i:number}>=[];
  for(const {id,offset,bytes} of index.tiles){
    const {features}=JSON.parse(gunzipSync(pack.subarray(offset,offset+bytes)).toString());
    features.forEach((f:{footprint:Outline;holes?:Outline[]},i:number)=>{
      const outline=f.footprint,n=outline.length;
      const points=outline.map(([lon,lat])=>project(lon,lat));
      const center={x:points.reduce((s,p)=>s+p.x,0)/n,z:points.reduce((s,p)=>s+p.z,0)/n};
      const fit=lookupRoofFit(id,outline,center);
      if(!fit)return;
      assert.equal(f.holes?.length??0,0);
      cases.push({tile:id,i});
      const ref=data.roofs.find(r=>r.tile===id&&r.featureIndex===i)!;
      const rim=points.map(p=>roofHeight(p,fit));
      assert.ok(Math.abs(ridgeOffset(center,fit)-ref.signedAtCenterM)<1e-8);
      assert.ok(Math.abs(Math.min(...rim)-ref.minBoundaryAglM)<.001);
      assert.ok(Math.abs(Math.max(...rim)-ref.maxBoundaryAglM)<.001);
      assert.ok(points.some(p=>ridgeOffset(p,fit)<0)&&points.some(p=>ridgeOffset(p,fit)>0));
    });
  }
  assert.deepEqual(cases.sort((a,b)=>a.tile.localeCompare(b.tile)),data.roofs.map(r=>({tile:r.tile,i:r.featureIndex})).sort((a,b)=>a.tile.localeCompare(b.tile)));
});
