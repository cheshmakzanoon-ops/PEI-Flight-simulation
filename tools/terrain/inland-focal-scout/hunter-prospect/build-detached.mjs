import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {gradeFaceProof} from './hunter-face.mjs';
import {plane,t,coords,rows,D,tx,tz,packedHeight,dataSet} from './pick.mjs';
const leading=dataSet.prospects[0];
assert.ok(leading&&leading.minCentreToMappedRibbonM>89);
const proof=gradeFaceProof({plane,witness:leading,rows,coords,D,tx,tz,packedHeight,
 stockUV:(a,b)=>t.uv(a,b),lift:.12,counterfactual:true});
const u32=new Uint32Array(plane.attributes.position.array.buffer);
const verts=proof.originalIndices;
const [x0,z0,x1,z1]=leading.window;
const ps=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>coords[z*D+x]);
proof.stockDraw={tile:'14-14',cut:leading.face*3,face:verts,origin:[tx,0,tz],
  exactFaceWords:verts.flatMap(i=>[u32[i*3],u32[i*3+1],u32[i*3+2]]),
  boundsWorld:[Math.min(...ps.map(v=>v.x)),Math.min(...ps.map(v=>v.z)),
    Math.max(...ps.map(v=>v.x)),Math.max(...ps.map(v=>v.z))]};
writeFileSync(process.argv[3],JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
plane.dispose();
