import assert from 'node:assert/strict';
import test from 'node:test';
import {mappedHedgeShadowsAvoidGrade} from '../src/render/indian-river/st-marys-hedge-guard.ts';

test('none of the actual mapped hedge roots or shadow corners can borrow the four tree receivers',()=>{
 const bounds=[-36068,2539,-35960,2644] as const;
 const stems=new Float32Array([-36050,28,2554,-36092,28,2600,-35934,29,2600]),shape=new Float32Array([8,9,2,1,4,3,2,1,4,3,2,1]);
 assert(mappedHedgeShadowsAvoidGrade(bounds,stems,shape,1,3),'the ordinary tree slot is not classified as hedge');
 assert(!mappedHedgeShadowsAvoidGrade(bounds,stems,shape,0,3));
 stems[3]=-36069;assert(!mappedHedgeShadowsAvoidGrade(bounds,stems,shape,1,3),'the root alone would miss; its real footprint does not');
 stems[3]=-36092;stems[6]=NaN;assert(!mappedHedgeShadowsAvoidGrade(bounds,stems,shape,1,3));
 assert(!mappedHedgeShadowsAvoidGrade(bounds,stems,shape,2,4));
 assert(mappedHedgeShadowsAvoidGrade(bounds,stems,shape,1,1),'with no appended slots the original lineup is unchanged');
});
