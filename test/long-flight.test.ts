import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawn, step, neutral } from '../src/sim/flight.ts';
import { RUNWAYS, SITES, runwayAt } from '../src/sim/places.ts';
import { Terrain } from '../src/sim/terrain.ts';
import { project } from '../src/sim/geo.ts';

const b = gunzipSync(readFileSync(new URL('../public/world/height.bin.gz', import.meta.url)));
const terrain = new Terrain(
  JSON.parse(readFileSync(new URL('../public/world/terrain.json', import.meta.url),'utf8')),
  new Int16Array(b.buffer,b.byteOffset,b.byteLength/2),
);
const surface=(x:number,z:number)=>({height:terrain.elevation(x,z)+.12,land:terrain.isLand(x,z),runway:!!runwayAt(x,z)});

for (const route of [{name:'default 56% lever',power:.56,minS:3100,maxS:3700},{name:'75% cruise lever',power:.75,minS:2400,maxS:2900}]) {
test('province-scale flight crosses from West Prince to East Point continuously: '+route.name, ()=>{
  const f=spawn({id:'west',name:'Cross-island flight',region:'Prince County',lon:-64.34,lat:46.76,heading:106,height:1500,note:''},surface);
  f.throttle=route.power;
  const target=project(-62.00,46.46);
  const sx=f.x,sz=f.z;
  for(let i=0;i<500000;i++){
    const dx=target.x-f.x,dz=target.z-f.z;
    if(Math.hypot(dx,dz)<700||f.status!=='flying')break;
    const tracked=Math.atan2(dx,-dz);
    const d=(tracked-f.heading+Math.PI*3)%(Math.PI*2)-Math.PI;
    const roll=Math.max(-.25,Math.min(.25,d*1.8));
    const pitch=Math.max(-.09,Math.min(.09,(1400-f.y)*.0013-f.vertical*.016));
    step(f,{...neutral,pitch,roll},surface);
    assert.ok(f.y>1300&&f.y<1800);
  }
  assert.equal(f.status,'flying');
  assert.ok(Math.hypot(f.x-target.x,f.z-target.z)<700);
  assert.ok(Math.hypot(f.x-sx,f.z-sz)>180000);
  assert.ok(f.time>route.minS&&f.time<route.maxS);
});
}

test('short final, flare and braking complete on the measured Charlottetown runway', ()=>{
  const r=RUNWAYS[0];
  const f=spawn(SITES.find(s=>s.id==='cyyg')!,surface);
  f.x=r.p.x-r.dx*35; f.z=r.p.z-r.dz*35;
  f.y=surface(r.p.x,r.p.z).height+6; f.speed=38; f.throttle=.13;
  f.status='flying'; f.gamma=-.045; f.pitch=.038+.28*.24;
  for(let i=0;i<900&&f.status==='flying';i++)step(f,{...neutral,pitch:.28},surface);
  assert.equal(f.status,'landed');
  assert.equal(f.notice,'Touchdown');
  for(let i=0;i<2000&&f.speed>.2;i++)step(f,{...neutral,power:-1,brake:true},surface);
  assert.equal(f.status,'landed');
  assert.ok(f.speed<.2);
  assert.equal(runwayAt(f.x,f.z)?.id,'CYYG03');
});

test('CYYG 10/28 uses the post-expansion strip and supports landing beyond the former 28 end',()=>{
  const r=RUNWAYS.find(r=>r.id==='CYYG10')!;
  assert.ok(Math.abs(r.length-2133.60)<1e-6 && Math.abs(r.width-45.72)<1e-6);
  assert.ok(r.to[0]>-63.102 && r.from[0]<-63.128);
  for(const s of [1,150,1700,2000,2132]){
    const x=r.p.x+s*r.dx,z=r.p.z+s*r.dz;
    assert.equal(runwayAt(x,z)?.id,r.id);
    assert.notEqual(runwayAt(x+r.dz*24,z-r.dx*24)?.id,r.id);
  }
  const f=spawn(SITES.find(s=>s.id==='cyyg')!,surface);
  const s=1970;
  f.x=r.p.x+r.dx*s; f.z=r.p.z+r.dz*s;
  f.y=surface(f.x,f.z).height+5.2; f.speed=37; f.throttle=.13;
  f.status='flying'; f.heading=r.heading+Math.PI; f.gamma=-.045; f.pitch=.105;
  for(let i=0;i<900&&f.status==='flying';i++)step(f,{...neutral,pitch:.25},surface);
  assert.equal(f.status,'landed');
  const station=(f.x-r.p.x)*r.dx+(f.z-r.p.z)*r.dz;
  assert.ok(station>1535 && station<1970,station+'');
  for(let i=0;i<2000&&f.speed>.2;i++)step(f,{...neutral,power:-1,brake:true},surface);
  assert.equal(f.status,'landed');
  assert.ok(f.speed<.2);
});
