/** Independent mapped exclusions for an offline grade prospect, not a claim of exhaustive obstructions. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

export async function readNorthCapeGradeExclusions(url, points, project, locator) {
 const [{decodeRoads},{decodeSidewalks},{decodeParkingSurfaces}]=await Promise.all([
  'roads','sidewalks','parking-surfaces',
 ].map(k=>import(url('src/render/'+k+'.ts'))));
 const sha=b=>createHash('sha256').update(b).digest('hex');
 const world='public/world/';
 const read=p=>readFileSync(url(world+p));
 const load=(path,expected)=>{
  const b=gunzipSync(read(path));
  assert.equal(sha(b),expected,path);
  return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 };
 const pins={
  roads:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
  sidewalks:'e2dce7c86c4b5cd45ea45fb92ed89c2ae504306e4349e1291e627a669630e384',
  parking:'071f8b599e27afcda8a1924cb152135f342c47756de1667fea28c0fdbb294303',
  index:'fcc2bb4d890eafd08ac41136a3bff7bebeafe2f9c25a066fdcf756ed39badce0',
 };
 const empty=()=>[Infinity,Infinity,-Infinity,-Infinity];
 const grow=(b,x,z)=>[Math.min(b[0],x),Math.min(b[1],z),Math.max(b[2],x),Math.max(b[3],z)];
 const pad=(b,d)=>[b[0]-d,b[1]-d,b[2]+d,b[3]+d];
 const bounds=points.reduce((b,p)=>grow(b,p.x,p.z),empty());
 const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
 const inBox=(b,x,z)=>x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3];

 // Study policy, not surveyed road edges: generous whole-object holds.
 const roadPad=24,walkPad=15,areaPad=20,locatorPad=35;
 const ribbons=[],areas=[],chunks=[];
 function linear(path,radius,role){
  assert.ok(Number.isFinite(radius)&&radius>0);
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
   if(!intersects(bounds,pad(grow(grow(empty(),a.x,a.z),b.x,b.z),radius)))continue;
   ribbons.push({a,dx,dz,length,radius,role});
  }
 }
 function outline(path,role){
  const box=pad(path.reduce((b,p)=>grow(b,p.x,p.z),empty()),areaPad);
  if(intersects(bounds,box))areas.push({box,role});
 }
 for(const r of decodeRoads(load('roads.bin.gz',pins.roads))) {
  linear(r.points,([2,2.8,3.6,4.8,6.4][r.flags&7]??8)+roadPad,'road');
 }
 for(const tile of decodeSidewalks(load('pedestrian/odbl/v1/sidewalks.bin.gz',pins.sidewalks)))
  for(const p of tile.paths)linear(p.points,p.width+walkPad,'sidewalk');
 for(const tile of decodeParkingSurfaces(load('ground/odbl/v1/parking-surfaces.bin.gz',pins.parking))){
  if(!intersects(bounds,pad(tile.box,areaPad)))continue;
  for(const [,paved,other] of tile.lots)for(const poly of [...paved,...other])
   outline(poly[0].map(([x,z])=>({x:x*.001+tile.ox,z:z*.001+tile.oz})),'parking');
 }
 const manifest=read('buildings/index.json');
 assert.equal(sha(manifest),pins.index);
 const index=JSON.parse(manifest),pack=read('buildings/tiles.pack');
 assert.equal(sha(pack),index.sha256);
 for(const t of index.tiles){
  const [W,S,E,N]=t.bounds,a=project(W,N),b=project(E,S);
  if(!intersects(bounds,pad([a.x,a.z,b.x,b.z],areaPad)))continue;
  const bytes=pack.subarray(t.offset,t.offset+t.bytes);
  assert.equal(sha(bytes),t.sha256);
  const {features}=JSON.parse(gunzipSync(bytes));
  assert.equal(features.length,t.count);
  for(const f of features)outline(f.footprint.map(([lon,lat])=>project(lon,lat)),'building');
  chunks.push([t.id,t.sha256]);
 }
 function classify({x,z}){
  if(Math.hypot(x-locator.x,z-locator.z)<=locatorPad)return 'locator';
  for(const {a,dx,dz,length,radius,role} of ribbons){
   const t=length>0?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length)):0;
   if(Math.hypot(x-a.x-dx*t,z-a.z-dz*t)<=radius)return role;
  }
  for(const {box,role} of areas)if(inBox(box,x,z))return role;
  return '';
 }
 const tally=xs=>xs.reduce((a,{role})=>(a[role]=(a[role]??0)+1,a),{});
 return {classify,receipt:{pins,chunks,mappedRibbons:tally(ribbons),mappedConservativeRectangles:tally(areas),
  buffersM:{roadHalfWidthPlus:roadPad,sidewalkWidthPlus:walkPad,areaAabb:areaPad,coastGuardLocator:locatorPad}}};
}
