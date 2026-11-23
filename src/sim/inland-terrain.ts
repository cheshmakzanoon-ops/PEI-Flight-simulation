import {INLAND_SPECS} from './inland-surveys.generated.ts';
import {readCoastalPack} from './coastal-packs.ts';
import type {MeshSurveySource} from './coastal-terrain.ts';

export async function loadInlandSurveys(base:string,fetcher:typeof fetch=fetch,timeoutMs=2200){
 const records=await Promise.all(INLAND_SPECS.map(async spec=>{
  const data=await readCoastalPack(base+'inland/v1/'+spec.id+'.i16.gz',fetcher,timeoutMs,spec,raw=>{
   const read=new DataView(raw),samples=new Int16Array(raw.byteLength/2);
   for(let j=0;j<samples.length;j++)samples[j]=read.getInt16(j*2,true);
   return samples;
  });
  return data?({spec,samples:data} as MeshSurveySource):undefined;
 }));
 return records.filter((r):r is MeshSurveySource=>!!r);
}
