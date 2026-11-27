// Read-only CPU replay of the ordinary and explicit q20213 Three.js emitters.
const F=require('node:fs'),A=require('node:assert/strict'),Z=require('node:zlib'),H=require('node:crypto'),{pathToFileURL:u}=require('node:url');
const R=require("node:path").resolve(__dirname,"../.."),sha=b=>H.createHash('sha256').update(b).digest('hex');
const path=p=>R+'/'+p;
const load=p=>import(u(path(p)));
(async()=>{
 const {Buildings}=await load('src/render/buildings.ts'),{Terrain}=await load('src/sim/terrain.ts'),
       {supportedRoofAtlas}=await load('src/sim/fitted-roofs.ts'),{project}=await load('src/sim/geo.ts'),
       {OLEARY}=await load('src/render/oleary-railway/authority.ts'),
       {PREVIEW}=await load('src/render/oleary-railway/industrial-standard-custody.generated.ts'),
       {STATION_SCOPE}=await load('src/render/oleary-railway/station-standard-custody.generated.ts'),
       T=await load('node_modules/three/build/three.module.js');
 const world=path('public/world/'),manifest=JSON.parse(F.readFileSync(world+'buildings/index.json')),whole=F.readFileSync(world+'buildings/tiles.pack');
 A.equal(sha(whole),OLEARY.atlas);A.equal(manifest.sha256,OLEARY.atlas);
 const dem=Z.gunzipSync(F.readFileSync(world+'height.bin.gz')),terrain=new Terrain(JSON.parse(F.readFileSync(world+'terrain.json')),new Int16Array(dem.buffer,dem.byteOffset,dem.length/2));
 const row=manifest.tiles.find(x=>x.id===OLEARY.id),bytes=whole.subarray(row.offset,row.offset+row.bytes);
 const actors=JSON.parse(Z.gunzipSync(bytes)).features,c=project(row.bounds[0],row.bounds[3]),d=project(row.bounds[2],row.bounds[1]);
 A.equal(sha(bytes),OLEARY.chunk);A.equal(sha(JSON.stringify(actors[OLEARY.ordinal])),OLEARY.row);
 A.equal(actors.length,OLEARY.rows);
 const tile={...row,x1:c.x,x2:d.x,z1:c.z,z2:d.z};
 const mat=new T.MeshBasicMaterial({side:T.DoubleSide});
 const results={};
 for(const mode of ['composed','explicit']){
  const composed=mode==='composed';
  const b=Object.assign(Object.create(Buildings.prototype),{mat,t:terrain,atlasHash:OLEARY.atlas,fitted:supportedRoofAtlas(OLEARY.atlas),farms:true,homes:true,olearyCompoundRoofs:composed,olearyAccessRoof:composed,
    sourisMcleanMat:mat,montagueMat:mat,waterStreetMat:mat,victoriaMat:mat,sourisMat:mat});
  const m=b.generate(actors,tile,false,OLEARY.ordinal,false,OLEARY.chunk,false,false,true,false),g=m.geometry;
  const count=g.getAttribute('position').count,span=m.userData.beaconTriangles;
  A.equal(span[1]-span[0],42);
  const selected=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>{
   const start=span[0]*a.itemSize,end=span[1]*a.itemSize;
   const bb=v=>Buffer.from(v.buffer,v.byteOffset,v.byteLength);
   if(composed){A.equal(count,PREVIEW.vertices);A.equal(sha(bb(a.array)),PREVIEW.stock[k][1],k);}
   return [k,[a.itemSize,a.count,sha(bb(a.array)),sha(bb(a.array.subarray(start,end)))]];
  }));
  const a=g.getAttribute('position').array.subarray(span[0]*3,span[1]*3);
  const output=process.argv[2]??'.';
  F.writeFileSync(output+'/'+mode+'-stock-q431.f32le',Buffer.from(a.buffer,a.byteOffset,a.byteLength));
  results[mode]={count,span,neighbor:m.userData.olearyIndustrialTriangles,origin:m.position.toArray(),selected};
 }
 const a=results.composed,b=results.explicit;
 A.equal(b.count,OLEARY.proof.vertices);A.deepEqual(b.span,[OLEARY.proof.start,OLEARY.proof.end]);A.deepEqual(a.neighbor,PREVIEW.target);
 A.deepEqual(Object.values(a.selected).map(x=>x[3]),Object.values(b.selected).map(x=>x[3]),'the six signed station streams have independent fixed equality across graphs');
 A.deepEqual(a.origin,b.origin);
 A.deepEqual(a.span,STATION_SCOPE.span);
 A.deepEqual(Object.fromEntries(Object.entries(a.selected).map(([key,pin])=>[key,pin[3]])),STATION_SCOPE.digests);
 F.writeFileSync((process.argv[2]??'.')+'/stock-generator.json',JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({scope:a.span,vertices:a.count,stationLocalDigests:Object.fromEntries(Object.entries(a.selected).map(([name,a])=>[name,a[3]]))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
