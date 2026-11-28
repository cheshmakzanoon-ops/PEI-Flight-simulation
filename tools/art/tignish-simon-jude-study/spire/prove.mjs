#!/usr/bin/env node
/** A fresh directory for a fully local Three.js/CPU proof; no browser or live world. */
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';

const argv=process.argv.slice(2);
if(argv.length!==2||argv[0]!=='--out'||!argv[1].trim()||argv[1].startsWith('--')){
 console.error('Usage: node --experimental-strip-types <path-to-spire>/prove.mjs --out <new-output-directory>');
 process.exit(2);
}
const source=dirname(fileURLToPath(import.meta.url)),out=resolve(process.cwd(),argv[1]);
const node=process.execPath;
const tools={test:'verify.mjs',emitter:'emit.mjs',renderer:'render-cpu.py'};
let owned=false;
const write=(p,b)=>writeFileSync(join(out,p),b,{flag:'wx'});
function call(bin,args,log,combine=false){
 const r=spawnSync(bin,args,{cwd:source,encoding:'utf8',maxBuffer:4*1024*1024});
 if(r.error){
  write(log,r.error.message+'\n');
  throw Error('Failed to start '+bin+'; see '+log);
 }
 write(log,combine?r.stdout+r.stderr:r.stdout);
 if(r.stderr&&!combine)write(log+'.stderr',r.stderr);
 if(r.status!==0)throw Error(bin+' exit '+r.status+'; see '+log);
 return r.stdout;
}
const sha=p=>createHash('sha256').update(readFileSync(join(out,p))).digest('hex');
try{
 try{mkdirSync(out,{recursive:false,mode:0o700});owned=true;}
 catch(e){if(e.code==='EEXIST')throw Error('Output already exists; refusing overwrite. Choose a fresh directory.');throw e;}
 call(node,['--experimental-strip-types','--test',tools.test],'verification.log',true);
 call(node,['--experimental-strip-types',tools.emitter,join(out,'three-emitted.json')],'emitter.log',true);
 const summary=JSON.parse(call('python3',[tools.renderer,join(out,'three-emitted.json'),join(out,'plates')],'plate-proof.json'));
 const files=['verification.log','three-emitted.json','plate-proof.json',
  'plates/front-flank.png','plates/front-reciprocal.png','plates/return-unseen.png'];
 const result={status:'PASS detached geometry and CPU plates',metric:false,gameMount:false,browserExecuted:false,
  triangles:summary.triangles,materialBatches:summary.batches.length,files:Object.fromEntries(files.map(name=>[name,sha(name)]))};
 write('receipt.json',JSON.stringify(result,null,2)+'\n');
 console.log(result.status+' : '+out);
}catch(e){
 if(owned)write('FAILURE.txt',String(e)+'\n');
 console.error(String(e));
 process.exitCode=1;
}
