/** Runtime constants independent of the additive renderer and its loader. */
export type CanopyBox=readonly [west:number,north:number,east:number,south:number];
export type RegionalStand={
 readonly id:string;readonly county:'Queens'|'Kings';readonly center:readonly [number,number];
 readonly owner:string;readonly efiSha:string;readonly bounds:CanopyBox;readonly canopyBounds:CanopyBox;
 readonly seats:readonly [number,number];readonly stockCount:number;readonly stockSha:string;
 readonly file:string;readonly count:number;readonly wireBytes:number;readonly wireSha:string;readonly decodedBytes:number;readonly decodedSha:string;
};
/** Original crowns over two independently fenced 2020 inventory stands. No new texture sources. */
export const REGIONAL_STANDS=[{
 id:'0911576',county:'Queens',center:[-13634.802037669377,10983.273661246612],
 owner:'13-13',efiSha:'ff1d9badde7c036815956fedd778820f7647399baff8afac3f59a7bc46d74c26',
 bounds:[-13778.2306,10714.335,-13470.7545,11240.3819],canopyBounds:[-13772,10720,-13477,11237],seats:[29,56.5],
 stockCount:1081,stockSha:'3cf79412600fa645d0fe1cb861ea248243e464a1a0b6003258c097abb0670b7b',
 file:'0911576-canopy-v2.rcv.gz',count:364,wireBytes:4613,wireSha:'81468d460e296a6edc28556057f88a3db61bcbd829331599cb3a982c1364df93',
 decodedBytes:5836,decodedSha:'c5db92407762a3d205cb2891a4af8722d83c8936679cf5c11ca6756a1397b70a',
},{
 id:'1900486',county:'Kings',center:[78977.95154228856,10227.377907960199],
 owner:'28-13',efiSha:'6b9e194428f793f533ca11d3a2c559e83c14c293565085da7562a36fdfb634b1',
 bounds:[78810.82,10100.0583,79141.5947,10318.4432],canopyBounds:[78816,10107,79133,10312],seats:[43,50],
 stockCount:507,stockSha:'4da1da8c3adc60724bea10998601b764f6ef7fcd31f27e8862ef6f57056fbacb',
 file:'1900486-canopy-v2.rcv.gz',count:201,wireBytes:2537,wireSha:'1aeee66d3e93b3197283ab034c1c165e619767ce9e0acf845d2f7677a0a6fc93',
 decodedBytes:3228,decodedSha:'435cc3b50f0242816784c294c8a3b91e436f8638f12471cc973d05b58f36a2d7',
}] as const satisfies readonly RegionalStand[];
export const REGIONAL_SOURCE={
 terrain:'661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d',
 cover:'46a4f4736a885576fa0529cd0f91bacdbfd47e3bfd719130ba3446c52c245863',
 decoded:'e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9',
 road:'72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1',
 structures:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 sidewalk:'e2dce7c86c4b5cd45ea45fb92ed89c2ae504306e4349e1291e627a669630e384',
 parking:'071f8b599e27afcda8a1924cb152135f342c47756de1667fea28c0fdbb294303',
} as const;
export const REGIONAL_DRAW_M=655;
export const REGIONAL_RELEASE_M=920;
export const REGIONAL_ROSTER_STRIDE=5;
export function canopyEnvelope(h:number,w:number){return .5*Math.hypot(w,Math.max(w,1.04*h))+1.5;}
export async function regionalDigest(buffer:ArrayBuffer){
 try{const bytes=await globalThis.crypto.subtle.digest('SHA-256',buffer);
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}catch{return;}
}
