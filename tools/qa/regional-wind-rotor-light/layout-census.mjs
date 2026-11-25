/** CPU-only positive caster and physical full-rotation envelope receipt.
 * Run with Node 22.12+ accepting TypeScript imports. No new map data or renderer. */
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const [root,out]=process.argv.slice(2); if(!root||!out)throw Error('Usage: node --experimental-strip-types layout-census.mjs <checkout> <out.json>');
const load=(p)=>import(pathToFileURL(join(resolve(root),p)).href);
const {ROTOR_PINS,ROTOR_INDEX,ROTOR_LIMIT,ROTOR_REACH,rotorLayout,PITCH_M,EDGE_PAD_M}=await load('src/render/regional-wind-rotor-field.ts');
const {turbineGeometry,WIND_PROFILE}=await load('src/render/regional-wind-geometry.ts');
const h=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const fields={};for(const id of Object.keys(ROTOR_PINS)){
 const {mast,rotor}=turbineGeometry(id,0),p=rotor.getAttribute('position'),l=rotorLayout(id,p,2048);
 if(!l||h(p.array)!==ROTOR_PINS[id]||h(rotor.index.array)!==ROTOR_INDEX)throw Error('wrong source donor or capacity');
 const axes=[l.x,l.y,l.sun];let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 // Independent analytic form: each coordinate is A*cos(a)+B*sin(a)+K.
 // This tests every native vertex and every rotor orientation, not sampling
 // scene frames to place a manual box.
 for(let k=0;k<axes.length;k++){
  const v=axes[k],c=l.cols3.map(m=>m.dot(v));
  for(let j=0;j<p.count;j++){
   const x=p.getX(j),y=p.getY(j),z=p.getZ(j),A=c[1]*y+c[2]*z,B=c[2]*y-c[1]*z,K=c[0]*x,L=Math.hypot(A,B);
   min[k]=Math.min(min[k],K-L);max[k]=Math.max(max[k],K+L);
  }
 }
 const limits=[[l.lowU,l.lowU+l.w*PITCH_M],[l.lowV,l.lowV+l.h*PITCH_M],[l.loD,l.hiD]],
        margin=limits.map(([lo,hi],k)=>[min[k]-lo,hi-max[k]]);
 if(Math.min(...margin.flat())<1.99999)throw Error('clipping a physical donor');
 const angular=.00465*(WIND_PROFILE[id].hub+WIND_PROFILE[id].radius+2+25)/l.sun.y,filter=Math.SQRT2*PITCH_M;
 if(angular+filter>=EDGE_PAD_M)throw Error('PCF can cross a neighbour slot');
 fields[id]={sourcePositionSHA256:h(p.array),sourceIndexSHA256:h(rotor.index.array),trianglesPerUpdatedRotor:rotor.index.count/3,maxSlots:ROTOR_LIMIT[id],layoutCells:[l.cols,l.rows],cellPixels:[l.w,l.h],atlasPixels:[l.ax,l.ay],estimatedDedicatedGPUAttachmentBytes:l.ax*l.ay*3,attachmentBudgetBasis:'only D16 (2 B) plus unused R8 color attachment (1 B); driver overhead not included',siteReachM:ROTOR_REACH[id],trueAllRotationProjectionBoundsM:min.map((v,k)=>[v,max[k]]),planarAtlasMarginAllSidesM:margin.slice(0,2),depthMarginM:margin[2],maxPenumbraPlusBilinearFootprintM:angular+filter,zeroAboveActualCap:'actual per-fragment directional receiver depth; no assumed flat ground'};
 rotor.dispose();mast.dispose();
}
const result={scope:'Proposed rotor-light local GPU source geometry and atlas bounds, no real GPU timings or optical approval implied',originalSun:[-.60,.74,-.31],solarRadiusRad:.00465,pixelPitchM:PITCH_M,edgePaddingM:EDGE_PAD_M,terrainQualification:'existing unmodified N112 receiver; geometric envelope uses +/-25m relative to original mast, not a terrain modification',fields};
writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(h(Buffer.from(JSON.stringify(result,null,2)+'\n')));
