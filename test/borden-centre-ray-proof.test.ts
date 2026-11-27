import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as T from 'three';
import {validateCentreRays} from '../src/render/borden-centre-ray-proof.ts';

const width=81,height=61, cx=40,cy=30;
type V=readonly [number,number,number];
type Tri=readonly [V,V,V];
const eye=new T.Vector3(-38866,30,27767), aim=new T.Vector3(-38834,0,27775);
const tri=(p:V,q:V,r:V):Tri=>[p,q,r];
function setup(){
 const camera=new T.PerspectiveCamera(52,width/height,.14,350000);
 camera.position.copy(eye);camera.lookAt(aim);camera.updateMatrixWorld();
 // Along the center ray: wet inclined ground x≈38855, the old cliff
 // face at x≈38837, and dry sea receiver x≈38834. Z remains in the cell.
 const land=tri([-38863,20,27767],[-38849,20,27767],[-38854,20,27780]);
 const curtain=tri([-38836,-.06,27769],[-38836,9,27770],[-38836,3,27787]);
 const remote=tri([-38000,1,29000],[-37990,1,29003],[-38011,9,28990]);
 const curves=[curtain,...Array.from({length:57},(_,i)=>remote.map(v=>[v[0]+i,v[1],v[2]]) as unknown as Tri)];
 return {camera,land,curves};
}
test('a forward wet ground, actual curtain and dry sea give a signed centre interval',()=>{
 const {camera,land,curves}=setup();
 const sample=validateCentreRays(camera,[land],curves,width,height);assert(sample);
 const hit=sample(cx,cy);assert(hit);
 assert(hit.landT[1]<hit.curveT[0]&&hit.curveT[1]<hit.seaT[0]);
 assert(hit.landG[1]<0&&hit.seaG[0]>0);
 assert.equal(sample(-1,cy),undefined);assert.equal(sample(width,cy),undefined);
});
test('overlapping nearest depths and an off-centre ray cannot stand in for isolated owners',()=>{
 const {camera,land,curves}=setup();
 const sample=validateCentreRays(camera,[land,land],curves,width,height);assert(sample);
 assert.equal(sample(cx,cy),undefined);
 assert.equal(validateCentreRays(camera,[land],curves,width,height)?.(0,0),undefined);
});

test('both fixed Borden cameras keep all 27 native critical centre rays inside the signed single cell',()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/borden-centre-rays.json',import.meta.url),'utf8')) as {
  terrainSha:string;vboSha:string;ground:Tri[];curtain:Tri[];
  views:Record<string,{width:number;height:number;matrixWorld:number[];projection:number[];centres:[number,number][]}>;
 };
 assert.equal(data.terrainSha,'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
 const positions=Buffer.alloc(58*3*3*4);
 data.curtain.flat(2).forEach((f,i)=>positions.writeFloatLE(f,i*4));
 assert.equal(createHash('sha256').update(positions).digest('hex'),data.vboSha);
 assert.equal(data.vboSha,'34baa0ed11b5bf920f05fb371865dcfc5e48bde1f6a12219d32752ee12c04350');
 assert.equal(data.ground.length,8);
 assert.deepEqual(Object.keys(data.views),['msw-close','mharbour-close']);
 for(const [name,view] of Object.entries(data.views)){
  const camera=new T.PerspectiveCamera();
  camera.matrixWorld.fromArray(view.matrixWorld);
  camera.projectionMatrix.fromArray(view.projection);
  assert.equal(view.centres.length,name==='msw-close'?7:20);
  const sample=validateCentreRays(camera,data.ground,data.curtain,view.width,view.height);
  assert(sample,name);
  assert.equal(sample(0,0),undefined,name);
  for(const [x,y] of view.centres){
   const result=sample(x,y);
   assert(result,`${name}: uncertain ray at ${x}, ${y}`);
   assert(result.landT[1]<result.curveT[0]&&result.curveT[1]<result.seaT[0],name);
   assert(result.landG[1]<0&&result.seaG[0]>0,name);
  }
 }
});
