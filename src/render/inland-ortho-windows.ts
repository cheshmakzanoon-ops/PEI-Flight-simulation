// Top-origin rows of the shipped 640 px Sentinel tile. Four RG cover
// bounds cover both nearest land-class and every bilinear coast vertex of
// the photographed mask, including its two-row tapers. No stock-wide hash.
export const INLAND_ORTHO_WINDOWS=[
 {
  "name":"west",
  "first":"7-12",
  "second":"8-12",
  "axis":"x",
  "edge":8,
  "nsha":"47d33340a2b0318e61fde6f8a820e645c28484a53d5fc7ab643543b6158ede6d",
  "ssha":"2154c285d58ce96f80e5f4f7e6f7761abd6578769aa7fb62a8b26428ce4b2cd4",
  "northRows":[
   217,
   219,
   235,
   237
  ],
  "coverBox":[
   1023,
   1525,
   2,
   5
  ],
  "coverRG":[
   30,
   255,
   30,
   255,
   30,
   255,
   30,
   255,
   40,
   255,
   30,
   255,
   30,
   255,
   30,
   255,
   40,
   255,
   30,
   255
  ]
 },
 {
  "name":"central",
  "first":"10-11",
  "second":"11-11",
  "axis":"x",
  "edge":11,
  "nsha":"d3d7b18884016a2afeb4842f1b27bd543702234d7d6c1660f52caeeafc4f2fcb",
  "ssha":"f962988f7aa5ed4f9679803ef0e1e9e1f69c54dd70c3748769a323bb8ce653f7",
  "northRows":[
   457,
   459,
   475,
   477
  ],
  "coverBox":[
   1407,
   1447,
   2,
   6
  ],
  "coverRG":[
   30,
   255,
   30,
   253,
   40,
   242,
   30,
   231,
   40,
   223,
   30,
   210,
   30,
   207,
   30,
   190,
   30,
   194,
   30,
   174,
   30,
   188,
   30,
   165
  ]
 }
] as const;
export type InlandWindowId=typeof INLAND_ORTHO_WINDOWS[number]['name'];
type CurrentCover={width:number;height:number;bytes:Uint8Array};
export function inlandSourceWindows(cover:CurrentCover):readonly InlandWindowId[]{
 if(cover.width!==4096||cover.height!==2720||cover.bytes.length!==4096*2720*2)return [];
 return INLAND_ORTHO_WINDOWS.filter(p=>{
  const [x,z,w,h]=p.coverBox;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)for(let c=0;c<2;c++){
   if(cover.bytes[2*((z+j)*cover.width+x+i)+c]!==p.coverRG[2*(j*w+i)+c])return false;
  }
  return true;
 }).map(p=>p.name);
}
