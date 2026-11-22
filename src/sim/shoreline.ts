import type { Cover } from './cover.ts';
import type { Terrain } from './terrain.ts';

export interface ShoreSegment { ax:number; az:number; bx:number; bz:number }

/** March the same pixel-centred, signed-distance mask the land and water shaders sample. */
export function coastSegments(cover: Cover, terrain: Terrain): ShoreSegment[] {
  const {width:w,height:h,bytes}=cover, result: ShoreSegment[]=[];
  const stepX=(terrain.right-terrain.left)/w, stepZ=(terrain.bottom-terrain.top)/h;
  for(let j=0;j<h-1;j++)for(let i=0;i<w-1;i++){
    const n=(j*w+i)*2+1;
    const a=bytes[n]-128,b=bytes[n+2]-128,c=bytes[n+2*w+2]-128,d=bytes[n+2*w]-128;
    const mask=(a>=0?1:0)|(b>=0?2:0)|(c>=0?4:0)|(d>=0?8:0);
    if(mask===0||mask===15)continue;
    // At mixed cells, perimeter edges locate the texture's bilinear zero crossing.
    const x=terrain.left+(i+.5)*stepX,z=terrain.top+(j+.5)*stepZ;
    const points: ([number,number]|undefined)[]=[
      (a>=0)!==(b>=0)?[x+stepX*a/(a-b),z]:undefined,
      (b>=0)!==(c>=0)?[x+stepX,z+stepZ*b/(b-c)]:undefined,
      (d>=0)!==(c>=0)?[x+stepX*d/(d-c),z+stepZ]:undefined,
      (a>=0)!==(d>=0)?[x,z+stepZ*a/(a-d)]:undefined
    ];
    const add=(p:[number,number],q:[number,number])=>{
      if(Math.hypot(p[0]-q[0],p[1]-q[1])>.01)result.push({ax:p[0],az:p[1],bx:q[0],bz:q[1]});
    };
    if(mask===5||mask===10){
      if(((a+b+c+d)>=0)===(mask===5)){add(points[0]!,points[1]!);add(points[2]!,points[3]!);}
      else{add(points[0]!,points[3]!);add(points[1]!,points[2]!);}
    }else{
      const intersections=points.filter((p):p is [number,number]=>!!p);
      if(intersections.length===2)add(intersections[0],intersections[1]);
    }
  }
  return result;
}
