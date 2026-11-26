import {test} from 'node:test';import assert from 'node:assert/strict';
import {terminalRooflessWallShader,TERMINAL_WALL_SPAN} from '../src/render/summerside-terminal/terminal-wall-tone.ts';
const vertex='#include <common>\nvoid main(){\n#include <logdepthbuf_vertex>\n}';
const fragment='#include <common>\nfloat area(float p,float a,float b){return 0.;}\nvoid main(){if(facade>71.5&&facade<74.5){shadeHangar4(c,wp,uv2d,facade,d);}else if(roof<.5)fakeWindow();}';
test('owner boundaries immutable; no geometry input or texture; only target walls skip branches',()=>{
 const r=terminalRooflessWallShader(vertex,fragment);assert(r);
 assert.match(r.vertex,/gl_VertexID>=5046 && gl_VertexID<5490/);
 assert.match(r.fragment,/uniform float terminalWallLive;/);
 assert.match(r.fragment,/if\(terminalWallLive>.5&&q68OuterWall>.5&&roof<.5\)/);
 assert(r.fragment.endsWith('if(roof<.5)fakeWindow();}'));
 assert.equal(TERMINAL_WALL_SPAN.end-TERMINAL_WALL_SPAN.start,444);
 assert(!r.fragment.includes('sampler'));
});
test('unknown shader, duplicate hook, or different creator are left stock',()=>{
 const r=terminalRooflessWallShader(vertex,fragment)!;
 assert.equal(terminalRooflessWallShader(r.vertex,r.fragment),undefined);
 assert.equal(terminalRooflessWallShader(vertex,fragment.replace('71.5','70.5')),undefined);
 assert.equal(terminalRooflessWallShader(vertex+'#include <common>',fragment),undefined);
});
