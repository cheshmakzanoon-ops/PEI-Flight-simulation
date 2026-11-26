/** One dated broad roof-tone cue. No surface classification, surveyed ridge,
 * pixels, current owner/tenant or adjacent daylight/ground changes. */
const PIN={
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 chunk:'14fca913cea9bc4ef9c41072448765e8328dd4a91b26723ab0573c7e4b1ef9fa',
 id:'q03330',offset:1337302,bytes:29361,count:674,
 bounds:[-63.358821,46.447468,-63.29188,46.482547],
 ordinal:377,height:11.8,minHeight:4.57,
 footprint:[[-63.293334,46.455534],[-63.293661,46.455314],[-63.293885,46.455473],[-63.293558,46.455693]],
} as const;

type Tile={id:string;offset:number;bytes:number;count:number;bounds:readonly number[]};
type Point=readonly [number,number];
type Row={footprint:readonly Point[];height:number;minHeight?:number;holes?:readonly (readonly Point[])[]};

export const RUSTICO_HARBOUR_ROOF_TILE=PIN.id;
export const RUSTICO_HARBOUR_ROOF_ROW=PIN.ordinal;
export const RUSTICO_HARBOUR_ROOF_TONE=0xaeb1aa;

export function rusticoHarbourRoofAtlasAllows(atlas:string|undefined,tile:Tile):boolean{
 return tile.id===PIN.id&&atlas===PIN.atlas&&tile.offset===PIN.offset&&tile.bytes===PIN.bytes&&
  tile.count===PIN.count&&tile.bounds.length===4&&PIN.bounds.every((v,i)=>tile.bounds[i]===v);
}

/** The digest must come from the same packed chunk as the decoded rows.
 * Exact tuple order matters; neither bounding-box proximity nor site address is authority. */
export function rusticoHarbourRoofAllows(atlas:string|undefined,tile:Tile,chunk:string|undefined,rows:readonly Row[]):boolean{
 if(!rusticoHarbourRoofAtlasAllows(atlas,tile)||chunk!==PIN.chunk||rows.length!==PIN.count)return false;
 const row=rows[PIN.ordinal];
 return !!row&&row.height===PIN.height&&row.minHeight===PIN.minHeight&&row.holes===undefined&&
  row.footprint.length===PIN.footprint.length&&PIN.footprint.every(([lon,lat],i)=>{
   const point=row.footprint[i];return !!point&&point.length===2&&point[0]===lon&&point[1]===lat;
  });
}
