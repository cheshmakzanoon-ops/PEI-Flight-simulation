/** Actual bundled UI constructor smoke with a small DOM stand-in. No browser. */
import assert from 'node:assert/strict';
import {UI} from '../../src/app/ui.ts';
import {SITES} from '../../src/sim/places.ts';
import {POINT_PRIM_DEPARTURE} from '../../src/render/point-prim/admit.ts';
function layout(search,includeOptional){
 const nodes=new Map(),actions={called:[]};
 const getElementById=id=>{
  if(!nodes.has(id))nodes.set(id,{dataset:{},style:{},value:'',innerHTML:'',
   querySelector:()=>({style:{}}),classList:{toggle(){}}});
  return nodes.get(id);
 };
 globalThis.document={getElementById,querySelectorAll:()=>[]};
 globalThis.Image=class {};
 globalThis.location={search,href:'https://example.test/'+search};
 const input={clear(){},touch:{}};
 const list=includeOptional?[...SITES,POINT_PRIM_DEPARTURE]:undefined;
 const ui=new UI({spec:{}},input,{start:i=>actions.called.push(i),resume(){},view(){},sound(){},pause(){},restart(){},
  engineState:()=>({out:false,airborne:false}),practiceFailure(){}},list);
 return {ui,read:getElementById,actions};
}
const route='departure='+POINT_PRIM_DEPARTURE.id;
for(const suffix of ['', '&stockPointPrim']){
 const {ui,read,actions}=layout('?'+route+'&pointPrimStudy'+suffix,true);
 assert.equal(ui.mode,'dispatch');assert.equal(ui.selected,SITES.length);
 assert.equal(read('site-note').textContent,POINT_PRIM_DEPARTURE.note);
 assert.equal(read('loc-name').textContent,POINT_PRIM_DEPARTURE.name);
 assert.match(read('ui').innerHTML,new RegExp('<option value="'+SITES.length+'">Point Prim'));
 read('start').onclick();assert.deepEqual(actions.called,[SITES.length]);
 ui.toggle('map');
 assert.match(read('modal').innerHTML,new RegExp('<option value="'+SITES.length+'">Point Prim'));
 ui.close();
 read('site').value='0';read('site').onchange();
 assert.equal(ui.selected,0);assert.equal(read('site-note').textContent,SITES[0].note);
}
const q=layout('?'+route,false);
assert.equal(q.ui.selected,0);
assert.equal(q.read('site-note').textContent,SITES[0].note);
assert(!q.read('ui').innerHTML.includes(POINT_PRIM_DEPARTURE.name));
assert(!SITES.some(s=>s.id===POINT_PRIM_DEPARTURE.id));
console.log(JSON.stringify({studyDispatch:true,stockControlDispatch:true,ordinaryListUnchanged:true,beginFlightIndex:SITES.length,mapSelection:true}));
