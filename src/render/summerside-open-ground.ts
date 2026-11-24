import {verifyDecodedCover} from '../sim/cover-proof.ts';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import {TREE_PITCH,TREE_TILE_SIDE,treeRandom} from '../sim/tree-layout.ts';
import {OPEN_LANE_SOURCE,type OpenRoadLane} from './mapped-lane-canopy.ts';

const ROOT={owner:'-236:62',i:-3764,j:1007,x:-45157.51953125,z:12089.5615234375,
 y:3.9245290756225586,h:16.367158889770508,w:15.841443061828613} as const;
export const SUMMERSIDE_FRONTAGE_ROOT=[ROOT.x,ROOT.z] as const;

const extras=['stockSummersideFrontage','mappedLaneCanopyStudy','woodland3D','woodlandView','woodlandBark','woodlandCrownBase','seatedForestShadows',
 'canopyLight','indianRiverReview','surveyRelief','inlandRelief','seatedRoads','buildingShadows','summersideStationReview',
 'spinnakersPreview','northBaywalkPreview','baywalkConcrete'] as const;
export function summersideFrontageCompatible(q:URLSearchParams){
 return q.get('scenery')!=='detail'&&!extras.some(k=>q.has(k));
}

/** Datestamped open ground beside the measured Water St building.
 * No vegetation positions or other exact slots are regenerated. */
export async function authenticateSummersideFrontage(t:Terrain,c:Cover,terrainSha:string|undefined,roadSha:string|undefined):Promise<OpenRoadLane|undefined>{
 const p=OPEN_LANE_SOURCE;
 if(!globalThis.crypto?.subtle||terrainSha!==p.terrain||roadSha!==p.road||c.sourceSha!==p.cover||
    TREE_PITCH!==12||TREE_TILE_SIDE!==16)return;
 const {i,j,x,z,y,h,w,owner}=ROOT;
 const px=(i+treeRandom(i,j,11))*12,pz=(j+treeRandom(i,j,84))*12;
 const rawH=8.2+treeRandom(i,j,35)*10.8,rawW=rawH*(.83+treeRandom(i,j,9)*.35);
 const expectedOwner=Math.floor(i/16)+':'+Math.floor(j/16);
 if(owner!==expectedOwner||Math.fround(px)!==x||Math.fround(pz)!==z||Math.fround(rawH)!==h||Math.fround(rawW)!==w||
    Math.fround(t.meshElevation(px,pz)-.16)!==y||!t.isLand(px,pz)||c.sample(t,px,pz)!==10||
    c.distance(t,px,pz)<90)return;
 if(await verifyDecodedCover(c)!==p.coverDecoded)return;
 const exactly=(xx:number,zz:number,hh:number,ww:number)=>xx===x&&zz===z&&hh===h&&ww===w;
 return {owners:[owner],size:1,forOwner:key=>key===owner?exactly:undefined,excludes:exactly};
}
