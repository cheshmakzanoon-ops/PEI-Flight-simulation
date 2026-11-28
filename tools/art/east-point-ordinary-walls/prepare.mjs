/** Copy the pinned source into new external scratch storage, never patch a stock checkout. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,readFileSync,symlinkSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('fixture/',import.meta.url)),at=f=>resolve(root,f);
const [repo,out]=process.argv.slice(2);
assert.ok(repo&&out,'usage: node prepare.mjs <repository> <fresh external directory>');
const base=resolve(repo),dest=resolve(out),shell=f=>resolve(base,f),file=f=>resolve(dest,'app',f);
assert.notEqual(dest,base);assert.ok(!dest.startsWith(base+'/')&&!existsSync(dest));
const sha=x=>createHash('sha256').update(x).digest('hex');
const pins=JSON.parse(readFileSync(at('authority.json')));
for(const row of pins.files){
 if(row.stock===null){assert.ok(!existsSync(shell(row.path)));continue;}
 assert.equal(sha(readFileSync(shell(row.path))),row.stock,row.path);
}
for(const f of ['node_modules/three/package.json','public/world/buildings/tiles.pack','package.json','tsconfig.json','index.html','vite.config.ts'])assert.ok(existsSync(shell(f)),f);
mkdirSync(dest);mkdirSync(resolve(dest,'app'));
cpSync(shell('src'),file('src'),{recursive:true,errorOnExist:true,force:false});
for(const f of ['package.json','package-lock.json','tsconfig.json','index.html','vite.config.ts'])cpSync(shell(f),file(f));
symlinkSync(shell('node_modules'),file('node_modules'),'dir');
symlinkSync(shell('public'),file('public'),'dir');
const app=resolve(dest,'app');
const run=(exe,args)=>{
 const r=spawnSync(exe,args,{cwd:app,encoding:'utf8',timeout:120000});
 assert.equal(r.status,0,r.error?.message??r.stderr);
 return r.stdout;
};
run('git',['apply','--unidiff-zero','--check',at('changes.patch')]);run('git',['apply','--unidiff-zero',at('changes.patch')]);
for(const row of pins.files)assert.equal(sha(readFileSync(file(row.path))),row.fixture,row.path);
const q=resolve(dest,'qa');mkdirSync(q);
for(const f of ['capture.py','score.py','project.py','source-geometry-pins.json','serve.py'])cpSync(at(f),resolve(q,f));
const outlog=[
 run(file('node_modules/.bin/tsc'),['-p','tsconfig.json']),
 run(file('node_modules/.bin/vite'),['build','--outDir','../build']),
];
writeFileSync(resolve(dest,'build-log.txt'),outlog.join('\n'),{flag:'wx'});
console.log(JSON.stringify({prepared:dest,scope:'Private East Point actual stock route, signed q1333 walls only'}));
