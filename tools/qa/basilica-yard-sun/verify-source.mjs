/*
 * Rebuild the exact immutable mesh/physical-sun source contract from ordinary game code.
 * This is not the independent ground-ray or screenshot comparison. No real-world sun survey.
 * node --experimental-strip-types tools/qa/basilica-yard-sun/verify-source.mjs . /tmp/yard-source.json
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [tree,output]=process.argv.slice(2);
if(!tree||!output)throw Error('Expected CHECKOUT OUTPUT.json');
const root=resolve(tree),tmp=mkdtempSync(join(tmpdir(),'pei-verified-basilica-'));
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(join(root,p));
const near=(a,b,e=2e-9)=>assert(Math.abs(a-b)<e,`Mismatch: ${a}, ${b}`);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),length=a=>Math.sqrt(dot(a,a)),unit=a=>a.map(x=>x/length(a));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
try{
 const p=spawnSync(process.execPath,['--experimental-strip-types',join(root,'tools/qa/basilica-exterior/emit-appearance-envelope.mjs'),root,tmp,'current-game-ground','candidate'],{encoding:'utf8'});
 if(p.status!==0)throw Error('Original game mesh did not export: '+p.stderr);
 const m=JSON.parse(readFileSync(join(tmp,'geometry.json'))),t=readFileSync(join(tmp,m.file));
 const cfg=(await import(pathToFileURL(join(root,'src/render/basilica-cast-source.ts')).href)).BASILICA_CAST;
 const code=await import(pathToFileURL(join(root,'src/render/basilica-cast-glsl.ts')).href);
 assert(m.dataSHA256===hash(t)&&m.triangleCount===30931&&m.batches.length===9);
 assert.deepEqual(cfg.origin,m.actualGroupOrigin);
 const groups=m.batches.map((batch,i)=>{
  const wanted=cfg.roster[i];assert.equal(batch.materialName,'basilica-exterior:'+wanted.surface);
  assert.equal(batch.positionSHA256,wanted.positions);assert.equal(batch.triangleCount*3,wanted.count);
  assert.equal(batch.indexSHA256,null);assert.equal(batch.materialType,'MeshStandardMaterial');
  return {role:wanted.surface,opaquePositionSha256:wanted.positions,triangles:batch.triangleCount};
 });
 const readGeo=new DataView(t.buffer,t.byteOffset,t.byteLength),sun=unit([-.6,.74,-.31]),u=unit(cross(sun,[0,1,0])),v=cross(sun,u);
 const axes=[u,v,sun],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 axes.forEach((axis,k)=>axis.forEach((d,i)=>near(d,cfg.directions[k][i])));
 for(let i=0;i<t.length;i+=24){
  const s=[0,1,2].map(k=>readGeo.getFloat64(i+k*8,true)-cfg.origin[k]);
  for(let k=0;k<3;k++){const d=dot(s,axes[k]);min[k]=Math.min(min[k],d);max[k]=Math.max(max[k],d);}
 }
 const pitch=cfg.pitch,n=cfg.size;
 const lower=[0,1].map(k=>Math.floor(((min[k]+max[k])*.5-n*pitch/2)/pitch)*pitch);
 assert.deepEqual(lower,cfg.loUV);near(min[2]-3,cfg.loD);near(max[2]+2,cfg.hiD);
 const margins=[0,1].map(k=>[(min[k]-lower[k])/pitch,(lower[k]+n*pitch-max[k])/pitch]);
 assert(margins.every(s=>Math.min(...s)>8));
 const tidy=a=>a.map(v=>+v.toFixed(8));
 const receipt={
  basis:'Original optional Great George frontage built from the game source; actual mesh in east/up/south game coordinates. Not a present-day building, photographic lighting or land survey.',
  terrainDecodedSha256:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
  worldTriangleSha256:m.dataSHA256,originalTriangleCount:m.triangleCount,groups,
  sourceOrigin:m.actualGroupOrigin,sun:tidy(sun),lightBoundsMin:tidy(min),lightBoundsMax:tidy(max),
  minTexelCorner:lower,pitchMetres:pitch,size:[n,n],outerCasterPaddingTexels:margins.map(tidy),
  depthMetres:{lower:+cfg.loD.toFixed(8),upper:+cfg.hiD.toFixed(8)},
  rendererContract:{casterGlslSha256:hash(code.DEPTH_VERTEX),receiverGlslSha256:hash(code.SHADOW_FIELD),
   rawD16Bytes:n*n*2,rawColourR8Bytes:n*n,receiverRoles:['land','road','walk'],
   homeTerrain:cfg.terrain,roadResident:cfg.roads,walkResident:cfg.sidewalk,
   publicNoArchitectureSelfShading:true,scope:'Verifies representation and source hashes; actual framebuffer and receiver classification require the independent native replay.'}
 };
 writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');console.log(`Verified ${groups.length} unchanged batches and ${m.triangleCount} actual triangles.`);
}finally{rmSync(tmp,{recursive:true,force:true});}
