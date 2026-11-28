import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OrthographicCamera} from 'three';
import {DESIGN,detachedUpperSpire} from './upper-spire.ts';
const w=384,h=672,half=1.985;
const a=detachedUpperSpire();
const shots=[['front-flank',[4.8,1.37,6.1]],['front-reciprocal',[-4.85,2.13,6.0]],['return-unseen',[-3.7,.94,-6.5]]];
const views=shots.map(([name,eye])=>{
 const c=new OrthographicCamera(-half*w/h,half*w/h,half,-half,.10,30);
 c.position.set(...eye);c.lookAt(0,.86,0);c.updateMatrixWorld();c.updateProjectionMatrix();
 return {name,eye,imageSize:[w,h],view:[...c.matrixWorldInverse.elements],projection:[...c.projectionMatrix.elements]};
});
a.root.updateMatrixWorld(true);
const streams=a.root.children.map(m=>{
 const data=Object.fromEntries(['position','normal','color'].map(k=>[k,Array.from(m.geometry.getAttribute(k).array)]));
 const receipt=Object.fromEntries(['position','normal','color'].map(k=>{const x=m.geometry.getAttribute(k).array;
  return [k,createHash('sha256').update(Buffer.from(x.buffer,x.byteOffset,x.byteLength)).digest('hex')];}));
 return {material:m.name,receipt,data,triangles:data.position.length/9,
  names:a.tris.filter(t=>t.batch===m.name).map(t=>t.role)};
});
if(process.argv.length!==3)throw Error('output file must be named');
writeFileSync(process.argv[2],JSON.stringify({design:DESIGN,views,streams})+'\n',{flag:'wx'});
a.dispose();
