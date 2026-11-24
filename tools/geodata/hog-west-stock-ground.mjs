// Called by bake-hog-west-grade.py with one detached binary study grid.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {World} from '../../src/render/world.ts';
import {Cover} from '../../src/sim/cover.ts';
import {Terrain} from '../../src/sim/terrain.ts';
import {project} from '../../src/sim/geo.ts';
import {WORLD_COLS,WORLD_ROWS} from '../../src/sim/coastal-terrain.ts';

const [directory,input,output]=process.argv.slice(2);
const read=f=>fs.readFileSync(directory+'/'+f);
const json=f=>JSON.parse(read(f));
const raw=gunzipSync(read('height.bin.gz')),land=json('cover.json');
const terrain=new Terrain(json('terrain.json'),new Int16Array(raw.buffer,raw.byteOffset,raw.length/2));
const cover=new Cover(land.width,land.height,gunzipSync(read('cover.bin.gz')));
const byId=new Map(),mat=new THREE.MeshBasicMaterial();
const world=Object.assign(Object.create(World.prototype),{terrain,cover,byId,mat,pondMeshes:[],reliefActive:new Set()});
const w=(terrain.right-terrain.left)/WORLD_COLS,d=(terrain.bottom-terrain.top)/WORLD_ROWS;
const bytes=fs.readFileSync(input),geo=new Float64Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/8);
const result=new Float64Array(geo.length*2);
for(let k=0;k<geo.length/2;k++){
 const {x,z}=project(geo[2*k],geo[2*k+1]),[u,v]=terrain.uv(x,z);
 const i=Math.floor(u*WORLD_COLS),j=Math.floor(v*WORLD_ROWS),id=i+'-'+j;
 const x0=terrain.left+i*w,z0=terrain.top+j*d;
 if(!byId.has(id))byId.set(id,{id,i,j,x0,z0,w,d,lod:112,fine:world.patch(x0,z0,w,d,112)});
 result.set([x,z,cover.distance(terrain,x,z),world.visualGroundHeight(x,z)],4*k);
}
fs.writeFileSync(output,Buffer.from(result.buffer));
