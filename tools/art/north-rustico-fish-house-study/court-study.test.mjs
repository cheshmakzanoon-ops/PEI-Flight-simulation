import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Vector3,Raycaster,MeshStandardMaterial} from 'three';
import {COURT_FISH_HOUSE_STUDY,courtDocumentedOpeningNames,originalCourtCore,makeCourtFishHouseStudy} from './court-fishhouse-study.ts';

const locked=JSON.parse(readFileSync(new URL('./study-evidence.json',import.meta.url),'utf8')),fit=locked;
const core=makeCourtFishHouseStudy(),period=makeCourtFishHouseStudy('documented-2009');
const sections=Object.fromEntries(core.children.map(m=>[m.name,m])),historic=Object.fromEntries(period.children.map(m=>[m.name,m]));
const {cornersUV:C,ridgeY,ridgeV,du,dv}=originalCourtCore();
assert.deepEqual(C,locked.frame.exactFederalUV);
const q=(p)=>[p.z*-1,p.x];
const Y=(u,v)=>ridgeY+du*u+dv*Math.abs(v-ridgeV);
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const interior=(p,gard=0)=>C.every((a,i)=>orient(a,C[(i+1)%4],p)>gard);
const sha=a=>createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const positions=m=>m.geometry.attributes.position;
const to=(a,i)=>new Vector3().fromBufferAttribute(a,i);
const kinds=g=>g.children.map(m=>[m.name,positions(m).count/3]);
const reach=(g,p,d)=>new Raycaster(p,d,0,40).intersectObjects(g.children,false)[0];

test('detached scope, single signed metric hull, exact 2020 slope deltas, 2009 scope separately named',()=>{
 assert.equal(du,fit.rawAbsolute.equationUvM[1]);
 assert.equal(dv,fit.rawAbsolute.equationUvM[2]);
 assert.ok(Math.abs(ridgeV-fit.rawAbsolute.equationUvM[3])<1e-12);
 assert.equal(COURT_FISH_HOUSE_STUDY.localFloorAuthority,'none');
 assert.equal(courtDocumentedOpeningNames.length,new Set(courtDocumentedOpeningNames).size);
 assert.equal(courtDocumentedOpeningNames.length,13);
 for(const g of [core,period]){
  assert.equal(g.parent,null);assert.deepEqual(g.position.toArray(),[0,0,0]);assert.ok(g.quaternion.isIdentity?.()??g.quaternion.w===1);
  assert.deepEqual(g.scale.toArray(),[1,1,1]);assert.match(g.name,/detached historic study/);
  for(const m of g.children){
   const pos=positions(m),counts=[pos.count,m.geometry.attributes.normal.count,m.geometry.attributes.uv.count];
   assert.equal(new Set(counts).size,1);assert.equal(pos.count%3,0);assert.equal(m.geometry.index,null);
   assert.equal(m.material.transparent,false); assert.equal(m.material.opacity,1);
   assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);
   assert(m.geometry.attributes.uv.array.every(Number.isFinite));
   for(let i=0;i<pos.count;i++){
    const p=to(pos,i);assert(p.toArray().every(Number.isFinite));assert(interior(q(p),-6e-6),m.name+' escapes q633 footprint '+p.toArray());
    assert.ok(p.y>=0);
   }
  }
 }
 for(const n of ['court / core/roof','court / core/soffit'])for(const k of ['position','normal','uv']){
  const a=sections[n].geometry.attributes[k].array,b=historic[n].geometry.attributes[k].array;
  assert.deepEqual(a,b,n+' '+k);
 }
});

test('every emitted triangle has measurable area and appropriate native facing',()=>{
 const palette={};
 for(const g of [core,period]){
  let min=Infinity;
  for(const m of g.children){
   const a=positions(m),n=m.geometry.attributes.normal;
   for(let i=0;i<a.count;i+=3){
    const roots=[to(a,i),to(a,i+1),to(a,i+2)];
    const N=roots[1].clone().sub(roots[0]).cross(roots[2].clone().sub(roots[0]));
    min=Math.min(min,N.length());
    assert.ok(N.length()>1e-7,m.name+' degeneracy at '+i);
    for(let j=0;j<3;j++)assert.ok(N.clone().normalize().dot(to(n,i+j))>.99999);
    if(m.name.endsWith('/roof'))assert(N.y>0,m.name);
    if(m.name.endsWith('/soffit'))assert(N.y<0,m.name);
   }
  }
  palette[g.userData.era]=min;
 }
 assert(palette['roof-core']>5);
});

test('core closed up to Float32 tolerance after splitting collinear T-junctions, correct opposite signed half-edges',()=>{
 const points=new Map(),faces=[];
 const key=p=>p.toArray().map(x=>Math.round(x*1000000)).join(',');
 for(const m of core.children){
  const pos=positions(m);
  for(let i=0;i<pos.count;i+=3){
   const F=[];
   for(let j=0;j<3;j++){
    const p=to(pos,i+j),k=key(p);if(!points.has(k))points.set(k,p);F.push(k);
   }
   faces.push(F);
  }
 }
 const E=new Map();
 for(const F of faces)for(let k=0;k<3;k++){
  const a=F[k],b=F[(k+1)%3],p=points.get(a),w=points.get(b).clone().sub(p),den=w.lengthSq();
  const nodes=[[0,a],[1,b]];
  for(const [l,x]of points)if(l!==a&&l!==b){
   const d=x.clone().sub(p),t=d.dot(w)/den;
   if(t>1e-6&&t<1-1e-6&&d.distanceTo(w.clone().multiplyScalar(t))<1e-6)nodes.push([t,l]);
  }
  nodes.sort((a,b)=>a[0]-b[0]);
  for(let j=1;j<nodes.length;j++){
   const a=nodes[j-1][1],b=nodes[j][1],sign=a<b?1:-1,s=a<b?a+'|'+b:b+'|'+a;
   const e=E.get(s)??[0,0];e[0]++;e[1]+=sign;E.set(s,e);
  }
 }
 for(const [e,n]of E)assert.deepEqual(n,[2,0],e);
 assert.equal(points.size-E.size+faces.length,2); // exactly two long collinear boundary-edge splits
});

test('analytic detached roof and registered SE-only art witness, 100% underside coverage',t=>{
 period.updateMatrixWorld(true);core.updateMatrixWorld(true);
 const down=new Vector3(0,-1,0),up=down.clone().negate();
 let compared=0,higher=0,min=Infinity,max=-Infinity;
 for(let u=-6;u<=6;u+=.17)for(let v=-3.31;v<=3.33;v+=.16){
  if(!interior([u,v],.003))continue;
  const start=new Vector3(v,17,-u);
  const c=reach(core,start,down),h=reach(period,start,down);
  assert(c&&h);
  assert.equal(c.object.name,'court / core/roof');
  assert(Math.abs(c.point.y-Y(u,v))<1e-6);
  const rise=h.point.y-c.point.y;
  if(u>-.18&&u<2.05&&v>.78&&v<2.49){
   assert.equal(h.object.name,'court / period/roof');
   assert(rise>.09);higher++;min=Math.min(min,rise);max=Math.max(max,rise);
  }else assert.equal(rise,0);
  for(const g of [core,period]){
   const under=reach(g,new Vector3(v,-2,-u),up);
   assert(under);assert.equal(under.object.name,'court / core/soffit');assert.equal(under.point.y,0);
  }
  compared++;
 }
 assert(compared>2_800&&higher>110);
 t.diagnostic(JSON.stringify({compared,higher,localSchematicDormerYGain:[min,max]}));
});

test('both variants opaque on all four walls; old era openings physically inset, no silhouette escape',t=>{
 const gr={};
 for(let j=0;j<4;j++){
  const a=C[j],b=C[(j+1)%4],
   d=new Vector3(b[0]-a[0],0,b[1]-a[1]).normalize(), side=['SE long side','SW gable','NW long side','NE gable'][j];
  let inset=0,rays=0,maxDepth=0;
  for(let t=.021;t<.981;t+=.012){
   const u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t;
   for(let y=.065;y<Y(u,v)-.039;y+=.103){
    const start=new Vector3(v,y,-u).addScaledVector(d,-2);
    const cc=reach(core,start,d),hh=reach(period,start,d);
    assert(cc&&hh,side);
    assert(Math.abs(cc.distance-2)<3e-6,side+' core');
    const deep=hh.distance-2;rays++;
    assert(deep>=-3e-6&&deep<=.14801,side+' period '+deep);
    if(deep>.08){inset++;maxDepth=Math.max(maxDepth,deep);}
   }
  }
  assert(inset>12&&rays>=2600,side+" "+JSON.stringify({rays,inset,maxDepth}));
  gr[side]={rays,inset,maxDepth};
 }
 t.diagnostic(JSON.stringify(gr));
});

test('native Three finish selection and exact metric UV isometry for each roof plane',t=>{
 const roles=new Set(),sample=new MeshStandardMaterial({color:'#aaa1a0'});
 const conventional=makeCourtFishHouseStudy('documented-2009',role=>{
  roles.add(role);return role==='roof'?sample:undefined;
 });
 assert.deepEqual(roles,new Set(['roof','soffit','trim','shingle','glazing','door','plywood']));
 for(const m of conventional.children)assert.equal(m.material===sample,m.name.endsWith('/roof'));
 for(const m of [sections['court / core/roof'],historic['court / period/roof']]){
  const p=positions(m),t=m.geometry.attributes.uv;
  for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){
   const a=i+j,b=i+(j+1)%3,d=to(p,a).distanceTo(to(p,b)),z=Math.hypot(t.getX(a)-t.getX(b),t.getY(a)-t.getY(b));
   assert(Math.abs(d-z)<2e-6,m.name+' metric UV');
  }
 }
 t.diagnostic(JSON.stringify({core:kinds(core),period:kinds(period),
  roofPositionSha:sha(positions(sections['court / core/roof']).array),roofUVSha:sha(sections['court / core/roof'].geometry.attributes.uv.array)}));
});


test('original material options leave every stock shell attribute and no photo texture',async()=>{
 const {courtFinish,patchCourtFinish}=await import('./court-finish.ts');
 const {ShaderLib}=await import('three');
 const allowed=new Set(['shingle','roof','plywood','trim']);
 const study=makeCourtFishHouseStudy('documented-2009',role=>allowed.has(role)?courtFinish(role):undefined);
 for(let i=0;i<study.children.length;i++){
  const a=study.children[i],b=period.children[i];
  assert.equal(a.name,b.name);
  for(const key of ['position','uv','normal'])assert.equal(sha(a.geometry.getAttribute(key).array),sha(b.geometry.getAttribute(key).array));
  assert.equal(a.material.map,null);assert.equal(a.material.transparent,false);
  if(allowed.has(a.userData.role)){
   const patched=patchCourtFinish(ShaderLib.standard.vertexShader,ShaderLib.standard.fragmentShader,a.userData.role);
   assert.match(patched.fragment,/courtNoise/);
   assert.equal(patchCourtFinish(patched.vertex,patched.fragment,a.userData.role),undefined);
  }
 }
});
