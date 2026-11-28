/** Portable no-network authoring proof. Output directory must not already exist. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const at=s=>fileURLToPath(new URL(s,import.meta.url));
assert.ok(process.argv[2],'usage: node prove.mjs <fresh output directory>');
const dir=resolve(process.argv[2]);
const mode={encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONOPTIMIZE:'0'},timeout:120000};
const go=(exe,args)=>{
 const q=spawnSync(exe,args,mode);
 assert.equal(q.status,0,q.error?.message??q.stderr);
};
go(process.execPath,['--experimental-strip-types',at('export-studio.mjs'),dir]);
go('python3',[at('render-studio.py'),dir]);
const ref=JSON.parse(readFileSync(at('evidence/egl-source-receipt.json')));
const replay=JSON.parse(readFileSync(resolve(dir,'render-receipt.json')));
const sha=x=>createHash('sha256').update(x).digest('hex');
assert.deepEqual(Object.keys(replay.views).sort(),['front','porch','visibleScale']);
assert.equal(replay.triangleCount,1240);
assert.equal(replay.geometryDraws,1);assert.equal(replay.analyticTextureReads,0);
for(const [name,x] of Object.entries(replay.views)){
 assert.ok(x.alphaUnchanged&&x.studioRestoreExact&&x.gpuArtPositiveRGBGT3>1000);
 assert.equal(sha(readFileSync(resolve(dir,name+'.png'))),x.exactPNGSHA);
 if(replay.driver===ref.driver)assert.equal(x.activeRGBA,ref.views[name].activeRGBA);
}
console.log(JSON.stringify({scope:'Isolated studio only; no in-game or material claim.',
 exactDriver:replay.driver===ref.driver,plates:Object.keys(replay.views)},null,2));
