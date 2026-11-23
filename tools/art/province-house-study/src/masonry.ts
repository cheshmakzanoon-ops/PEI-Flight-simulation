/** Original, seamless appearance test only; no image reuse or site dimensions. */
export type Family = "ashlar" | "rustic" | "cut" | "slate" | "apron";
const mod = (a: number, b: number) => ((a % b) + b) % b;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const sm = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return t*t*(3-2*t);
};
function hash(i:number,j:number,seed:number) {
  let n = Math.imul(i|0, 0x9e3779b1) ^ Math.imul(j|0, 0x85ebca6b) ^ Math.imul(seed|0, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function field(u:number,v:number,cx:number,cy:number,seed:number) {
  let x=u*cx,y=v*cy, i=Math.floor(x), j=Math.floor(y);
  const a=sm(0,1,x-i),b=sm(0,1,y-j);
  i=mod(i,cx); j=mod(j,cy);
  const k=mod(i+1,cx),l=mod(j+1,cy);
  return mix(mix(hash(i,j,seed),hash(k,j,seed),a),mix(hash(i,l,seed),hash(k,l,seed),a),b);
}
export const stoneSpan = [9.6,4.8] as const;
export function stonePoint(u0:number,v0:number,family:Family,seed=31) {
  const u=mod(u0,1),v=mod(v0,1),rusticated=family==="rustic", cut=family==="cut", slate=family==="slate", apron=family==="apron";
  const rowCount=slate?28:apron?16:rusticated?10:12;
  const y=v*rowCount, row=Math.floor(y), h=stoneSpan[1]/rowCount;
  // Unequal stone widths and variable stagger without phase changes across the texture edge.
  const x=mod(u + .05 + (row%2)*.099 + (hash(row,1,seed)-.5)*.06,1);
  let left=0, right=1, block=0; const n=slate?32:apron?30:rusticated?13:15;
  for(let i=1;i<=n;i++){
    const next=i===n?1:(i+(hash(i,row,seed+8)-.5)*.51)/n;
    if (x<next){right=next;block=i-1;break;} left=next;
  }
  const wide=Math.min(x-left,right-x)*stoneSpan[0], tall=Math.min(y-row,1+row-y)*h;
  const chip=(field(u,v,71,34,seed)-.49)*.003;
  const bed=Math.min(wide,tall)+chip, mortar=cut?0:1-sm(.003,.009,bed);
  const blockId = hash(block,row,seed+12), patch = hash(block,row,seed+48);
  const t = (blockId-.5) * (apron?.041:slate?.061:rusticated?.063:.088);
  const band=field(u,v,13,111,seed+2)-.5;
  const grains=field(u,v,222,143,seed+3)-.5;
  const low=field(u,v,39,23,seed+4)-.5;
  const pocket=sm(.66,.96,field(u,v,129,91,seed+5))*sm(.52,.86,field(u,v,63,38,seed+7));
  const wash=field(u,v,17,29,seed+18)-.5;
  const cloud=field(u,v,61,44,seed+14)-.5;
  const fill=(slate?.35:apron?.51:cut?.612:rusticated?.591:.596)+(cut?0:t)+.013*band+.035*low+.025*grains-.053*pocket+.035*cloud+.023*wash;
  const mx=mix(fill, slate?.29:apron?.47:.425+.025*grains, mortar*(rusticated?.76:.64));
  const warm=cut?.080:slate?-.027:apron?.18:rusticated?.067+(patch-.5)*.071:(patch-.5)*.101+.072;
  let raised = cut?0:rusticated?.012:apron?.0028:slate?.0018:.0028;
  raised *= sm(.002,rusticated?.019:.009,bed);
  raised += (1-mortar) * (band*(cut?.00023:.00093) + grains*(rusticated?.0015:cut?.00026:.0008) - pocket*(cut?.0009:.0022) + low*(cut?.0006:.0019));
  return {height:raised,color:[mx*(1+warm*.43),mx*(.979-warm*.10),mx*(.944-warm*.62)],rough:(slate?.80:.79)+.10*mortar+.05*low};
}

/** Detach-study appearance lanes: R/G = sRGB scalar and relative warmth, B/A = signed tangent XY.
 * Conditional light-response adjustments are in stone-material.ts, not in the source colors. */
export const toneRange=[.23,.53] as const;
export const warmthRange=[-.08,.28] as const;
export const encoded=(v:number)=>Math.round(Math.max(0,Math.min(1,v))*255);
export const profile={
  ashlar:{w:1536,rows:12,blocks:15, spread:.088, bias:.596, joint:.425, jointDensity:.64, warmth:.072, tintStagger:.101, relief:.0028, fillet:.009, bands:.00093, grains:.0008, poreDepth:.0022, drift:.0019, rough:.79, roughLuma:[.467,.551]},
  rustic:{w:1536,rows:10,blocks:13, spread:.063, bias:.591, joint:.425, jointDensity:.76, warmth:.067, tintStagger:.071, relief:.012,  fillet:.019, bands:.00093, grains:.0015, poreDepth:.0022, drift:.0019, rough:.79, roughLuma:[.451,.536]},
  cut:   {w:512, rows:12,blocks:15, spread:0,    bias:.612, joint:.425, jointDensity:0,   warmth:.080, tintStagger:0,    relief:0,     fillet:.009, bands:.00023, grains:.00026,poreDepth:.0009, drift:.0006, rough:.79, roughLuma:[.086,.109]},
  slate: {w:1024,rows:28,blocks:32, spread:.061, bias:.35,  joint:.29,  jointDensity:.64, warmth:-.027,tintStagger:0,    relief:.0018, fillet:.009, bands:.00093, grains:.0008, poreDepth:.0022, drift:.0019, rough:.80, roughLuma:[.299,.336]},
  apron: {w:1024,rows:16,blocks:30, spread:.041, bias:.51,  joint:.47,  jointDensity:.64, warmth:.18,  tintStagger:0,    relief:.0028, fillet:.009, bands:.00093, grains:.0008, poreDepth:.0022, drift:.0019, rough:.79, roughLuma:[.472,.496]},
} as const satisfies Record<Family, {w:number,rows:number,blocks:number,spread:number,bias:number,joint:number,jointDensity:number,warmth:number,tintStagger:number,relief:number,fillet:number,bands:number,grains:number,poreDepth:number,drift:number,rough:number,roughLuma:readonly [number,number]}>;
export const families=Object.keys(profile) as Family[];
export type StonePlane={family:Family,width:number,height:number,pixels:Uint8Array};
export type StoneBatch={kind:'stone-v1',planes:StonePlane[],bakeMs:number,byWidthMs:Record<string,number>,peakWorkingBytes:number};
const grids=[[71,34,0],[13,111,2],[222,143,3],[39,23,4],[129,91,5],[63,38,7],[17,29,18],[61,44,14]] as const;

/** The reference evaluator above hashes each lattice vertex from scratch for every texel.
 * Instead cache the 8 tiny static noise lattices, share their interpolated rows among materials
 * of each size, and precompute each irregular course's boundaries. No source image or WASM. */
export function bakeStones(names:Family[]=families,seed=31):StoneBatch {
  const start=performance.now(), byWidthMs:Record<string,number>={}, planes:StonePlane[]=[];
  const lattices=grids.map(([cx,cy,offset])=>{
    const data=new Float64Array(cx*cy);
    for(let j=0;j<cy;j++) for(let i=0;i<cx;i++)data[j*cx+i]=hash(i,j,seed+offset);
    return {cx,cy,data};
  });
  const latticeBytes=lattices.reduce((sum,a)=>sum+a.data.byteLength,0);
  let retained=0, peakWorkingBytes=latticeBytes;
  for(const width of new Set(names.map(f=>profile[f].w))){
    const t0=performance.now(),height=width>>1;
    const gridsForSize=lattices.map(({cx,cy,data})=>{
      const left=new Uint16Array(width),right=new Uint16Array(width),rate=new Float64Array(width);
      for(let i=0;i<width;i++){
        const x=(i+.5)/width*cx,k=Math.floor(x);
        left[i]=k;right[i]=(k+1)%cx;rate[i]=sm(0,1,x-k);
      }
      const row=new Float64Array(width);
      function fill(v:number){
        const sy=v*cy,iy=Math.floor(sy),a=iy*cx,b=((iy+1)%cy)*cx,vertical=sm(0,1,sy-iy);
        for(let i=0;i<width;i++){
          const x=left[i],y=right[i],f=rate[i];
          row[i]=mix(mix(data[a+x],data[a+y],f),mix(data[b+x],data[b+y],f),vertical);
        }
      }
      return {fill,row,scratch:row.byteLength+left.byteLength+right.byteLength+rate.byteLength};
    });
    const ns=names.filter(f=>profile[f].w===width).map(family=>{
      const t=profile[family];
      const courses=Array.from({length:t.rows},(_,row)=>{
        const boundaries=new Float64Array(t.blocks+1),tones=new Float64Array(t.blocks),warm=new Uint8Array(t.blocks);
        for(let i=1;i<t.blocks;i++) boundaries[i]=(i+(hash(i,row,seed+8)-.5)*.51)/t.blocks;
        boundaries[t.blocks]=1;
        for(let i=0;i<t.blocks;i++){
          tones[i]=(hash(i,row,seed+12)-.5)*t.spread;
          warm[i]=encoded((t.warmth+(hash(i,row,seed+48)-.5)*t.tintStagger-warmthRange[0])/warmthRange[1]);
        }
        return {offset:.05+(row%2)*.099+(hash(row,1,seed)-.5)*.06,boundaries,tones,warm};
      });
      return {family,t,courses,pixels:new Uint8Array(width*height*4),cells:new Float32Array(width*height)};
    });
    peakWorkingBytes=Math.max(peakWorkingBytes,latticeBytes+retained+gridsForSize.reduce((sum,f)=>sum+f.scratch,0)+ns.reduce((n,a)=>n+a.cells.byteLength+a.pixels.byteLength+a.courses.reduce((n,c)=>n+c.boundaries.byteLength+c.tones.byteLength+c.warm.byteLength,0),0));
    const [chip,band,grains,low,pa,pb,wash,cloud]=gridsForSize.map(a=>a.row);
    for(let j=0;j<height;j++){
      const v=(j+.5)/height;
      for(const f of gridsForSize) f.fill(v);
      for(const {family,t,courses,pixels,cells} of ns){
        const yy=v*t.rows,row=Math.floor(yy),h=stoneSpan[1]/t.rows;
        const {offset,boundaries,tones,warm}=courses[row], tall=Math.min(yy-row,1+row-yy)*h;
        const cut=family==='cut',fixedJoint=family==='slate'||family==='apron';
        let block=0,prior=-1;
        for(let i=0;i<width;i++){
          let x=(i+.5)/width+offset;if(x>=1)x-=1;
          if(x<prior) block=0;
          while(x>=boundaries[block+1])block++;
          prior=x;
          const wide=Math.min(x-boundaries[block],boundaries[block+1]-x)*stoneSpan[0];
          const bed=Math.min(wide,tall)+(chip[i]-.49)*.003,mortar=cut?0:1-sm(.003,.009,bed);
          const d=band[i]-.5,g=grains[i]-.5,l=low[i]-.5,pores=sm(.66,.96,pa[i])*sm(.52,.86,pb[i]);
          const fill=t.bias+tones[block]+.013*d+.035*l+.025*g-.053*pores+.035*(cloud[i]-.5)+.023*(wash[i]-.5);
          const tone=mix(fill,t.joint+(fixedJoint?0:.025*g),mortar*t.jointDensity);
          const texel=j*width+i,k=4*texel;
          pixels[k]=encoded((tone-toneRange[0])/toneRange[1]);pixels[k+1]=warm[block];
          cells[texel]=t.relief*sm(.002,t.fillet,bed)+(1-mortar)*(d*t.bands+g*t.grains-pores*t.poreDepth+l*t.drift);
        }
      }
    }
    for(const {family,pixels,cells} of ns){
      const xs=width/(2*stoneSpan[0]),ys=height/(2*stoneSpan[1]);
      for(let j=0;j<height;j++){
        const row=j*width,p=(j===0?height-1:j-1)*width,n=(j+1===height?0:j+1)*width;
        for(let i=0;i<width;i++){
          const a=(cells[row+(i===0?width-1:i-1)]-cells[row+(i+1===width?0:i+1)])*xs,b=(cells[p+i]-cells[n+i])*ys;
          const d=Math.sqrt(1+a*a+b*b),k=4*(row+i);
          pixels[k+2]=encoded(.5+a/(2*d));pixels[k+3]=encoded(.5+b/(2*d));
        }
      }
      retained+=pixels.byteLength;
      planes.push({family,width,height,pixels});
    }
    byWidthMs[width]=performance.now()-t0;
  }
  return {kind:'stone-v1',planes,bakeMs:performance.now()-start,byWidthMs,peakWorkingBytes};
}
