/** Same-stock generator CPU custody only; no scene mounted or native owner read. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {registerHooks} from 'node:module'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {MeshBasicMaterial,REVISION} from 'three'
const [repo,out]=process.argv.slice(2)
assert.equal(REVISION,'187')
const p=(f)=>resolve(repo,f)
const h=b=>createHash('sha256').update(b).digest('hex')
const buf=(f)=>readFileSync(p(f))
registerHooks({resolve(spec,ctx,next){
 if(spec==='three'||spec.startsWith('three/'))return next(spec,{...ctx,parentURL:import.meta.url})
 return next(spec,ctx)
}})
const imp=f=>import(pathToFileURL(p('src/'+f)))
const [{Buildings},{Terrain},{project,geographic},{supportedRoofAtlas},{farmRoofAtlas},{homeRoofAtlas}]=await Promise.all(
 ['render/buildings.ts','sim/terrain.ts','sim/geo.ts','sim/fitted-roofs.ts','render/farm-shells.ts','render/home-envelopes.ts'].map(imp))
const root='public/world/'
const idx=buf(root+'buildings/index.json'), pack=buf(root+'buildings/tiles.pack'), spec=JSON.parse(buf(root+'terrain.json'))
const atlas=JSON.parse(idx), row=atlas.tiles.find(e=>e.id==='q2232'), wire=pack.subarray(row.offset,row.offset+row.bytes)
assert.equal(h(idx),'fcc2bb4d890eafd08ac41136a3bff7bebeafe2f9c25a066fdcf756ed39badce0')
assert.equal(h(pack),atlas.sha256)
assert.equal(h(wire),'546d40a7045ce55492e065c543ce72bdac489416e2c992a52a57fddfac77c899')
const rows=JSON.parse(gunzipSync(wire)).features
assert.equal(rows.length,16)
const packed=gunzipSync(buf(root+'height.bin.gz'))
const stockHeight=h(packed)
assert.equal(stockHeight,'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d')
const t=new Terrain(spec,new Int16Array(packed.buffer,packed.byteOffset,packed.length/2))
const [w,s,e,n]=row.bounds,a=project(w,n),b=project(e,s)
const cfg={...row,x1:a.x,x2:b.x,z1:a.z,z2:b.z}, ordinates=[2,4,5,9,10,13,14], mat=new MeshBasicMaterial()
const g=new Map()
const trimmed=new Map()
for(const i of ordinates){
 const opts={t,mat,atlasHash:atlas.sha256,fitted:supportedRoofAtlas(atlas.sha256),farms:farmRoofAtlas(atlas.sha256),homes:homeRoofAtlas(atlas.sha256)}
 const m=Object.assign(Object.create(Buildings.prototype),opts).generate(rows,cfg,false,i,false,row.sha256)
 assert.equal(m.parent,null)
 const attrs=['position','normal','color','uv','topFlag','facadeStyle']
 const bytes=(v)=>Buffer.from(v.buffer,v.byteOffset,v.byteLength)
 const a=Object.fromEntries(attrs.map(k=>[k,h(bytes(m.geometry.getAttribute(k).array))]))
 if(g.has('whole'))assert.deepEqual(g.get('whole'),a);else g.set('whole',a)
 const slice=m.userData.beaconTriangles, pos=m.geometry.attributes.position
 assert(slice.every(j=>j>=0&&j%3===0)&&slice[1]>slice[0]&&slice[1]<=pos.count)
 const partial=Object.fromEntries(attrs.map(k=>{
   const at=m.geometry.getAttribute(k)
   return [k,h(bytes(at.array.subarray(slice[0]*at.itemSize,slice[1]*at.itemSize)))]
 }))
 const origin=m.position.toArray(), relative=Array.from(pos.array.subarray(3*slice[0],3*slice[1]))
 const positions=Array.from({length:relative.length/3},(_,k)=>[0,1,2].map(j=>relative[3*k+j]+origin[j]))
 const roof=Array.from(m.geometry.attributes.topFlag.array.subarray(...slice)), centroid=rows[i].footprint.reduce((acc,p)=>[acc[0]+p[0]/rows[i].footprint.length,acc[1]+p[1]/rows[i].footprint.length],[0,0])
 const c=project(...centroid)
 trimmed.set(i,{record:rows[i],rowSHA:h(JSON.stringify(rows[i])),centroid,world:[c.x,c.z],origin,span:slice,n:pos.count,
   relativeBounds: [0,1,2].map(j=>{const a=relative.filter((_,k)=>k%3===j);return [Math.min(...a),Math.max(...a)]}),
   xyz:positions,roof,tilerMeshY:t.meshElevation(c.x,c.z),hashes:partial})
 m.geometry.dispose()
}
mat.dispose();
assert.equal(trimmed.size,7)
writeFileSync(out,JSON.stringify({scope:'Offline emitted stock CPU reconstruction; no actual role-marked driver submission. Existing terrain physics unmodified.',
  recorder:{index:h(idx),atlas:atlas.sha256,record:row,revision:REVISION,stockHeight}, all:[...g.values()][0], ordinals:Object.fromEntries(trimmed)},null,2)+'\n',{flag:'wx'})
