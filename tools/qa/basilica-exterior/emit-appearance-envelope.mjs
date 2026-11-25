/*
 * Dump actual non-displaced landmark triangles, batch roles and game-relative heights.
 * node --experimental-strip-types tools/qa/basilica-exterior/emit-appearance-envelope.mjs \
 *   . /tmp/pei-basilica current-game-ground candidate
 * Replace candidate with stock for the earlier landmark. A finite explicit datum (e.g. 0)
 * is supported for comparative tests only and is never survey evidence.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const [root,out,groundArg,selected='stock']=process.argv.slice(2);
if(!root||!out||!groundArg||(!Number.isFinite(Number(groundArg))&&groundArg!=='current-game-ground')||
   !['stock','original','candidate'].includes(selected))throw Error('Require CHECKOUT OUT (current-game-ground|GAME_Y) (stock|candidate)');
const mode=selected==='candidate'?'candidate':'stock',dir=resolve(root),url=p=>pathToFileURL(p).href;
const sha=b=>createHash('sha256').update(b).digest('hex');
const THREE=await import(url(join(dir,'node_modules/three/build/three.module.js')));
const src=join(dir,mode==='candidate'?'src/render/basilica-exterior.ts':'src/render/basilica.ts');
const donor=await import(url(src)),scene=new THREE.Scene(),queries=[];
let y,regular;
if(mode==='candidate'||groundArg==='current-game-ground'){
 const {Terrain}=await import(url(join(dir,'src/sim/terrain.ts')));
 const {regularRoadGround}=await import(url(join(dir,'src/render/road-contact.ts')));
 const {project}=await import(url(join(dir,'src/sim/geo.ts')));
 const {gunzipSync}=await import('node:zlib'),spec=JSON.parse(readFileSync(join(dir,'public/world/terrain.json'),'utf-8'));
 const b=gunzipSync(readFileSync(join(dir,'public/world',spec.file)));
 if(sha(b)!==spec.sha256||spec.sha256!=='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d')
  throw Error('Historical terrain bytes/manifest changed');
 const t=new Terrain(spec,new Int16Array(b.buffer,b.byteOffset,b.byteLength/2));
 const p=project(-63.125295,46.233718);
 y=t.elevation(p.x,p.z);regular=regularRoadGround(t);
}
const ground=groundArg==='current-game-ground'?y:Number(groundArg);
const datum={elevation:(x,z)=>{queries.push([x,z]);return ground;}};
const g=mode==='candidate'?donor.addBasilicaExterior(scene,datum,(x,z)=>regular(x,z)-y+ground):donor.addBasilica(scene,datum);
if(!g||g.parent!==scene)throw Error('Landmark not mounted');
g.updateMatrixWorld(true);
let triangleCount=0;const batches=[],pieces=[];
g.traverse(obj=>{
  if(!obj.isMesh||!obj.visible)return;
  const geo=obj.geometry,p=geo.getAttribute('position');
  if(!p||p.itemSize!==3||p.normalized||!Number.isSafeInteger(p.count))throw Error('Unsupported actual position attribute');
  if(obj.isInstancedMesh||obj.isSkinnedMesh||obj.morphTargetInfluences?.length||geo.morphAttributes.position?.length)throw Error('Animated geometry needs exact evaluated positions');
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  const ne=geo.index?.count??p.count;const dr=geo.drawRange;const ar=Number.isFinite(dr.count)?dr.start+dr.count:ne;
  const groupList=Array.isArray(obj.material)?geo.groups:[{start:0,count:ne,materialIndex:0}];
  for(const gj of groupList){
    const mat=mats[gj.materialIndex];if(!mat)throw Error('Missing drawn material');
    if(!mat.visible)continue;
    if(mat.transparent||mat.alphaTest>0||mat.displacementMap)throw Error('Alpha/displacement needs a separate true renderer proof');
    const start=Math.max(gj.start,dr.start),end=Math.min(gj.start+gj.count,ar,ne);
    if(start%3||end%3)throw Error('Non-triangle draw range');
    const v=new THREE.Vector3(), positions=new Float64Array(Math.max(0,end-start)*3);
    for(let i=start;i<end;i++){
      const ix=geo.index?geo.index.getX(i):i;
      if(!Number.isInteger(ix)||ix<0||ix>=p.count)throw Error('Index out of bounds');
      v.fromBufferAttribute(p,ix).applyMatrix4(obj.matrixWorld);
      positions[3*(i-start)]=v.x;positions[3*(i-start)+1]=v.y;positions[3*(i-start)+2]=v.z;
    }
    const buf=Buffer.from(positions.buffer);
    if(!positions.every(Number.isFinite))throw Error('Nonfinite rendered coordinates');
    const tri=(end-start)/3;const side=mat.side===THREE.FrontSide?'front':mat.side===THREE.BackSide?'back':mat.side===THREE.DoubleSide?'both':null;
    if(!side||obj.matrixWorld.determinant()<=0)throw Error('Unsupported negative orientation');
    batches.push({triangleStart:triangleCount,triangleCount:tri,side,materialType:mat.type,materialName:mat.name,roles:geo.userData.basilicaRoles??[],
      materialColor:mat.color?.getHexString()??null,geometryType:geo.type,positionSHA256:sha(Buffer.from(p.array.buffer,p.array.byteOffset,p.array.byteLength)),
      indexSHA256:geo.index?sha(Buffer.from(geo.index.array.buffer,geo.index.array.byteOffset,geo.index.array.byteLength)):null,
      worldTrianglesSHA256:sha(buf)});
    triangleCount+=tri;pieces.push(buf);
  }
});
if(!triangleCount||queries.length!==1)throw Error('Unexpected terrain ownership or geometry');
const ab=Buffer.concat(pieces), fn='world-triangles.f64le';
if(new Uint8Array(new Uint16Array([1]).buffer)[0]!==1)throw Error('Little-endian emitter host required');
mkdirSync(out,{recursive:true});
writeFileSync(join(out,fn),ab);
const meta={format:'PEI world triangles, packed Float64 little endian [X east,Y up,Z south]; draw order; 3 vertices per triangle.',triangleCount,
  sourceSHA256:sha(readFileSync(src)),explicitTerrainGroundY:ground,terrainLookupXZ:queries[0],actualGroupOrigin:g.position.toArray(),
  qualitativeRoof:mode==='candidate',gameGroundWitness:g.userData.basilicaGroundWitness??[],localLandingY:g.userData.basilicaLandingY??null,file:fn,dataSHA256:sha(ab),batches,scope:'Geometric opaque upper-face/down-ray test; not material detail, licensed facade, sky or rendered pixel quality.'};
writeFileSync(join(out,'geometry.json'),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({triangleCount,drawnBatches:batches.length,dataSHA256:meta.dataSHA256,actualGroupOrigin:meta.actualGroupOrigin}));
