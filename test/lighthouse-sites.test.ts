import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Mesh, Scene, type Object3D, type LOD} from 'three';
import { LIGHT_STATIONS, insideLighthouseYard, replacesLightBuilding } from '../src/sim/lighthouse-sites.ts';
import { addLighthouseScenery } from '../src/render/lighthouses.ts';
import { project } from '../src/sim/geo.ts';
import { SITES } from '../src/sim/places.ts';
import { Terrain } from '../src/sim/terrain.ts';

const world=new URL('../public/world/',import.meta.url);
const read=(path:string)=>readFileSync(new URL(path,world));
const spec=JSON.parse(read('terrain.json').toString()),bytes=gunzipSync(read(spec.file));
const terrain=new Terrain(spec,new Int16Array(bytes.buffer,bytes.byteOffset,bytes.length/2));
const meshCount=(o:Object3D)=>{let draws=0,triangles=0;
  o.traverse(m=>{if(m instanceof Mesh){draws++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;}});
  return {draws,triangles};
};

test('replace only the three surveyed roof outlines, not nearby houses or woods',()=>{
  const mf=JSON.parse(read('buildings/index.json').toString()),pack=read('buildings/tiles.pack');
  const found:number[]=[]; let examined=0;
  for(const tile of mf.tiles){
    const records=JSON.parse(gunzipSync(pack.subarray(tile.offset,tile.offset+tile.bytes)).toString()).features;
    for(const f of records){examined++;if(replacesLightBuilding(f.footprint))found.push(f.height);}
  }
  assert.equal(examined,mf.count);assert.deepEqual(found.sort((a,b)=>a-b),[9.21,19.48,20.73]);
  for(const s of Object.values(LIGHT_STATIONS)){
    const p=project(s.lon,s.lat);assert.equal(insideLighthouseYard(p.x,p.z),true);
    assert.equal(insideLighthouseYard(p.x+80,p.z+80,11),false);
  }
  const e=project(-61.9716064,46.4526020),w=project(-64.3867576,46.6204853);
  assert.equal(insideLighthouseYard(e.x,e.z),true);assert.equal(insideLighthouseYard(w.x,w.z),true);
  assert.equal(insideLighthouseYard(w.x+40,w.z,8),false);
});

test('both light stations sit on land, preserve their real heights and fit LOD draw budgets',()=>{
  const scene=new Scene(),stations:LOD[]=addLighthouseScenery(scene,terrain);
  assert.equal(stations.length,2);
  for(const [i,s] of Object.values(LIGHT_STATIONS).entries()){
    const p=project(s.lon,s.lat),obj=stations[i],levels=obj.levels;
    assert.equal(terrain.isLand(p.x,p.z),true);assert.equal(obj.position.x,p.x);
    assert.equal(obj.position.z,p.z);assert.equal(obj.position.y,terrain.meshElevation(p.x,p.z)+.12);
    assert.deepEqual(levels.map(l=>l.distance),[0,750,8500]);
    const near=meshCount(levels[0].object),mid=meshCount(levels[1].object);
    assert.equal(near.draws,2);assert.equal(mid.draws,1);assert.equal(meshCount(levels[2].object).draws,0);
    assert.ok(near.triangles<8500,near.triangles+' near triangles');assert.ok(mid.triangles<1300,mid.triangles+' mid triangles');
    for(const lod of levels.slice(0,2)){
      let top=-Infinity;
      lod.object.traverse(m=>{if(m instanceof Mesh){const pos=m.geometry.attributes.position;
        for(let j=0;j<pos.count;j++)top=Math.max(top,pos.getY(j));
      }});
      assert.ok(Math.abs(top-s.height)<.001,top+' mesh height, '+s.height+' published height');
    }
    const site=SITES.find(a=>a.id===(i?'west-light':'east-light'))!,sp=project(site.lon,site.lat);
    const dx=p.x-sp.x,dz=p.z-sp.z,d=Math.hypot(dx,dz),bearing=Math.atan2(dx,-dz)*180/Math.PI;
    const headingOffset=((bearing-site.heading+540)%360)-180;
    assert.ok(d>250 && d<430);
    // Avoid hiding the landmark behind the aircraft in chase view, while remaining inside FOV.
    assert.ok(headingOffset>7 && headingOffset<17);
  }
});
