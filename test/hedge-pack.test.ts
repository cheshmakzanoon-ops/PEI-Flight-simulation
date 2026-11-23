import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {validHedgeCatalogue,decodeHedgeChunk} from '../src/sim/hedge-stream.ts';
import {project} from '../src/sim/geo.ts';

const path=new URL('../public/world/woodland/hedgerows-v1/',import.meta.url);
const m=JSON.parse(readFileSync(new URL('index.json',path),'utf8'));
const h=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
test('hedgerow assets are bounded and every pinned chunk uniquely decodes on its declared tile',()=>{
  assert.ok(validHedgeCatalogue(m));
  const packs=m.packs.map((p:{file:string;sha256:string;bytes:number})=>{
    const raw=readFileSync(new URL(p.file,path));
    assert.equal(raw.length,p.bytes);assert.equal(h(raw),p.sha256);return raw;
  });
  const [w,s,e,n]=m.bounds,a=project(w,n),b=project(e,s),dx=(b.x-a.x)/32,dz=(b.z-a.z)/22;
  let total=0,shrubs=0,survey=0;
  for(const t of m.tiles){
    const raw=gunzipSync(packs[t.pack].subarray(t.offset,t.offset+t.bytes));
    assert.equal(h(raw),t.sha256);
    const [i,j]=t.id.split('-').map(Number),x=a.x+i*dx,z=a.z+j*dz;
    const rows=decodeHedgeChunk(Uint8Array.from(raw).buffer,t.count,x,z);
    for(let k=0;k<rows.length;k+=4){
      assert.ok(rows[k]>=x-.004&&rows[k]<=x+dx+.004&&rows[k+1]>=z-.004&&rows[k+1]<=z+dz+.004);
      if(rows[k+3]===1)shrubs++;if(rows[k+3]===2)survey++;
    }
    total+=t.count;
  }
  const county=Object.values(m.stats) as {instances:number;shrub:number;standHeightSupport:number}[];
  assert.equal(total,county.reduce((s,c)=>s+c.instances,0));assert.equal(shrubs,county.reduce((s,c)=>s+c.shrub,0));
  assert.equal(survey,county.reduce((s,c)=>s+c.standHeightSupport,0));
});
test('hedgerow decoder rejects false ownership, bad height, malformed and duplicate loci',()=>{
  assert.equal(validHedgeCatalogue({...m,bounds:[...m.bounds,46]}),false);
  assert.equal(validHedgeCatalogue({...m,tiles:[{...m.tiles[0],offset:19},...m.tiles.slice(1)]}),false);
  assert.equal(validHedgeCatalogue({...m,buildingSHA256:'0'.repeat(64)}),false);
  assert.equal(validHedgeCatalogue({...m,localCoverSHA256:{}}),false);
  assert.equal(validHedgeCatalogue({...m,forestNativeSHA256:undefined}),false);
  assert.throws(()=>decodeHedgeChunk(new ArrayBuffer(5),1,0,0));
  const b=new ArrayBuffer(12),v=new DataView(b);
  v.setUint8(4,17);v.setUint8(5,1);v.setUint8(10,17);v.setUint8(11,1);
  assert.throws(()=>decodeHedgeChunk(b,2,0,0),/Invalid hedgerow support/);
  const a=b.slice(0,6);new DataView(a).setUint16(2,65535,true);
  assert.throws(()=>decodeHedgeChunk(a,1,0,0),/Invalid hedgerow support/);
});

test('a temporary request timeout recovers before excluding a local hedgerow tile',async()=>{
 const {HedgeStream}=await import('../src/sim/hedge-stream.ts');
 const first=m.tiles[0],part=m.packs[first.pack];
 const whole=readFileSync(new URL(part.file,path));
 const meta={
  'cover.json':{compressedSha256:m.coverSHA256},
  'roads.json':{sha256:m.roadsSHA256},
  'buildings/index.json':{sha256:m.buildingSHA256},
  'woodland/hedgerows-v1/index.json':m
 } as Record<string,unknown>;
 let times=0;
 const stream=new HedgeStream('/',async(u,init)=>{
  const f=String(u).replace(/^\/world\//,'');
  if(f in meta)return Response.json(meta[f]);
  if(f==='woodland/hedgerows-v1/'+part.file){
   const rg=new Headers(init?.headers).get('Range');
   if(rg==='bytes='+first.offset+'-'+(first.offset+first.bytes-1)){
    if(++times===1)throw new DOMException('Mock network hiccup','TimeoutError');
    return new Response(whole.subarray(first.offset,first.offset+first.bytes),{status:206,headers:{
     'Content-Range':'bytes '+first.offset+'-'+(first.offset+first.bytes-1)+'/'+whole.byteLength
    }});
   }
  }
  return new Response(null,{status:404});
 });
 await stream.settleCatalogue();
 const [i,j]=first.id.split('-').map(Number),[a,b,c,d]=m.bounds;
 const nw=project(a,d),se=project(c,b),dx=(se.x-nw.x)/32,dz=(se.z-nw.z)/22;
 stream.move(nw.x+(i+.5)*dx,nw.z+(j+.5)*dz);
 const max=Date.now()+4000;
 while(!stream.state.loaded&&Date.now()<max)await new Promise(r=>setTimeout(r,30));
 assert.equal(times,2);
 assert.equal(stream.state.loaded,1);
 assert.ok(!stream.state.missing);
});
