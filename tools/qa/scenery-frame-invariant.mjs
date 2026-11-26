/** Score fixed-camera RGBA captures. Disocclusion can explain a failure; it
 * cannot make an alpha-changing or out-of-region comparison pass. */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const equal=(a,b,i)=>a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2]&&a[i+3]===b[i+3];
const witnessLimit=24;

export function sceneryFrameInvariant({stock,alternate,restored,uncovered,box,threshold=6,minimum=1}){
 const {width:w,height:h}=stock;
 if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||
    !Number.isSafeInteger(w*h*4)||!Number.isSafeInteger(minimum)||minimum<1||
    !Number.isSafeInteger(threshold)||threshold<0||threshold>254)
  throw new RangeError('Invalid frame size or visual gate');
 const [x0,y0,x1,y1]=box;
 if(box.length!==4||!box.every(Number.isSafeInteger)||x0<0||y0<0||x1>w||y1>h||x0>=x1||y0>=y1)
  throw new RangeError('Use a nonempty half-open receiver box inside the frame');
 const image=[stock,alternate,restored,...(uncovered?[uncovered]:[])];
 for(const f of image)if(f.width!==w||f.height!==h||!(f.data instanceof Uint8Array)||f.data.length!==w*h*4)
  throw new RangeError('Every capture must use the same native RGBA size');
 const [a,b,r,u]=image.map(f=>f.data);
 let changed=0,strong=0,alpha=0,outsideRgb=0,outsideAlpha=0,undoDelta=0,underlyingExact=0,originalNonopaque=0;
 const witness=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,out=x<x0||y<y0||x>=x1||y>=y1;
  const rgb=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
  const da=a[i+3]!==b[i+3];
  if(a[i+3]<255)originalNonopaque++;
  if(rgb||da)changed++;
  if(rgb>threshold)strong++;
  if(out&&rgb)outsideRgb++;
  if(!equal(a,r,i))undoDelta++;
  if(da){
   alpha++;
   if(out)outsideAlpha++;
   const matches=!!u&&equal(b,u,i);
   if(matches)underlyingExact++;
   if(witness.length<witnessLimit)witness.push({x,y,stock:a[i+3],alternate:b[i+3],
    ...(u?{uncovered:u[i+3],sameUncoveredRgba:matches}:{})});
  }
 }
 return {size:[w,h],box,threshold,minimum,changed,strong,alpha,outsideRgb,outsideAlpha,undoDelta,originalNonopaque,
  stockRestoreExact:undoDelta===0,allAlphaUnchanged:alpha===0,
  uncoveredWitness:u?{exactRgbaAtChangedAlpha:underlyingExact,unmatched:alpha-underlyingExact}:null,
  alphaSamples:witness,omittedAlphaSamples:alpha-witness.length,
  pass:strong>=minimum&&outsideRgb===0&&alpha===0&&undoDelta===0};
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const [stock,alternate,restored,box,report,uncovered]=process.argv.slice(2);
 if(!stock||!alternate||!restored||!box||!report)throw new Error(
  'Usage: node scenery-frame-invariant.mjs STOCK.png ALT.png RESTORE.png x0,y0,x1,y1 REPORT.json [UNCOVERED.png]');
 const {PNG}=await import('pngjs');
 const frame=p=>PNG.sync.read(readFileSync(p));
 const result=sceneryFrameInvariant({stock:frame(stock),alternate:frame(alternate),restored:frame(restored),
  uncovered:uncovered?frame(uncovered):undefined,box:box.split(',').map(v=>v.trim()?Number(v):NaN)});
 writeFileSync(report,JSON.stringify(result,null,2)+'\n');
 if(!result.pass)process.exitCode=1;
}
