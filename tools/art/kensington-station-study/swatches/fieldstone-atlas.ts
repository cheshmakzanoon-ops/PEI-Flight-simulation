import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat,
  SRGBColorSpace, UnsignedByteType,
} from 'three';

const SIDE=768, METRES=3.84, STEP=METRES/SIDE;
type Stone={
  x:number;y:number;r:number;aspect:number;angle:number; knots:number[];
  s:number;c:number; aimX:number;aimY:number; bump:number; tint:number[];
};
const palette=[
  [101,87,72],[123,109,92],[127,114,96],[93,94,88],[141,121,97],
  [118,97,75],[112,107,95],[136,113,90],[89,82,73],[127,127,123],
] as const;
const loop=(x:number,n:number)=>x-n*Math.floor(x/n);
const smooth=(t:number)=>t*t*(3-2*t);
const fit=(t:number)=>Math.max(0,Math.min(1,t));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const byte=(v:number)=>Math.round(Math.max(0,Math.min(255,v)));
function integer(x:number,y:number,seed:number){
  let h=Math.imul(x+71017,741103597)^Math.imul(y+3239,1597334677)^Math.imul(seed+599,666391);
  h=Math.imul(h^(h>>>16),73244475);h=Math.imul(h^(h>>>16),73244475);
  return ((h^(h>>>16))>>>0)/4294967296;
}
function noise(x:number,y:number,band:number,seed:number){
  const a=x*band,b=y*band,i=Math.floor(a),j=Math.floor(b);
  const x0=loop(i,band),x1=loop(i+1,band),y0=loop(j,band),y1=loop(j+1,band);
  const u=smooth(a-i),v=smooth(b-j);
  return mix(mix(integer(x0,y0,seed),integer(x1,y0,seed),u),mix(integer(x0,y1,seed),integer(x1,y1,seed),u),v);
}
function packStones(){
  let q=0x894a7f2b;
  const random=()=>{q=(q+0x6d2b79f5)|0;let t=Math.imul(q^(q>>>15),1|q);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
  const grid=24, cells:number[][]=Array.from({length:grid**2},()=>[]), stones:Stone[]=[];
  const slot=(x:number,y:number)=>loop(x,grid)+loop(y,grid)*grid;
  const delta=(p:number)=>p-METRES*Math.round(p/METRES);
  const support=(a:Stone,hx:number,hy:number)=>a.r/Math.hypot(hx*a.c+hy*a.s,(hy*a.c-hx*a.s)/a.aspect);
  // Sequential joint packing; capstone, usual rounded cobble, and wedged chips.
  // These are independent artistic scale classes, not sizes measured in the station wall.
  for(const [n,rMin,rMax] of [[660,.067,.108],[2500,.045,.071],[4450,.026,.053],[4700,.012,.025]] as const){
    for(let i=0;i<n;i++){
      const x=random()*METRES,y=random()*METRES,r=mix(rMin,rMax,random()**1.38);
      const a=random()*2*Math.PI, aspect=mix(.62,1.12,random());
      const color=palette[Math.floor(random()*palette.length)];
      const w=(random()-.5)*13;
      const s:Stone={x,y,r,aspect,angle:a,c:Math.cos(a),s:Math.sin(a),
        knots:Array.from({length:7},()=>mix(.78,1.17,random())),
        aimX:(random()-.5)*.28,aimY:(random()-.5)*.28,
        bump:mix(.008,.018,random())*(.8+.2*r/.10),
        tint:[color[0]+w,color[1]+w,color[2]+w],
      };
      const gx=Math.floor(x*grid/METRES),gy=Math.floor(y*grid/METRES);
      let free=true;
      for(let j=-2;j<=2&&free;j++)for(let k=-2;k<=2&&free;k++)for(const i of cells[slot(gx+k,gy+j)]){
        const o=stones[i],dx=delta(o.x-x),dy=delta(o.y-y);
        if(Math.abs(dx)>r*1.3+o.r*1.3+.04||Math.abs(dy)>r*1.3+o.r*1.3+.04)continue;
        const d=Math.hypot(dx,dy);
        if(d<.0001||d<.79*(support(s,dx/d,dy/d)+support(o,-dx/d,-dy/d))+.0065){free=false;break;}
      }
      if(free){cells[slot(gx,gy)].push(stones.length);stones.push(s);}
    }
  }
  return stones;
}
function build(){
  const a=new Uint8Array(SIDE**2*4), no=new Uint8Array(SIDE**2*4);
  const h=new Float32Array(SIDE**2), masks=new Float32Array(SIDE**2);
  // Periodic generic mineral grain: no photo, baked sky, or pasted surface.
  for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
    const i=x+y*SIDE,p=i*4,u=(x+.5)/SIDE,v=(y+.5)/SIDE;
    const wear=(noise(u,v,5,23)-.5)*16+(noise(u,v,28,77)-.5)*9;
    const grit=noise(u,v,98,9)-.5, ch=integer(x,y,800)-.5;
    a[p]=byte(100+wear+10*grit+3*ch);a[p+1]=byte(89+wear+10*grit+3*ch);a[p+2]=byte(78+wear+10*grit+3*ch);a[p+3]=255;
    h[i]=grit*.0018+ch*.0004;
  }
  const stones=packStones();
  for(const s of stones){
    const seed=Math.floor((s.angle+1)*1349),reach=1.30*s.r;
    const x0=Math.floor((s.x-reach)/STEP),x1=Math.ceil((s.x+reach)/STEP),
          y0=Math.floor((s.y-reach)/STEP),y1=Math.ceil((s.y+reach)/STEP);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const dx=((x+.5)*STEP-s.x)/s.r,dy=((y+.5)*STEP-s.y)/s.r;
      const u=dx*s.c+dy*s.s, v=(dy*s.c-dx*s.s)/s.aspect;
      const length=Math.hypot(u,v);if(length>1.205)continue;
      const ang=loop(Math.atan2(v,u)/Math.PI*.5,1)*7, j=Math.floor(ang);
      const radius=mix(s.knots[j],s.knots[(j+1)%7],mix(ang-j,smooth(ang-j),.48));
      const edge=(radius-length)*s.r;
      const cover=fit(.5+edge/STEP);if(cover<=0)continue;
      const xx=loop(x,SIDE),yy=loop(y,SIDE),ind=xx+yy*SIDE,k=ind*4;
      const tx=(xx+.5)/SIDE,ty=(yy+.5)/SIDE;
      const fleck=noise(tx,ty,157,seed)-.5, face=noise(tx,ty,57,seed)-.5, grain=integer(xx,yy,seed)-.5;
      const pebble=smooth(fit(edge/.017+.02));
      const raised=pebble*s.bump*(.60+.40*Math.sqrt(fit(1-(u-s.aimX)**2-(v-s.aimY)**2))+.37*face)+.00072*fleck;
      if(raised+.0003<h[ind]&&masks[ind]>0)continue;
      const broad=(noise(tx,ty,5,23)-.5)*12, chips=11*fleck+12*face+3.3*grain;
      // Short ambient interstices along the material itself, never a sun/shadow paint.
      const shade=.93+.07*smooth(fit(edge/.012));
      for(let c=0;c<3;c++)a[k+c]=byte(mix(a[k+c],s.tint[c]*shade+chips+broad,cover));
      h[ind]=mix(h[ind],raised,cover);
      masks[ind]=Math.max(masks[ind],cover);
    }
  }
  for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
    const i=x+y*SIDE,p=i*4;
    const dx=(h[loop(x+1,SIDE)+y*SIDE]-h[loop(x-1,SIDE)+y*SIDE])/(2*STEP),
          dy=(h[x+loop(y+1,SIDE)*SIDE]-h[x+loop(y-1,SIDE)*SIDE])/(2*STEP);
    const a=-dx*.83,b=-dy*.83,j=1/Math.hypot(a,b,1);
    no[p]=byte(127.5+127.5*a*j);no[p+1]=byte(127.5+127.5*b*j);no[p+2]=byte(127.5+127.5*j);no[p+3]=255;
  }
  function tex(bytes:Uint8Array,sRGB:boolean){
    const texture=new DataTexture(bytes,SIDE,SIDE,RGBAFormat,UnsignedByteType);
    if(sRGB)texture.colorSpace=SRGBColorSpace;
    texture.wrapS=texture.wrapT=RepeatWrapping;
    texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;
    texture.repeat.setScalar(1/METRES);texture.generateMipmaps=true;texture.anisotropy=8;
    texture.name=sRGB?'Kensington original periodic fieldstone colour':'Kensington original periodic fieldstone relief';
    texture.needsUpdate=true;
    return texture;
  }
  const occupied=masks.reduce((sum,x)=>sum+x,0)/masks.length;
  const lut=Array.from({length:256},(_,i)=>{const n=i/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
  const mean=[0,0,0];for(let i=0;i<a.length;i+=4)for(let k=0;k<3;k++)mean[k]+=lut[a[i+k]];
  mean.forEach((n,i)=>mean[i]=n/SIDE**2);
  return {map:tex(a,true),normalMap:tex(no,false),mean,recipe:{stoneCount:stones.length,occupied,metres:METRES,resolution:SIDE}};
}
let tiles:ReturnType<typeof build>|undefined;
/** Detached artist atlas. Call only for an admitted local variant or the studio preview. */
export function originalFieldstoneAtlas(){return tiles??=build();}
