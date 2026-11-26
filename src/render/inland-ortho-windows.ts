// Source texels run north→south for west/east joins, or west→east for
// north/south joins. Each signed cover block includes the nearest class
// and all bilinear coast samples touched by the window and two-texel tapers.
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
 },
 {"name":"south-central-fields","first":"11-16","second":"12-16","axis":"x","edge":12,
  "nsha":"92bb14110710420e78cda0e46a8880a909b3a60f3c3145a94f03c417f35c9a31",
  "ssha":"adaf69a737c54fbe43008e5900da768cb78b00e6709b47d282ef57336540daa4",
  "alongSourceTexels":[315,317,333,335],"coverBox":[1535,2038,2,6],
  "coverRG":[40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255]},
 {"name":"east-fields","first":"21-16","second":"21-17","axis":"z","edge":17,
  "nsha":"6afd2e66609a7271edf4e323b1b605f8863ba2bd2ef266ebd2771f2405d7f1bc",
  "ssha":"ff339559c0744e4c245cc3ff137b1c6b48b6b0709bd36e38143b427b489bb0ea",
  "alongSourceTexels":[613,615,631,633],"coverBox":[2810,2101,6,2],
  "coverRG":[40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255,40,255]},
 {"name":"west-forest-fields","first":"6-9","second":"7-9","axis":"x","edge":7,
  "nsha":"113dcd8bf55d45c74fb852a904551060f6df9d3d36bc1bc37183e081f7de69ba",
  "ssha":"5559366506f6d2413c8f6ca84940e73cae230c9e72b672766ce2bd083445c4dd",
  "alongSourceTexels":[412,414,430,432],"coverBox":[895,1191,2,6],
  "coverRG":[40,231,40,216,40,215,40,198,40,200,40,181,40,189,40,168,40,179,40,157,40,176,40,153]},
 {"name":"queens-southwest-fields","first":"13-16","second":"13-17","axis":"z","edge":17,
  "nsha":"38fe57f36c10ef4b4310ccc5633d1b3dcabddb65c237f20350ec63eba30465e9",
  "ssha":"5497ec40b8ac0b1ad9e67605e333ad6d4742cc15a64453369115bb6a8df5e0d0",
  "alongSourceTexels":[41,43,59,61],"coverBox":[1671,2101,6,2],
  "coverRG":[40,255,40,255,40,255,30,255,30,255,30,255,40,255,40,255,40,255,40,255,30,255,30,255]},
 {"name":"queens-inland-fields","first":"14-16","second":"15-16","axis":"x","edge":15,
  "nsha":"a636aa93cd604197ea6fd2d72f559347f94fb2a1f5880a549fb9661cff4f4c30",
  "ssha":"a72dc92329f4b6d65616f425f89cad3dc84967fe14a51bdc59566447d4c2dbe4",
  "alongSourceTexels":[94,96,112,114],"coverBox":[1919,1995,2,6],
  "coverRG":[40,255,40,255,40,255,40,255,30,255,40,255,30,255,30,255,40,255,40,255,40,255,40,255]}
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
