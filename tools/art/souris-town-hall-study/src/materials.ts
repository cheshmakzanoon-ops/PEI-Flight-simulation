import * as T from 'three';
export type Role='wall'|'trim'|'roofSide'|'roofCrown'|'wood'|'shadow'|'glass'|'letter'|'foundation';
export const roles:readonly Role[]=['wall','trim','roofSide','roofCrown','wood','shadow','glass','letter','foundation'];
export const palettes:Record<Role,{colour:readonly [number,number,number];roughness:number;metalness:number; coating:number}>={
 wall:{colour:[255,255,255],roughness:.86,metalness:0,coating:0},trim:{colour:[255,255,255],roughness:.83,metalness:0,coating:0},
 roofSide:{colour:[255,255,255],roughness:.78,metalness:.02,coating:0},roofCrown:{colour:[255,255,255],roughness:.64,metalness:.22,coating:.07},
 wood:{colour:[63,52,44],roughness:.81,metalness:0,coating:0},shadow:{colour:[69,62,55],roughness:.97,metalness:0,coating:0},
 glass:{colour:[76,91,103],roughness:.185,metalness:.14,coating:.56},letter:{colour:[76,60,45],roughness:.88,metalness:0,coating:0},
 foundation:{colour:[111,99,82],roughness:.91,metalness:0,coating:0},
};
const fract=(x:number)=>x-Math.floor(x), H=(a:number,b:number,k=0)=>fract(Math.sin(a*127.1+b*311.7+k*34.52)*43758.5453123);
const C=(x:number)=>Math.min(1,Math.max(0,x));
const lerp=(a:number,b:number,x:number)=>a+(b-a)*x;
function dNoise(x:number,y:number,wrapX:number,wrapY:number,seed:number){
 const i=Math.floor(x),j=Math.floor(y),t=fract(x),u=fract(y),a=t*t*(3-2*t),b=u*u*(3-2*u);
 const s=(n:number,k:number)=>H(((n%wrapX)+wrapX)%wrapX,((k%wrapY)+wrapY)%wrapY,seed);
 return lerp(lerp(s(i,j),s(i+1,j),a),lerp(s(i,j+1),s(i+1,j+1),a),b);
}
const buildRows=(r:number,w:number,seed:number)=>Array.from({length:r},(_,j)=>{
 const widths=Array.from({length:w},(_,i)=>.52+H(i,j,seed)*1.15),z=widths.reduce((a,b)=>a+b,0);
 let s=0;return [...widths.map(q=>{const p=s;s+=q/z;return p;}),1];
});
const ashlar=buildRows(10,7,3),shingle=buildRows(18,11,32);
const fasciaRows=buildRows(1,10,4)[0]; // course heights and widths differ independently

const smooth=(a:number,b:number,x:number)=>{const t=C((x-a)/(b-a));return t*t*(3-2*t);};
export function makeStoneTile(role:Role,size=512){
 if(!['wall','trim','roofSide','roofCrown'].includes(role))return undefined;
 const wall=role==='wall',trim=role==='trim',roof=role==='roofSide';
 const meter:readonly [number,number]=wall?[3.68,2.52]:trim?[1.70,1.54]:roof?[2.58,1.62]:[3.20,3.0];
 const maps=new Uint8Array(size*size*4),norm=new Uint8Array(maps.length),heights=new Float32Array(size*size);
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=(i+.5)/size,y=(j+.5)/size;
  const cloud=dNoise(x*9,y*8,9,8,4)-.5, chips=dNoise(x*85,y*64,85,64,9)-.5;
  const grit=.62*(dNoise(x*194,y*144,194,144,14)-.5)+.38*(H(i,j,52)-.5);
  const scratches=dNoise(x*142,y*73,142,73,28)-.5;
  const shift=dNoise(x*25,y*21,25,21,64)-.5;
  const scaleChips=dNoise(x*43,y*32,43,32,105)-.5, coarse=dNoise(x*12,y*17,12,17,8)-.5;
  let a:number,b:number,c:number,h:number;
  if(wall||roof){
   const rs=wall?ashlar:shingle;
   const aligned=fract(y+(wall?.0115:.0013)*shift+(wall?.0092:0)*coarse);
   let row=Math.floor(aligned*rs.length),yf=fract(aligned*rs.length),height=meter[1]/rs.length;
   if(wall){row=0;while(row+1<fasciaRows.length-1&&aligned>=fasciaRows[row+1])row++;
    height=meter[1]*(fasciaRows[row+1]-fasciaRows[row]);yf=(aligned-fasciaRows[row])/(fasciaRows[row+1]-fasciaRows[row]);}
   const e=fract(x+.49*H(row,82,3)+(wall?.019:.0039)*cloud+(wall?.0110:.0018)*chips+(wall?.0054:0)*scaleChips);
   const list=rs[row];let l=0;while(l+1<list.length-1&&e>=list[l+1])l++;
   const lo=list[l],hi=list[l+1],du=Math.min(e-lo,hi-e)*meter[0];
   const dv=Math.min(yf,1-yf)*height;
   const gap=Math.min(du,dv*1.14),edge=smooth(wall?.0035:.0010,wall?.018:.0055,gap+Math.max(0.,(wall?.012:0)*scaleChips));
   const hue=H(l,row,84),lt=H(l,row,18)-.5;
   const noise=9.5*cloud+12.5*chips+16.5*grit;
   if(wall){
    const dry=H(row,l,62),weather=H(l,row,137);
    const color=[135+30*lt-17*hue-18*weather,85+23*lt+11*hue-7*weather,61+19*lt+12*hue-7*weather];
    const broad=smooth(.012,.094,gap), breakFace=smooth(-.29,.32,.64*scaleChips+.62*chips+.47*coarse-.05*grit)-.48;
    const faced=.047*Math.tanh(6.1*(yf-.38)+3.5*coarse)*(dry-.55)*broad;
    h=-.0066 + edge*(.0105+broad*(.0133+lt*.0105)+.0129*breakFace+.0099*scaleChips+.0059*coarse+faced)+.0021*grit;
    const cool=weather> .74 ? .70 : 1.;
    const rock=18.2*breakFace+11.6*coarse+17.6*scaleChips +9.2*grit;
    a=lerp(92+noise*.48,color[0]+rock+5*broad,edge);b=lerp(81+noise*.41,color[1]+rock*.92+4*broad,edge);c=lerp(67+noise*.37,color[2]+rock*.85+3*broad,edge);
    a*=.95+.05*cool;

   }else{
    const v=73+15*lt+9.3*cloud+14*chips+12*grit+6*scratches;
    a=lerp(52,v+6,edge);b=lerp(51,v+1,edge);c=lerp(47,v-5,edge);
    h=edge*(.0027+.0033*yf+.0023*chips)+.0014*grit;
   }
  }else if(trim){
   const w=17*cloud+21*chips+14*grit+9*scratches+11.5*scaleChips;
   a=176+w;b=157+w*.96;c=122+w*.88;h=.009*cloud+.0055*chips+.0029*grit+.0042*scaleChips;
  }else{
   const w=9*cloud+6*chips+8*grit;
   a=79+w;b=82+w;c=81+w;h=.004*cloud+.0016*chips+.0007*grit;
  }
  const k=(j*size+i)*4;maps.set([a,b,c,255].map(v=>Math.max(0,Math.min(255,Math.round(v)))),k);heights[j*size+i]=h;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const h=(i:number,j:number)=>heights[((j+size)%size)*size+(i+size)%size];
  const a=(h(x-1,y)-h(x+1,y))*size/(2*meter[0]),b=(h(x,y-1)-h(x,y+1))*size/(2*meter[1]);
  const k=(y*size+x)*4,m=1/Math.hypot(a,b,1);
  norm.set([Math.round(127.5*(1+a*m)),Math.round(127.5*(1+b*m)),Math.round(127.5*(1+m)),255],k);
 }
 return {maps,norm,size,repeat:meter.map(x=>1/x) as [number,number]};
}
function texture(data:Uint8Array,size:number,repeat:readonly [number,number],rgb:boolean){
 const t=new T.DataTexture(data,size,size,T.RGBAFormat);
 t.wrapS=T.RepeatWrapping;t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;
 t.colorSpace=rgb?T.SRGBColorSpace:T.NoColorSpace;t.repeat.set(...repeat);t.needsUpdate=true;return t;
}
export function makeMaterials(textured=true){
 const materials=new Map<Role,T.MeshPhysicalMaterial>();
 for(const name of roles){
  const r=palettes[name],fallback:Partial<Record<Role,readonly [number,number,number]>>={wall:[127,86,61],trim:[172,153,117],roofSide:[72,67,60],roofCrown:[79,82,81]};
  const p=textured?r.colour:fallback[name]??r.colour;
  const c=new T.Color().setRGB(p[0]/255,p[1]/255,p[2]/255,T.SRGBColorSpace);
  const m=new T.MeshPhysicalMaterial({color:c,roughness:r.roughness,metalness:r.metalness,clearcoat:r.coating,clearcoatRoughness:.26,vertexColors:true});
  if(textured){
   const p=makeStoneTile(name);
   if(p){m.map=texture(p.maps,p.size,p.repeat,true);m.normalMap=texture(p.norm,p.size,p.repeat,false);m.normalScale.setScalar(name==='wall'?.83:name==='trim'?.53:.45);}
  }
  m.envMapIntensity=name==='glass'?.68:.40;materials.set(name,m);
 }
 return materials;
}
