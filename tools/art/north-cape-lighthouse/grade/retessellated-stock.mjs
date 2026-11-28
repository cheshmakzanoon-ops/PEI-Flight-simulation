/** Exact counterfactual only: added positions share the original playing-surface facet. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const sha=a=>createHash('sha256').update(bytes(a)).digest('hex');
const f=Math.fround;
/** Output uses the identical candidate index, UV and inactive-normal suffix by design. Only Y changes here. */
export function retessellatedNorthCape({oldPositions,newPositions,originalIndices}){
 assert.ok(oldPositions instanceof Float32Array&&newPositions instanceof Float32Array);
 assert.equal(oldPositions.length,12769*3);assert.equal(newPositions.length,(12769+437)*3);
 assert.deepEqual(originalIndices,[10165,10278,10166]);
 assert.ok(bytes(newPositions.subarray(0,oldPositions.length)).equals(bytes(oldPositions)));
 const ps=originalIndices.map(i=>Array.from(oldPositions.subarray(i*3,i*3+3)));
 const sw=new Uint32Array(new Float32Array(ps.flat()).buffer);
 assert.deepEqual([...sw],[1160826500,1083417045,1154998000,1160826500,1084606665,1155426707,1161049331,1079686423,1154998000]);
 const [a,b,c]=ps,[ux,uz]=[b[0]-a[0],b[2]-a[2]],[vx,vz]=[c[0]-a[0],c[2]-a[2]];
 const det=(ux*vz-uz*vx),P=newPositions.slice();
 let changed=0,planeResidual=0,highest=0;
 for(let i=oldPositions.length;i<P.length;i+=3){
  const x=P[i]-a[0],z=P[i+2]-a[2],u=(x*vz-z*vx)/det,v=(ux*z-uz*x)/det;
  assert.ok(Math.min(u,v,1-u-v)>.02);
  const stock=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
  planeResidual=Math.max(planeResidual,Math.abs(f(stock)-stock));
  highest=Math.max(highest,P[i+1]-f(stock));changed+=+(P[i+1]!==f(stock));P[i+1]=stock;
 }
 assert.ok(planeResidual<.000001&&highest>.90&&highest<1.0&&changed>250);
 return {positions:P,records:{sourceFace:20152,preservedOriginalPositionRecords:12769,addedPositionRecords:437,
  unchangedIndexBasis:true,changedOnlyHeightRecords:changed,maximumNeutralPlaneRoundingM:planeResidual,
  maxHeightAboveNeutralM:highest,changedShaftOrLandmark:false,
  neutralPackedPositionSHA256:sha(P),neutralSuffixSHA256:sha(P.subarray(oldPositions.length))}};
}
