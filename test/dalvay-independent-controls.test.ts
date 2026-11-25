import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,PlaneGeometry,Scene,ShaderMaterial,Texture} from 'three';
import {dalvayExteriorRequested,dalvayWaterRequested,sceneryDeparture,standardSourisShoreline} from '../src/app/scenery-profile.ts';
import {departureBriefing} from '../src/app/departure-briefing.ts';
import {SITES} from '../src/sim/places.ts';
import {dalvayDrawCenter} from '../src/render/dalvay-exterior-socket.ts';
import {project} from '../src/sim/geo.ts';
import {DALVAY,dalvayGroundPair} from '../src/render/dalvay-exterior-seat.ts';
import {DALVAY_WATER_VISUAL,DalvayLakeOptics} from '../src/render/dalvay-lake-optics.ts';

test('coastal dispatch and the manor and lake comparison switches have three independent owners',()=>{
 const id='dalvay-lake-coastal-pass',ids=SITES.map(v=>v.id);
 const keys=['dalvayExteriorStudy','stockDalvayExterior','dalvayWaterOptics','stockDalvayWaterOptics'];
 for(let mask=0;mask<16;mask++){
  const q=new URLSearchParams({departure:id,scenery:'standard'});
  keys.forEach((s,i)=>{if(mask&(1<<i))q.set(s,'')});
  const art=!!(mask&1)&&!(mask&2),water=!!(mask&4)&&!(mask&8);
  assert.equal(dalvayExteriorRequested(q),art,q.toString());assert.equal(dalvayWaterRequested(q),water,q.toString());
  const site=SITES[sceneryDeparture('?'+q,ids)];assert.equal(site.id,id);
  assert.match(departureBriefing(site,'?'+q),water?/preview is enabled/:/preview is off/);
  assert.equal(standardSourisShoreline(q),true);
  for(const blocker of ['scenery=detail','surveyRelief','otherScene']){
   const foreign=new URLSearchParams(q.toString()+'&'+blocker);
   assert(!dalvayExteriorRequested(foreign));assert(!dalvayWaterRequested(foreign));
  }
 }
});

test('the manor keeps its own two original seats when lake shaders mount, withdraw or lose one receiver',()=>{
 const scene=new Scene(),sky=new Texture(),rows=DALVAY_WATER_VISUAL.tiles.map(id=>{
  const local=new ShaderMaterial({vertexShader:'varying vec3 p; varying vec2 vuv; void main(){vec4 w=vec4(position,1.);p=w.xyz;vuv=uv;}',
   fragmentShader:'void main(){vec3 terrainDx=vec3(1.);gl_FragColor=vec4(mist(col,d,p.y),1.);}',uniforms:{skyMap:{value:sky},clock:{value:0}}});
  const fine=new Mesh(new PlaneGeometry(1,1,112,112),local);scene.add(fine);
  return {id,local,fine,lod:112};
 });
 const slots=()=>rows.map(t=>({id:t.id,mesh:t.fine,stock:t.local})),seats=()=>dalvayGroundPair(rows[0],rows[1],false);
 const original=rows.map(t=>[t.fine.geometry,t.fine.material,t.local.fragmentShader,t.local.vertexShader]);
 const size=DALVAY_WATER_VISUAL.width*DALVAY_WATER_VISUAL.height;
 const preview=new DalvayLakeOptics(new Uint8Array(size));assert(seats());preview.update(slots);assert(preview.active);assert(seats());
 for(const [i,t] of rows.entries()){assert.equal(t.fine.geometry,original[i][0]);assert.equal(t.fine.material,original[i][1]);}
 rows[0].lod=56;assert(!seats());rows[0].lod=112;assert(seats());assert(!dalvayGroundPair(rows[0],rows[1],true));
 preview.update(()=>slots().slice(0,1));assert(!preview.active);assert(seats());
 for(const [i,t] of rows.entries()){assert.equal(t.local.fragmentShader,original[i][2]);assert.equal(t.local.vertexShader,original[i][3]);}
 preview.dispose();assert(seats());for(const t of rows){t.fine.geometry.dispose();t.local.dispose();t.fine.removeFromParent();}sky.dispose();
});

test('original owner origin uses this engine’s two canonical corner projections, without a coordinate tolerance',()=>{
 const [west,south,east,north]=DALVAY.bounds,sw=project(west,north),ne=project(east,south);
 assert.deepEqual(dalvayDrawCenter(),{x:(sw.x+ne.x)/2,z:(sw.z+ne.z)/2});
 // A one-ULP runtime variation in the local longitude scale was measured in native Chrome.
 // The callback is an offline repro of the two stock corner values, never used to admit a live mesh.
 const native=[{x:0,z:0},{x:2*8231.943729727123,z:2*9208.361856004321}],calls:number[][]=[];
 const x=dalvayDrawCenter((lon,lat)=>{calls.push([lon,lat]);return native[calls.length-1];});
 assert.deepEqual(calls,[[west,north],[east,south]]);assert.deepEqual(x,{x:8231.943729727123,z:9208.361856004321});
 assert.notEqual(x.x,8231.943729727122);
});
