/** Dump actual Three.js cap/wall topology for independent OGR/source checks. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {SIDEWALKS} from '../../src/render/sidewalks.generated.ts';
import {floatGridAudit} from './sidewalk-test-fixture.mjs';
import {decodeSidewalks,walkSections,sidewalkGeometry,sidewalkGrid,fitSidewalk,WALK_TOP} from '../../src/render/sidewalks.ts';
import {Terrain} from '../../src/sim/terrain.ts';
import {Cover} from '../../src/sim/cover.ts';
const root=new URL('../../public/world/',import.meta.url);
const open=name=>readFileSync(new URL(name,root));
const data=gunzipSync(open(SIDEWALKS.asset));
const atlas=decodeSidewalks(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
const tm=JSON.parse(open('terrain.json'));
const height=gunzipSync(open(tm.file));
const t=new Terrain(tm,new Int16Array(height.buffer.slice(height.byteOffset,height.byteOffset+height.byteLength)));
const cm=JSON.parse(open('cover.json')),c=new Cover(cm.width,cm.height,gunzipSync(open(cm.file)));
const report={paths:0,pathSpans:0,rejected:0,topTris:0,wallTris:0,byStyle:[0,0,0,0,0,0],tiles:[],maxSlopeGroundError:0,wrongWinding:0},projected=[];
for(const tile of atlas){
 const {geometry:g,top,offsets}=sidewalkGeometry(tile,sidewalkGrid(t),(x,z)=>c.distance(t,x,z)>.3);
 let tileDropped=0;
 for(const [id,path] of tile.paths.entries()){
  const s=walkSections(path),xyz=[];
  for(let i=1;i<s.length;i++){
   const [a,b]=s[i-1],[d,e]=s[i];
   const area=(a,b,q)=>(b.x-a.x)*(q.z-a.z)-(b.z-a.z)*(q.x-a.x);
   if(area(a,b,e)<1e-8||area(a,e,d)<1e-8){tileDropped++;continue;}
   xyz.push([a,b,e,d].map(p=>[p.x,p.z]));
  }
  projected.push({id:tile.id+':'+id,points:path.points.map(p=>[p.x,p.z]),style:path.style,quads:xyz});
  report.byStyle[path.style]+=xyz.length;report.pathSpans+=path.points.length-1;
 }
 const xyz=g.getAttribute('position'),normal=g.getAttribute('normal'),mark=g.getAttribute('walkStyle');
 report.paths+=tile.paths.length;report.rejected+=tileDropped;
 report.topTris+=top/3;report.wallTris+=(xyz.count-top)/3;
 report.tiles.push({tile:tile.id,paths:tile.paths.length,dropped:tileDropped,capTris:top/3,wallTris:(xyz.count-top)/3});
 const delta=floatGridAudit({geometry:g,offsets,top},tile,sidewalkGrid(t));
 report.maxSlopeGroundError=Math.max(report.maxSlopeGroundError,delta.error);
 report.wrongWinding+=delta.wrongWinding;
}
if(report.wrongWinding||report.maxSlopeGroundError>=.001)throw Error(JSON.stringify(report));
const name=process.argv[2];
if(name)writeFileSync(name,JSON.stringify({projected,report})+'\n');
console.log(JSON.stringify({...report,tiles:report.tiles.length}));
