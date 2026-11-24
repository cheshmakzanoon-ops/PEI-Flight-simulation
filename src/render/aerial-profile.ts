/** Preserve independent shadow, imagery and Detail comparisons. */
export function aerialPerspectiveRequested(q:URLSearchParams){
 if(q.get('scenery')==='detail'||q.has('stockAerialPerspective'))return false;
 return q.has('aerialPerspectiveStudy')||!q.has('buildingShadows')&&!q.has('orthophotoSeamStudy');
}

/** A hung or rejected optional JS dependency cannot prevent Standard flight.
 * The settled result does not change if the module finally arrives later. */
export async function loadAerialModule<T>(loader:()=>Promise<T>,timeoutMs=1200){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([
   Promise.resolve().then(loader).catch(()=>undefined),
   new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),timeoutMs);}),
  ]);
 }finally{if(timer!==undefined)clearTimeout(timer);}
}
