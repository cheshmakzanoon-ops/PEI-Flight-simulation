/** Original former railway-shop exterior V4: local relative study with original low visitor front and roof setback, never a map actor. */
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial,ShapeUtils,Vector2,Vector3,type Material} from 'three'
import {FOUNDERS_PLAN as P} from './founders-exterior-plan.generated.ts'
import {foundersBuffMasonry} from './founders-buff-masonry.ts'
import {foundersRailGlass} from './root-original-founders-rail-glass.ts'
type UV=readonly [number,number];type XYZ=readonly [number,number,number];
type OpeningRole='historic-round-top'|'observed-west-three'|'annotated-visitor-link'|'annotated-tower-upper'|'annotated-tower-door';
const portal=(r:OpeningRole)=>r.startsWith('annotated-');
export type FoundersRole='mainRoof'|'visitorRoof'|'railBrick'|'visitorPale'|'brickHead'|'paleSill'|'curvedGlass'|'matchedMullion'|'westCrossbar'|'buffEntrancePanel'|'visitorLinkGlass'|'visitorFrame'|'tealEntranceCanopy'|'entranceCoping'|'lowVisitorPanel'|'raisedVisitorFrame'
const RG={mainRoof:'#5b6466',visitorRoof:'#98968d',railBrick:'#9c5941',visitorPale:'#b2a99b',brickHead:'#8e503d',paleSill:'#9d9f91',curvedGlass:'#303a3c',matchedMullion:'#6e8c79',westCrossbar:'#34413f',buffEntrancePanel:'#b9a99b',visitorLinkGlass:'#5f7470',visitorFrame:'#596c63',tealEntranceCanopy:'#375d59',entranceCoping:'#85463c',lowVisitorPanel:'#bfc1b7',raisedVisitorFrame:'#656b68'} as const
export function makeFoundersMaterial(role:FoundersRole,active=true):Material{
 if(role==='buffEntrancePanel')return foundersBuffMasonry(active);
 if(role==='curvedGlass'&&active)return foundersRailGlass();
 if(role==='visitorLinkGlass'&&active){const g=foundersRailGlass(.62);g.color.set(RG.visitorLinkGlass);return g;}
 const r=new MeshStandardMaterial({color:RG[role],roughness:role==='curvedGlass'?.255:.89,metalness:role==='curvedGlass'?.065:.015});r.name=role;
 if(active&&(role==='railBrick'||role==='brickHead')){
  r.customProgramCacheKey=()=>`pei-founders-masonry-original-v1:${role}`;
  r.onBeforeCompile=p=>{
   p.vertexShader='varying vec2 foundersM;\n'+p.vertexShader;
   p.vertexShader=p.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n foundersM=uv;');
   p.fragmentShader=`varying vec2 foundersM;
float cellarHash(vec2 k){vec3 h=fract(vec3(k.xyx)*vec3(.1031,.1042,.1027));h+=dot(h,h.yzx+21.17);return fract((h.x+h.y)*h.z);}
`+p.fragmentShader;
   p.fragmentShader=p.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 sz=vec2(.224,.074),fw=fwidth(foundersM)/sz,q=foundersM/sz;
 q.x+=mod(floor(q.y),2.)*.5;
 vec2 soft=max(vec2(.008),fw*.5),d=min(fract(q),1.-fract(q));
 vec2 solid=smoothstep(vec2(.020,.050)-soft,vec2(.020,.050)+soft,d);
 float vis=1.-smoothstep(.10,.84,max(fw.x,fw.y));
 float joint=(1.-solid.x*solid.y)*vis;
 float firingTone=sin(foundersM.x*.29+sin(foundersM.y*.25))*.032+sin(foundersM.x*.91+foundersM.y*.45)*.017;
 float grit=(cellarHash(floor(q))-.50)*.17*vis;
 diffuseColor.rgb=mix(diffuseColor.rgb*(1.+firingTone+grit),vec3(.273,.224,.177),joint*.67);
 `);
  }
 }
 return r
}
const original=P.outline as readonly UV[];
const ra=(x:number)=>Math.round(x*1e8)*1e-8;
const dist=(a:UV,b:UV)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const eq=(a:UV,b:UV)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
const deg=(p:UV,a:UV,b:UV)=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))/dist(a,b)<2e-7&&
 (p[0]-a[0])*(p[0]-b[0])+(p[1]-a[1])*(p[1]-b[1])<4e-6;
const actualEdge=(a:UV,b:UV)=>original.findIndex((p,i)=>deg(a,p,original[(i+1)%original.length])&&deg(b,p,original[(i+1)%original.length]));
const area=(p:readonly UV[])=>p.reduce((s,q,i)=>s+.5*(q[0]*p[(i+1)%p.length][1]-q[1]*p[(i+1)%p.length][0]),0);
const lerp=(p:UV,q:UV,t:number):UV=>[ra(p[0]+(q[0]-p[0])*t),ra(p[1]+(q[1]-p[1])*t)];
function clip(poly:readonly UV[],axis:0|1,val:number,side:1|-1):UV[]{
 const p:UV[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-val)*side,db=(b[axis]-val)*side,C=1e-8;
  if(da>=-C)p.push(a);
  if((da>C&&db< -C)||(da< -C&&db>C)){
   const e=lerp(a,b,(val-a[axis])/(b[axis]-a[axis]));p.push(axis===0?[val,e[1]]:[e[0],val]);
  }
 }
 return p.filter((a,i)=>i===0||!eq(a,p[i-1])).filter((a,i,b)=>i===0||i!==b.length-1||!eq(a,b[0]));
}
const tsp=(p:readonly UV[],holes:readonly UV[][]=[])=>ShapeUtils.triangulateShape(p.map(q=>new Vector2(...q)),holes.map(h=>h.map(q=>new Vector2(...q))));
const arch=(x:number,foot:number,width:number,head:number,rise:number,steps=10):UV[]=>{
 const half=width*.5,spring=head-rise,p:UV[]=[[x-half,foot],[x+half,foot]];
 for(let i=0;i<=steps;i++){
  const a=i*Math.PI/steps;p.push([x+Math.cos(a)*half,spring+Math.sin(a)*rise]);
 }
 return p;
}
const rectangle=(x:number,foot:number,width:number,head:number):UV[]=>[[x-width*.5,foot],[x+width*.5,foot],[x+width*.5,head],[x-width*.5,head]];
function profile(x:number,foot:number,w:number,h:number,r:number):UV[]{return r===0?rectangle(x,foot,w,h):arch(x,foot,w,h,r);}
const higher=([u,v]:UV)=>{const {origin,p}=P.higher;return p[0]+p[1]*(u-origin[0])-p[2]*Math.max(0,p[4]-v)-p[3]*Math.max(0,v-p[4]);};
const main=([u,v]:UV)=>{const {origin,p}=P.main;return p[0]+p[1]*(u-origin[0])+Math.max(0,p[2]-p[3]*Math.max(0,p[5]-v)-p[4]*Math.max(0,v-p[5]));};
const annexHigh=([,v]:UV)=>P.annexMixed.p[0]+P.annexMixed.p[3]*(v-P.annexMixed.origin[1]);
const annexLow=(_p:UV)=>P.annexLower.p[0];
const crest=P.main.p[5],ve0=crest-P.main.p[2]/P.main.p[3],ve1=crest+P.main.p[2]/P.main.p[4];
const fP={
 'upper-sw-observed-approximate':{U:[-1,P.broadUjoinIllustrativeOnly],levels:[-.01,P.oldBodyVsReturn],roof:higher,type:'main'},
 'old-rail-shop-roof-body':{U:[P.broadUjoinIllustrativeOnly,81],levels:[-.01,ve0,crest,ve1,P.oldBodyVsReturn],roof:main,type:'main'},
 'north-smaller-early-visitor-wing':{U:[-1,P.annexMixed.p[2]],levels:[P.oldBodyVsReturn,35],roof:annexHigh,type:'visitor'},
 'north-side-lower-visitor-shelf':{U:[P.annexMixed.p[2],81],levels:[P.oldBodyVsReturn,35],roof:annexLow,type:'visitor'}
} as const;

export function buildFoundersRailShop(material:(r:FoundersRole)=>Material=makeFoundersMaterial){
 const bag=new Map<FoundersRole,{p:number[];n:number[];uv:number[];component:number[];face:string[]}>();
 let idx=-1;
 const v=(p:XYZ)=>new Vector3(...p);
 const emit=(r:FoundersRole,a:XYZ,b:XYZ,c:XYZ,uv:readonly [UV,UV,UV],should:XYZ,face:string,isLayer=false,ownPart?:number)=>{
  const N=v(b).sub(v(a)).cross(v(c).sub(v(a)));if(N.lengthSq()<2e-18)return;
  const flip=N.dot(v(should))<0;if(flip)N.negate();N.normalize();
  const arr=bag.get(r)??{p:[],n:[],uv:[],component:[],face:[]};bag.set(r,arr);
  for(const i of flip?[0,2,1]:[0,1,2]){arr.p.push(...[a,b,c][i].map(ra));arr.n.push(N.x,N.y,N.z);arr.uv.push(...uv[i]);}
  arr.component.push(ownPart??(isLayer?255:idx));arr.face.push(face);
 };
 const direct=(role:FoundersRole,p:UV[],out:(p:UV)=>XYZ,normal:XYZ,face:string,layer=false)=>{
  for(const [i,j,k]of tsp(p))emit(role,out(p[i]),out(p[j]),out(p[k]),[p[i],p[j],p[k]],normal,face,layer);
 };
 const layers={series:0,westBays:0,panes:0,dividerTriangles:0,westCrossbars:0,visitorRecesses:0,canopyTriangles:0,lowLinkStudyPanels:0,raisedPedimentTriangles:0};
 const model:{part:number;subject:string;outline:UV[];roof:[number,number]}[]=[];
 for(const [name,s]of Object.entries(fP))for(let band=0;band<s.levels.length-1;band++){
  const strip=(lo:number,hi:number)=>{
   const q=clip(clip(clip(clip(original,0,s.U[0],1),0,s.U[1],-1),1,lo,1),1,hi,-1);
   return area(q)<0?q.reverse():q;
  }
  const ring=strip(s.levels[band],s.levels[band+1]);
  if(ring.length<3||Math.abs(area(ring))<1e-6)continue;idx++;
  const roof=(p:UV)=>s.roof(p)-P.datumIllustrativeOnly;
  const west=name==='upper-sw-observed-approximate',westCrest=P.higher.p[4];
  const isEarly=name==='north-smaller-early-visitor-wing';
  const i7=isEarly?ring.findIndex((a,j)=>actualEdge(a,ring[(j+1)%ring.length])===7):-1;
  if(isEarly&&i7<0)throw Error('Missing exact old visitor edge 7');
  const a7=i7<0?undefined:ring[i7],b7=i7<0?undefined:ring[(i7+1)%ring.length];
  const lowH=4.17,shift=.91,atDesign=(q:UV)=>[q[0],lowH,q[1]] as XYZ;
  const U7:UV=a7&&b7?[(b7[0]-a7[0])/dist(a7,b7),(b7[1]-a7[1])/dist(a7,b7)]:[0,0];
  const N7:XYZ=[U7[1],0,-U7[0]],lo7=a7&&b7?lerp(a7,b7,.055):undefined,hi7=a7&&b7?lerp(a7,b7,.945):undefined;
  const S7=(q:UV)=>[ra(q[0]-N7[0]*shift),ra(q[1]-N7[2]*shift)] as UV;
  const inLo=lo7?S7(lo7):undefined,inHi=hi7?S7(hi7):undefined;
  const details=lo7&&hi7&&inLo&&inHi?{lo7,hi7,inLo,inHi}:undefined;
  const topRing=details?ring.flatMap((a,i)=>i===i7?[a,details.lo7,details.inLo,details.inHi,details.hi7]:[a]):ring;
  const caps= west?[strip(s.levels[band],westCrest),strip(westCrest,s.levels[band+1])]:[topRing],tops=caps.flat().map(roof);
  model.push({part:idx,subject:name,outline:ring,roof:[Math.min(...tops),Math.max(...tops)]});
  const edges=(r:UV[])=>r.map((a,i)=>[a,r[(i+1)%r.length]] as const);
  const wallEdges=west?[
    ...caps.flatMap(edges).filter(([a,b])=>!(a[1]===westCrest&&b[1]===westCrest)&&actualEdge(a,b)!==6),
    ...edges(ring).filter(([a,b])=>actualEdge(a,b)===6),
  ]:details&&a7&&b7?edges(ring).flatMap(([a,b],i)=>i===i7?[[a7,details.lo7]as const,[details.hi7,b7]as const]:[[a,b]as const]):edges(ring);
  for(const cap of caps){
    direct(s.type==='main'?'mainRoof':'visitorRoof',cap,p=>[p[0],roof(p),p[1]],[0,1,0],name+'-roof');
    if(!details||!a7||!b7)direct('paleSill',cap,p=>[p[0],0,p[1]],[0,-1,0],name+'-sealed-floor');
    else{
     // Keep the old exact foundation plane. Seat the two new collinear façade breakpoints without a T-junction.
     const out=([x,z]:UV):XYZ=>[x,0,z],down:XYZ=[0,-1,0],face=name+'-sealed-floor';
     for(const tri of tsp(ring)){
      const p=tri.map(i=>ring[i]),f:UV[]=[];
      for(let i=0;i<3;i++){
       const a=p[i],b=p[(i+1)%3];f.push(a);
       if(a===a7&&b===b7)f.push(details.lo7,details.hi7);else if(a===b7&&b===a7)f.push(details.hi7,details.lo7);
      }
      if(f.length===3)emit('paleSill',out(f[0]),out(f[1]),out(f[2]),[f[0],f[1],f[2]],down,face);
      else{
       const c:UV=p.reduce<UV>((q,r)=>[q[0]+r[0]/3,q[1]+r[1]/3],[0,0]);
       for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length];emit('paleSill',out(a),out(b),out(c),[a,b,c],down,face);}
      }
     }
    }
  }
  for (const [a,b] of wallEdges){
   const dx=b[0]-a[0],dz=b[1]-a[1],len=dist(a,b),sE=actualEdge(a,b),n:XYZ=[dz/len,0,-dx/len];
   const tc=west&&sE===6&&(a[1]-westCrest)*(b[1]-westCrest)<0?(westCrest-a[1])/dz:undefined;
   const seam=west&&sE===6?caps.flat().find(p=>p[1]===westCrest&&deg(p,a,b)):undefined;
   const crease=tc!==undefined&&seam?{u:tc*len,p:seam}:undefined;
   function at(p:UV,inset=0):XYZ{
    if(crease&&inset===0&&p[0]===crease.u)return [crease.p[0],p[1],crease.p[1]];
    return [a[0]+dx*(p[0]/len)-n[0]*inset,p[1],a[1]+dz*(p[0]/len)-n[2]*inset];
   }
   const t0=roof(a),t1=roof(b);if(!(t0>4&&t1>4))throw Error('Invalid study roof branch');
   const visitorFace=false; // edge7 now has bounded positive relief below, never the old tall blank slot
   const towerFace=name==='north-smaller-early-visitor-wing'&&sE===9;
   const side:FoundersRole=s.type==='main'?'railBrick':towerFace?'buffEntrancePanel':'visitorPale';
   const lowA=details&&(a===details.lo7||a===details.hi7),lowB=details&&(b===details.lo7||b===details.hi7);
   const outer:UV[]=[[0,0],...(crease?[[crease.u,0]as UV]:[]),[len,0],...(lowB?[[len,lowH]as UV]:[]),[len,t1],...(crease?[[crease.u,roof(crease.p)]as UV]:[]),[0,t0],...(lowA?[[0,lowH]as UV]:[])];
   const frontRoof=(u:number)=>t0+(t1-t0)*u/len;
   const border=visitorFace||towerFace?[.04*len,.96*len]:undefined;
   const coping:UV[]|undefined=border?[[border[0],frontRoof(border[0])-.166],[border[1],frontRoof(border[1])-.166],[border[1],frontRoof(border[1])-.041],[border[0],frontRoof(border[0])-.041]]:undefined;
   const tallInset=towerFace?arch(.5*len,.131,.892*len,Math.min(t0,t1)-.38,.268):undefined;
   const openings:{x:number;foot:number;width:number;head:number;rise:number;role:OpeningRole}[]=[];
   if(sE===5&&s.type==='main'&&name==='old-rail-shop-roof-body'){
    const station=(u:number)=>(u-a[0])*len/dx;
    for(let u=21.25;u<75;u+=5.65){const c=station(u),w=2.98;if(c-w/2>.43&&c+w/2<len-.43)openings.push({x:c,foot:.52,width:w,head:Math.min(t0,t1)-1.14,rise:.67,role:'historic-round-top'});}
   }
   if(sE===6&&west){
    if(!(len>16.8&&len<17.1&&crease))throw Error('Wrong original west gable for entrance study');
    // The three round heads and dark mid-band are observed role counts only.
    // Approximate symbolic sizes in detached local metres; no photo-derived measurement.
    for(const [f,w,foot,rise]of [[.168,.222,.44,.76],[.492,.242,.38,.94],[.813,.218,.44,.76]]as const){
      const c=f*len,width=w*len;
      const toXZ=(u:number):UV=>[a[0]+dx*(u/len),a[1]+dz*(u/len)];
      const head=Math.min(roof(toXZ(c-width*.5)),roof(toXZ(c+width*.5)))-1.14;
      openings.push({x:c,foot,width,head,rise,role:'observed-west-three'});
    }
   }
   if(visitorFace){
    if(!(len>10&&len<11))throw Error('Unexpected edge 7 geometry');
    openings.push({x:.51*len,foot:.34,width:.408*len,head:Math.min(t0,t1)-.48,rise:0,role:'annotated-visitor-link'});
   }
   if(towerFace){
    if(!(len>4.9&&len<5.2))throw Error('Unexpected edge 9 geometry');
    openings.push({x:.5*len,foot:4.34,width:.73*len,head:Math.min(t0,t1)-1.08,rise:.56,role:'annotated-tower-upper'});
    openings.push({x:.5*len,foot:.30,width:.70*len,head:3.71,rise:0,role:'annotated-tower-door'});
   }
   const holes=openings.map(j=>profile(j.x,j.foot,j.width,j.head,j.rise));
   const insetDepth=tallInset?.068:0;
   function wall(perim:UV[],cuts:UV[][],r:FoundersRole,face:string,offset=0){
    const flat=[...perim,...cuts.flat()];
    for(const tri of tsp(perim,cuts)){
     // The signed neighboring edge endpoints remain exactly as in the V2 actor.
     const join:UV[]=[];
     for(let i=0;i<3;i++){
      const j=tri[i],k=tri[(i+1)%3],a=flat[j],b=flat[k],vx=b[0]-a[0],vy=b[1]-a[1],den=vx*vx+vy*vy;
      join.push(a);if(!(den>0))continue;
      join.push(...flat.map((p,m)=>[p,m,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/den] as const).filter(([p,m,t])=>m!==j&&m!==k&&t>1e-8&&t<1-1e-8&&Math.abs((p[1]-a[1])*vx-(p[0]-a[0])*vy)<1e-8).sort((p,q)=>p[2]-q[2]).map(j=>j[0]));
     }
     const add=(a:UV,b:UV,c:UV)=>emit(r,at(a,offset),at(b,offset),at(c,offset),[a,b,c],n,face);
     if(join.length===3)add(join[0],join[1],join[2]);else{
      const z:UV=tri.reduce<UV>((p,i)=>[p[0]+flat[i][0]/3,p[1]+flat[i][1]/3]as const,[0,0]as const);
      for(let j=0;j<join.length;j++)add(z,join[j],join[(j+1)%join.length]);
     }
    }
   }
   function rebate(loop:UV[],r:FoundersRole,offset:number,face:string){
    for(let j=0;j<loop.length;j++){
     const u=loop[j],v=loop[(j+1)%loop.length],du=v[0]-u[0],dv=v[1]-u[1],inward:XYZ=[-dx/len*dv,du,-dz/len*dv];
     emit(r,at(u),at(v),at(v,offset),[u,v,v],inward,face);
     emit(r,at(u),at(v,offset),at(u,offset),[u,v,u],inward,face);
    }
   }
   wall(outer,[...(tallInset?[tallInset]:holes),...(coping?[coping]:[])],side,`${name}-${sE}`);
   if(tallInset){
    rebate(tallInset,'brickHead',insetDepth,'annotated-tower-inset-rebate');
    wall(tallInset,holes,'brickHead','annotated-tower-inset-field',insetDepth);
   }
   if(coping){
    const role=towerFace?'annotated-tower-coping':'annotated-visitor-link-coping',d=.008;
    rebate(coping,'entranceCoping',d,role);
    direct('entranceCoping',coping,p=>at(p,d),n,role);
   }
   for(let j=0;j<holes.length;j++){
    const H=holes[j],o=openings[j],track=o.role,wing=portal(track),door=track==='annotated-tower-door';
    if(track==='historic-round-top')layers.series++;else if(wing)layers.visitorRecesses++;else layers.westBays++;
    const depth=insetDepth+(door?.76:wing?.36:.228),step=insetDepth+(wing?.135:.118),c=o.x,d=o.foot+.12,sw=o.width*.873,top=o.head-.17,k=o.rise*.87;
    const R=profile(c,d,sw,top,k);
    for(let g=0;g<H.length;g++){
     const e=(g+1)%H.length,from=H[g],to=H[e],u=R[g],v=R[e];
     const rt:FoundersRole=g===0?'paleSill':track==='annotated-visitor-link'||door?'visitorFrame':'brickHead';
     emit(rt,at(from,insetDepth),at(to,insetDepth),at(v,step),[from,to,v],n,track+'-chamfer');emit(rt,at(from,insetDepth),at(v,step),at(u,step),[from,v,u],n,track+'-chamfer');
     const dx2=R[e][0]-R[g][0],dy=R[e][1]-R[g][1],inward:XYZ=[-dx/len*dy,dx2,-dz/len*dy];
     emit(rt,at(u,step),at(v,step),at(v,depth),[u,v,v],inward,track+'-true-reveal');emit(rt,at(u,step),at(v,depth),at(u,depth),[u,v,u],inward,track+'-true-reveal');
    }
    direct(wing?'visitorLinkGlass':'curvedGlass',R,p=>at(p,depth),n,track+'-opaque-pane');layers.panes++;
    // Small separate matte surface ribbons. Positive depth overlap with the opaque pane,
    // no role substitution, no in-world frame count claim, and no silhouette outside the recess.
    const adjacent=.011,grid=(gold:UV[],wide=false)=>{
     const offset=wide?.032:adjacent,finish=wide?'westCrossbar':wing?'visitorFrame':'matchedMullion';
     for(const [i,j,k]of tsp(gold)){emit(finish,at(gold[i],depth-offset),at(gold[j],depth-offset),at(gold[k],depth-offset),[gold[i],gold[j],gold[k]],n,track+(wide?'-authored-dark-crossbar':'-authored-dividers'),true);if(wide)layers.westCrossbars++;else layers.dividerTriangles++;}
    };
    const railHalf=wing?.035:.023;
    for(const f of door?[0]:[-.25,0,.25]){
     const x=c+sw*f,rel=(Math.abs(f)*sw+railHalf)/(sw*.5),end=top-k+k*Math.sqrt(Math.max(0,1-rel*rel))-.05;
     grid([[x-railHalf,d+.004],[x+railHalf,d+.004],[x+railHalf,end],[x-railHalf,end]]);
    }
    for(const f of door?[.71]:track==='observed-west-three'?[.23,.74]:[.23,.52,.79]){
     const y=d+(top-k-d)*f,half=sw*.5-.006;grid([[c-half,y-.021],[c+half,y-.021],[c+half,y+.021],[c-half,y+.021]]);
    }
    if(door){
     // Positive-thickness shallow curved hood, kept entirely INSIDE the old hull:
     // behind its signed external plane and independently ahead of the recessed door.
     const half=sw*.476,outerDepth=insetDepth+.028,innerDepth=insetDepth+.706,thickness=.086;
     const cover=Array.from({length:11},(_,i)=>{
      const q=i/10*2-1;
      return [c+half*q,2.96+.24*Math.sqrt(Math.max(0,1-q*q))] as UV;
     });
     const sh=(j:number,y:number,dp:number)=>at([cover[j][0],cover[j][1]+y],dp);
     const shade=(a:XYZ,b:XYZ,c:XYZ,d:XYZ,expect:XYZ)=>{
      const u=[a[0],a[1]] as UV,v=[b[0],b[1]] as UV,w=[c[0],c[1]] as UV,z=[d[0],d[1]] as UV;
      emit('tealEntranceCanopy',a,b,c,[u,v,w],expect,track+'-closed-hood',false,254);
      emit('tealEntranceCanopy',a,c,d,[u,w,z],expect,track+'-closed-hood',false,254);layers.canopyTriangles+=2;
     };
     const reverse:XYZ=[-n[0],0,-n[2]];
     for(let j=0;j<cover.length-1;j++){
      const k=j+1;
      shade(sh(j,0,outerDepth),sh(k,0,outerDepth),sh(k,0,innerDepth),sh(j,0,innerDepth),[0,1,0]);
      shade(sh(j,-thickness,outerDepth),sh(k,-thickness,outerDepth),sh(k,-thickness,innerDepth),sh(j,-thickness,innerDepth),[0,-1,0]);
      shade(sh(j,0,outerDepth),sh(k,0,outerDepth),sh(k,-thickness,outerDepth),sh(j,-thickness,outerDepth),n);
      shade(sh(j,0,innerDepth),sh(k,0,innerDepth),sh(k,-thickness,innerDepth),sh(j,-thickness,innerDepth),reverse);
     }
     for(const q of [0,cover.length-1]){
      const s=q===0?-1:1;shade(sh(q,0,outerDepth),sh(q,-thickness,outerDepth),sh(q,-thickness,innerDepth),sh(q,0,innerDepth),[s*dx/len,0,s*dz/len]);
     }
    }
    if(track==='observed-west-three'){
     const y=d+(top-k-d)*.48,half=sw*.5-.010;grid([[c-half,y-.089],[c+half,y-.089],[c+half,y+.089],[c-half,y+.089]],true);
    }
   }
  }

  if(details){
   const {lo7,hi7,inLo,inHi}=details,L=dist(lo7,hi7);
   const yAt=(x:number)=>roof(lerp(inLo,inHi,x/L));
   const asWall=(xy:UV,inset=0,back=false):XYZ=>{
    const a=back?inLo:lo7,b=back?inHi:hi7,k=xy[0]/L;
    return [a[0]+(b[0]-a[0])*k-N7[0]*inset,xy[1],a[1]+(b[1]-a[1])*k-N7[2]*inset];
   };
   const unitRight:XYZ=[U7[0],0,U7[1]],unitLeft:XYZ=[-U7[0],0,-U7[1]];
   direct('visitorRoof',[lo7,hi7,inHi,inLo],atDesign,[0,1,0],'v4-lower-front-roof');
   const quad=(r:FoundersRole,q:readonly [XYZ,XYZ,XYZ,XYZ],should:XYZ,tag:string,part?:number)=>{
    const [a,b,c,d]=q,uv=(q:XYZ):UV=>[q[0]+q[2]*.619,q[1]];
    emit(r,a,b,c,[uv(a),uv(b),uv(c)],should,tag,false,part);
    emit(r,a,c,d,[uv(a),uv(c),uv(d)],should,tag,false,part);
   };
   for(const [p,q,n] of [[lo7,inLo,unitRight],[hi7,inHi,unitLeft]]as const){
    quad('raisedVisitorFrame',[[p[0],lowH,p[1]],[q[0],lowH,q[1]],[q[0],roof(q),q[1]],[p[0],roof(p),p[1]]],n,'v4-exposed-opaque-return');
   }
   function faceWork(back:boolean){
    const tint:FoundersRole=back?'raisedVisitorFrame':'lowVisitorPanel';
    const Y=back?lowH:0,wall:UV[]=[[0,Y],[L,Y],[L,back?yAt(L):lowH],[0,back?yAt(0):lowH]];
    const insetFace=(p:UV,d=0)=>asWall(p,d,back);
    const k=.38*L,wide=.235*L,lowTag=back?'v4-recessed-upper-strip':'v4-lower-horizontal-cladding';
    const extraShape=back?undefined:rectangle(k,.117,wide,lowH-.052);
    const openings:UV[][]=back?[rectangle(.53*L,lowH+.36,.78*L,Math.min(yAt(0),yAt(L))-.85)]:[
     rectangle(.123*L,.22,.211*L,3.0),rectangle(.735*L,.22,.455*L,3.0)
    ];
    function skin(outer:UV[],holes:UV[][],r:FoundersRole,tag:string,d=0){
     for(const [i,j,k] of tsp(outer,holes)){
      const flat=[...outer,...holes.flat()],p=[flat[i],flat[j],flat[k]]as const;
      emit(r,insetFace(p[0],d),insetFace(p[1],d),insetFace(p[2],d),p,N7,tag);
     }
    }
    function reveal(hole:UV[],d1:number,d2:number,r:FoundersRole,tag:string){
     for(let j=0;j<hole.length;j++){
      const a=hole[j],b=hole[(j+1)%hole.length],du=b[0]-a[0],dv=b[1]-a[1],toward:XYZ=[-U7[0]*dv,du,-U7[1]*dv];
      emit(r,insetFace(a,d1),insetFace(b,d1),insetFace(b,d2),[a,b,b],toward,tag);
      emit(r,insetFace(a,d1),insetFace(b,d2),insetFace(a,d2),[a,b,a],toward,tag);
     }
    }
    function glass(h:UV[],start:number,tag:string,rails:number){
     const d=start+.19,LW=h[0][0],RW=h[1][0],floor=h[0][1],top=h[2][1];
     reveal(h,start,d,'visitorFrame',tag+'-reveal');
     direct('visitorLinkGlass',h,p=>insetFace(p,d),N7,tag+'-glass');layers.lowLinkStudyPanels++;
     const run=(q:UV[])=>direct('visitorFrame',q,p=>insetFace(p,d-.013),N7,tag+'-frames',true);
     for(let j=1;j<=rails;j++) run(rectangle(LW+(RW-LW)*(j/(rails+1)),floor+.004,.061,top-.004));
     const lower=floor+(top-floor)*.676;
     run(rectangle((LW+RW)*.5,lower-.04,(RW-LW)-.008,lower+.04));
    }
    skin(wall,extraShape?[...openings,extraShape]:openings,tint,lowTag);
    for(const [i,h]of openings.entries())glass(h,0,lowTag+'-'+i,back?4:i===0?1:2);
    if(extraShape){
     const d=.059,door=rectangle(k,.228,wide*.644,2.55);
     reveal(extraShape,0,d,'brickHead','v4-red-portal-sides');
     skin(extraShape,[door],'brickHead','v4-red-portal-inset',d);
     glass(door,d,'v4-red-portal-date-qualified',1);
    }
   }
   faceWork(false);faceWork(true);
   // Closed independent rounded red heading above the lower fascia, tucked behind the signed front line.
   const c=.38*L,width=.235*L,rail=lowH-.03;
   const ped=arch(c,rail,width,lowH+1.13,.75,10);
   const pD=.058,qD=.291,nFlip:XYZ=[-N7[0],0,-N7[2]],label='v4-rounded-brick-head';
   for(const [i,j,k]of tsp(ped)){
    const uv=[ped[i],ped[j],ped[k]]as const;
    emit('brickHead',asWall(uv[0],pD),asWall(uv[1],pD),asWall(uv[2],pD),uv,N7,label,false,253);
    emit('brickHead',asWall(uv[0],qD),asWall(uv[1],qD),asWall(uv[2],qD),uv,nFlip,label,false,253);layers.raisedPedimentTriangles+=2;
   }
   for(let i=0;i<ped.length;i++){
    const a=ped[i],b=ped[(i+1)%ped.length],du=b[0]-a[0],dv=b[1]-a[1],out:XYZ=[U7[0]*dv,-du,U7[1]*dv];
    quad(i===0?'brickHead':'entranceCoping',[asWall(a,pD),asWall(b,pD),asWall(b,qD),asWall(a,qD)],out,label+'-rim',253);
    layers.raisedPedimentTriangles+=2;
   }
  }
 }
 const group=new Group();group.name='Founders former railway shop: arched west facade with separate visitor-link study, not world position';let triangles=0;
 for(const [r,b]of bag){
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(b.p,3)).setAttribute('normal',new Float32BufferAttribute(b.n,3)).setAttribute('uv',new Float32BufferAttribute(b.uv,2));
  g.computeBoundingBox();g.computeBoundingSphere();g.userData.kind=r;g.userData.component=Uint8Array.from(b.component);g.userData.face=b.face;
  const m=new Mesh(g,material(r));m.name=r;group.add(m);triangles+=b.p.length/9;
 }
 return {group,triangles,batches:bag.size,roles:layers,parts:model,old:original,roofCreaseV:crest,authoredStepOnly:[P.broadUjoinIllustrativeOnly,P.annexMixed.p[2]],datumNotWorld:P.datumIllustrativeOnly};
}
