/** One dated broad roof-tone cue. No surface classification, surveyed ridge,
 * reference pixels, material identification, or present-day appearance. */
const PIN={
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 chunk:'88b950823701ee69cf16f7f8db068be81d5cf057293c84a5c32127120631777b',
 id:'q03301',offset:1153102,bytes:7583,count:166,
 bounds:[-63.43623,46.378688,-63.358873,46.410964],
 ordinal:13,height:6.01,minHeight:2.17,
 footprint:[[-63.387069,46.403868],[-63.387041,46.403788],[-63.387086,46.403781],[-63.387065,46.403725],
  [-63.387103,46.403722],[-63.387097,46.403692],[-63.387146,46.403688],[-63.387186,46.403851]],
} as const;

type Tile={id:string;offset:number;bytes:number;count:number;bounds:readonly number[]};
type Point=readonly [number,number];
type Row={footprint:readonly Point[];height:number;minHeight?:number;holes?:readonly (readonly Point[])[]};

export const NEW_GLASGOW_ROOF_TILE=PIN.id;
export const NEW_GLASGOW_ROOF_ROW=PIN.ordinal;
export const NEW_GLASGOW_ROOF_TONE=0xbac0bc;

export function newGlasgowRoofAtlasAllows(atlas:string|undefined,tile:Tile):boolean{
 return tile.id===PIN.id&&atlas===PIN.atlas&&tile.offset===PIN.offset&&tile.bytes===PIN.bytes&&
  tile.count===PIN.count&&tile.bounds.length===4&&PIN.bounds.every((v,i)=>tile.bounds[i]===v);
}

/** The digest must come from the same packed chunk as the decoded rows.
 * Exact tuple order matters; neither bounding-box proximity nor site address is authority. */
export function newGlasgowRoofAllows(atlas:string|undefined,tile:Tile,chunk:string|undefined,rows:readonly Row[]):boolean{
 if(!newGlasgowRoofAtlasAllows(atlas,tile)||chunk!==PIN.chunk||rows.length!==PIN.count)return false;
 const row=rows[PIN.ordinal];
 return !!row&&row.height===PIN.height&&row.minHeight===PIN.minHeight&&row.holes===undefined&&
  row.footprint.length===PIN.footprint.length&&PIN.footprint.every(([lon,lat],i)=>{
   const point=row.footprint[i];return !!point&&point.length===2&&point[0]===lon&&point[1]===lat;
  });
}
