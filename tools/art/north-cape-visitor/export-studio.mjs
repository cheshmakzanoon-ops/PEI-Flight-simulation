import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {PerspectiveCamera,Matrix4} from 'three';
import {createVisitorStudy} from './north-cape-visitor.ts';
const out=resolve(process.argv[2]);mkdirSync(out);
const h=b=>createHash('sha256').update(b).digest('hex');
const w=1080,H=700, a=createVisitorStudy(),g=a.mesh.geometry;
const write=(name,data)=>{writeFileSync(resolve(out,name),data,{flag:'wx'});return {file:name,sha:h(data)}};
const attr=Object.fromEntries(['position','normal','finish'].map(k=>{
 const b=g.getAttribute(k).array;return [k,write(k+'.f32',Buffer.from(b.buffer,b.byteOffset,b.byteLength))];
}));
const shader={vertex:write('visitor.vert','#version 300 es\n'+a.mesh.material.vertexShader),fragment:write('visitor.frag','#version 300 es\n'+a.mesh.material.fragmentShader)};
const matrix=new Matrix4().toArray();
const cams={front:{eye:[-30,11.3,44],target:[0,3.78,1.1],fov:29},porch:{eye:[36,19,42],target:[.3,3.27,1.7],fov:28.5},
 visibleScale:{eye:[136,48,98],target:[0,2.9,1.4],fov:53}};
const joints=Object.fromEntries(Object.entries(cams).map(([mode,v])=>{
 const c=new PerspectiveCamera(v.fov,w/H,.08,1000);c.position.set(...v.eye);c.lookAt(...v.target);c.updateMatrixWorld(true);
 return [mode,{...v,model:matrix,view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray()}];
}));
const j={status:'Detached interpretation, no placed geometry or runtime requirements.',attr,shader,viewport:[w,H],
 roles:a.parts,numVerts:g.attributes.position.count,cameras:joints};
assert.equal(j.numVerts,3720);
write('studio.json',JSON.stringify(j,null,2)+'\n');a.dispose();
