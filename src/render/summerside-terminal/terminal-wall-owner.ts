/** Detached terminal wall proof. The indexed stream can remove different,
 * already-authenticated owner ranges without remapping the target vertices.
 * This validates the target still arrives as the same 148 complete triangles. */
export const TERMINAL_WIRE={
 atlas:'538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557',
 wire:'b88c120e29513f42f5ad6e272981c21627b38634de29e5f9b3939a57a06fbe67',
 row:'492585ecefa26d74442f2aeda9f9cef8a893cdae1a57f87648a26c2b823041be',
 flags:'2db7308591fd5236242e38163717582a110d38d60a1ac72ea71ce3709c0df05a',
 positions:'7f8cc57c5725b1b87817d265ee4c644a37489dd4ed00418e4e1e8c15490a0318',
 id:'q032001',ordinal:68,rows:399,bytes:20163,first:5046,wallEnd:5346,last:5490,total:69906,
} as const;

// Two reproduced exact emission profiles, paired with their exact projected centre.
// The +1 ULP projection recipe changes an unrelated feature's ear-cut ordering.
// No tolerance, loose digest combination, or implicit new profile is authorized.
export const TERMINAL_PROFILES=[-44176.33503531042,-44176.33503531043] as const;
export const TERMINAL_WIDTH={position:3,uv:2,color:3,topFlag:1,facadeStyle:1,normal:3} as const;
export type TerminalAttr=keyof typeof TERMINAL_WIDTH;
export type TerminalStream=Float32Array<ArrayBufferLike>|Uint8Array<ArrayBufferLike>;
const streamHashes:Readonly<Record<TerminalAttr,readonly [original:string,alternate:string,target:string]>>={
 position:[
  '7f8cc57c5725b1b87817d265ee4c644a37489dd4ed00418e4e1e8c15490a0318',
  '975c0603e3d8ce10bbccc78b13ec6e1be3dade24b96f909c8b2a395871a85a92',
  '95302eae4a794ea5aa8181e2f750f217ee4853a56b708bff77c4b8b2b093695c'],
 uv:[
  '466365cb43752ca7372586f946be175c160024ee139bdeecdfc7062948c94022',
  '6ba2fe4898ae267deefed8a828b7bc2f8cda5b0897b3e506b5bf19c459fbf2a1',
  '30a9ea19952e8aa063257d47b91bbc143a9342e5da1c7816e523938f7a20c114'],
 color:[
  '1d9b62d3c1aff4f4130e62d21480654185325e55f544cc539e12662c84881b19',
  '29455542ef9a3402459af09cccc026841febb7c9adcfda3008fd63b66cbd7692',
  '59eb39b88a13317b48d43953069fe995c5aef82ada32595824f644209ebe3b33'],
 topFlag:[
  '2db7308591fd5236242e38163717582a110d38d60a1ac72ea71ce3709c0df05a',
  '6704b1ee394598f9ad13cf2cd8c128a4a2c8e0563acbf8cf7a78f9bf56e785e2',
  '42d8458016de1eaa683563966d52945b3d22578bb68d3391b63c52b0ffcb3767'],
 facadeStyle:[
  '9e335552099a99d18f394670ab98f498b97a9fa40165e31976b4853cab8c7cc2',
  '9e335552099a99d18f394670ab98f498b97a9fa40165e31976b4853cab8c7cc2',
  '0673d7ed815afd3f6341211be04d352854005d1567022503d86a1b623e7d9566'],
 normal:[
  'ab6955b2d33f2cdf51392536554c4131e00f540ef7b18d4bf3aedb0b5b079d49',
  'b3706d2dc36ec58726175ac5a0df30405a945d67e75cb9393d5269bc2dff064b',
  'bdbd9245e87c64c7947e5116f048ec29cfe8266a29096421356b0eb9ced137b2'],
};

const sha=async(b:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const view=(a:TerminalStream)=>{
 if(!(a.buffer instanceof ArrayBuffer))throw Error('Terminal attribute backing is not a whole immutable lease');
 return new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
};
export async function terminalWireAllows(atlas:string|undefined,id:string,raw:ArrayBuffer,rows:readonly unknown[],
 ownerX:number,streams:Readonly<Record<TerminalAttr,TerminalStream>>){
 const {atlas:a,id:i,wire,row,ordinal,rows:n,total,bytes,first,last}=TERMINAL_WIRE;
 const profile=TERMINAL_PROFILES.findIndex(x=>x===ownerX);
 if(a!==atlas||i!==id||rows.length!==n||raw.byteLength!==bytes||profile<0||
    !(streams.topFlag instanceof Float32Array)||!terminalDrawAllows(null,streams.topFlag))return false;
 try{
  const fields=Object.keys(TERMINAL_WIDTH) as TerminalAttr[];
  if(fields.some(k=>streams[k]?.length!==total*TERMINAL_WIDTH[k]||
     !(k==='facadeStyle'?streams[k] instanceof Uint8Array:streams[k] instanceof Float32Array)))return false;
  const pair=await Promise.all([sha(raw),sha(new TextEncoder().encode(JSON.stringify(rows[ordinal]))),
   ...fields.map(async k=>{
    const ar=streams[k],width=TERMINAL_WIDTH[k]*ar.BYTES_PER_ELEMENT,all=view(ar);
    const [digest,target]=await Promise.all([sha(all),sha(all.subarray(first*width,last*width))]);
    return digest===streamHashes[k][profile]&&target===streamHashes[k][2];
   })]);
  return pair[0]===wire&&pair[1]===row&&pair.slice(2).every(x=>x===true)&&terminalDrawAllows(null,streams.topFlag);
 }catch{return false;}
}

const knownHoles=[
 [[30618,30666]],
 [[51228,51429],[65946,65988]],
 [[30618,30666],[51228,51429],[65946,65988]],
] as const;
export function terminalDrawAllows(index:Uint32Array|Uint16Array|null,flags:Float32Array,first=0,count=Infinity,groupCount=0){
 const {first:lo,wallEnd,last:hi,total}=TERMINAL_WIRE;
 if(!(flags instanceof Float32Array)||flags.length!==total||first!==0||count!==Infinity||groupCount!==0)return false;
 for(let k=lo;k<hi;k++)if(flags[k]!==Number(k>=wallEnd))return false;
 if(index===null)return true;
 if(!(index instanceof Uint32Array)||index.length%3!==0||index.length>total)return false;
 // Exact emitted global ranges of independently admitted neighbor art.
 for(const drops of knownHoles){
  if(index.length!==total-drops.reduce((sum,[a,b])=>sum+b-a,0))continue;
  let k=0,h=0,match=true;
  for(let i=0;i<total;){
   const q=drops[h];
   if(q&&i===q[0]){i=q[1];h++;continue;}
   if(index[k++]!==i++){match=false;break;}
  }
  if(match&&k===index.length&&h===drops.length)return true;
 }
 return false;
}
