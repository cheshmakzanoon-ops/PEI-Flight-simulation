import {Scene} from 'three';
import type {Group} from 'three';
import type {Terrain} from '../sim/terrain.ts';
import type {Cover} from '../sim/cover.ts';
import {project} from '../sim/geo.ts';
import {standardLandAtlasMatches} from './meadow-standard.ts';

const p=project(-63.125295,46.233718); // Already-shipped game landmark anchor.
const box=[p.x-42,p.z-42,p.x+42,p.z+42] as const;

/** Only the old regular 16-16 terrain against which these steps were seated.
 * Imported water/subdivision replacements cannot silently inherit this receiver. */
export function basilicaSiteSupports(t:Terrain,hash:string|undefined,c:Cover){
 if(!standardLandAtlasMatches(t,hash,c)||t.surveyGrids.some(q=>q.spec.tileX===16&&q.spec.tileZ===16)||
    c.waterInsets.some(q=>q.intersects(...box)))return false;
 for(const x of [box[0],p.x,box[2]])for(const z of [box[1],p.z,box[3]]){
  if(!t.isLand(x,z)||!(c.distance(t,x,z)>48))return false;
 }
 return true;
}

type Artist={addBasilicaExterior:(s:Scene,t:Pick<Terrain,'elevation'>,g:(x:number,z:number)=>number)=>Group};

/** Stage the entire independent landmark, never a partial church beside the stock one.
 * No WebGL resource is allocated to temporary scene objects before attaching. */
export async function mountBasilicaStudy(scene:Scene,t:Pick<Terrain,'elevation'>,ground:(x:number,z:number)=>number,
 load:()=>Promise<Artist>){
 const staged=new Scene();
 try{
  const g=(await load()).addBasilicaExterior(staged,t,ground);
  if(staged.children.length!==1||g.parent!==staged||!g.isGroup)return false;
  scene.add(g);return true;
 }catch{return false;}
}
