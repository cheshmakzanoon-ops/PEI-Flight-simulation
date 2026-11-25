import * as T from 'three';
import {createRegionalWind} from '../../../src/render/regional-wind.ts';
import {WIND_PROFILE} from '../../../src/render/regional-wind-geometry.ts';
import {WIND_STATIONS} from '../../../src/render/regional-wind.generated.ts';
import {project} from '../../../src/sim/geo.ts';
import {mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const out=process.argv[2];if(!out)throw Error('Provide an output directory for the original model geometry.');
mkdirSync(out,{recursive:true});
const targets={'west-cape':'WCW27','east-point-i':'EKW6',hermanville:'HCS3'};
const hash=x=>createHash('sha256').update(x).digest('hex');
const geometry=[];
for(const [id,target] of Object.entries(targets)){
 const station=WIND_STATIONS[id].find(r=>r[0]===target),p=project(station[1],station[2]);const ground={visualGroundEpoch:0,surface:()=>({land:true}),visualGroundHeight:()=>16,terrain:{isLand:()=>true},cover:{distance:()=>254}};
 const a=createRegionalWind(id,new T.Scene(),ground),profile=WIND_PROFILE[id];a.update({...p,y:140},4.25);
 const mesh=a.root.children[0];assert(mesh.isInstancedMesh&&mesh.visible&&!/rotor/.test(mesh.name));const m=new T.Matrix4(),v=new T.Vector3();let slot=-1;
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);if(Math.hypot(m.elements[12]-p.x,m.elements[14]-p.z)<.02){slot=i;break;}}
 assert(slot>=0&&m.elements[13]===16);const originalOrigin=[m.elements[12],m.elements[13],m.elements[14]];
 m.elements[12]=m.elements[13]=m.elements[14]=0;
 const pos=mesh.geometry.getAttribute('position'),xyz=new Float64Array(pos.count*3),idx=Uint32Array.from(mesh.geometry.index.array);
 for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);xyz.set(v.toArray(),i*3);}
 writeFileSync(out+'/'+id+'.f64',Buffer.from(xyz.buffer));writeFileSync(out+'/'+id+'.u32',Buffer.from(idx.buffer));
 geometry.push({id,target,model:profile.model,only:mesh.name,count:mesh.count,actualSlot:slot,publishedUnit:station,originalOrigin,matrix:m.toArray(),vertices:pos.count,faces:idx.length/3,
  position:hash(Buffer.from(pos.array.buffer,pos.array.byteOffset,pos.array.byteLength)),indices:hash(Buffer.from(mesh.geometry.index.array.buffer,mesh.geometry.index.array.byteOffset,mesh.geometry.index.array.byteLength)),worldLocal:hash(Buffer.from(xyz.buffer))});
 a.dispose();
}
writeFileSync(out+'/actual-shape-sources.json',JSON.stringify({meaning:'Current near mast-and-fairing INSTANCED BUFFER actually emitted by the shipping geometry factory. Read same orientation from its own registered instance matrix; only translation subtracted. Rotor is deliberately not loaded into the cast.',geometry},null,2)+'\n');
