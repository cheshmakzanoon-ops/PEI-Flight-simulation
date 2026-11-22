import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bake,insideRoof} from '../tools/geodata/bake-tree-clearance.ts';
import {roofCellCount,roofCellDeltas} from '../src/sim/tree-clearance.generated.ts';
import {decodeTreeCells,fillRoofTile} from '../src/sim/tree-clearance.ts';
import {treeCellKey,treeTileStart} from '../src/sim/tree-layout.ts';

test('every shipped tree clearance bit equals a source roof hit; no other cells are suppressed',()=>{
  const {sorted,tally,text}=bake();
  assert.equal(readFileSync(new URL('../src/sim/tree-clearance.generated.ts',import.meta.url),'utf8'),text,'stale source seeds, coverage, or mask: rebake and review');
  assert.deepEqual(tally,{sourceRoofs:85866,sourceHoles:0,footprintsWithStems:12557,stemRoofPairs:18038,uniqueStems:18038,tilesWithBlockedStems:6620,deltaBytes:25499});
  assert.deepEqual(Array.from(decodeTreeCells(roofCellDeltas,roofCellCount)),sorted);
  const bits=new Uint32Array(8),emitted:number[]=[];
  for(const tile of new Set(sorted.map(k=>Math.floor(k/256)))){
    const tx=tile%2048-1024,tz=Math.floor(tile/2048)-1024;
    assert.equal(fillRoofTile(tx,tz,bits),true);
    for(let local=0;local<256;local++){
      if((bits[local>>>5]&(1<<(local&31)))!==0)emitted.push(treeTileStart(tx,tz)+local);
    }
  }
  assert.deepEqual(emitted,sorted);
  for(const [x,z] of [[-1024,-1024],[1023,1023],[-1025,0],[0,1024]]){
    bits.fill(0xffffffff);assert.equal(fillRoofTile(x,z,bits),false);assert.ok(bits.every(w=>w===0));
  }
});

test('courtyard holes and just-outside stems stay untouched; negative tile coordinates round-trip',()=>{
  const box=(a:number,b:number,c:number,d:number)=>[{x:a,z:b},{x:c,z:b},{x:c,z:d},{x:a,z:d}];
  const exterior=box(-10,-10,10,10),interior=box(-4,-4,4,4);
  assert.equal(insideRoof(0,0,exterior,[interior]),false);
  assert.equal(insideRoof(-6,0,exterior,[interior]),true);
  assert.equal(insideRoof(10.001,0,exterior,[interior]),false);
  assert.equal(treeCellKey(-1,-1),treeTileStart(-1,-1)+255);
  assert.equal(treeCellKey(-16,-16),treeTileStart(-1,-1));
  assert.equal(treeCellKey(0,0),treeTileStart(0,0));
  assert.throws(()=>decodeTreeCells('gA==',1));
  assert.throws(()=>decodeTreeCells('AQA=',2));
  assert.throws(()=>decodeTreeCells('AQI=',1));
});
