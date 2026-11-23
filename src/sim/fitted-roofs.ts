import type { GroundPoint, RoofRidge } from './roof-ridge.ts';
import source from './fitted-roofs.json' with {type:'json'};

// A tile and exact quantized first vertex identify only explicitly vetted outlines.
export const supportedRoofAtlas=(sha:string|undefined)=>sha===source.atlasSha256;
const fitsByTile=new Map<string,typeof source.roofs>();
for(const entry of source.roofs){
  const list=fitsByTile.get(entry.tile);
  if(list)list.push(entry);else fitsByTile.set(entry.tile,[entry]);
}
export function lookupRoofFit(tile:string,outline:readonly (readonly [number,number])[],center:GroundPoint):RoofRidge|undefined {
  const first=outline[0];
  const fit=first&&fitsByTile.get(tile)?.find(r=>r.vertices===outline.length&&r.firstLonLat[0]===first[0]&&r.firstLonLat[1]===first[1]);
  if(!fit)return;
  const {axisX:x,axisZ:z,signedAtCenterM,topAboveSurveyGroundM:peakM,risePerRun}=fit;
  const shift=signedAtCenterM/(x*x+z*z);
  return {origin:{x:center.x-x*shift,z:center.z-z*shift},normal:{x,z},peakM,leftSlope:risePerRun,rightSlope:risePerRun};
}
