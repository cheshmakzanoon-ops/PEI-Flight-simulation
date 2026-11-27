import assert from 'node:assert/strict';
import test from 'node:test';
import {ShaderMaterial,Texture} from 'three';
import {churchGroundSun} from '../src/render/indian-river/church-ground-sun.ts';
import {prepareIndianRiverSunReceiver} from '../src/render/indian-river/church-ground-sun-receiver.ts';

const source='float light=1.;void main(){vec3 col=vec3(1.);col*=.90+.31*light;gl_FragColor=vec4(col,1.);}';
const mask=()=>{
 const m=churchGroundSun({x0:-28000,z0:5155,width:8,height:8,spacing:.40,tile:[10,11]},new Uint8Array(64));
 assert(m);return m;
};

test('the detached Indian River sun specialization shares the exact existing texture slots without rewriting stock',()=>{
 const stock=new ShaderMaterial({fragmentShader:source,uniforms:{imageMap:{value:new Texture()},detailReady:{value:0}}}),lit=mask();
 const {uniforms,fragmentShader,version}=stock;
 let retired=0;stock.addEventListener('dispose',()=>retired++);
 const draft=prepareIndianRiverSunReceiver(stock,lit);assert(draft&&draft.intact());
 assert.notEqual(draft.material,stock);
 assert.equal(stock.fragmentShader,fragmentShader);assert.equal(stock.version,version);
 assert.equal(stock.uniforms,uniforms);assert.deepEqual(Object.keys(uniforms),['imageMap','detailReady']);
 assert.equal(draft.material.uniforms.imageMap,uniforms.imageMap);
 assert.equal(draft.material.uniforms.churchSunMask,lit.uniforms.churchSunMask);
 assert.equal(draft.material.uniforms.churchSunLive,lit.live);
 assert.match(draft.material.fragmentShader,/else col\*=\.90\+\.31\*light;/);
 uniforms.detailReady.value=31;lit.live.value=1;
 assert.equal(draft.material.uniforms.detailReady.value,31);
 assert(draft.intact());
 stock.defines.UNRELATED=1;assert(!draft.intact());delete stock.defines.UNRELATED;
 const image=lit.uniforms.churchSunMask.value.image,original=image.data;
 image.data=original.slice();assert(!draft.intact());image.data=original;
 assert(draft.intact());
 uniforms.detailReady={value:0};assert(!draft.intact());
 draft.dispose();draft.dispose();assert.equal(retired,0);
 lit.uniforms.churchSunMask.value.dispose();stock.dispose();
});

test('unknown material or different terrain tile cannot borrow the Indian River light receiver',()=>{
 const stock=new ShaderMaterial({fragmentShader:source}),lit=mask();
 assert(!prepareIndianRiverSunReceiver(stock,{...lit,tile:[24,17]}));
 stock.fragmentShader=source.replace('col*=.90+.31*light;','col*=light;');
 assert(!prepareIndianRiverSunReceiver(stock,lit));
 stock.fragmentShader=source+'//col*=.90+.31*light;';
 assert(!prepareIndianRiverSunReceiver(stock,lit));
 stock.fragmentShader=source;stock.uniforms.churchSunMask={value:null};
 assert(!prepareIndianRiverSunReceiver(stock,lit));
 lit.uniforms.churchSunMask.value.dispose();stock.dispose();
});

import {readFileSync as read} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {INDIAN_RIVER_SOURCE as pin} from '../src/render/indian-river/indian-river-source.generated.ts';
import {indianRiverResidentTile,verifyIndianRiverResident} from '../src/render/indian-river/indian-river-live-owner.ts';

test('Indian River identifies the exact ordinary index and the already streamed compressed range',async()=>{
 const dir=new URL('../public/world/buildings/',import.meta.url);
 const index=Uint8Array.from(read(new URL('index.json',dir))).buffer;
 const raw=read(new URL('tiles.pack',dir)).subarray(pin.offset,pin.offset+pin.size);
 const body=Uint8Array.from(raw).buffer,atlas=JSON.parse(new TextDecoder().decode(index));
 const tile=atlas.tiles.find((t:{id:string})=>t.id===pin.tile);
 const rows=JSON.parse(gunzipSync(raw).toString()).features;
 assert(indianRiverResidentTile(atlas.sha256,tile));
 assert(await verifyIndianRiverResident(index,body,atlas.sha256,tile,rows));
 assert(!indianRiverResidentTile(atlas.sha256,{...tile,bounds:[tile.bounds[0]+.001,...tile.bounds.slice(1)]}));
 const oldIndex=index.slice(0),oldBody=body.slice(0);
 new Uint8Array(oldIndex)[1]^=16;new Uint8Array(oldBody)[4]^=1;
 assert(!await verifyIndianRiverResident(oldIndex,body,atlas.sha256,tile,rows));
 assert(!await verifyIndianRiverResident(index,oldBody,atlas.sha256,tile,rows));
 const foreign=[...rows];foreign[pin.ordinal]={...foreign[pin.ordinal],height:25};
 assert(!await verifyIndianRiverResident(index,body,atlas.sha256,tile,foreign));
});
