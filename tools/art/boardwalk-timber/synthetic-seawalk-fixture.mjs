import {buildBoardwalkCap} from './boardwalk-cap.ts';

// Synthetic only. These metre coordinates are not a geographic place,
// springline, engineered alignment, target pose, or provider data.
const freeze=a=>Object.freeze(a.map(p=>Object.freeze(p)));
export const SYNTHETIC_STANDARD=Object.freeze({
 width:3,
 centerline:freeze([[0,0],[5.8,0],[9.6,2.3],[12.9,2.29],[12.9,8.1],[17.35,8.1],[20.2,6.8]]),
 poses:Object.freeze({
  approach:{eye:[-2.05,1.37,-1.54],target:[5.30,.07,.81],fov:48},
  join:{eye:[10.34,5.12,-2.98],target:[12.24,.07,4.80],fov:54},
  context:{eye:[-5.25,11.7,-9.1],target:[9.75,.14,3.60],fov:51},
  reverse:{eye:[21.60,3.2,11.20],target:[14.8,.09,6.34],fov:53},
 }),
 resolution:[900,600],
});
export function syntheticGround(x,z){
 return 1.2+.0011*x-.00102*z+.012*Math.sin(x*.42)+.008*Math.sin(z*.38);
}
export function buildSyntheticWalk(timber='full'){
 return buildBoardwalkCap({...SYNTHETIC_STANDARD,ground:syntheticGround,
  dry:triangle=>triangle.every(([x,z])=>x>=-3&&x<=24&&z>=-3&&z<=12),timber});
}
