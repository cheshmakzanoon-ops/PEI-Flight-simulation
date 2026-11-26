import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {spawn,step,FIXED_STEP,neutral} from '../src/sim/flight.ts';
import {project} from '../src/sim/geo.ts';
import {Terrain,type TerrainSpec} from '../src/sim/terrain.ts';
import {Cover} from '../src/sim/cover.ts';
import {SITES} from '../src/sim/places.ts';
import {BOWLEY_POND} from '../src/sim/bowley-pond.generated.ts';
import {BowleyPond} from '../src/sim/bowley-pond.ts';
import {bowleyCoreRequested,sceneryOptions} from '../src/app/scenery-profile.ts';

test('Greenwich starts offshore and crosses the mapped pond area in the unchanged flight model',()=>{
 const base=new URL('../public/world/',import.meta.url),read=(n:string)=>readFileSync(new URL(n,base));
 const spec:TerrainSpec&{file:string}=JSON.parse(read('terrain.json').toString());
 const cv=JSON.parse(read('cover.json').toString());
 const rb=gunzipSync(read(spec.file)),atlas=new Terrain(spec,new Int16Array(rb.buffer,rb.byteOffset,rb.byteLength/2));
 const cover=new Cover(cv.width,cv.height,gunzipSync(read(cv.file)));
 const pond=new BowleyPond(BOWLEY_POND,gunzipSync(read(BOWLEY_POND.file)));
 const start=SITES.find(x=>x.id==='greenwich-dunes-low');assert.ok(start);
 const mid=project(-62.71070,46.44722);
 let check:readonly [number,number,number]|undefined;
 for(const opt of [false,true]){
  const surface=(x:number,z:number)=>{
   if(opt&&pond.water(x,z))return {height:pond.spec.waterY,land:false,runway:false};
   const land=cover.distance(atlas,x,z)>=0;
   return {height:atlas.contactHeight(x,z,land),land,runway:false};
  };
  const f=spawn(start,surface);
  assert.equal(surface(f.x,f.z).land,false);
  let closest=Infinity,lowest=Infinity;
  for(let i=0;i<90*50;i++){
   step(f,neutral,surface,FIXED_STEP);
   assert.equal(f.status,'flying');
   closest=Math.min(closest,Math.hypot(f.x-mid.x,f.z-mid.z));
   lowest=Math.min(lowest,f.y-surface(f.x,f.z).height);
  }
  assert.ok(closest<33&&lowest>173,{closest,lowest});
  if(check)assert.deepEqual([f.x,f.y,f.z],check);
  else check=[f.x,f.y,f.z];
 }
});

test('Bowley is Standard geography irrespective of departure, with deliberate rollback and local ownership controls',()=>{
 const active=(q:string)=>bowleyCoreRequested(sceneryOptions(q));
 for(const q of ['', '?departure=greenwich-dunes-low','?departure=summerside','?scenery=detail','?bowleySurveyPreview',
   '?inlandRelief&bowleySurveyPreview','?coastalOptics','?cavendishDetail'])
  assert.equal(active(q),true,q);
 for(const q of ['?stockBowleyPond','?scenery=detail&stockBowleyPond','?bowleySurveyPreview&stockBowleyPond',
   '?stockBowleyPond&bowleySurveyPreview','?surveyRelief','?inlandRelief','?buildingShadows','?seatedForestShadows'])
  assert.equal(active(q),false,q);
 assert.equal(sceneryOptions('?').has('bowleySurveyPreview'),false,'do not silently add legacy study flags or mode side effects');
});
