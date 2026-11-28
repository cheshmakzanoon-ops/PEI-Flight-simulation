import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {surfaceComponents} from '../tools/art/north-cape-lighthouse/surface-candidates.ts';

const dir = new URL('../data/north-cape-lighthouse-study/',import.meta.url);
const json=(name:string)=>JSON.parse(readFileSync(new URL(name,dir),'utf8'));
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');

test('the exact aligned North Cape surface distinguishes the lighthouse vicinity from the tall mast across thresholds',()=>{
 const ground=json('source.json'),surface=json('surface-source.json');
 const compressed=readFileSync(new URL(surface.file,dir)),raw=gunzipSync(compressed);
 const terrain=gunzipSync(readFileSync(new URL(ground.file,dir)));
 assert.equal(sha(compressed),surface.storedSHA256);assert.equal(sha(raw),surface.decodedSHA256);
 assert.equal(sha(terrain),ground.decodedSHA256);
 const [c0,r0]=surface.groundWindowOffset,[x,,_,y]=ground.registration.geotransform;
 const {width:w,height:h}=surface;
 assert.deepEqual([w,h,c0,r0],[56,56,164,168]);
 assert.deepEqual(surface.sourcePixelOffset,[ground.registration.sourcePixelOffset[0]+c0,ground.registration.sourcePixelOffset[1]+r0]);
 assert.equal(raw.length,w*h*4);
 const g=new Float64Array(w*h),s=new Float64Array(w*h);
 for(let i=0;i<w*h;i++){
  g[i]=terrain.readInt16LE(((r0+Math.floor(i/w))*ground.width+c0+i%w)*2)/100;
  s[i]=raw.readFloatLE(i*4);
 }
 const grid={width:w,height:h,easting:x+c0,northing:y-r0,groundMetres:g,surfaceMetres:s};
 const ref=ground.reference.projected;
 for(const [threshold,cells] of [[9,[43,42]],[12,[32,37]],[15,[23,32]],[17,[15,30]]] as const){
  const q=surfaceComponents(grid,threshold,ref);
  assert.deepEqual(q.map(c=>c.cells),cells);
  const [a,b]=q;
  assert.ok(q.every(c=>!c.touchesWindowEdge));
  assert.ok(Math.hypot(a.centre[0]-ref[0],a.centre[1]-ref[1])<3.25);
  assert.ok(b.centre[1]<a.centre[1]-17&&b.centre[1]>a.centre[1]-18);
  assert.ok(Math.abs(a.maxAboveGroundMetres-19.3273)<.008);
  assert.ok(Math.abs(b.maxAboveGroundMetres-69.283)<.008);
  if(threshold===12)assert.deepEqual(a.centre,[2281329.03125,350451.8125]);
 }
});

test('comparison rejects no-data and reports potentially truncated components instead of treating them as complete',()=>{
 const base={width:3,height:3,easting:50,northing:30,groundMetres:new Float32Array(9)};
 const s=[12,0,0,0,12,0,0,0,0];
 const out=surfaceComponents({...base,surfaceMetres:s},12,[51.5,28.5]);
 assert.deepEqual(out.map(c=>[c.cells,c.centre,c.touchesWindowEdge]),[[1,[51.5,28.5],false],[1,[50.5,29.5],true]]);
 s[0]=-32767;
 assert.throws(()=>surfaceComponents({...base,surfaceMetres:s},12,[51.5,28.5]),/no-data/);
 assert.throws(()=>surfaceComponents({...base,surfaceMetres:s},0,[51.5,28.5]),/window/);
});
