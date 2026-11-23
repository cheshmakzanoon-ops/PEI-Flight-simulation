import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { project } from '../src/sim/geo.ts';
import { Terrain } from '../src/sim/terrain.ts';
import { Buildings } from '../src/render/buildings.ts';
import { HOME_ATLAS_SHA,HOME_COUNT,HOME_FORMS } from '../src/render/home-envelopes.generated.ts';
import { emitHomeEnvelope,homeRoofAtlas,homeRoofHeight,readHomeEnvelope } from '../src/render/home-envelopes.ts';
import { farmFootprintKey } from '../src/render/farm-shells.ts';

type Pt={x:number;z:number};
type Feature={footprint:[number,number][];height:number;minHeight:number;holes?:[number,number][][]};
type Tile={id:string;offset:number;bytes:number;bounds:[number,number,number,number]};
const p=new URL('../public/world/',import.meta.url);
const bytes=readFileSync(new URL('buildings/tiles.pack',p));
const atlas=JSON.parse(readFileSync(new URL('buildings/index.json',p),'utf8')) as
 {sha256:string;tiles:Tile[];count:number};
const rows=HOME_FORMS as Readonly<Record<string,readonly (readonly number[])[]>>;
const features=(q:Tile): Feature[]=>JSON.parse(gunzipSync(bytes.subarray(q.offset,q.offset+q.bytes)).toString()).features;
const area=(a:Pt,b:Pt,c:Pt)=>((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))*.5;
const distance=(a:Pt,b:Pt,p:Pt)=>{
 const x=b.x-a.x,z=b.z-a.z;
 const u=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z)));
 return Math.hypot(p.x-a.x-u*x,p.z-a.z-u*z);
};
function inside(r:readonly Pt[],p:Pt){
 let covered=false, min=Infinity;
 for(let i=0;i<r.length;i++){
  const a=r[i],b=r[(i+1)%r.length];
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)covered=!covered;
  min=Math.min(min,distance(a,b,p));
 }
 return covered||min<.0002;
}
// Check sub-segments on both sides of every real edge intersection rather
// than merely requiring vertices inside a potentially concave outline.
function containedEdge(r:readonly Pt[],a:Pt,b:Pt){
 const x=b.x-a.x,z=b.z-a.z,events=[0,1];
 if(x*x+z*z<1e-14)return inside(r,a);
 for(let i=0;i<r.length;i++){
  const p=r[i],q=r[(i+1)%r.length],u=q.x-p.x,v=q.z-p.z;
  const w=p.x-a.x,t=p.z-a.z,d=x*v-z*u;
  if(Math.abs(d)<1e-10)continue;
  const k=(w*v-t*u)/d,j=(w*z-t*x)/d;
  if(k>1e-9&&k<1-1e-9&&j>=-1e-8&&j<=1+1e-8)events.push(k);
 }
 events.sort((l,m)=>l-m);
 return events.slice(1).every((t,i)=>{
  const k=(t+events[i])*.5;
  return inside(r,{x:a.x+k*x,z:a.z+k*z});
 });
}

test('the native measurement and separate ODbL membership files match the shipped envelope rows',()=>{
 const q=new URL('../data/residential-architecture/',import.meta.url);
 const report=JSON.parse(readFileSync(new URL('fit-report.json',q),'utf8'));
 assert.equal(report.atlasSha256,HOME_ATLAS_SHA);
 const decode=(path:URL,hash:string,packed:string)=>{
  const f=readFileSync(path),g=gunzipSync(f);
  assert.equal(createHash('sha256').update(f).digest('hex'),packed);
  assert.equal(createHash('sha256').update(g).digest('hex'),hash);
  return JSON.parse(g.toString());
 };
 const windows=decode(new URL('native-window-houses.json.gz',q),report.data.nativeWindowJSONSHA256,report.data.nativeWindowGzipSHA256) as {tile:string;i:number;hold:number;hash:string;footprintKey:number}[];
 const matches=decode(new URL('../odbl/residential/matched-houses.json.gz',q),report.data.osmDatabaseJSONSHA256,report.data.osmDatabaseGzipSHA256) as {tile:string;i:number;osm:string;building:string;outline:unknown[];intersectionOverUnion:number;matchBasis:string}[];
 assert.equal(windows.length,HOME_COUNT);
 assert.equal(matches.length,HOME_COUNT);
 assert.equal(windows.reduce((n,h)=>n+h.hold,0),16669);
 for(const [i,r] of windows.entries()){
  assert.match(r.hash,/^[0-9a-f]{64}$/);
  const m=matches[i];
  assert.equal(m.tile,r.tile);assert.equal(m.i,r.i);
  assert.equal(rows[r.tile].find(x=>x[0]===r.i)?.[1],r.footprintKey);
  assert.match(m.osm,/^[wr]\d+$/);
  assert.ok(m.intersectionOverUnion>=(m.matchBasis==='exact overlap'?.659999:.571999));
  assert.ok(m.outline.length>=4);
 }
});

test('only exact version-matched row, plan and ordered geometry select a home envelope',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),HOME_ATLAS_SHA);
 assert.equal(homeRoofAtlas(atlas.sha256),true);
 assert.equal(homeRoofAtlas(undefined),false);
 assert.equal(homeRoofAtlas('another atlas'),false);
 let n=0;
 for(const tile of atlas.tiles){
  const list=rows[tile.id]??[],records=features(tile);
  for(let i=0;i<records.length;i++){
   const f=records[i],r=list.find(k=>k[0]===i),active=readHomeEnvelope(tile.id,i,f.footprint);
   assert.equal(!!active,!!r);
   if(!r||!active)continue;
   n++;assert.equal(f.holes?.length??0,0);
   assert.equal(r[1],farmFootprintKey(f.footprint));
   assert.ok([1,2,4].includes(active.planes.length));
   assert.equal(readHomeEnvelope(tile.id,i,[...f.footprint].reverse()),undefined);
  }
 }
 assert.equal(n,HOME_COUNT);
});
test('roof planes and physical cladding/aperture triangles all remain inside the source plan',()=>{
 let homes=0,windows=0,doors=0,max=0;
 for(const t of atlas.tiles){
  const rowsIn=rows[t.id];if(!rowsIn)continue;
  const fs=features(t);
  for(const row of rowsIn){
   const f=fs[row[0]],model=readHomeEnvelope(t.id,row[0],f.footprint)!;
   const ring=f.footprint.map(a=>project(...a)),c={x:ring.reduce((s,q)=>s+q.x,0)/ring.length,z:ring.reduce((s,q)=>s+q.z,0)/ring.length};
   const plan=ring.reduce((s,a,i)=>s+area(c,a,ring[(i+1)%ring.length]),0);
   const V:{p:Pt;y:number;k:number}[]=[];
   emitHomeEnvelope(ring,c,10,413635,model,(x,z)=>9.95+(x-c.x)*.003+(z-c.z)*.004,
    (p,y,_tint,u,v,k)=>{assert.ok(Number.isFinite(y+u+v));V.push({p,y,k});});
   let top=0;
   for(let i=0;i<V.length;i+=3){
    const [A,B,C]=V.slice(i,i+3),label=t.id+' mesh '+row[0]+' face '+A.k;
    assert.equal(A.k,B.k);assert.equal(B.k,C.k);
    for(const v of [A,B,C]){
     assert.ok(inside(ring,v.p),label+' outside original plan');
     if(v.k===1)assert.ok(Math.abs(v.y-10-homeRoofHeight(v.p,c,model.planes))<1e-6,label);
    }
    assert.ok(containedEdge(ring,A.p,B.p)&&containedEdge(ring,B.p,C.p)&&containedEdge(ring,C.p,A.p),label+' edge crosses plan');
    const p={x:(A.p.x+B.p.x+C.p.x)/3,z:(A.p.z+B.p.z+C.p.z)/3};
    assert.ok(inside(ring,p),label+' interior crosses plan');
    if(A.k===1)top+=Math.abs(area(A.p,B.p,C.p));
    if(A.k===-1)windows++;
    if(A.k===-3)doors++;
   }
   assert.ok(Math.abs(top-Math.abs(plan))<.00012,t.id+':'+row[0]+' gap or overlap in measured cap');
   max=Math.max(max,V.length/3);
   assert.ok(V.length/3<=550,'triangle cap');
   homes++;
  }
 }
 assert.equal(homes,HOME_COUNT);
 assert.ok(windows>HOME_COUNT*2,'too few physical glazed apertures');
 assert.ok(doors>HOME_COUNT*.6,'too few qualified near entrances');
 console.log('Home joinery apertures:',{homes,windows:windows/2,doors:doors/2,max});
});
test('the visible home window is behind an actual wall opening and side jamb, not painted on the siding',()=>{
 const ring=[{x:-5,z:-4},{x:5,z:-4},{x:5,z:4},{x:-5,z:4}],center={x:0,z:0};
 const samples:number[]=[],flags:number[]=[];
 emitHomeEnvelope(ring,center,.05,1487,{style:10,front:0,levels:1,planes:[[5,0,.52],[5,0,-.52]]},()=>0,
  (p,y,_,_a,_b,k)=>{samples.push(p.x,y,p.z);flags.push(k);});
 const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(samples,3));
 const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 m.updateMatrixWorld();
 const wall=flags.indexOf(0)*3,window=flags.indexOf(-1)*3;assert.ok(wall>=0&&window>=0);
 // A ray into the same row shades a real inner window and a neighboring opaque wall.
 const y=1.61,z0=-8;
 const ray=(x:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,z0),new THREE.Vector3(0,0,1),0,20).intersectObject(m,false)[0];
 const win=ray((samples[window]+samples[window+3]+samples[window+6])/3);
 const blank=ray(4.26);
 assert.equal(flags[win.face!.a],-1);
 assert.equal(flags[blank.face!.a],0);
 assert.ok(win.point.z-blank.point.z>=.11&&win.point.z-blank.point.z<.16);
 geo.dispose();m.material.dispose();
});
test('actual grouped home meshes preserve every unrelated attribute including existing surveyed farm shells',()=>{
 const spec=JSON.parse(readFileSync(new URL('terrain.json',p),'utf8'));
 const raw=gunzipSync(readFileSync(new URL('height.bin.gz',p)));
 const samples=new Int16Array(raw.length/2);
 for(let i=0;i<samples.length;i++)samples[i]=raw.readInt16LE(i*2);
 const terrain=new Terrain(spec,samples);
 const object=Object.create(Buildings.prototype);
 const mat=new THREE.MeshBasicMaterial();
 Object.assign(object,{t:terrain,atlasHash:HOME_ATLAS_SHA,fitted:true,farms:true,mat});
 let changed=0,vertices=0,triangles=0,worstTileDelta=0,maxTile=0;
 for(const tile of atlas.tiles){
  const targets=rows[tile.id];if(!targets)continue;
  const f=features(tile),skip=new Set(targets.map(r=>r[0]));
  const [w,s,e,n]=tile.bounds;
  const bounds={...tile,x1:project(w,n).x,x2:project(e,s).x,z1:project(w,n).z,z2:project(w,s).z};
  const absent=f.map((record,j)=>skip.has(j)?{...record,footprint:[]}:record);
  object.homes=false;const legacy=object.generate(absent,bounds) as THREE.Mesh;
  const prior=object.generate(f,bounds) as THREE.Mesh;
  object.homes=true;const actual=object.generate(f,bounds) as THREE.Mesh;
  const facade=actual.geometry.getAttribute('facadeStyle'),keep:number[]=[];
  for(let i=0;i<facade.count;i++){if(facade.getX(i)<10)keep.push(i);}
  assert.ok((facade.count-keep.length)>=targets.length*20);
  const tileDelta=(facade.count-prior.geometry.getAttribute('position').count)/3;
  triangles+=tileDelta;worstTileDelta=Math.max(worstTileDelta,tileDelta);maxTile=Math.max(maxTile,targets.length);
  changed+=targets.length;vertices+=keep.length;
  for(const name of ['position','normal','color','uv','topFlag','facadeStyle']){
   const orig=legacy.geometry.getAttribute(name),next=actual.geometry.getAttribute(name);
   assert.equal(orig.count,keep.length,name+' changed the non-selected count');
   for(let k=0;k<orig.array.length;k++){
    const j=Math.floor(k/orig.itemSize),m=k%orig.itemSize;
    if(!Object.is(orig.array[k],next.array[keep[j]*orig.itemSize+m]))throw Error(tile.id+' changed '+name+' scalar '+k);
   }
  }
  for(const mesh of [legacy,prior,actual])mesh.geometry.dispose();
 }
 assert.equal(changed,HOME_COUNT);
 console.log('Residential mesh scope', {changed,vertices,triangles,worstTileDelta,maxTile});
 assert.ok(triangles<HOME_COUNT*350);assert.ok(worstTileDelta<30000);
 assert.ok(vertices>500000);
 mat.dispose();
});
