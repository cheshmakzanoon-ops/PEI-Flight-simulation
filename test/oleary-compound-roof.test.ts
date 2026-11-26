import {olearyCompoundRoofsRequested} from '../src/app/scenery-profile.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {compoundHeight,compoundRoof,compoundRoofEdge,compoundRoofTriangles} from '../src/render/oleary-compound-roofs.ts';
import {OLEARY_COMPOUND_ROOFS} from '../src/render/oleary-compound-roofs.generated.ts';

const v=(x:number,z:number)=>({x,z});
const area=(a:{x:number;z:number},b:{x:number;z:number},c:{x:number;z:number})=>
 ((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;
test('the upper envelope clips to lower visible planes before picking a winning roof section',()=>{
 const shapes=[[[5,0,0]],[[6,.4,0],[7,-.5,0],[6,0,.6],[8,0,-.4]]] as const;
 const centre=v(0,0),a=v(-6,-6),b=v(6,-6),c=v(0,6);
 const roof=compoundRoofTriangles([a,b,c],centre,shapes);
 assert(roof.length>3);
 assert(Math.abs(roof.reduce((sum,t)=>sum+area(...t),0)-area(a,b,c))<1e-8);
 for(const q of roof){
  const p=v(q.reduce((n,x)=>n+x.x,0)/3,q.reduce((n,x)=>n+x.z,0)/3);
  assert(Math.abs(compoundHeight(p,centre,shapes)-q.reduce((n,x)=>n+compoundHeight(x,centre,shapes),0)/3)<1e-9);
 }
 const sections=compoundRoofEdge(v(-6,0),v(6,0),centre,shapes);
 assert(sections.length>3);
 for(let i=1;i<sections.length;i++){
  const a=sections[i-1],b=sections[i],p=v((a.x+b.x)/2,(a.z+b.z)/2);
  assert(Math.abs(compoundHeight(p,centre,shapes)-(compoundHeight(a,centre,shapes)+compoundHeight(b,centre,shapes))/2)<1e-8);
 }
});
test('equal plane boundaries do not stack or skip mesh faces',()=>{
 const root=[[[5,0,0]],[[5,0,0],[5,1,0]],[[5,0,0],[5,0,1]]] as const;
 const a=v(-6,-6),b=v(6,-6),c=v(0,6);
 const exact=compoundRoofTriangles([a,b,c],v(0,0),root);
 assert(Math.abs(exact.reduce((n,t)=>n+area(...t),0)-area(a,b,c))<1e-8);
});
test('a supported envelope refuses edited, reversed, and different source outlines',()=>{
 const [ordinal,encoded]=OLEARY_COMPOUND_ROOFS[0];
 const ll:[number,number][]=[];
 for(let i=0;i<encoded.length;i+=2)ll.push([encoded[i]/1e6,encoded[i+1]/1e6]);
 assert(compoundRoof(ordinal,ll));
 assert.equal(compoundRoof(ordinal+1,ll),undefined);
 assert.equal(compoundRoof(ordinal,[ll[0],...ll.slice(1).reverse()]),undefined);
 assert.equal(compoundRoof(ordinal,[[ll[0][0]+1e-6,ll[0][1]],...ll.slice(1)]),undefined);
});


test('ordinary surveyed roofs leave alternate railway scenes and Detail stock',()=>{
 for(const [query,expected] of [
  ['departure=oleary-railway-low',true],['diagnostics&departure=oleary-railway-low',true],
  ['scenery=standard',true],['stockOlearyAccessRoof',true],
  ['stockOlearyExterior',false],['olearyExteriorStudy',false],['olearyWarehouseStudy',false],
  ['stockOlearyWarehouse',false],['scenery=detail',false],['surveyRelief',false],
  ['scenery=standard&scenery=detail',false],['qa={}',false],['qa={',false],
 ] as const)assert.equal(olearyCompoundRoofsRequested(new URLSearchParams(query)),expected,query);
});
