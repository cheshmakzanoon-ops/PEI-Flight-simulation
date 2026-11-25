import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const entries=['README.md','docs/WORLD.md','docs/PRODUCTION.md'] as const;
const root=new URL('../',import.meta.url);
function localDestinations(text:string){
 const clean=text.replace(/^\s*(?:```|~~~)[^\n]*\n[\s\S]*?^\s*(?:```|~~~)\s*$/gm,'');
 // The entry pages use ordinary inline Markdown paths. This check does
 // not crawl external sources, validate hash fragments or enforce prose.
 return [...clean.matchAll(/!?\[([^\]\n]+)\]\((<?[^<>\s)]+>?)\)/g)]
   .map((m)=>({label:m[1],target:m[2].replace(/^<|>$/g,'')}))
   .filter(({target})=>!target.startsWith('#')&&!target.startsWith('//')&&!/^[a-z][a-z\d+.-]*:/i.test(target));
}

test('the three project entry documents link to existing local files and images',()=>{
 const missing:string[]=[];
 for(const entry of entries){
  const source=new URL(entry,root);
  const from=readFileSync(source,'utf8');
  for(const {label,target} of localDestinations(from)){
   const location=new URL(target,source);
   location.hash='';location.search='';
   if(!existsSync(location))missing.push(`${entry}: [${label}](${target})`);
  }
 }
 assert.deepEqual(missing,[]);
});
