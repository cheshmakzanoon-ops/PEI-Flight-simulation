import {test} from 'node:test';
import assert from 'node:assert/strict';
import {downtownFacade} from '../src/render/facade.ts';
test('inferred downtown facades remain bounded and use deterministic height families',()=>{
 assert.equal(downtownFacade(-61.972,46.452,6,0),0);
 assert.equal(downtownFacade(-64.387,46.620,6,0),0);
 assert.equal(downtownFacade(-63.121,46.232,6,0),1);
 assert.equal(downtownFacade(-63.121,46.232,12,0),2);
 assert.equal(downtownFacade(-63.121,46.232,12,1),3);
 assert.equal(downtownFacade(-63.121,46.232,22,0),4);
 assert.equal(downtownFacade(-63.121,46.232,22,1),5);
});
