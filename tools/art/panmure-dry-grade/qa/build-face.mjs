/** Exact stock rim and co-topology neutral for one disconnected-from-peers Panmure face. */
import A from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {PlaneGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
const [repo,dir]=process.argv.slice(2);
const sha=b=>createHash('sha256').update(b).digest('hex');
const open=n=>readFileSync(resolve(dir,n)),root=n=>readFileSync(resolve(repo,n));
const source=open('stock-screen.json'),cut=JSON.parse(open('cell-selection.json'));
A.equal(sha(source),cut.screen);
A.equal(sha(open('cell-selection.json')),'4742355e7227c52d85ddde73019aff007168f23bba98566ad83efcfad101ce86');
const {Terrain}=await import(pathToFileURL(resolve(repo,'src/sim/terrain.ts')));
const {GROUND_LIFT,WORLD_COLS,WORLD_ROWS,SURVEY_LOD}=await import(pathToFileURL(resolve(repo,'src/sim/coastal-terrain.ts')));
A.deepEqual([GROUND_LIFT,WORLD_COLS,WORLD_ROWS,SURVEY_LOD],[.12,32,22,112]);
const terrainSpec=JSON.parse(root('public/world/terrain.json'));
const raw=gunzipSync(root('public/world/'+terrainSpec.file));
A.equal(sha(raw),'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
const t=new Terrain(terrainSpec,Int16Array.from({length:raw.length/2},(_,i)=>raw.readInt16LE(i*2)));
const NC=SURVEY_LOD,w=(t.right-t.left)/32,h=(t.bottom-t.top)/22,ox=t.left+25*w+w/2,oz=t.top+18*h+h/2;
const p0=new PlaneGeometry(w,h,NC,NC).rotateX(-Math.PI/2);
const a0=p0.attributes.position,u0=p0.attributes.uv,n0=p0.attributes.normal,E0=p0.index.array;
const old=cut.oldStockFace;
for(let i=0;i<a0.count;i++){
 const x=a0.getX(i)+ox,z=a0.getZ(i)+oz;
 a0.setY(i,t.atlasElevation(x,z)+GROUND_LIFT);u0.setXY(i,...t.uv(x,z));
}
const stock=Array.from(E0.slice(old*3,old*3+3));
const P=Array.from(a0.array),Pneutral=Array.from(a0.array),U=Array.from(u0.array);
const at2=i=>[P[i*3],P[i*3+2]];
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const [s0,s1,s2]=stock.map(at2),full=orient(s0,s1,s2);
A.ok(full<0);
function yOn(x,z){
 const p=[x,z],u=orient(s0,p,s2)/full,v=orient(s0,s1,p)/full;
 A.ok(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7);
 return a0.getY(stock[0])*(1-u-v)+a0.getY(stock[1])*u+a0.getY(stock[2])*v;
}
const feature=new Map(JSON.parse(source).matches.map(r=>[r.native.join(','),r]));
const boundary=cut.boundary,k=boundary.length,gridkey=x=>x.join(',');
const isB=new Set(boundary.map(gridkey));
const turn=(a,b,c)=>orient(a,b,c)!==0;
const cornerIndices=boundary.map((v,i)=>turn(boundary[(i+k-1)%k],v,boundary[(i+1)%k])?i:-1).filter(i=>i>=0);
A.ok(cornerIndices.length>=4);
const relative=q=>feature.get(gridkey(q)).scene.map((p,i)=>p-[ox,oz][i]);
const linearized=new Map(),segments=[];
for(let j=0;j<cornerIndices.length;j++){
 const start=cornerIndices[j],end=cornerIndices[(j+1)%cornerIndices.length],n=(end-start+k)%k;
 A.ok(n>0);
 const p=relative(boundary[start]),q=relative(boundary[end]),points=[];
 for(let i=0;i<=n;i++){
  const l=(start+i)%k,key=gridkey(boundary[l]);
  linearized.set(key,p.map((v,c)=>v+(q[c]-v)*i/n));points.push(key);
 }
 segments.push(points);
}
const ids=new Map(),added=new Set();
let peak=0,core=0,projectError=0;
function put(x,z,y,yn){
 const i=P.length/3;
 P.push(Math.fround(x),Math.fround(y),Math.fround(z));
 Pneutral.push(P[i*3],Math.fround(yn),P[i*3+2]);
 U.push(...t.uv(P[i*3]+ox,P[i*3+2]+oz));return i;
}
for(const q of cut.nodes){
 const k=gridkey(q),row=feature.get(k),native=relative(q),chosen=linearized.get(k)??native;
 const [x,z]=chosen.map(Math.fround);
 A.equal(row.face,old);
 projectError=Math.max(projectError,Math.hypot(x-native[0],z-native[1]));
 const dist=Math.min(...boundary.map(p=>Math.hypot(p[0]-q[0],p[1]-q[1])));
 const s=Math.min(1,dist/3),rho=s*s*(3-2*s),base=yOn(x,z);
 const y=base+(row.earth+GROUND_LIFT-base)*rho;
 if(dist>=3)core++;
 const id=put(x,z,y,base);ids.set(k,id);added.add(id);peak=Math.max(y-base,peak);
 if(isB.has(k))A.equal(P[id*3+1],Pneutral[id*3+1]);
}
A.ok(projectError<.002&&peak>.50&&core>=10);
const surface=[],ring=[];
function wound(target,[a,b,c]){
 const o=orient(at2(a),at2(b),at2(c));A.ok(Math.abs(o)>.0001);
 target.push(o<0?[a,b,c]:[a,c,b]);
}
for(const [x,y] of cut.nativeCells){
 const [a,b,c,d]=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(q=>ids.get(gridkey(q)));
 wound(surface,[a,d,c]);wound(surface,[a,c,b]);
}
const corners=cornerIndices.map(i=>ids.get(gridkey(boundary[i])));
const segmentsByStart=new Map();
for(const chain of segments){
 const elements=chain.map(k=>ids.get(k));
 segmentsByStart.set(elements[0]+':'+elements.at(-1),elements);
 segmentsByStart.set(elements.at(-1)+':'+elements[0],[...elements].reverse());
}
const outer=[...stock,...corners],mark2=i=>new Vector2(...at2(i));
const fill=ShapeUtils.triangulateShape(stock.map(mark2),[corners.map(mark2)]).map(p=>p.map(i=>outer[i]));
for(const face of fill){
 let refined=false;
 const bent=[];
 for(let i=0;i<3;i++){
  const a=face[i],b=face[(i+1)%3],chain=segmentsByStart.get(a+':'+b)??[a,b];
  if(chain.length>2)refined=true;
  bent.push(...chain.slice(0,-1));
 }
 if(!refined){wound(ring,face);continue;}
 const middle=[0,1].map(axis=>face.reduce((x,id)=>x+at2(id)[axis]/3,0)).map(Math.fround);
 const y=yOn(...middle),m=put(...middle,y,y);
 for(let j=0;j<bent.length;j++)wound(ring,[m,bent[j],bent[(j+1)%bent.length]]);
}
const out=[...ring,...surface];
 // The actual ground vertex shader rounds model translation to world F32.
 // Two original annulus diagonals made zero-area GPU triangles. Replace
 // only the verified lifted-neutral polygon diagonals; no vertex changes.
 const repairs=[[77,[12928,12965,12951],[12951,12928,1719]],[97,[1719,12965,12928],[1719,12965,12951]],[78,[12966,12952,12960],[12960,12966,1720]],[111,[1720,12952,12966],[1720,12952,12960]]];
 for(const [i,prior,next] of repairs){
  A.deepEqual(out[i],prior);
  for(const j of new Set([...prior,...next]))A.equal(P[3*j+1],Pneutral[3*j+1]);
  out[i]=next;
 }
 const world2=i=>[Math.fround(Math.fround(ox)+P[3*i]),Math.fround(Math.fround(oz)+P[3*i+2])];
 const gpuAreas=out.map(ids=>orient(...ids.map(world2)));
 A.ok(gpuAreas.every(x=>x<0));
 const minimumShaderAltitude=Math.min(...out.map((ids,i)=>{
  const [a,b,c]=ids.map(world2);
  const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  return -gpuAreas[i]/Math.max(d(a,b),d(b,c),d(c,a));
 }));
 A.ok(minimumShaderAltitude>.0019);
const edges=new Map(),key=(x,y)=>x<y?x+':'+y:y+':'+x,sign=(x,y)=>x<y?1:-1;
for(const ids of out)for(let i=0;i<3;i++){
 const a=ids[i],b=ids[(i+1)%3],k=key(a,b),v=edges.get(k)??[0,0];
 edges.set(k,[v[0]+1,v[1]+sign(a,b)]);
}
const outerEdge=new Map(stock.map((x,i)=>[key(x,stock[(i+1)%3]),sign(x,stock[(i+1)%3])]));
for(const [k,v] of edges)A.deepEqual(v,outerEdge.has(k)?[1,outerEdge.get(k)]:[2,0]);
for(const k of outerEdge.keys())A.ok(edges.has(k));
const area=out.reduce((a,f)=>a-orient(...f.map(at2))/2,0);
A.ok(Math.abs(area+full/2)<.0001);
const f32=a=>Buffer.from(Float32Array.from(a).buffer),u16=a=>Buffer.from(Uint16Array.from(a).buffer);
const header={scope:'Exact detached one-face candidate only, not native render, clearance or physics.',
 owner:'25-18',origin:[ox,0,oz],stockTriple:stock,old,oldVertices:a0.count,newNativeNodes:added.size,
 triangles:[out.length,ring.length,surface.length],peak,core,projectError,
 terminalAreaError:Math.abs(area+full/2),minimumShaderAltitude,partition:[...outerEdge.keys()],
 oldBytes:{p:sha(f32(a0.array)),n:sha(f32(n0.array)),uv:sha(f32(u0.array)),i:sha(u16(E0))},};
// The ordinary World regular owner retains rotated PlaneGeometry normals.
const normal=Array.from(n0.array.slice(0,3));
A.ok(Array.from(n0.array).every((value,i)=>Object.is(value,normal[i%3])));
const normals=Array.from({length:P.length-a0.array.length},(_,i)=>normal[i%3]);
const data={positions:f32(P.slice(a0.array.length)),neutral:f32(Pneutral.slice(a0.array.length)),
 uv:f32(U.slice(u0.array.length)),normal:f32(normals),replacement:u16(out.flat())};
writeFileSync(resolve(dir,'detached-face.json'),JSON.stringify({...header,shas:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,sha(v)])),
 packed:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.toString('base64')]))},null,2)+'\n',{flag:'wx'});
console.log(header);
