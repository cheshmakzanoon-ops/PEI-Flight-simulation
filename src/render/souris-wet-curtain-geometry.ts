import {BufferAttribute,BufferGeometry,Mesh} from 'three';

export type StockCurtainQuad = Readonly<{
  // Directed first bottom corner, second bottom corner, then their actual Y values.
  // Coordinates must match the original submitted Float32 positions exactly.
  x0:number; z0:number; x1:number; z1:number;
  bottom0:number; bottom1:number; top0:number; top1:number;
  copies:1|2;
  // For one signed partial mask: retire the eastern part only, preserve all
  // old UV, Y and winding on the west remainder.
  keepWestOfEasting?:number;
}>;

type PinnedCut = Readonly<{decodedCover:string; quads:readonly StockCurtainQuad[]}>;

const OFFSHORE_CUT_LIMITS={west:72615,east:72952,north:16952.8,south:17000.4} as const;
const quadVertices=(q:StockCurtainQuad)=>new Float32Array([
  q.x0,q.bottom0,q.z0, q.x1,q.bottom1,q.z1, q.x0,q.top0,q.z0,
  q.x0,q.top0,q.z0, q.x1,q.bottom1,q.z1, q.x1,q.top1,q.z1,
]);

const exactAt=(a:Float32Array,start:number,b:Float32Array)=>b.every((v,i)=>Object.is(a[start+i],v));
const samePosition=(a:BufferAttribute,b:BufferAttribute)=>a===b;
const boundsSafe=(x:number,z:number)=>Number.isFinite(x)&&Number.isFinite(z)&&
  x>=OFFSHORE_CUT_LIMITS.west&&x<=OFFSHORE_CUT_LIMITS.east&&
  z>=OFFSHORE_CUT_LIMITS.north&&z<=OFFSHORE_CUT_LIMITS.south;

interface Plan {
  readonly count:number;
  readonly removedTriangles:number;
  show():boolean;
  stock():void;
  dispose():void;
}

/** Only exact stock shore strips with confirmed original open-water support.
 *  No land/sea, terrain/collider or other visibility state is touched.
 *  Fail closed if the source or exact directed quads cannot be matched unambiguously.
 */
export function planSourisWetCurtainCut(
  faces:readonly Mesh[],confirmedCover:string|undefined,pin:PinnedCut,
):Plan|undefined{
  if(!confirmedCover||confirmedCover!==pin.decodedCover||!/^[a-f\d]{64}$/.test(confirmedCover)||
     pin.quads.length===0||pin.quads.length!==2)return;
  if(pin.quads.some(q=>!boundsSafe(q.x0,q.z0)||!boundsSafe(q.x1,q.z1)||
    (q.copies!==1&&q.copies!==2)||q.z0!==q.z1||Math.abs(q.x1-q.x0)>48||
    Math.max(q.top0,q.top1)>.73||Math.min(q.top0,q.top1)<.71||
    Math.min(q.bottom0,q.bottom1)<-.15||Math.max(q.bottom0,q.bottom1)>-.13||
    (q.keepWestOfEasting!==undefined&&(!Number.isFinite(q.keepWestOfEasting)||
      q.x0-q.keepWestOfEasting<.1||q.keepWestOfEasting-q.x1<.1||
      q.top0!==q.top1||q.bottom0!==q.bottom1))))return;
  const expected=pin.quads.map(q=>({pos:quadVertices(q),count:0,need:q.copies,clip:q.keepWestOfEasting}));
  const lookup=new Map<number, typeof expected>();
  for(const q of expected){
    const k=q.pos[0];const same=lookup.get(k)??[];
    if(same.some(p=>exactAt(q.pos,0,p.pos)))return;
    same.push(q);lookup.set(k,same);
  }
  const matches:{subject:Mesh,prior:BufferGeometry,position:BufferAttribute,uv:BufferAttribute,cut:{off:number,east?:number}[]}[]=[];
  for(const subject of faces){
    const prior=subject.geometry;
    if(subject.name!=='shore-to-sea surface'||prior.index||prior.groups.length||
       Object.keys(prior.attributes).sort().join(',')!=='position,uv')continue;
    const {position,uv}=prior.attributes;
    if(!(position instanceof BufferAttribute&&uv instanceof BufferAttribute)||position.itemSize!==3||
       uv.itemSize!==2||position.count!==uv.count||position.count%6||
       !(position.array instanceof Float32Array&&uv.array instanceof Float32Array)||
       position.normalized||uv.normalized||prior.drawRange.start!==0||prior.drawRange.count!==Infinity)
      continue;
    const p=position.array,cut:{off:number,east?:number}[]=[];
    for(let off=0;off<p.length;off+=18){
      const options=lookup.get(p[off]);
      if(!options)continue;
      const q=options.find(o=>exactAt(p,off,o.pos));
      if(q){
        if(q.clip!==undefined&&uv.array.subarray(off/3*2,off/3*2+12).some(x=>x!==0))return;
        q.count++;cut.push({off,east:q.clip});
      }
    }
    if(cut.length)matches.push({subject,prior,position,uv,cut});
  }
  if(matches.length!==1||expected.some(q=>q.count!==q.need))return;
  const {subject,prior,position,uv,cut}=matches[0];
  const basePos=position.array as Float32Array,baseUV=uv.array as Float32Array;
  const fullyRemoved=cut.filter(q=>q.east===undefined).length;
  const nextP=new Float32Array(basePos.length-fullyRemoved*18);
  const nextU=new Float32Array(baseUV.length-fullyRemoved*12);
  let source=0,write=0;
  const segment=(end:number)=>{
    nextP.set(basePos.subarray(source,end),write);
    nextU.set(baseUV.subarray(source/3*2,end/3*2),write/3*2);
    write+=end-source;source=end+18;
  };
  for(const {off,east} of cut){
    segment(off);
    if(east!==undefined){
      const remainder=basePos.slice(off,off+18);
      // The first bottom and two top vertices at the directed east end.
      for(const i of [0,6,9])remainder[i]=east;
      nextP.set(remainder,write);
      nextU.set(baseUV.subarray(off/3*2,off/3*2+12),write/3*2);
      write+=18;
    }
  }
  segment(basePos.length);
  const variant=new BufferGeometry();
  variant.name=prior.name;
  variant.setAttribute('position',new BufferAttribute(nextP,3));
  variant.setAttribute('uv',new BufferAttribute(nextU,2));
  // Identical culling and draw grouping. Do not recompute a new scene envelope.
  variant.boundingSphere=prior.boundingSphere?.clone()??null;
  variant.boundingBox=prior.boundingBox?.clone()??null;
  let disposed=false;
  const stock=()=>{if(subject.geometry===variant)subject.geometry=prior;};
  return {
    count:cut.length,removedTriangles:fullyRemoved*2,
    show(){
      if(disposed)return false;
      if(subject.geometry===variant)return true;
      if(subject.geometry!==prior||!samePosition(prior.attributes.position as BufferAttribute,position)||
         !samePosition(prior.attributes.uv as BufferAttribute,uv))return false;
      subject.geometry=variant;
      return true;
    },
    stock,
    dispose(){if(!disposed){stock();variant.dispose();disposed=true;}},
  };
}
