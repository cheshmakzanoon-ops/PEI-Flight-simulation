import {matchesOrbyTerrainBounds,ORBY_COVER_SHA} from '../sim/orby-shore-closure.ts';

export const CAPE_TRYON_COVER_DECODED='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9';
const HEIGHT_SHA='661f78b0ede8782741231e4b58196c138a8a3d5d8076da5cfce4106c350f925d';

export function tryonRockMatches(terrainSha:string|undefined,bounds:readonly number[],cover:{
 sourceSha?:string;width:number;height:number;
}){
 return terrainSha===HEIGHT_SHA&&matchesOrbyTerrainBounds(bounds)&&
  cover.sourceSha===ORBY_COVER_SHA&&cover.width===4096&&cover.height===2720;
}

/** Mark exact position spans already selected by the certified Tryon arc.
 * The shore shader never otherwise consumes the existing UV coordinates. */
export function markTryonRockShoreUV(uv:Float32Array,ranges:readonly (readonly [number,number])[]){
 for(const [start,end] of ranges)for(let i=start;i<end;i+=3)uv[i/3*2]=1;
 return uv;
}

export const tryonRockGLSL=/*glsl*/`
 uniform float tryonRockGain,tryonRockAll;
float tryonStoneCoverage(vec3 p,float viewDistance){
 // Detail only the exact old and additive Gulf-facing curtain owners.
 // The signed stock aperture confines the colour even inside these meshes.
 vec2 edge=min(p.xz-vec2(-23711.65,-3858.77),vec2(-23491.49,-3789.80)-p.xz);
 return smoothstep(0.,10.,min(edge.x,edge.y))*smoothstep(1.45,5.5,p.y)*
        (1.-smoothstep(420.,1050.,viewDistance));
}
vec3 tryonStoneColor(vec3 p,vec3 pixel,vec3 litNormal){
 vec2 q=p.xz-vec2(-23495.75,-3776.389);
 float drift=noise(q*.051+vec2(32.1,2.3));
 float joints=noise(vec2(dot(q,vec2(.087,.057)),p.y*.24+dot(q,vec2(-.010,.014))));
 float w=p.y+dot(q,vec2(.006,-.003))+(drift-.5)*.63;
 float beds=w/4.3,sequence=floor(beds);
 float level=fract(beds);
 float seedA=hash(vec2(sequence+5.15,47.37)),seedB=hash(vec2(sequence*1.11,19.03));
 float breakA=noise(q*.062+vec2(sequence*.713,sequence*.29));
 float breakB=noise(q*.089+vec2(sequence*.217,-sequence*.316));
 float mainBed=abs(level-(.26+.14*seedA+.047*(breakA-.5)));
 float closeSeam=abs(level-(.55+.25*seedB+.053*(breakB-.5)));
 float pxVisible=1.-smoothstep(.30,.87,pixel.y+dot(pixel.xz,vec2(.019,.016)));
 float pockets=smoothstep(.22,.81,breakA),fragments=smoothstep(.49,.77,breakB);
 float first=1.-smoothstep(.016,.067+.033*seedA,mainBed);
 float next=1.-smoothstep(.006,.032+.020*seedB,closeSeam);
 float shade=(first*(.40+.60*pockets)+.54*next*fragments)*pxVisible;
 float rim=(1.-smoothstep(.012,.068,abs(mainBed-.061)))*pockets*pxVisible;
 float subsided=noise(vec2(dot(q,vec2(.064,-.072)),w*.48));
 float mottled=.23*drift+.27*joints+.34*subsided+.16*seedA;
 vec3 dry=mix(vec3(.164,.070,.048),vec3(.247,.109,.076),smoothstep(.12,.84,mottled));
 vec3 base=mix(vec3(.113,.062,.052),dry,smoothstep(.6,3.5,p.y+(drift-.5)*1.15));
 float sunlight=.84+.26*max(0.,dot(litNormal,sun));
 float close=(1.-smoothstep(.08,.41,pixel.y+length(pixel.xz)*.46));
 float grit=noise(vec2(dot(q,vec2(.91,.72)),p.y*2.97+dot(q,vec2(-.235,.233))));
 return base*(sunlight+.11*joints-.22*shade+.085*rim+close*.11*(grit-.5));
}
`;
