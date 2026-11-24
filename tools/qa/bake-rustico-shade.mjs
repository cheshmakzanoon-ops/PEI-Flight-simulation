import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {Terrain} from '../../src/sim/terrain.ts';
import {BoundedGrade} from '../../src/sim/bounded-grade.ts';
import {RUSTICO_GRADE as S} from '../../src/sim/rustico-grade.generated.ts';
import {project} from '../../src/sim/geo.ts';
import {buildRusticoModel} from '../../src/render/north-rustico/model.ts';
import {DATUM} from '../../src/render/north-rustico/frame.ts';
const here=new URL('../../public/world/',import.meta.url);
const read=x=>fs.readFileSync(new URL(x,here));
const bytes=gunzipSync(read('height.bin.gz')),dem=new Terrain(JSON.parse(read('terrain.json')),new Int16Array(bytes.buffer,bytes.byteOffset,bytes.length/2));
const raw=gunzipSync(read(S.file)),N=raw.length/3,h=new Int16Array(N),w=new Uint8Array(N);
for(let i=0;i<N;i++){h[i]=raw.readInt16LE(i*2);w[i]=raw[2*N+i];}
const grade=new BoundedGrade(dem,S,h,w,(x,z)=>dem.atlasElevation(x,z));
const o=project(-63.291964738182266,46.45530404141915),n=project(-63.291955162471346,46.45531014013396),v=project(-63.29197356252845,46.45531065942009);
const m=new T.Matrix4().set(n.x-o.x,0,o.x-v.x,o.x,0,1,0,DATUM+.12,n.z-o.z,0,o.z-v.z,o.z,0,0,0,1);
const inv=m.clone().invert(),root=buildRusticoModel('hero');root.updateMatrixWorld(true);
const model=root.children.filter(c=>c.castShadow);const m2=new T.MeshBasicMaterial({side:T.DoubleSide});model.forEach(q=>q.material=m2);
const sun0=new T.Vector3(-.60,.74,-.31).normalize().transformDirection(inv);
const right=new T.Vector3().crossVectors(sun0,new T.Vector3(0,1,0)).normalize();
const up=new T.Vector3().crossVectors(sun0,right).normalize();
const dirs=[[0,0],[-.013,0],[.013,0],[0,-.013],[0,.013]].map(([a,b])=>sun0.clone().addScaledVector(right,a).addScaledVector(up,b).normalize());
const M=80,dx=0.28,dz=0.28;
const originX=o.x-8.4,originZ=o.z-8.4;
const shadow=new Uint8Array(M*M);
const point=new T.Vector3(),ray=new T.Raycaster();ray.near=.025;ray.far=18;
const t=performance.now();
let cast=0,edge=0;
for(let j=0;j<M;j++)for(let i=0;i<M;i++){
 const x=originX+i*dx,z=originZ+j*dz,y=grade.visualY(x,z); if(y===undefined||grade.weight(x,z)<.999999)continue;
 point.set(x,y+.026,z).applyMatrix4(inv);
 let shade=0;
 for(const d of dirs){ray.set(point,d);const hits=ray.intersectObjects(model,false);if(hits.length)shade+=1;}
 shadow[j*M+i]=Math.round(shade*255/dirs.length);
 if(shade){cast++;if(i===0||j===0||i===M-1||j===M-1)edge++;}
}
if(edge)throw Error('The certified shadow does not fit the admitted receiver');
const file=new URL('../../src/render/north-rustico/model.ts',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const spec={n:M,x:originX,z:originZ,dx,dz,modelSha:sha(fs.readFileSync(file)),maskSha:sha(shadow),alpha:Buffer.from(shadow).toString('base64')};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(spec,null,2)+'\n');
console.log(JSON.stringify({modelSha:spec.modelSha,maskSha:spec.maskSha,positiveSamples:cast,edge,elapsedMs:performance.now()-t}));
