import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sceneryOptions,standardGreenGablesHouseRequested} from '../src/app/scenery-profile.ts';
import {greenGablesBarnStandardRequested} from '../src/render/green-gables-barn-gate.ts';
const src='?departure=cavendish-dunelands-low&diagnostics';
test('the ordinary House policy does not set the expansive legacy review flag or veto the Barn',()=>{
 const q=sceneryOptions(src),veto=sceneryOptions(src+'&stockGreenGablesHouse');
 assert(standardGreenGablesHouseRequested(q));
 assert(!standardGreenGablesHouseRequested(veto));
 assert(!q.has('greenGablesReview'));
 const justHouse=sceneryOptions(src+'&stockGreenGablesBarn');
 assert(standardGreenGablesHouseRequested(justHouse));
 assert(!greenGablesBarnStandardRequested(justHouse));
 assert.equal(greenGablesBarnStandardRequested(veto),greenGablesBarnStandardRequested(q));
 for(const suffix of ['&qa','&scenery=detail','&surveyRelief','&buildingShadows','&unknownStudy','&cavendishDetail','&greenGablesReview']){
  const alternate=sceneryOptions(src+suffix);
  assert(!standardGreenGablesHouseRequested(alternate),suffix);
 }
 assert(sceneryOptions(src+'&greenGablesReview&stockGreenGablesHouse').has('greenGablesReview'));
});

import {BufferAttribute,BufferGeometry,Float32BufferAttribute,Mesh,MeshBasicMaterial} from 'three';
import {CavendishBarnViews,retireCavendishHouseView} from '../src/render/cavendish-owner-views.ts';
test('a refused shared owner releases only its exact House and Barn indices',()=>{
 const stock=new BufferGeometry();
 stock.setAttribute('position',new Float32BufferAttribute(new Float32Array(18*3),3));
 const house=new BufferAttribute(new Uint16Array([0,1,2,3,4,5,9,10,11,12,13,14,15,16,17]),1);
 const now=new Mesh(stock,new MeshBasicMaterial());
 stock.setIndex(house);
 const variants=new CavendishBarnViews(stock,[3,6]);
 const both=variants.withBarn(house)!;
 now.geometry=both;
 // A foreign material is not authority over the cohort's installed index.
 const material=new MeshBasicMaterial();now.material=material;
 assert(retireCavendishHouseView(now,stock,house,variants));
 assert.equal(now.geometry,stock);assert.equal(stock.getIndex(),null);assert.equal(now.material,material);
 const newGeometry=stock.clone();
 now.geometry=newGeometry;
 const newIndex=new BufferAttribute(new Uint16Array([0,1,2]),1);newGeometry.setIndex(newIndex);
 assert.equal(retireCavendishHouseView(now,stock,house,variants),false);
 assert.equal(now.geometry,newGeometry);assert.equal(newGeometry.getIndex(),newIndex);
 now.geometry=both;both.setIndex(newIndex);
 assert.equal(retireCavendishHouseView(now,stock,house,variants),false);
 assert.equal(now.geometry,both);assert.equal(both.getIndex(),newIndex);
});
