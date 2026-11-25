/** Run as Node 22.12+ from the repository root. The runtime itself creates the
 * original packed tile and the resolved optional art; this adapter only reads
 * its emitted GPU attributes and existing unmodified receiver sampler. */
import {readFileSync as R,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';import {gunzipSync as Z} from 'node:zlib';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]??'.'),out=resolve(process.argv[3]??'/tmp/pei-seacow-emitted');mkdirSync(out,{recursive:true});
const require=createRequire(join(root,'package.json')),THREE=await import(pathToFileURL(require.resolve('three').replace(/three\.cjs$/,'three.module.js')));
const mod=p=>import(pathToFileURL(join(root,p)));
const {Buildings}=await mod('src/render/buildings.ts'),{Terrain}=await mod('src/sim/terrain.ts'),{regularRoadGround}=await mod('src/render/road-contact.ts');
const {SEACOW}=await mod('src/render/seacow-exterior-seat.ts');
const h=b=>createHash('sha256').update(b).digest('hex'),read=p=>R(join(root,'public/world',p)),obj=p=>JSON.parse(read(p)),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const a=obj('buildings/index.json'),s=obj('terrain.json'),z=Z(read(s.file)),t=new Terrain(s,new Int16Array(ab(z))),floor=regularRoadGround(t);
const k=a.tiles.find(o=>o.id===SEACOW.id),pack=read('buildings/'+a.file),wire=pack.subarray(k.offset,k.offset+k.bytes);assert.equal(h(pack),SEACOW.atlas);assert.equal(h(wire),SEACOW.chunk);
const scene=new THREE.Scene(),b=new Buildings(scene,t,[k],{read:async(o,n)=>{assert.deepEqual([o,n],[k.offset,k.bytes]);return ab(wire);}},a.sha256);
let ready=true;b.enableSeacowExterior({floor,verifiedCover:async()=>true,resident:()=>ready});b.wanted.add(k.id);await b.load(b.tiles[0]);
const originalBeforeAdmission=b.meshes.get(k.id).geometry;assert.equal(originalBeforeAdmission.index,null);
for(let i=0;!b.seacowExteriorActive&&i<100;i++)await new Promise(r=>setTimeout(r,5));assert(b.seacowExteriorActive);
const g=b.seacow.art.group,owner=b.seacow.owner,mounted=owner.geometry;
scene.updateMatrixWorld(true);
const blend=(a,b,f)=>a.map((q,i)=>q+f*(b[i]-q));
const map=(p,mat)=>new THREE.Vector3(...p).applyMatrix4(mat).toArray();
const hashes=Object.fromEntries(['src/render/seacow-exterior-art.ts','src/render/seacow-exterior-seat.ts','src/render/buildings.ts','src/render/world.ts','src/main.ts','src/app/scenery-profile.ts'].map(p=>[p,h(R(join(root,p)))]));
const row=(m,i)=>{const a=m.geometry.attributes.position;return map([a.getX(i),a.getY(i),a.getZ(i)],m.matrixWorld);};
const last=g.children[1],bottom=[],course=[],terrainSamples=[];
for(let edge=0;edge<8;edge++){const foot=[],seam=[],samples=[];
 for(let j=0;j<=8;j++){const i=edge*48+Math.min(j,7)*6;foot.push(row(last,i+(j===8?5:0)));seam.push(row(last,i+(j===8?2:1)));}
 for(let j=0;j<=16;j++){const a=Math.min(7,Math.floor(j/2)),p=blend(foot[a],foot[a+1],j/2-a);samples.push({p,originalN112:floor(p[0],p[2]),originalGameTerrain:t.meshElevation(p[0],p[2])});}
 bottom.push(foot);course.push(seam);terrainSamples.push(samples);
}
const files=g.children.map((m,i)=>{const a=m.geometry.attributes.position,raw=Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength),name='original-emitted-role-'+i+'.f32';writeFileSync(join(out,name),raw);
 const attrs=Object.fromEntries(Object.entries(m.geometry.attributes).map(([k,a])=>[k,{sha256:h(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),itemSize:a.itemSize,count:a.count}]));
 return{role:m.name,file:name,sha256:h(raw),bufferType:'non-indexed little-endian Float32 xyz; triangles in groups of three; transform by column-major matrixWorld',matrixWorld:m.matrixWorld.elements,vertices:a.count,triangles:a.count/3,attrs};
});
const thresholdModel=g.userData.seacowThreshold,threshold=[];const gallery=new Map(),candidates=[];
for(let i=0;i<last.geometry.attributes.position.count;i++){const p=row(last,i),u=p[0]-g.position.x,w=p[2]-g.position.z,r=Math.hypot(u,w),y=p[1]-g.position.y;
 if(Math.abs(y-14.28)<2e-5&&Math.abs(r-2.72)<2e-5)gallery.set(p.map(q=>q.toFixed(5)).join(','),p);
 if(thresholdModel.some(q=>Math.hypot(...q.map((v,j)=>v-p[j]))<1e-4))candidates.push({i,p});}
for(const p of thresholdModel){const v=candidates.find(q=>Math.hypot(...q.p.map((v,j)=>v-p[j]))<1e-4);assert(v);threshold.push(v);}
assert.equal(gallery.size,8);
const thumbs=files.map(x=>x.triangles),output={scope:'Actual V1 in-engine PBR geometry over original signed regular terrain; no current site elevation or physical position survey claimed. Old collider need not coincide with the displayed ground.',sourceRuntime:hashes,gameOrigin:g.position.toArray(),source:{atlas:a.sha256,oldWire:h(wire),oldTile:k.id,row:SEACOW.ordinal,proof:SEACOW.proof,rows:k.count,targetIndicesBefore:b.seacow.owner.userData.beaconTriangles,retainedOriginalTriangles:mounted.index.count/3},roles:files,allTriangles:thumbs.reduce((a,b)=>a+b,0),actualBaseRingWorld:bottom.map(e=>e[0]),actualBaseEdgesWorld:bottom,actualSidingStartWorld:course,actualGalleryLevelWorld:[...gallery.values()],actualThreshold:threshold,andSeventeenProbesPerEdge:terrainSamples};
ready=false;b.syncSeacow();assert(!b.seacowExteriorActive);assert.equal(owner.geometry,originalBeforeAdmission);assert.equal(owner.geometry.index,null);
const features=JSON.parse(Z(wire)).features,old=b.generate(features,b.tiles[0],false,130),range=old.userData.beaconTriangles;
const hashPart=(g,k,a,b)=>{const q=g.attributes[k];return h(Buffer.from(q.array.buffer,q.array.byteOffset+a*q.itemSize*q.array.BYTES_PER_ELEMENT,(b-a)*q.itemSize*q.array.BYTES_PER_ELEMENT));};
output.originalRemaining={originalVertexCount:owner.geometry.attributes.position.count,allSameAttributeObjects:Object.keys(owner.geometry.attributes).every(k=>owner.geometry.attributes[k]===mounted.attributes[k]),originalFullRestored:owner.geometry===originalBeforeAdmission&&owner.geometry.index===null,auxiliary:{order:130,span:range,hashes:Object.fromEntries(Object.keys(old.geometry.attributes).map(k=>[k,hashPart(mounted,k,...range)]))}};
writeFileSync(join(out,'emitted-exterior.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({roleTris:thumbs,names:files.map(x=>x.role),origin:output.gameOrigin,all:output.allTriangles,receipt:h(R(join(out,'emitted-exterior.json')))}));
