/** An opt-in revision to the existing museum preview, never a Standard scenery promotion. */
const safe=new Set(['beaconsfieldReview','diagnostics','qa','departure','scenery','stockBeaconsfieldGrade','summersideTerminalWallPreview','stockSummersideTerminalWalls']);
export function beaconsfieldGradeRequested(q:URLSearchParams){
 if(!q.has('beaconsfieldReview')||q.has('stockBeaconsfieldGrade')||(q.has('scenery')&&q.get('scenery')!=='standard'))return false;
 for(const k of q.keys())if(!safe.has(k))return false;
 return true;
}
