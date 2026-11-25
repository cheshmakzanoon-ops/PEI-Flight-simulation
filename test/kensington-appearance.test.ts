import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const appearance=new URL('../tools/art/kensington-station-study/appearance/',import.meta.url);
const read=(p:string)=>readFileSync(new URL(p,appearance),'utf8');
test('appearance workbench presents its actual holds and is not mounted into the simulator',()=>{
 const page=read('index.html'),stage=read('studio.ts');
 assert.match(page,/Approximate exterior study, not installed scenery/);
 assert.match(page,/Southwest crown/); assert.match(page,/Northeast roof tip/);
 assert.match(page,/Exact roof covering/);
 assert.match(stage,/draft\.owner\.visible=true/); // explicit isolated host only
 assert.doesNotMatch(stage,/src\/|\bWorld\b|window\.location/);
 assert.doesNotMatch(readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),/KensingtonApproximateSilhouette|kensington-station-study/);
});

test('actual emitted 3D assemblies remain detached, bounded, and retain open shelter roles',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'pei-kensington-appearance-'));
 const entry=fileURLToPath(new URL('silhouette.ts',appearance));
 const materials=fileURLToPath(new URL('angular-stone-recipe.ts',appearance));
 try{
  const out=join(folder,'check.mjs');
  await build({stdin:{resolveDir:fileURLToPath(appearance),sourcefile:'qa.mjs',contents:`
    import assert from 'node:assert/strict';
    import {createKensingtonApproximateSilhouette} from ${JSON.stringify(entry)};
    import {studioAngularStoneAtlas} from ${JSON.stringify(materials)};
    const d=createKensingtonApproximateSilhouette();
    assert.equal(d.owner.parent,null);
    assert.equal(d.owner.visible,false);
    assert.equal(d.arch.children.length,8);
    assert.equal(d.art.children.length,12);
    const roles=Object.fromEntries(d.art.children.map(m=>[m.userData.role,m.geometry.attributes.position.count/3]));
    assert.deepEqual([roles['shelter-SW'],roles['shelter-NE']],[20,20]);
    assert.equal(Object.values(roles).reduce((a,b)=>a+b),491);
    assert(d.facts.evidenceHolds.includes('all field grade and feet'));
    const texture=studioAngularStoneAtlas();
    assert.equal(texture.recipe.stoneCount,1216);
    assert(texture.recipe.occupied>.62&&texture.recipe.occupied<.72);
    assert.equal(texture.map.image.data.length,768*768*4);
    d.dispose(); d.dispose();
  `},bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'error'});
  execFileSync(process.execPath,[out],{timeout:12000});
 }finally{rmSync(folder,{recursive:true,force:true});}
});
