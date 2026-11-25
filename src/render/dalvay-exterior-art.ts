import * as T from 'three';
import {DalvayMesh,DalvayRoofs,clipPoly,xz,type UV,type P,type Skin} from './dalvay-art-mesh.ts';
import {project} from '../sim/geo.ts';

/** Original, qualitative exterior in the single existing AEB socket. Neither the
 * old stored box height nor the failed independent survey is a measured roofline. */
const origin=project(-63.07337348670973,46.41470500130027);
const STONE=0x93694f,ASH=0xaa8770,BUFF=0xb49a82,CREAM=0xf0eadb,EDGE=0xd6d1bc,TIMBER=0xe9e4d5,
 GREEN=0x454e41,GREEN2=0x4f5846,GABLED=0x465240,STEPS=0xa39986,DOOR=0x504135,GLASS=0x52636a;
type Frame={at:(s:number,y:number,out?:number)=>P,normal:UV};
const frame=(a:UV,b:UV,n:UV):Frame=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);return {normal:n,at:(s,y,o=0)=>[a[0]+(b[0]-a[0])*s/len+n[0]*o,y,a[1]+(b[1]-a[1])*s/len+n[1]*o]};};
const face=(axis:'u'|'v',value:number,out:-1|1):Frame=>axis==='u'?frame([value,0],[value,1],[out,0]):frame([0,value],[1,value],[0,out]);
type Opening={x:number,width:number,bottom:number,top:number,door?:boolean,entrance?:boolean,group?:number};
const win=(x:number,width=1.12,bottom=4.43,top=6.22,group=1):Opening=>({x,width,bottom,top,group});
const door=(x:number,width=1.45,bottom=.34,top=2.80):Opening=>({x,width,bottom,top,door:true});
const area=(p:UV[])=>Math.abs(p.reduce((a,q,i)=>a+q[0]*p[(i+1)%p.length][1]-q[1]*p[(i+1)%p.length][0],0))*.5;
export function makeDalvayExterior(floor:(x:number,z:number)=>number){
 const amp=new DalvayMesh(),roofs=new DalvayRoofs(amp),group=new T.Group();
 const ground=floor(origin.x,origin.z);if(!Number.isFinite(ground))throw Error('Dalvay: no original terrain');
 group.position.set(origin.x,ground,origin.z);group.name='Dalvay-by-the-Sea · documentary exterior';
 const h=(u:number,v:number)=>{const a=xz(u,v);const k=floor(origin.x+a[0],origin.z+a[1])-ground;if(!Number.isFinite(k)||Math.abs(k)>1)throw Error('Dalvay: incompatible game grade');return k;};
 const wallRanges:{role:string,masonry:[number,number],render:[number,number]}[]=[],walls:{role:string,range:number[]}[]=[],feet:P[][]=[],openings:{door:boolean,corners:P[]}[]=[],roofsSemantic:{role:string,axis:'u'|'v',ridge:P[],eaves:P[]}[]=[];
 const features:{role:string,parts:Record<string,[number,number]>}[]=[];
 const feature=(role:string,emit:()=>void)=>{const names=Object.keys(amp.bins) as Skin[],first=names.map(n=>amp.bins[n].pos.length/9);emit();const parts:Record<string,[number,number]>={};names.forEach((n,i)=>{const end=amp.bins[n].pos.length/9;if(end>first[i])parts[n]=[first[i],end-first[i]];});features.push({role,parts});};
 const groundFeatures:{role:string,firstTriangle:number,triangles:number,lowerVertices:number[],upperEdgeVertices?:number[]}[]=[];
 const skirt=(f:Frame,lo:number,hi:number,up=.36,shade=STONE,role='foundation',uvOffset=0)=>{
  const at=amp.bins.masonry.pos.length/3;
  const p=f.at(lo,0),q=f.at(hi,0),a=h(p[0],p[2])-.07,b=h(q[0],q[2])-.07;
  amp.quad('masonry',f.at(lo,a),f.at(lo,up),f.at(hi,up),f.at(hi,b),shade,[[lo+uvOffset,a],[lo+uvOffset,up],[hi+uvOffset,up],[hi+uvOffset,b]]);
  feet.push([f.at(lo,a),f.at(hi,b)]);groundFeatures.push({role,firstTriangle:at/3,triangles:2,lowerVertices:[at,at+5]});
 };
 const sheet=(s:Skin,f:Frame,pts:UV[],t:number,o=0)=>{
  if(pts.length<3||area(pts)<.000001)return;amp.poly(s,pts.map(([x,y])=>f.at(x,y,o)),t,pts);
 };
 const rect=(f:Frame,l:number,r:number,b:number,t:number,tint:number,s:Skin='joinery',o=0)=>sheet(s,f,[[l,b],[r,b],[r,t],[l,t]],tint,o);
 const stick=(f:Frame,x1:number,y1:number,x2:number,y2:number,width:number,tint=TIMBER,offset=.065,depth=.09)=>amp.member(f.at(x1,y1,offset),f.at(x2,y2,offset),f.normal,width,depth,tint);
 function cutWall(f:Frame,poly:UV[],ops:Opening[],skin:Skin,tint:number,offset=0){
  const ls=[...new Set([Math.min(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[0])),...ops.flatMap(w=>[w.x-w.width/2,w.x+w.width/2])])].sort((a,b)=>a-b),
        hs=[...new Set([Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[1])),...ops.flatMap(w=>[w.bottom,w.top])])].sort((a,b)=>a-b);
  for(let i=1;i<ls.length;i++)for(let j=1;j<hs.length;j++){const l=ls[i-1],r=ls[i],b=hs[j-1],t=hs[j],xc=(l+r)/2,y=(b+t)/2;
   if(ops.some(w=>xc>w.x-w.width/2&&xc<w.x+w.width/2&&y>w.bottom&&y<w.top))continue;
   let p=clipPoly(poly,q=>q[0]-l);p=clipPoly(p,q=>r-q[0]);p=clipPoly(p,q=>q[1]-b);p=clipPoly(p,q=>t-q[1]);sheet(skin,f,p,tint,offset);
  }
 }
 function opening(f:Frame,w:Opening){
  const l=w.x-w.width/2,r=w.x+w.width/2,b=w.bottom,t=w.top,d=.118;openings.push({door:!!w.door,corners:[f.at(l,b),f.at(l,t),f.at(r,t),f.at(r,b)]});
  amp.quad('joinery',f.at(l,b),f.at(l,t),f.at(l,t,-d),f.at(l,b,-d),EDGE);amp.quad('joinery',f.at(r,b,-d),f.at(r,t,-d),f.at(r,t),f.at(r,b),EDGE);
  amp.quad('joinery',f.at(l,t),f.at(r,t),f.at(r,t,-d),f.at(l,t,-d),0xb9b4a5);amp.quad('joinery',f.at(l,b,-d),f.at(r,b,-d),f.at(r,b),f.at(l,b),EDGE);
  if(w.entrance){feature('recessed paired green entry, divided transom and separate sidelights',()=>{
   const green=0x394f43,dark=0x32453b,metal=0x8b7751,head=b+(t-b)*.776,sl=w.width*.164,leafL=l+sl,leafR=r-sl,m=w.x;
   rect(f,l,r,b,t,green,'joinery',-d);rect(f,l+.07,r-.07,head+.066,t-.075,0x5c6b67,'glazing',-d+.011);
   // Each smaller upper light is actual joinery, not an image cutout. No historic pane-count claim.
   for(let k=1;k<7;k++){const x=l+.06+(w.width-.12)*k/7;stick(f,x,head+.055,x,t-.065,.028,green,-d+.042,.034);}
   const ty=head+(t-head)*.55;stick(f,l+.07,ty,r-.07,ty,.028,green,-d+.045,.034);
   for(const [lo,hi]of [[l,leafL],[leafR,r]]){rect(f,lo+.058,hi-.058,b+.25,head-.07,0x68756e,'glazing',-d+.012);
    for(const y of[b+.72,b+1.32,head-.43])stick(f,lo+.03,y,hi-.03,y,.033,green,-d+.050,.038);}
   for(const [lo,hi]of [[leafL,m],[m,leafR]]){rect(f,lo+.075,hi-.075,b+.68,head-.11,0x596968,'glazing',-d+.014);
    rect(f,lo+.09,hi-.09,b+.105,b+.59,dark,'joinery',-d+.01);rect(f,lo+.145,hi-.145,b+.16,b+.525,green,'joinery',-d+.018);
    stick(f,lo+.05,b+.7,hi-.05,b+.7,.05,green,-d+.039,.04);}
   for(const x of[leafL,m,leafR])stick(f,x,b+.035,x,head,.070,green,-d+.052,.063);
   for(const x of[m-.095,m+.095])stick(f,x,b+1.01,x,b+1.19,.03,metal,-d+.084,.053);
   stick(f,l,head,r,head,.117,dark,-d+.062,.085);
  });}else if(w.door){
   rect(f,l,r,b,t,DOOR,'joinery',-d);const mid=t-.5;rect(f,l+.12,r-.12,mid+.07,t-.07,GLASS,'glazing',-d+.012);
   rect(f,l+.15,r-.15,b+.70,mid-.11,0x566266,'glazing',-d+.014);stick(f,w.x,b+.12,w.x,t-.09,.045,0x786754,-d+.032,.038);
   stick(f,l,mid,r,mid,.09,EDGE,-d+.041,.036);
  }else{
   const n=w.group??1,sw=w.width/n;
   for(let j=0;j<n;j++){
    const a=l+j*sw,z=a+sw,mid=b+(t-b)*.48;rect(f,a,z,b,t,GLASS,'glazing',-d);
    rect(f,a+.04,z-.04,mid+.06,t-.06,0x697775,'glazing',-d+.009);
    stick(f,a+.02,mid,z-.02,mid,.059,CREAM,-d+.045,.045);stick(f,(a+z)/2,mid,(a+z)/2,t-.018,.026,EDGE,-d+.038,.035);
    if(sw>.75)stick(f,a+.018,mid+(t-mid)*.54,z-.018,mid+(t-mid)*.54,.023,EDGE,-d+.04,.035);
    if(j)stick(f,a,b,a,t,.075,CREAM,.004,.11);
   }
  }
  for(const x of[l-.045,r+.045])stick(f,x,b-.025,x,t+.04,.08,TIMBER,.035,.105);
  stick(f,l-.10,b-.03,r+.10,b-.03,.095,CREAM,.063,.205);stick(f,l-.085,t+.036,r+.085,t+.036,.09,CREAM,.045,.145);
 }
 function wall(role:string,f:Frame,l:number,r:number,up:number,ss:Opening[],uu:Opening[],base=.36){
  const firstStone=amp.bins.masonry.pos.length/9,firstRender=amp.bins.render.pos.length/9;
  const band=3.67,lo=(a:number,b:number):UV[]=>[[l,a],[r,a],[r,b],[l,b]];
  skirt(f,l,r,base,STONE,role);cutWall(f,lo(base,Math.min(band,up)),ss,'masonry',STONE);
  if(up>band+.04){cutWall(f,lo(band,up),uu,'render',BUFF);stick(f,l,band+.04,r,band+.04,.17,CREAM,.06,.15);stick(f,l,up-.045,r,up-.045,.14,CREAM,.04,.14);
   for(const s of[l+.07,r-.07])stick(f,s,band,s,up,.15,CREAM,.05,.16);
  }
  for(const w of [...ss,...uu])opening(f,w);walls.push({role,range:[l,r,base,up]});wallRanges.push({role,masonry:[firstStone,amp.bins.masonry.pos.length/9],render:[firstRender,amp.bins.render.pos.length/9]});
 }
 type Gable={axis:'u'|'v',lo:number,hi:number,c:number,half:number,eave:number,peak:number,flare:number};
 function gable(role:string,f:Gable,tint=GREEN){
  roofs.role=role;
  const at=(along:number,k:number,h:number):P=>f.axis==='v'?[f.c+k,h,along]:[along,h,f.c+k];
  const flare=Math.min(f.flare,f.half*.35),dh=(f.peak-f.eave)*flare/f.half*.58;
  for(const side of[-1,1]){const a=side*f.half,b=side*(f.half-flare);
   roofs.quad(at(f.lo,a,f.eave),at(f.hi,a,f.eave),at(f.hi,b,f.eave+dh),at(f.lo,b,f.eave+dh),tint,f.axis);
   roofs.quad(at(f.lo,b,f.eave+dh),at(f.hi,b,f.eave+dh),at(f.hi,0,f.peak),at(f.lo,0,f.peak),tint,f.axis);
  }
  roofsSemantic.push({role,axis:f.axis,ridge:[at(f.lo,0,f.peak),at(f.hi,0,f.peak)],eaves:[at(f.lo,-f.half,f.eave),at(f.hi,f.half,f.eave)]});
  return {height:(k:number)=>Math.abs(k)>=f.half-flare?f.eave+(f.half-Math.abs(k))/flare*dh:f.peak-Math.abs(k)/(f.half-flare)*(f.peak-f.eave-dh),f,dh,flare};
 }
 function decorateEnd(fr:Frame,c:number,half:number,e:number,peak:number,ops:Opening[],level:'large'|'small'|'plain',flare=.58){
  const m=Math.min(flare,half*.35),dy=(peak-e)*m/half*.58,
   poly:UV[]=[[c-half,e],[c-half+m,e+dy],[c,peak],[c+half-m,e+dy],[c+half,e]];
  const cy=e+(peak-e)*.7525,crown=level==='large'&&half>6?win(c,.47,cy-.38,cy+.38):undefined;
  const actual=crown?[...ops,crown]:ops;cutWall(fr,poly,actual,'render',level==='small'?GABLED:BUFF);for(const w of actual)opening(fr,w);
  const trim=level==='small'?.12:.21;
  for(const k of[-1,1]){
   stick(fr,c+k*half,e,c+k*(half-m),e+dy,trim,CREAM,.07,.17);
   stick(fr,c+k*(half-m),e+dy,c,peak,trim,CREAM,.07,.17);
  }
  stick(fr,c-half,e+.03,c+half,e+.03,level==='small'?.075:.15,CREAM,.06,.14);
  if(level==='large'){
   const y0=e+(peak-e)*.55,w=half*.417;
   cutWall(fr,[[c-w,y0],[c,peak-.19],[c+w,y0]],crown?[crown]:[],'shingles',GABLED,.013);
   stick(fr,c-w,y0,c+w,y0,.13,CREAM,.067,.12);
   const H=(s:number)=>peak-(peak-e-dy)*Math.abs(s)/(half-m);
   for(const dx of[-.76,-.48,-.25,.25,.48,.76].map(x=>x*half)){
    const hi=Math.min(y0-.055,H(dx)-.2);if(hi>e+.14&&!ops.some(w=>Math.abs(c+dx-w.x)<w.width*.5+.06))stick(fr,c+dx,e+.12,c+dx,hi,.115,TIMBER,.054,.087);
   }
   for(const k of[-1,1])stick(fr,c+k*.34,peak-.82,c+k*.10,peak-.35,.070,TIMBER,.072,.09);

  }else if(level==='small'){
   for(const k of[-1,1])stick(fr,c+k*half*.51,e+.12,c+k*half*.19,peak-.25,.052,TIMBER,.04,.075);
  }
 }
 const main={axis:'v' as const,lo:-17.86,hi:9.10,c:1.40,half:7.91,eave:6.81,peak:13.69,flare:.79};
 gable('dominant north-end gable and western slope',main,GREEN);
 // A sheltered north facade and the west long wall, with true holes and glazing set behind the jambs.
 wall('north principal gable end',face('v',-17.55,-1),-6.12,8.90,6.80,[win(-3.46,1.57,.82,2.69,2),{...door(-.185,2.57,.34,2.99),entrance:true},win(5.33,1.66,.82,2.69,2)],
  [win(-3.63,1.98,4.13,6.15,2),win(.95,1.77,4.10,6.15,2),win(5.45,2.05,4.13,6.15,2)]);
 const northFace=face('v',-17.7,-1);
 decorateEnd(northFace,main.c,7.78,6.80,13.62,[win(main.c,3.63,7.85,10.36,3)],'large',main.flare);
 // Original recessed Tudor window bank and a shallow boxed-out panel rail, not a flat printed gable.
 const northPanels=face('v',-17.74,-1);
 stick(northPanels,main.c-3.48,7.72,main.c+3.48,7.72,.108,CREAM,.074,.135);
 for(let i=-6;i<=6;i++)stick(northPanels,main.c+i*.55,6.97,main.c+i*.55,7.68,.071,TIMBER,.046,.075);
 wall('long western facade',face('u',-6.15,-1),-17.54,10.56,6.80,
  [win(-14.33,1.63,.92,2.71,2),win(-9.41,1.30,.92,2.71),door(-4.34,1.40),win(.79,1.60,.91,2.73,2)],
  [win(-14.33,1.69,4.19,6.19,2),win(-9.41,1.81,4.19,6.16,2),win(-4.44,1.75,4.21,6.18,2),win(2.4,1.38,4.21,6.15)]);
 wall('quieter eastern return',face('u',8.96,1),-17.54,10.90,6.79,
  [win(-13.9,1.38,.94,2.70),win(-8.7,1.51,.91,2.70,2),win(-3.52,1.42,.95,2.7),win(2.18,1.56,.95,2.7,2)],
  [win(-13.9,1.53,4.2,6.12,2),win(-8.7,1.47,4.2,6.11,2),win(-3.52,1.52,4.18,6.10,2),win(2.18,1.49,4.18,6.12,2),win(7.4,1.24,4.2,6.1)]);
 // The long roof terminates INSIDE the transverse ridge. No second facade is hidden under the joined roof.
 // Dormers are actual small roof volumes with glazed fronts AND opening cuts to the main roof envelope.
 for(const [j,v] of[-14.36,-9.28,-4.41].entries()){
  const ex=-4.19,hw=1.10,ff=face('u',ex,-1),foot=main.eave+(main.half-Math.abs(ex-main.c))*(main.peak-main.eave)/main.half-.07,
   lo=foot+.05,e=lo+1.18,peak=e+1.46,back=-1.53,tx=.54;
  cutWall(ff,[[v-hw,lo],[v+hw,lo],[v+hw,e],[v-hw,e]],[win(v,1.18,lo+.12,e-.12,2)],'render',BUFF);opening(ff,win(v,1.18,lo+.12,e-.12,2));
  for(const s of[-1,1]){const fr=face('v',v+s*hw,s as -1|1);sheet('shingles',fr,[[ex,lo],[back-.10,e-.07],[back,e],[ex,e]],GREEN2);stick(ff,v+s*(hw-.045),lo,v+s*(hw-.045),e,.083,CREAM,.045,.09);}
  gable('paired west gable dormer '+(j+1),{axis:'u',lo:ex-.12,hi:back,c:v,half:hw+.11,eave:e,peak,flare:tx},GREEN);
  decorateEnd(face('u',ex-.067,-1),v,hw+.062,e,peak-.02,[],'small',tx);
 }
 // Central projecting upper window bay, supported by the porch; shallow facets, not a flush window decal.
 const vbay=.12,bay:UV[]=[[-6.16,-2.36],[-7.38,-1.78],[-7.68,-1.10],[-7.68,1.35],[-7.30,1.86],[-6.14,2.48]];
 for(let i=1;i<bay.length;i++){const a=bay[i-1],b=bay[i],du=b[0]-a[0],dv=b[1]-a[1],l=Math.hypot(du,dv),fr=frame(a,b,[-dv/l,du/l]),ops=l>1?[win(l*.5,l*.68,4.14,6.26,l>2?2:1)]:[];
  cutWall(fr,[[0,3.64],[l,3.64],[l,6.73],[0,6.73]],ops,'render',BUFF);for(const w of ops)opening(fr,w);
  stick(fr,0,3.77,0,6.6,.11,CREAM,.04,.12);stick(fr,0,3.72,l,3.72,.16,CREAM,.06,.16);
 }
 gable('projecting bay cross-gable',{axis:'u',lo:-7.83,hi:1.83,c:vbay,half:3.07,eave:6.7,peak:12.41,flare:.46},GREEN);
 decorateEnd(face('u',-7.72,-1),vbay,2.98,6.71,12.37,[win(vbay,1.85,7.48,9.36,2)],'large',.43);
 // Distinct large transverse west gable and attached service/porch, not a second house.
 const cross={axis:'u' as const,lo:-17.82,hi:11.43,c:9.01,half:5.38,eave:6.61,peak:13.77,flare:.65};
 gable('transverse southwest balcony wing',cross,GREEN2);
 wall('balcony western wing end',face('u',-17.54,-1),3.99,14.05,6.60,
  [win(6.90,1.6,.92,2.7,2),door(10.21,1.38)], [win(6.83,1.59,4.13,6.08,2),win(10.79,2.11,4.13,6.09,2)]);
 decorateEnd(face('u',-17.64,-1),cross.c,5.29,6.6,13.70,[{x:cross.c,width:2.38,bottom:7.44,top:9.15,group:2}], 'large',.65);
 wall('return under long inhabited west wing',face('v',3.99,-1),-17.54,-6.15,6.58,
  [win(-14.34,1.49,.92,2.72,2),win(-9.63,1.34,.92,2.72)], [win(-14.34,1.93,4.17,6.12,2),win(-9.63,1.69,4.15,6.1,2)]);
 // Lake-facing upper elevation: two broad cross-gables growing out of the SAME transverse roof.
 // All dimensions are original artist proportions within the pinned stock plan, never a digital survey.
 const lakeFace=face('v',13.71,1),lakeBase=.36,lakeBand=3.67,lakeEave=6.60;
 const upper=(fr:Frame,l:number,r:number,windows:Opening[])=>{cutWall(fr,[[l,lakeBand],[r,lakeBand],[r,lakeEave],[l,lakeEave]],windows,'render',BUFF);
  for(const w of windows)opening(fr,w);for(const y of[lakeBand+.055,lakeEave-.07])stick(fr,l,y,r,y,.15,CREAM,.045,.14);
  for(const x of[l+.075,r-.075])stick(fr,x,lakeBand+.06,x,lakeEave-.10,.14,CREAM,.045,.14);};
 feature('joined lake elevation: framed upper rooms and eastern gable return',()=>{
  const upperWindows=[win(-15.70,1.35,4.15,6.08,2),win(-9.54,2.62,4.12,6.12,3),win(-2.28,3.04,4.15,6.12,3),win(4.63,2.57,4.12,6.10,3),win(9.32,1.09,4.20,6.06)];
  upper(lakeFace,-17.49,11.13,upperWindows);for(const x of[-13.67,-11.31,-7.37,-5.77,-4.57,-.20,1.66,7.47])stick(lakeFace,x,3.77,x,6.40,.11,TIMBER,.043,.095);
  const east=face('u',11.16,1);upper(east,4.0,13.72,[win(6.29,1.49,4.18,6.13,2),win(10.47,2.70,4.11,6.13,3)]);
  decorateEnd(face('u',11.28,1),cross.c,5.24,6.62,13.66,[win(cross.c,2.60,7.63,9.66,3)],'large',.62);
 });
 const lakeGables=[{c:-9.49,half:4.52,end:14.09,peak:13.08},{c:4.59,half:4.66,end:14.10,peak:13.24}];
 for(const [j,k]of lakeGables.entries()){
  const title='lakeside outward broad cross-gable '+(j+1),f={axis:'v' as const,lo:8.76,hi:k.end,c:k.c,half:k.half,eave:6.61,peak:k.peak,flare:.63};gable(title,f,GREEN);
  feature(title+' actual upper sashes and half-timber end',()=>{
   const fr=face('v',k.end-.12,1);decorateEnd(fr,k.c,k.half-.085,6.63,k.peak-.07,[win(k.c,1.79,8.21,10.15,2)],'large',.59);
   // Fine, physically separate original finial catching the rim at close range; no precise ornamental survey.
   amp.rod('joinery',fr.at(k.c,k.peak-.105,-.018),fr.at(k.c,k.peak+.29,-.018),.040,.018,0x8c8c75,6);
   amp.rod('joinery',fr.at(k.c,k.peak+.29,-.018),fr.at(k.c,k.peak+.56,-.018),.021,.006,0x8c8c75,6);
   const width=k.half*.72;stick(fr,k.c-width,7.42,k.c+width,7.42,.106,TIMBER,.058,.092);
   // Individually bounded sloping bargeboard and small original pendant, rather than a silhouette texture.
   for(const side of[-1,1]){const xx=k.c+side*(k.half-.15);stick(fr,xx,6.65,xx-side*.12,6.31,.083,CREAM,.068,.105);}
  });
 }
 feature('low central south-facing shed dormer with three separately recessed sashes',()=>{
  const a=-4.46,b=.01,front=12.34,back=10.05,low=8.86,high=10.76,fr=face('v',front,1),windows=[-3.63,-2.23,-.84].map(x=>win(x,.96,9.10,10.55));
  cutWall(fr,[[a,low],[b,low],[b,high],[a,high]],windows,'shingles',GABLED);for(const w of windows)opening(fr,w);
  for(const [x,n] of[[a,-1],[b,1]] as const)sheet('shingles',face('u',x,n),[[back,11.86],[front,low],[front,high],[back,11.97]],GREEN2);
  stick(fr,a-.04,high,b+.04,high,.105,CREAM,.06,.13);
  roofs.role='lakeside low continuous multi-sash shed dormer';roofs.quad([a-.11,high+.08,front+.13],[b+.11,high+.08,front+.13],[b+.11,12.17,back],[a-.11,12.17,back],GREEN2,'u');
 });
 // A genuine segmented arch in the stone part of the lake wall; masonry is cut to the curve,
 // rather than hiding a rectangular junction behind co-planar glass or a printed arch.
 feature('south exposed fieldstone return and arched divided masonry opening',()=>{
  const l=-17.50,r=-5.61,c=-9.48,wide=3.20,bottom=.84,spring=2.47,rad=.49;
  const wing=face('v',13.68,1);skirt(wing,l,r,lakeBase,STONE,'lake arched-wall footing');
  const side=win(-15.48,1.10,.85,2.65);cutWall(wing,[[l,lakeBase],[c-wide/2,lakeBase],[c-wide/2,lakeBand],[l,lakeBand]],[side],'masonry',STONE);opening(wing,side);
  rect(wing,c+wide/2,r,lakeBase,lakeBand,STONE,'masonry');rect(wing,c-wide/2,c+wide/2,lakeBase,bottom,STONE,'masonry');
  const pts:UV[]=[];for(let j=0;j<=12;j++){const t=Math.PI*(1-j/12);pts.push([c+Math.cos(t)*wide/2,spring+Math.sin(t)*rad]);}
  for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];sheet('masonry',wing,[a,b,[b[0],lakeBand],[a[0],lakeBand]],STONE);sheet('glazing',wing,[[a[0],bottom],[b[0],bottom],b,a],GLASS,-.098);stick(wing,...a,...b,.09,CREAM,-.028,.09);}
  for(const x of[c-wide/2,c-wide/2+.72,c+wide/2-.72,c+wide/2])stick(wing,x,bottom,x,spring,.084,CREAM,-.008,.12);
  stick(wing,c-wide/2,bottom,c+wide/2,bottom,.106,EDGE,.05,.16);stick(wing,c-wide/2,spring,c+wide/2,spring,.076,CREAM,-.025,.09);
  for(const dx of[-.72,0,.72]){const x=c+dx,t=Math.sqrt(1-(dx/(wide/2))**2);stick(wing,x,spring,x,spring+rad*t,.047,EDGE,-.025,.079);}
 });
 // An original broad curve in true plan, no image masks, no invented circular annex separate from the house.
 // A low glazed room turns from the south toward the east, beneath the verified two-gable family.
 const bez=(a:UV,b:UV,c:UV,d:UV,segments:number):UV[]=>Array.from({length:segments+1},(_,j)=>{const t=j/segments,z=1-t;return[a[0]*z*z*z+3*b[0]*z*z*t+3*c[0]*z*t*t+d[0]*t*t*t,a[1]*z*z*z+3*b[1]*z*z*t+3*c[1]*z*t*t+d[1]*t*t*t];});
 const A:UV=[-5.71,13.18],B:UV=[-.67,14.16],C:UV=[8.89,18.34],D:UV=[12.72,15.59],E:UV=[14.69,3.77],F:UV=[15.75,-2.54];
 const curve=[...bez(A,[-4.78,13.88],[-3.06,14.05],B,4),...bez(B,[2.72,15.10],[5.88,17.37],C,7).slice(1),...bez(C,[10.68,18.83],[12.13,17.95],D,4).slice(1),...bez(D,[13.53,12.13],[13.91,7.93],E,8).slice(1),...bez(E,[15.08,1.86],[15.44,-.69],F,4).slice(1)];
 const pavilion:P=[7.23,5.19,7.96],sill=1.28,glassTop=3.43,cornice=3.67;
 feature('continuous curved sandstone dining-room plinth and sash ribbon',()=>{
  // Each course continues round the bend; restarting material UV at every sash would tile the stone pattern.
  let course=0;
  const closure:UV=[-5.61,13.68],dcx=A[0]-closure[0],dcz=A[1]-closure[1],cheekLen=Math.hypot(dcx,dcz),cheek=frame(closure,A,[-dcz/cheekLen,dcx/cheekLen]);
  skirt(cheek,0,cheekLen,.30,STONE,'arched wall to glazed return');rect(cheek,0,cheekLen,.30,cornice,STONE,'masonry');
  for(let i=1;i<curve.length;i++){
   const a=curve[i-1],b=curve[i],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv),fr=frame(a,b,[-dv/len,du/len]);
   skirt(fr,0,len,.30,STONE,'rounded dining-room plinth '+i,course);
   amp.quad('masonry',fr.at(0,.30),fr.at(0,sill),fr.at(len,sill),fr.at(len,.30),STONE,[[course,.30],[course,sill],[course+len,sill],[course+len,.30]]);course+=len;
   rect(fr,0,len,sill-.015,sill+.09,BUFF,'render',.020);
   const tone=[0x52646a,0x63716f,0x556669,0x5e706e][Math.floor(i/4)%4];
   rect(fr,0,len,sill+.065,glassTop,tone,'glazing',-.043);rect(fr,0,len,glassTop,cornice,EDGE,'joinery',.018);
   const s=sill+(glassTop-sill)*.72;stick(fr,.018,s,len-.018,s,.060,CREAM,-.005,.083);
   // Mullions are three-dimensional at each physical facet; stronger piers separate small groups.
   const big=i===1||i===curve.length-1||i%4===1;
   stick(fr,.04,sill+.018,.04,glassTop+.015,big?.145:.086,CREAM,.024,big?.156:.108);
   if(big){const yy=glassTop-.18;for(const k of [0.18,0.30])stick(fr,.04,yy-.045,.04+k,glassTop+.022,.052,CREAM,.056,.076);}
   stick(fr,0,sill+.062,len,sill+.062,.094,CREAM,.046,.153);
   // Rake/fascia end pieces remain within the tagged footprint, not a newly approximated shoreline.
   stick(fr,0,cornice-.045,len,cornice-.045,.144,CREAM,.053,.149);
  }
 });
 roofs.role='continuous curved dining-room low roof';
 // Adjacent facets must share a common eave vertex even at changing normal: use a single averaged offset.
 const corner=(k:number):P=>{const p=curve[k],a=curve[Math.max(0,k-1)],b=curve[Math.min(curve.length-1,k+1)],du=b[0]-a[0],dv=b[1]-a[1],l=Math.hypot(du,dv);return[p[0]-.093*dv/l,cornice+.075,p[1]+.093*du/l];};
 for(let i=1;i<curve.length;i++){const a=corner(i-1),b=corner(i);roofs.plane([[a[0],a[2]],[b[0],b[2]],[pavilion[0],pavilion[2]]],[a,b,pavilion],GREEN,'u');}
 const endCap:UV[]=[F,[16.14,-5.71],[8.90,-5.06],[8.90,5.57]];
 feature('reserved low eastern service return, not a reconstruction of the 1939 wing',()=>{
 for(let i=1;i<endCap.length;i++){const a=endCap[i-1],b=endCap[i],du=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(du,dv),fr=frame(a,b,[-dv/len,du/len]),w=len>6?[win(len*.52,1.44,.98,2.63,2)]:[];
   skirt(fr,0,len,.32,STONE,'attached east service return');cutWall(fr,[[0,.32],[len,.32],[len,cornice],[0,cornice]],w,'masonry',ASH);for(const z of w)opening(fr,z);
   stick(fr,0,cornice-.055,len,cornice-.055,.12,TIMBER,.044,.13);
   const p:P=[a[0],cornice+.075,a[1]],q:P=[b[0],cornice+.075,b[1]];roofs.role='attached secondary low cap';roofs.plane([a,b,[pavilion[0],pavilion[2]]],[p,q,pavilion],GREEN2,'u');}
 });
 // The roof under the original upper storey closes the recessed junction without an extra independent volume.
 {const p=corner(0),q:P=[-5.76,3.92,12.80],a:P=[8.9,4.37,5.57];roofs.role='dining roof and original wall junction';for(const [x,y] of[[p,q],[q,a]])roofs.plane([[x[0],x[2]],[y[0],y[2]],[pavilion[0],pavilion[2]]],[x,y,pavilion],GREEN,'u');}
 // The smaller shed-roofed dormer is related in kind, not a claim about the undocumented rear count.
 {const u0=7.24,u1=4.82,v0=-11.91,v1=-8.16,low=8.18,high=9.58;
  const fr=face('u',u0,1),o=win((v0+v1)/2,2.27,low+.09,high-.15,2);cutWall(fr,[[v0,low],[v1,low],[v1,high],[v0,high]],[o],'render',BUFF);opening(fr,o);
  for(const [s,sg] of[[v0,-1],[v1,1]]as const)sheet('shingles',face('v',s,sg),[[u1,10.21],[u0,low],[u0,high]],GREEN2);
  roofs.role='shed dormer';roofs.quad([u0+.14,high,v0-.12],[u0+.14,high,v1+.12],[u1,10.47,v1+.12],[u1,10.47,v0-.12],GREEN2,'v');
 }
 function foot(u:number,v:number,w:number,d:number,y:number,tint=STONE){
  const at=amp.bins.masonry.pos.length/3;
  const a:UV[]=[[u-w/2,v-d/2],[u+w/2,v-d/2],[u+w/2,v+d/2],[u-w/2,v+d/2]],base=a.map(([x,z]):P=>[x,h(x,z)-.06,z]);
  feet.push(base);for(let i=0;i<4;i++){const j=(i+1)%4;const X=base[i],Y=base[j],l=Math.hypot(Y[0]-X[0],Y[2]-X[2]);
   amp.quad('masonry',X,[X[0],y,X[2]],[Y[0],y,Y[2]],Y,tint,[[0,X[1]],[0,y],[l,y],[l,Y[1]]]);}
  amp.quad('masonry',[a[0][0],y,a[0][1]],[a[1][0],y,a[1][1]],[a[2][0],y,a[2][1]],[a[3][0],y,a[3][1]],tint);
  groundFeatures.push({role:'porch pier',firstTriangle:at/3,triangles:10,lowerVertices:[at,at+6,at+12,at+18]});
 }
 function post(u:number,v:number,top:number,normal:UV,twin=false){
  foot(u,v,twin?.52:.46,.45,.79);amp.box('joinery',u-.285,u+.285,v-.255,v+.255,.77,.875,EDGE);
  for(const off of twin?[-.122,.122]:[0]){
   const tx=-normal[1],tz=normal[0],x=u+off*tx,z=v+off*tz;
   amp.box('joinery',x-.083,x+.083,z-.083,z+.083,.86,1.47,TIMBER);
   for(const [y0,y1,r0,r1] of[[1.43,1.53,.104,.082],[1.53,1.63,.082,.106],[1.63,1.72,.106,.076],[1.72,top-.47,.076,.068],[top-.47,top-.34,.067,.098],[top-.34,top-.27,.098,.08],[top-.27,top-.20,.085,.117],[top-.20,top,.115,.115]]){
    if(y1>y0)amp.rod('joinery',[x,y0,z],[x,y1,z],r0,r1,TIMBER,8);
   }
  }
  // Edge of a concave timber bracket, catching real light under the deep roof.
  for(const side of[-1,1]){const tangent:UV=[-normal[1]*side,normal[0]*side];
   const outline:UV[]=[[0,top-.63],[.085,top-.60],[.14,top-.42],[.26,top-.28],[.42,top-.17],[.59,top-.11],[.63,top],[0,top]];
   const front=(p:UV,o:number):P=>[u+tangent[0]*p[0]+normal[0]*o,p[1],v+tangent[1]*p[0]+normal[1]*o];
   for(let j=1;j+1<outline.length-1;j++)amp.triangle('joinery',front(outline[7],.048),front(outline[j],.048),front(outline[j+1],.048),TIMBER);
   for(let j=0;j<outline.length;j++){const k=(j+1)%outline.length;amp.quad('joinery',front(outline[j],-.048),front(outline[k],-.048),front(outline[k],.048),front(outline[j],.048),TIMBER);}
  }
 }
 function balustrade(a:UV,b:UV,baseY:number,top:number,th=.055){
  const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.2)return;
  const n:UV=[dz/l,-dx/l],v=(f:number,y:number):P=>[a[0]+dx*f,y,a[1]+dz*f];
  for(const h of[baseY+.12,top])amp.member(v(0,h),v(1,h),n,h===top?.105:.079,h===top?.144:.100,TIMBER);
  const slots=Math.max(1,Math.floor(l/.208));for(let j=1;j<slots;j++){const p=v(j/slots,0);amp.box('joinery',p[0]-th/2,p[0]+th/2,p[2]-th/2,p[2]+th/2,baseY+.13,top-.04,TIMBER);}
 }
 // Open roofed porch. Every foot seats separately on original submitted game grade.
 function lean(axis:'u'|'v',inner:number,outer:number,s0:number,s1:number,y0:number,y1:number,stations:number[],gaps:number[],name:string){
  const p=(d:number,s:number,y:number):P=>axis==='u'?[d,y,s]:[s,y,d],at=(d:number,s:number):UV=>axis==='u'?[d,s]:[s,d];
  const n:UV=axis==='u'?[Math.sign(outer-inner),0]:[0,Math.sign(outer-inner)];
  roofs.role=name;roofs.quad(p(inner,s0,y0),p(inner,s1,y0),p(outer,s1,y1),p(outer,s0,y1),GREEN,axis==='u'?'v':'u');
  const bf=face(axis,outer,Math.sign(outer-inner) as -1|1);
  rect(bf,s0,s1,y1-.15,y1,EDGE,'joinery',-.01);
  const near=outer-Math.sign(outer-inner)*.21;
  const v0=Math.min(inner,outer),v1=Math.max(inner,outer);
  if(axis==='u')amp.box('joinery',v0,v1,s0,s1,.17,.345,0x8b8170);else amp.box('joinery',s0,s1,v0,v1,.17,.345,0x8b8170);
  for(let j=0;j<stations.length;j++){
   const [u,v]=at(near,stations[j]);post(u,v,y1-.15,n,j%3===1);
   if(j&&!gaps.includes(j-1))balustrade(at(near,stations[j-1]+.25),at(near,stations[j]-.25),.35,1.18);
  }
  walls.push({role:name,range:[inner,outer,s0,s1]});
 }
 lean('u',-6.10,-8.16,-17.99,3.66,3.82,3.12,[-17.64,-13.44,-9.24,-5.02,-.86,3.31],[2],'west inhabited veranda');
 lean('v',-17.46,-18.36,-8.10,8.94,3.76,3.18,[-7.77,-4.1,-.28,3.72,8.42],[1,2],'north veranda return');
 lean('u',8.90,9.77,-17.55,-6.65,3.73,3.23,[-17.29,-12.12,-7.1],[],'narrow east veranda return');
 lean('v',4.04,2.64,-17.52,-8.14,3.79,3.13,[-17.21,-13.02,-8.52],[0],'return below southwest wing');
 lean('u',-17.45,-18.86,4.21,13.92,3.77,3.25,[4.54,8.92,13.58],[0,1],'veranda under upper gallery');
 // Peaked entrance porch on northern projection. Old official civic beacon is NOT an entrance survey.
 gable('smaller gabled entrance porch',{axis:'v',lo:-23.58,hi:-17.71,c:-.19,half:3.25,eave:2.86,peak:4.49,flare:.31},GREEN2);
 decorateEnd(face('v',-23.45,-1),-.19,3.12,2.89,4.44,[],'plain',.30);
 for(const u of[-2.99,2.61])for(const v of[-22.97,-19.41])post(u,v,2.85,[0,-1]);
 amp.box('joinery',-3.0,2.67,-23.12,-17.18,.16,.345,0x8c7c69);
 for(let j=0;j<3;j++){const z=-23.72+j*.20;const b=h(-.18,z)-.04;skirt(face('v',z,-1),-1.65,1.28,.105+.085*j,ASH,'entry riser '+j);const at=amp.bins.masonry.pos.length/3;amp.box('masonry',-1.65,1.28,z,z+.239,b,.105+.085*j,ASH);groundFeatures.push({role:'entry tread '+j,firstTriangle:at/3,triangles:12,lowerVertices:[at,at+5,at+11,at+17],upperEdgeVertices:[at+1,at+2]});}
 // Open to the drive on both ends; intentionally no new road, parked cars or parcel ornament.
 gable('open porte-cochère',{axis:'u',lo:-21.97,hi:-17.20,c:9.74,half:3.57,eave:3.27,peak:4.68,flare:.33},GREEN2);
 decorateEnd(face('u',-21.83,-1),9.74,3.42,3.28,4.62,[],'plain',.31);
 for(const u of[-21.56,-18.23])for(const v of[6.46,13.05]){post(u,v,3.27,[-1,0],true);}
 // Balcony and architectural outside stair observed in the design view. Do not move any nearby features.
 amp.box('joinery',-18.91,-17.41,6.59,9.53,7.13,7.38,EDGE);
 for(const [a,b]of[[[-18.8,6.64],[-18.8,9.46]],[[-18.8,6.64],[-17.47,6.64]]]as [UV,UV][]){balustrade(a,b,7.37,8.38,.055);}
 for(const v of[6.69,9.39]){
  amp.rod('joinery',[-17.59,5.95,v],[-18.68,7.16,v],.078,.075,CREAM,6);amp.box('joinery',-18.96,-18.78,v-.08,v+.08,7.36,8.46,CREAM);
 }
 {const u=-18.39,begin=9.52,direction=1,steps=18,run=4.40,rise=3.72; // leaves the open end of the upper landing
  for(let k=0;k<steps;k++){const z=begin+direction*run*k/steps,level=7.34-rise*k/steps;const z1=z+direction*(run/steps+.015);
   amp.box('joinery',u-.44,u+.44,Math.min(z,z1),Math.max(z,z1),level-.13,level,CREAM);}
  for(const side of[-1,1]){const x=u+.41*side,n:UV=[side,0];amp.member([x,7.31,begin],[x,7.31-rise,begin+run],n,.18,.079,CREAM);
   amp.member([x,8.28,begin],[x,8.28-rise,begin+run],n,.09,.085,TIMBER);
   for(let k=0;k<=15;k++){const z=begin+run*k/15,y=7.34-rise*k/15;amp.box('joinery',x-.029,x+.029,z-.029,z+.029,y,y+.91,TIMBER);}}
  amp.box('joinery',-18.9,-17.50,13.76,14.23,3.43,3.63,EDGE);
 }
 function stack(u:number,v:number,base:number,cap:number,w:number,d:number){
  amp.box('joinery',u-w*.5,u+w*.5,v-d*.5,v+d*.5,base,cap,0x966b54);
  for(let k=1;k<(cap-base)/.18;k++){const y=base+k*.18;amp.box('joinery',u-w/2-.003,u+w/2+.003,v-d/2-.003,v+d/2+.003,y-.007,y+.008,0xa9856e);}
  amp.box('joinery',u-w/2-.085,u+w/2+.085,v-d/2-.085,v+d/2+.085,cap-.18,cap+.058,0x796455);
  amp.box('joinery',u-w*.31,u+w*.31,v-d*.26,v+d*.26,cap+.058,cap+.069,0x49483f);
 }
 stack(.41,-9.10,11.38,14.46,.58,.77);stack(3.42,6.18,11.05,14.68,.81,1.04);
 roofs.build();amp.finish(group);
 group.userData.dalvayGeometry={origin:[origin.x,ground,origin.z],architecturalFeatures:features,roofForms:roofsSemantic,roofTriangleRanges:roofs.emitted,wallRanges,walls,footSegments:feet,groundFeatures,openings,sourceOwner:['q12203',71]};
 return {group,dispose(){for(const q of group.children){const m=q as T.Mesh<T.BufferGeometry,T.Material>;m.geometry.dispose();m.material.dispose();}group.removeFromParent();}};
}
