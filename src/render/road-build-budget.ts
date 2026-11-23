/** Advance deterministic geometry work at pre-existing safe yield boundaries.
 * One segment or final buffer phase may overrun; no extra work starts late. */
export function advanceRoadBuild<T>(build:Generator<void,T>,deadline:number,now:()=>number=()=>performance.now()){
 let steps=0;
 while(now()<deadline){
  const result=build.next();
  steps++;
  if(result.done)return {done:true,value:result.value,steps} as const;
 }
 return {done:false,steps} as const;
}
export const ROAD_BUILD_SLICE_MS=4;
