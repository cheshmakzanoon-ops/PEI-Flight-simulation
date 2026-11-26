import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {CAPE_WET_PATCH,capeWetCells,capeWetPatchGateGLSL} from '../src/render/cape-tryon-wet-tie.ts';
import {CAPE_TRYON_COVER_DECODED} from '../src/render/cape-tryon-rock.ts';
import {project} from '../src/sim/geo.ts';

test('Cape wet tie envelopes only the 22 eligible source transition cells',()=>{
 const pub=new URL('../public/world/',import.meta.url);
 const m=JSON.parse(readFileSync(new URL('cover.json',pub),'utf8'));
 const bytes=gunzipSync(readFileSync(new URL(m.file,pub)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),CAPE_TRYON_COVER_DECODED);
 const [w,s,e,n]=m.bounds;
 const nw=project(w,n),se=project(e,s);
 const scope={left:nw.x,top:nw.z,right:se.x,bottom:se.z};
 const cells=capeWetCells(scope,{width:m.width,height:m.height,bytes});
 const expected=[[1324,1548,1549],[1324,1553,1555],[1325,1547,1553],[1325,1555,1555],
  [1326,1550,1551],[1326,1554,1555],[1327,1554,1554],[1328,1554,1554],[1329,1554,1554],[1330,1554,1555]];
 assert.deepEqual(cells.map(q=>[q.j,q.i]),expected.flatMap(([j,a,b])=>Array.from({length:b-a+1},(_,k)=>[j,a+k])));
 assert.equal(cells.length,22);
 const area=cells.reduce((a,c)=>a+(c.x1-c.x0)*(c.z1-c.z0),0);
 assert(Math.abs(area-45078.41)<.02);
 assert(area/(CAPE_WET_PATCH.width*CAPE_WET_PATCH.height)<.286);
 const invalid=capeWetCells(scope,{width:m.width,height:m.height,bytes:bytes.subarray(1)});
 assert.deepEqual(invalid,[]);
 assert.match(capeWetPatchGateGLSL,/shore!=0\./);
 assert.match(capeWetPatchGateGLSL,/exact>=-\.075/);
 assert.match(capeWetPatchGateGLSL,/gl_FragDepth=1\./);
});
