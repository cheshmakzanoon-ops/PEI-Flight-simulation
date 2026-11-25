import fs from'node:fs';import{gunzipSync as zip}from'node:zlib';import{createHash}from'node:crypto';
const [root,dest]=process.argv.slice(2);if(!root||!dest)throw Error('Usage: node --experimental-transform-types fences.mjs /absolute/checkout OUTPUT.json');
const imp=p=>import('file://'+root+'/src/'+p+'.ts'),{decodeRoads}=await imp('render/roads'),{decodeParkingSurfaces}=await imp('render/parking-surfaces'),{decodeSidewalks,walkSections}=await imp('render/sidewalks'),{project}=await imp('sim/geo'),H=v=>createHash('sha256').update(v).digest('hex'),rd=f=>zip(fs.readFileSync(root+'/public/world/'+f)),ab=v=>v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength);
const o=project(-63.125295,46.233718),rad=85,w=v=>v.map(p=>[p[0]-o.x,p[1]-o.z]),clip=(p,e=0)=>Math.min(...p.map(a=>a[0]))<o.x+rad+e&&Math.max(...p.map(a=>a[0]))>o.x-rad-e&&Math.min(...p.map(a=>a[1]))<o.z+rad+e&&Math.max(...p.map(a=>a[1]))>o.z-rad-e;
let roads=[],sidewalk=[],parking=[];const files=['roads.bin.gz','pedestrian/odbl/v1/sidewalks.bin.gz','ground/odbl/v1/parking-surfaces.bin.gz'],b=files.map(rd);
for(const r of decodeRoads(ab(b[0]))){let last;const hw=[2,2.8,3.6,4.8,6.4][r.flags&7];for(const {x,z}of r.points){if(last){const poly=[last,[x,z]];if(clip(poly,hw+2))roads.push([w(poly),hw]);}last=[x,z];}}
for(const t of decodeSidewalks(ab(b[1])))for(const path of t.paths){const a=walkSections(path);for(let i=1;i<a.length;i++){const q=[a[i-1][0],a[i-1][1],a[i][1],a[i][0]].map(v=>[v.x,v.z]);if(clip(q,1))sidewalk.push(w(q));}}
for(const t of decodeParkingSurfaces(ab(b[2])))for(const [,cc,rr]of t.lots)for(const poly of [...cc,...rr]){const pp=poly.map(r=>r.map(v=>[t.ox+v[0]*.001,t.oz+v[1]*.001]));if(clip(pp[0],1))parking.push(pp.map(w));}
fs.writeFileSync(dest,JSON.stringify({reference:[o.x,o.z],coordinate:'relative game X and Z metres',files:Object.fromEntries(files.map((f,i)=>[f,H(b[i])])),roads,sidewalk,parking}));
console.log(roads.length,sidewalk.length,parking.length)
