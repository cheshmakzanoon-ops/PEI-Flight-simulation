import assert from 'node:assert/strict';
import test from 'node:test';
import {TERMINAL_PROFILES,TERMINAL_WIDTH,TERMINAL_WIRE as P,terminalDrawAllows,terminalWireAllows,type TerminalAttr,type TerminalStream} from '../src/render/summerside-terminal/terminal-wall-owner.ts';
const flag=()=>{const a=new Float32Array(P.total);a.fill(1,P.wallEnd,P.last);return a;};
const draw=()=>Uint32Array.from(Array.from({length:P.total},(_,i)=>i).filter(i=>i<30618||i>=30666));
test('stock and index overlays may preserve exactly the same terminal triangles',()=>{
 assert(terminalDrawAllows(null,flag()));
 const rail=draw();const wharf=rail.filter(i=>!(i>=51228&&i<51429)&&!(i>=65946&&i<65988));
 assert(terminalDrawAllows(rail,flag()));
 assert(terminalDrawAllows(wharf,flag()));
 assert(terminalDrawAllows(Uint32Array.from(Array.from({length:P.total},(_,i)=>i)
   .filter(i=>!(i>=51228&&i<51429)&&!(i>=65946&&i<65988))),flag()));
 assert(!terminalDrawAllows(Uint32Array.from({length:P.last-P.first},(_,i)=>P.first+i),flag()));
 assert(!terminalDrawAllows(Uint32Array.from(Array.from({length:P.total},(_,i)=>i).filter(i=>i<102||i>=150)),flag()));
});
test('reject partial range, split triangles, duplicate/missing owner vertex and changed flags',()=>{
 const bad=flag();bad[P.first]=1;
 assert(!terminalDrawAllows(null,bad));
 assert(!terminalDrawAllows(null,flag(),3));
 assert(!terminalDrawAllows(null,flag(),0,Infinity,2));
 assert(!terminalDrawAllows(draw().slice(1),flag()));
 const d=draw(),i=d.indexOf(P.first);
 d[i]=73;
 assert(!terminalDrawAllows(d,flag()));
 d[i]=P.first+3;d[i+1]=P.first+4;d[i+2]=P.first+5;
 assert(!terminalDrawAllows(d,flag()));
 assert(!terminalDrawAllows(new Uint16Array(draw()),flag()));
});
test('matching an atlas and row count is not authority to alter a changed stream',async()=>{
 const r=new Array<unknown>(P.rows).fill(null);
 const streams=Object.fromEntries(Object.entries(TERMINAL_WIDTH).map(([k,w])=>[k,
  k==='topFlag'?flag():k==='facadeStyle'?new Uint8Array(P.total):new Float32Array(P.total*w)])) as Record<TerminalAttr,TerminalStream>;
 for(const x of [...TERMINAL_PROFILES,0])
  assert(!await terminalWireAllows(P.atlas,P.id,new ArrayBuffer(P.bytes),r,x,streams));
 assert(!await terminalWireAllows('fake',P.id,new ArrayBuffer(P.bytes),r,TERMINAL_PROFILES[0],streams));
});
