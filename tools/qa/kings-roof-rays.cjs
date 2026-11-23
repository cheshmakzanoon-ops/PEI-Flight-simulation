const fs=require('node:fs'), path=require('node:path'), H=require('node:crypto'), Z=require('node:zlib'), A=require('node:assert/strict'),{pathToFileURL}=require('node:url');
async function main(){
 const [, , previous, update, witness, out]=process.argv;
 if(!out)throw new Error('Usage: node tools/qa/kings-roof-rays.cjs PREVIOUS_ROOT CANDIDATE_ROOT WITNESS_JSON REPORT_JSON');
 const absolute=path.resolve(previous), candidate=path.resolve(update);
 const moduleAt=(root,f)=>import(pathToFileURL(path.join(root,f)));
 const manifest=JSON.parse(fs.readFileSync(path.join(absolute,'public/world/buildings/index.json')));
 const read=(f)=>JSON.parse(fs.readFileSync(f));
 const Three=await moduleAt(absolute,'node_modules/three/build/three.module.js');
 const current=await moduleAt(absolute,'src/render/buildings.ts'), revised=await moduleAt(candidate,'src/render/buildings.ts');
 const {Terrain}=await moduleAt(absolute,'src/sim/terrain.ts');
 const {supportedRoofAtlas}=await moduleAt(absolute,'src/sim/fitted-roofs.ts');
 const {project}=await moduleAt(absolute,'src/sim/geo.ts');
 const {NEUTRAL_ATLAS_SHA}=await moduleAt(candidate,'src/render/neutral-roofs.generated.ts');
 const {readNeutralRoof}=await moduleAt(candidate,'src/render/neutral-roof.ts');
 const pack=fs.readFileSync(path.join(absolute,'public/world/buildings/tiles.pack'));
 const sum=b=>H.createHash('sha256').update(b).digest('hex');
 A.equal(sum(pack),NEUTRAL_ATLAS_SHA);A.equal(manifest.sha256,NEUTRAL_ATLAS_SHA);
 const b=Z.gunzipSync(fs.readFileSync(path.join(absolute,'public/world/height.bin.gz')));
 const t=new Terrain(JSON.parse(fs.readFileSync(path.join(absolute,'public/world/terrain.json'))),new Int16Array(b.buffer,b.byteOffset,b.length/2));
 const mat=new Three.MeshBasicMaterial({side:Three.DoubleSide});
 const exact=(A)=>Object.assign(Object.create(A.Buildings.prototype),{mat,t,atlasHash:manifest.sha256,fitted:supportedRoofAtlas(manifest.sha256),farms:true,homes:true,sourisMcleanMat:mat,montagueMat:mat,waterStreetMat:mat,victoriaMat:mat,sourisMat:mat});
 const old=exact(current), next=exact(revised);
 const C=new Map(manifest.tiles.map(c=>{const l=project(c.bounds[0],c.bounds[3]),r=project(c.bounds[2],c.bounds[1]);return [c.id,{...c,x1:l.x,x2:r.x,z1:l.z,z2:r.z}];}));
 const list=new Map();
 const load=(tid)=>{
  if(!list.has(tid)){
   const c=C.get(tid),bytes=pack.slice(c.offset,c.offset+c.bytes);
   A.equal(sum(bytes),c.sha256);const f=JSON.parse(Z.gunzipSync(bytes)).features;A.equal(f.length,c.count);list.set(tid,f);
  }
  return list.get(tid);
 };
 const percentile=(r,v)=>{const p=[...r].sort((a,b)=>a-b),m=(p.length-1)*v,n=Math.floor(m);return p[n]+(p[Math.ceil(m)]-p[n])*(m-n);};
 const cases=read(witness), misses=[], rejected=[], tested=[];
 const ray=new Three.Raycaster(new Three.Vector3(0,250,0),new Three.Vector3(0,-1,0),0,430);
 const Empty={footprint:[]};
 for(const r of cases){
  const f=load(r.tile)[r.i];A.deepEqual(f.footprint,r.footprint);
  A.equal(readNeutralRoof(manifest.sha256+'stale',r.tile,r.i,r.footprint),undefined);
  A.equal(readNeutralRoof(manifest.sha256,r.tile,r.i,[r.footprint[0],...r.footprint.slice(1).reverse()]),undefined);
  const fixtures=Array(r.i+1).fill(Empty);fixtures[r.i]=f;
  const stock=old.generate(fixtures,C.get(r.tile)),quality=next.generate(fixtures,C.get(r.tile));
  for(const m of [stock,quality])m.updateMatrixWorld();
  const p=r.footprint.map(ll=>project(...ll)), x=p.reduce((x,v)=>x+v.x,0)/p.length,z=p.reduce((z,v)=>z+v.z,0)/p.length;
  const base=t.meshElevation(x,z)+.05;
  const collect=(s,lon,lat)=>{
   const q=project(lon,lat);
   ray.ray.origin.set(q.x,250,q.z);
   return ray.intersectObject(s,false).filter(h=>s.geometry.getAttribute('topFlag').getX(h.face.a)===1).map(h=>h.point.y);
  };
  const rows=[[],[]],dupes=[[],[]];
  for(const [a,bb,y]of r.points){
   for(const [i,m]of [stock,quality].entries()){
    const heights=collect(m,a,bb);
    if(!heights.length){misses.push({r:r.tile+'/'+r.i,i,a,bb});continue;}
    rows[i].push(Math.abs(heights[0]-y));if(heights.length>1)dupes[i].push(heights[0]-heights.at(-1));
   }
  }
  const summary={tile:r.tile,i:r.i,city:r.city,kind:r.kind,points:r.points.length,before:percentile(rows[0],.9),after:percentile(rows[1],.9),datumDiff:Math.abs(base-r.expectedDatum),faces:[stock.geometry.attributes.position.count/3,quality.geometry.attributes.position.count/3],highDouble:Math.max(0,...dupes[1])};
  if(summary.after>.48||summary.before-summary.after<.12||summary.datumDiff>.799||summary.highDouble>.002)rejected.push(summary);else tested.push(summary);
  for(const m of [stock,quality])m.geometry.dispose();
 }
 A.equal(misses.length,0,JSON.stringify(misses.slice(0,10)));
 // For complete stream chunks, remove the intended slots and compare six real mesh attributes byte-for-byte.
 const targetMap=new Map();
 for(const r of cases){if(!targetMap.has(r.tile))targetMap.set(r.tile,new Set());targetMap.get(r.tile).add(r.i);}
 let bytes=0,vertices=0;
 for(const [tile,selected] of targetMap){
  const rows=load(tile).map((f,i)=>selected.has(i)?Empty:f);
  const m=old.generate(rows,C.get(tile)),n=next.generate(rows,C.get(tile));
  const attr=m.geometry.attributes;
  for(const k of Object.keys(attr)){
   const a=attr[k].array,b=n.geometry.attributes[k].array;
   A.ok(Buffer.from(a.buffer,a.byteOffset,a.byteLength).equals(Buffer.from(b.buffer,b.byteOffset,b.byteLength)),tile+' unrelated '+k);
   bytes+=a.byteLength;
  }
  vertices+=attr.position.count;m.geometry.dispose();n.geometry.dispose();
 }

 const q=[.1,.5,.9,.99,1];
 const report={target:'KINGS; roof-only scout; no semantic façade or footprints',attempted:cases.length,accepted:tested.length,rejected:rejected.length,cells:cases.reduce((n,x)=>n+x.points.length,0),chunks:list.size,unrelated:{vertices,bytes},q,
  perBuildingAbsoluteRoofP90:{before:q.map(v=>percentile(tested.map(a=>a.before),v)),after:q.map(v=>percentile(tested.map(a=>a.after),v))},
  rejectedNotPublished:rejected,acceptedProof:tested};
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,acceptedProof:undefined},null,2));mat.dispose();
 A.equal(rejected.length,0,'Release witness contains unevidenced roof changes');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
