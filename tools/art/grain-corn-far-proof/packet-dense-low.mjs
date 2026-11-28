import fs from 'node:fs';
import * as T from 'three';
const root=new URL('./',import.meta.url);
const p=JSON.parse(fs.readFileSync('packet.json'));
const lock=JSON.parse(fs.readFileSync(new URL('dense-low-angle-prelock.json',root)));
const fresh=process.argv.includes('--holdout');
const angles=fresh?lock.holdout:lock.elevations.flatMap(e=>Array.from({length:lock.yawCount},(_,i)=>[360*i/lock.yawCount,e]));
const cams=[];
for(let v=0;v<2;v++)for(const[az,elevation]of angles){
 const c=new T.OrthographicCamera(-2.6,2.6,2.6,-2.6,.05,40);
 const a=az*Math.PI/180,e=elevation*Math.PI/180,center=new T.Vector3(0,1.03,0);
 c.position.set(10*Math.cos(e)*Math.sin(a),10*Math.sin(e),10*Math.cos(e)*Math.cos(a)).add(center);
 c.lookAt(center);c.updateMatrixWorld();
 cams.push({variant:'variant-'+v,elevation,az,orthographicSpanM:5.2,eye:c.position.toArray(),
   view:c.matrixWorldInverse.toArray(),projection:c.projectionMatrix.toArray(),
   normal:new T.Matrix3().getNormalMatrix(c.matrixWorldInverse).toArray()});
}
p.cams=cams;
console.log(JSON.stringify(p));
