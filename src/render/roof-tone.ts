import {ROOF_TONES,TONE_ATLAS_SHA} from './roof-tone.generated.ts';
type ToneRow=readonly [slot:number,footprintMicrodegrees:readonly number[],r2:number,g2:number,b2:number];
const rows:Readonly<Record<string,readonly ToneRow[]>>=ROOF_TONES;
export type RoofTone=readonly [red:number,green:number,blue:number];
export function readRoofTone(atlas:string|undefined,tile:string,i:number,outline:readonly (readonly [number,number])[]):RoofTone|undefined {
 if(atlas!==TONE_ATLAS_SHA)return;
 const q=rows[tile]?.find(p=>p[0]===i);
 if(!q||q[1].length!==outline.length*2||
    outline.some(([x,z],i)=>x!==q[1][2*i]/1e6||z!==q[1][2*i+1]/1e6))return;
 // Match the atlas ground's 25%-reflectance TCI transfer. This is a
 // 2025 broad diffuse roof cue, not a measured material or current paint.
 return [q[2]/2040,q[3]/2040,q[4]/2040];
}
