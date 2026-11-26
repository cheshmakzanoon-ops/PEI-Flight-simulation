import type {BufferGeometry} from 'three';

/** Exact owner and one existing outer wall only. Does not qualify appearance or replace geometry. */
const SCOPE=Object.freeze({"atlas":"538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557","wire":"c8024e0feff5779754c8ba4268c0f95b11e2a371a11dd3877a3f65d6d8e3c393","id":"q130333","count":270,"offset":3149036,"bytes":11110,"bounds":[-62.28727,46.35682,-62.247545,46.374566],"ordinal":32,"sourceEdge":26,"height":12.06,"minHeight":2.25,"footprint":[[-62.251286,46.358076],[-62.25131,46.358099],[-62.250762,46.358368],[-62.250743,46.358348],[-62.250531,46.358449],[-62.250433,46.358351],[-62.250259,46.358433],[-62.250228,46.358403],[-62.250248,46.358393],[-62.250167,46.35831],[-62.250125,46.35833],[-62.250119,46.358324],[-62.250305,46.358232],[-62.250166,46.358097],[-62.250119,46.358121],[-62.250092,46.358095],[-62.250039,46.358121],[-62.249902,46.357987],[-62.250169,46.357856],[-62.250115,46.357803],[-62.249674,46.358017],[-62.249497,46.357842],[-62.250026,46.357585],[-62.250066,46.357618],[-62.250163,46.357562],[-62.250147,46.357549],[-62.250492,46.357318],[-62.250901,46.35761],[-62.25058,46.357826],[-62.250446,46.35773],[-62.250644,46.357995],[-62.250612,46.358011],[-62.250757,46.358149],[-62.2509,46.358077],[-62.250878,46.358056],[-62.251137,46.357927],[-62.251194,46.35798],[-62.251225,46.357964],[-62.251323,46.358057]]});
type Entry={footprint:readonly (readonly number[])[];height:number;minHeight?:number;holes?:unknown};
type Tile={id:string;offset:number;bytes:number;count:number;bounds:readonly number[]};

export function sourisFacingOwnerTile(atlas:string|undefined,tile:Tile){
 return atlas===SCOPE.atlas&&tile.id===SCOPE.id&&tile.offset===SCOPE.offset&&tile.bytes===SCOPE.bytes&&
   tile.count===SCOPE.count&&tile.bounds.length===SCOPE.bounds.length&&SCOPE.bounds.every((v,i)=>tile.bounds[i]===v);
}
/** wire is the digest of the same unaltered gzip chunk whose fully decoded features are passed. */
export function sourisFacingAdmittedEdge(atlas:string|undefined,tile:Tile,wire:string|undefined,features:readonly Entry[]){
 if(!sourisFacingOwnerTile(atlas,tile)||wire!==SCOPE.wire||features.length!==SCOPE.count)return;
 const f=features[SCOPE.ordinal];
 if(!f||f.height!==SCOPE.height||f.minHeight!==SCOPE.minHeight||f.holes!==undefined||
  f.footprint.length!==SCOPE.footprint.length||!SCOPE.footprint.every(([x,y],k)=>{
   const p=f.footprint[k];return p?.length===2&&p[0]===x&&p[1]===y;
 }))return;
 return {ordinal:SCOPE.ordinal,edge:SCOPE.sourceEdge};
}

// Six emitted vertices after the original float32 receiver conversion.
const FACE=[
 ["position",3,[1298.4776611328125,26.087697982788086,930.9740600585938,1298.4776611328125,39.81220245361328,930.9740600585938,1267.081787109375,39.81220245361328,898.5150146484375,1298.4776611328125,26.087697982788086,930.9740600585938,1267.081787109375,39.81220245361328,898.5150146484375,1267.081787109375,26.127748489379883,898.5150146484375]],
 ["uv",2,[0,0,0,13.724505424499512,45.15851593017578,13.684453964233398,0,0,45.15851593017578,13.684453964233398,45.15851593017578,0]],
 ["color",3,Array.from({length:6},()=>[0.520995557308197,0.533276379108429,0.4507857859134674]).flat()],
 ["topFlag",1,Array.from({length:6},()=>[0]).flat()],
 ["normal",3,Array.from({length:6},()=>[-0.7187803387641907,0,0.6952372193336487]).flat()],
] as const;

export function sourisFacingExactSurface(geometry:BufferGeometry){
 for(const [name,width,values] of FACE){
  const a=geometry.getAttribute(name);
  if(!a||a.itemSize!==width||a.count!==13953||a.normalized||!(a.array instanceof Float32Array))return false;
  for(let i=0;i<values.length;i++)if(a.array[1989*width+i]!==values[i])return false;
 }
 return true;
}
