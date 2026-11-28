import {REVISION,RGFormat,HalfFloatType,LinearFilter,ClampToEdgeWrapping,NoColorSpace} from 'three';
import {getDFGLUT} from 'three/src/renderers/shaders/DFGLUTData.js';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
assert.equal(REVISION,'187');
const tex=getDFGLUT(),{data,width,height}=tex.image;
assert(data instanceof Uint16Array);
assert.equal(width,16);assert.equal(height,16);assert.equal(data.length,512);
assert.equal(tex.format,RGFormat);assert.equal(tex.type,HalfFloatType);assert.equal(tex.colorSpace,NoColorSpace);
assert.equal(tex.flipY,false);assert.equal(tex.unpackAlignment,1);assert.equal(tex.generateMipmaps,false);
assert.equal(tex.wrapS,ClampToEdgeWrapping);assert.equal(tex.wrapT,ClampToEdgeWrapping);
assert.equal(tex.minFilter,LinearFilter);assert.equal(tex.magFilter,LinearFilter);
const output=resolve(process.argv[2]??'.');
const payload=Buffer.alloc(data.length*2);data.forEach((a,i)=>payload.writeUInt16LE(a,i*2));
writeFileSync(resolve(output,'r187-dfg.rg16f'),payload,{flag:'wx'});
const out={sha256:createHash('sha256').update(payload).digest('hex'),bytes:payload.length,width,height,
 format:'RG16F internal, RG/HALF_FLOAT source',filter:'LINEAR',wrap:'CLAMP_TO_EDGE',mips:false,
 flipY:false,colorspace:'none',exactRendererSource:'Three r187 DFGLUTData.getDFGLUT()'};
writeFileSync(resolve(output,'r187-dfg.json'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(out);
