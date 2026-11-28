/** Prince Edward Island, Kings County. Offline current regular terrain screen only. */
import A from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PlaneGeometry} from 'three';
const [repo,data]=process.argv.slice(2);
const file=(name)=>resolve(repo,name),url=(name)=>pathToFileURL(file(name));
const fs=(name)=>readFileSync(file(name)),input=name=>readFileSync(resolve(data,name));
const sha=x=>createHash('sha256').update(x).digest('hex');
const meta=JSON.parse(input('receipt.json'));
A.deepEqual(meta.geotransform,[2434248,1,0,317139,0,-1]);
const {Terrain}=await import(url('src/sim/terrain.ts'));
const {Cover}=await import(url('src/sim/cover.ts'));
const {project}=await import(url('src/sim/geo.ts'));
const {WORLD_COLS,WORLD_ROWS,GROUND_LIFT,SURVEY_LOD}=await import(url('src/sim/coastal-terrain.ts'));
const {MASK,MASK_SHA,MASK_BOUNDS,MASK_SHAPE}=await import(url('src/render/panmure-pasture/mask.generated.ts'));
A.deepEqual([WORLD_COLS,WORLD_ROWS,GROUND_LIFT,SURVEY_LOD],[32,22,.12,112]);
const [H,W]=MASK_SHAPE;
A.deepEqual([H,W],[236,213]);
const mask=gunzipSync(Buffer.from(MASK,'base64'));
A.equal(sha(mask),MASK_SHA);A.equal(mask.length,W*H);
const tSpec=JSON.parse(fs('public/world/terrain.json')),cSpec=JSON.parse(fs('public/world/cover.json'));
const load=(file,pin)=>{const bytes=gunzipSync(fs('public/world/'+file));A.equal(sha(bytes),pin);return bytes;};
const b=load(tSpec.file,'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d');
const c=load(cSpec.file,'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9');
A.equal(tSpec.verticalDatum,'CGVD2013');
const t=new Terrain(tSpec,Int16Array.from({length:b.length/2},(_,i)=>b.readInt16LE(i*2)));
const cover=new Cover(cSpec.width,cSpec.height,c);
const n=SURVEY_LOD,w=(t.right-t.left)/WORLD_COLS,h=(t.bottom-t.top)/WORLD_ROWS,
 x=t.left+25*w+w/2,z=t.top+18*h+h/2;
const g=new PlaneGeometry(w,h,n,n).rotateX(-Math.PI/2),p=g.attributes.position;
for(let i=0;i<p.count;i++)p.setY(i,t.atlasElevation(x+p.getX(i),z+p.getZ(i))+GROUND_LIFT);
const X=Array.from({length:n+1},(_,j)=>x+p.getX(j));
const Z=Array.from({length:n+1},(_,j)=>z+p.getZ(j*(n+1)));
function bracket(axis,q){
 let i=0,j=n;
 while(i+1<j){const k=(i+j)>>1;if(axis[k]<=q)i=k;else j=k;}
 A.ok(q>=axis[i]&&q<axis[j]);return i;
}
function stock(a,b){
 const i=bracket(X,a),j=bracket(Z,b),d=n+1,k=j*d+i;
 A.ok(i>=1&&j>=1&&i<n-1&&j<n-1);
 const u=(a-X[i])/(X[i+1]-X[i]),v=(b-Z[j])/(Z[j+1]-Z[j]);
 const [nw,ne,sw,se]=[k,k+1,k+d,k+d+1].map(q=>p.getY(q));
 const first=u+v<=1, y=first?nw+(ne-nw)*u+(sw-nw)*v:se+(sw-se)*(1-u)+(ne-se)*(1-v);
 return {face:2*(j*n+i)+Number(!first),datumY:y-GROUND_LIFT};
}
const bw=124,bh=185,count=bw*bh;
const dtm=input('dtm.f32'),dsm=input('dsm.f32');
A.equal(sha(dtm),'6cf5c849602f9d27717a27287999dc4f4c9414fde5cee09ad515833e862b647e');
A.equal(sha(dsm),'5ef9ee70792a52bab0a4bf73395faec88594d6ef23950536e3dce9fff94ab693');
A.equal(dtm.length,count*4);A.equal(dsm.length,dtm.length);
const coord=Array.from({length:count},(_,i)=>[2434248+i%bw+.5,317138.5-Math.floor(i/bw)].join(' '));
const t0=spawnSync('gdaltransform',['-s_srs','EPSG:3979','-t_srs','EPSG:4326'],{input:coord.join('\n')+'\n',
 encoding:'utf8',maxBuffer:3*1024*1024,env:{...process.env,LC_ALL:'C',PROJ_NETWORK:'OFF'}});
A.equal(t0.status,0,t0.stderr);
const ll=t0.stdout.trim().split('\n');A.equal(ll.length,count);
const core=[136,91,156,118];
const matches=[];
const rejected={outsideSignedCore:0,wrongLiveCell:0,terrainClassOrShore:0,surfaceConfounded:0};
for(let j=0;j<count;j++){
 const [lon,lat,nativeZ]=ll[j].trim().split(/\s+/).map(Number);
 A.ok(Number.isFinite(lon)&&Number.isFinite(lat)&&nativeZ===0);
 const xz=project(lon,lat),u=Math.floor(xz.x-MASK_BOUNDS[0]),v=Math.floor(xz.z-MASK_BOUNDS[1]);
 if(u<core[0]||v<core[1]||u>core[2]||v>core[3]){rejected.outsideSignedCore++;continue}
 if(mask[v*W+u]!==255){rejected.wrongLiveCell++;continue}
 const tide=cover.legacyDistance(t,xz.x,xz.z),type=cover.sample(t,xz.x,xz.z);
 if(!(tide>80&&type===30&&t.isLand(xz.x,xz.z))){rejected.terrainClassOrShore++;continue}
 const m=dtm.readFloatLE(j*4),high=dsm.readFloatLE(j*4);
 if(m<3||m>=18||high-m<-.15||high-m>.36){rejected.surfaceConfounded++;continue}
 const b=stock(xz.x,xz.z);
 matches.push({native:[j%bw,Math.floor(j/bw)],scene:[xz.x,xz.z],old:b.datumY,earth:m,
  dsm:high,delta:m-b.datumY,face:b.face,dry:tide});
}
const percent=(x,h)=>x[Math.floor((x.length-1)*h)];
const all=matches.map(w=>w.delta).sort((a,b)=>a-b);
A.ok(all.length>60);
const stats={total:matches.length,range:[all[0],all.at(-1)],median:percent(all,.5),p10:percent(all,.1),p90:percent(all,.9),
 atLeast45:all.filter(x=>x>=.45).length,atMostMinus45:all.filter(x=>x<=-.45).length};
const result={scope:'Offline Panmure dry-inset height comparison against ordinary reconstructed scene triangle; not live GPU evidence, continuous peer clearance, or approved geometry.',
 registration:meta.geotransform,coreRasterInclusive:core,tile:'25-18',dtm:sha(dtm),dsm:sha(dsm),mask:sha(mask),
 rejected,stats,faces:[...new Set(matches.map(x=>x.face))].sort((a,b)=>a-b),matches};
writeFileSync(resolve(data,'stock-screen.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(stats,result.faces,rejected);
