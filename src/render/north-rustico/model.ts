import * as T from 'three';
import {CAP,GALLERY,DATUM,ENTRY,HOUSE_EAVE,HOUSE_PLANES,RING_FLOOR,RAIL_TOP,WALL0,farU,nearU,negV,posV,rearU,ridgeV,roofNearU,roofY,type P,type Side} from './frame.ts';
import {Batch,beam,cuboid,flat,mix,p,prism,rect,tube,vec,type XY} from './geometry.ts';
import {plainRusticoMaterials,type MaterialKey,type RusticoMaterials} from './materials.ts';

export type RusticoTier='hero'|'flight';
type Plane={fn:(s:number,y:number,d?:number)=>P,n:P};
type Orifice={s:number,y:number,w:number,h:number,hood?:boolean,entry?:boolean,narrow?:boolean};
const Y_DECK_BEAM=RING_FLOOR-.146;
const nominalFoundationLow=2.49;
const v_mid=.12;
const planeS=(sign:number,edge:(y:number)=>number):Plane=>{
  const slope=edge(6)-edge(5);
  return {n:p(0,-sign*slope,sign),fn:(s,y,d=0)=>p(s,y,edge(y)+sign*d)};
};
const planeU=(sign:number,edge:(y:number)=>number):Plane=>{
  const slope=edge(6)-edge(5);
  return {n:p(sign,-sign*slope,0),fn:(s,y,d=0)=>p(edge(y)+sign*d,y,s)};
};
const onRoof=(s:Side,u:(y:number)=>number,v:(y:number)=>number,subsurface=.066)=>{
  const [a,b,c]=HOUSE_PLANES[s],du=u(6)-u(5),dv=v(6)-v(5);
  // Closed facade physically overlaps the 93 mm soffit, never the source-derived upper face.
  return (a-subsurface+b*(u(5)-5*du)+c*(v(5)-5*dv))/(1-b*du-c*dv);
};
const windowOpening=(o:Orifice)=>rect(o.s-o.w/2,o.s+o.w/2,o.y-o.h/2,o.y+o.h/2);
const orient=(ring:P[],prefer:P):P=>{
  const d=new T.Vector3().subVectors(vec(ring[1]),vec(ring[0])).cross(new T.Vector3().subVectors(vec(ring[2]),vec(ring[0]))).normalize();
  const h=new T.Vector3(prefer[0],prefer[1],-prefer[2]);if(d.dot(h)<0)d.negate();return p(d.x,d.y,-d.z);
};
const boxCenter=(b:Batch,c:P,w:number,h:number,d:number)=>cuboid(b,c[0]-w/2,c[0]+w/2,c[1]-h/2,c[1]+h/2,c[2]-d/2,c[2]+d/2);

export function buildRusticoModel(tier:RusticoTier='hero',m:RusticoMaterials=plainRusticoMaterials()){
  const hero=tier==='hero';
  const bat=new Map<string,{b:Batch,m:MaterialKey,casting:boolean}>();
  const stock=(id:string,material:MaterialKey,casting=true)=>{
    let e=bat.get(id);
    if(!e){e={b:new Batch(),m:material,casting};bat.set(id,e);}
    return e.b;
  };
  const siding=stock('lap-shell','siding'), white=stock('painted-casings','white'), gutter=stock('hoods-and-hardware','red'), clips=stock('black-metal','iron'), frame=stock('deck-structure','white'), glass=stock('smoky-sash','window',false), backs=stock('recess-backing','shadow'), seal=stock('window-reveals','seal'), door=stock('painted-door','door'), deck=stock('gallery-deck','deck'), eaves=stock('gable-fascia','fascia'), lens=stock('lantern-inner-armature','optic',false);
  const blind=stock('opaque-reveal-return','shadow',false);
  const side=(pl:Plane,s0:number,s1:number,y0:number,y1:number,d=0)=>rect(s0,s1,y0,y1).map(q=>pl.fn(...q,d));
  function wall(pl:Plane,q:XY[],open:Orifice[]){
    const out=pl.n;
    siding.poly(q.map(v=>pl.fn(...v)),out,q,[1,1,1],open.map(windowOpening),q,q=>pl.fn(...q));
    for(const o of open)casement(pl,o);
  }
  function ringTrim(pl:Plane,c:XY[],outer:number,inner:number,trim:Batch,innerQ:XY[]){
    for(let i=0;i<4;i++){
      const j=(i+1)%4;
      trim.poly([pl.fn(...c[i],outer),pl.fn(...c[j],outer),pl.fn(...innerQ[j],outer),pl.fn(...innerQ[i],outer)],pl.n);
      trim.poly([pl.fn(...c[j],0.0006),pl.fn(...c[i],0.0006),pl.fn(...c[i],outer),pl.fn(...c[j],outer)]);
      const jr=[pl.fn(...innerQ[i],outer),pl.fn(...innerQ[j],outer),pl.fn(...innerQ[j],inner),pl.fn(...innerQ[i],inner)];
      const S=innerQ[(i+2)%4][0]-innerQ[i][0],H=innerQ[(i+2)%4][1]-innerQ[i][1];
      const cen=pl.fn(innerQ[i][0]+(i%2===0?0:S),innerQ[i][1]+(i%2===0?H:0));
      const a=pl.fn(...innerQ[i]);seal.poly(jr,orient(jr,p(cen[0]-a[0],cen[1]-a[1],cen[2]-a[2])));
    }
  }
  function casement(pl:Plane,o:Orifice){
    const A=o.s-o.w/2,B=o.s+o.w/2,L=o.y-o.h/2,H=o.y+o.h/2,T0=o.entry?.067:o.narrow?.045:.061;
    const edges=rect(A-.024,B+.024,L-.018,H+.018), inner=rect(A+T0,B-T0,L+T0,H-T0);
    ringTrim(pl,edges,.038,-.101,white,inner);
    const matchW=o.w-2*T0,matchH=o.h-2*T0;
    // A true exterior recess is blind. Inner sash masks need not span the whole shell cut;
    // broad backplate plus four opaque returns stop grazing rays through the open wall hole.
    const surround=rect(A-.037,B+.037,L-.030,H+.030),zBack=-.224;
    blind.poly(surround.map(q=>pl.fn(...q,zBack)),pl.n);
    for(let i=0;i<4;i++){
      const j=(i+1)%4, a=surround[i],b=surround[j];
      const f=[pl.fn(...a,-.008),pl.fn(...b,-.008),pl.fn(...b,zBack),pl.fn(...a,zBack)];
      const c=pl.fn(o.s,o.y),q=pl.fn(...a);
      blind.poly(f,orient(f,p(c[0]-q[0],c[1]-q[1],c[2]-q[2])));
    }
    if(o.entry){
      door.poly(side(pl,A+T0,B-T0,L+T0,H-T0,-.082),pl.n);
      // Unmarked, flush painted timber. No replica notices, brand or exact lock reproduction.
      door.poly(side(pl,A+T0+.007,B-T0-.007,L+T0+.006,H+T0-.14,-.075),pl.n,undefined,[.94,.918,.871]);
      beam(white,pl.fn(A-.028,L+.006,.033),pl.fn(B+.028,L+.006,.033),.028,.118,pl.n,[.73,.705,.662]);
      if(hero){
        beam(clips,pl.fn(B-.165,L+.966,-.047),pl.fn(B-.165,L+1.054,-.047),.031,.028,pl.n);
        beam(clips,pl.fn(B-.169,L+1.02,-.030),pl.fn(B-.253,L+1.02,-.015),.021,.024,pl.n);
      }
    }else{
      // Front-surface glass never an apparent through-hole; opaque recess and asymmetric muntin illumination.
      backs.poly(side(pl,A+T0,B-T0,L+T0,H-T0,-.214),pl.n);
      const mull=(s:number,y:number,ss:number,yy:number,w:number)=>beam(white,pl.fn(s,y,-.081),pl.fn(ss,yy,-.081),w,.033,pl.n);
      const x0=A+T0,x1=B-T0,xm=o.s,Y0=L+T0,Y1=H-T0;
      const levels=[Y0,Y0+matchH*.245,Y0+matchH*.494,Y0+matchH*.753,Y1];
      const sg=[.74,.80,.87,.91];
      if(hero||o.w>.37){
        mull(xm,Y0+.004,xm,Y1-.004,o.narrow?.019:.026);
        for(let i=1;i<4;i++)mull(x0+.002,levels[i],x1-.002,levels[i],i===2?.051:.022);
      }else{
        mull(x0+.002,Y0+matchH/2,x1-.002,Y0+matchH/2,.035);
      }
      for(let i=0;i<4;i++){
        const lb=levels[i]+.001,ub=levels[i+1]-.001;
        const colorA=[sg[i],sg[i]*1.036,sg[i]*1.073],colorB=[sg[i]*.93,sg[i]*.977,sg[i]*1.019];
        glass.poly(side(pl,x0,xm,lb,ub,-.104),pl.n,undefined,colorA);
        glass.poly(side(pl,xm,x1,lb,ub,-.104),pl.n,undefined,colorB);
      }
      beam(white,pl.fn(A-.032,L-.016,.028),pl.fn(B+.032,L-.016,.028),.033,.133,pl.n,[.93,.918,.887]);
      if(hero&&matchW>.05){ // dark seal fillet behind sash, not a printed outline
        const s0=x0+.007,s1=x1-.007; beam(seal,pl.fn(s0,levels[2]-.035,-.077),pl.fn(s1,levels[2]-.035,-.077),.012,.009,pl.n);
      }
    }
    if(!o.hood) return;
    const x=A-.071,z=B+.071,H0=H+.067,drop=.064,d=.204;
    const a=pl.fn(x,H0,.013),b=pl.fn(z,H0,.013),c=pl.fn(z,H0-drop,d),e=pl.fn(x,H0-drop,d);
    const under=(q:P)=>p(q[0],q[1]-.021,q[2]);
    gutter.poly([a,b,c,e],orient([a,b,c,e],p(0,1,0)));
    gutter.poly([e,c,under(c),under(e)],pl.n);
    gutter.poly([a,e,under(e),under(a)]);
    gutter.poly([c,b,under(b),under(c)]);
    flat(eaves,[under(e),under(c),under(b),under(a)],p(0,-1,0));
  }
  for(const sign of [-1,1]){
    const edge=sign>0?posV:negV, sideKey:Side=sign>0?'pos':'neg', pl=planeS(sign,edge);
    wall(pl,[[nearU(WALL0),WALL0],[farU(WALL0),WALL0],[farU(Y_DECK_BEAM),Y_DECK_BEAM],[nearU(Y_DECK_BEAM),Y_DECK_BEAM]],[
      {s:.24,y:4.965,w:.548,h:1.454,hood:true},
      {s:.32,y:7.623,w:.518,h:1.286,hood:true},
    ]);
    const near=onRoof(sideKey,nearU,edge),far=onRoof(sideKey,rearU,edge);
    wall(pl,[[rearU(WALL0),WALL0],[nearU(WALL0),WALL0],[nearU(near),near],[rearU(far),far]],[
      {s:sign>0?-5.045:-4.94,y:4.958,w:.57,h:1.42,hood:true},
      ...(sign>0?[{s:-3.831,y:4.089,w:.736,h:2.113,hood:true,entry:true}]:[]),
    ]);
  }
  const NE=planeU(1,farU);
  wall(NE,[[negV(WALL0),WALL0],[posV(WALL0),WALL0],[posV(Y_DECK_BEAM),Y_DECK_BEAM],[negV(Y_DECK_BEAM),Y_DECK_BEAM]],[
    {s:v_mid-.15,y:7.593,w:.528,h:1.332,hood:true},
    {s:v_mid-.15,y:4.943,w:.616,h:1.49,hood:true},
  ]);
  // The cross-wall physically meets the two cut roof planes. It is dark backing when occluded.
  const SW=planeU(-1,nearU);
  wall(SW,[[negV(WALL0),WALL0],[posV(WALL0),WALL0],[posV(Y_DECK_BEAM),Y_DECK_BEAM],[negV(Y_DECK_BEAM),Y_DECK_BEAM]],[]);
  const G=planeU(-1,rearU);
  const nv=onRoof('neg',rearU,negV),pv=onRoof('pos',rearU,posV),ridge=onRoof('neg',rearU,y=>ridgeV(rearU(y)));
  wall(G,[[negV(WALL0),WALL0],[posV(WALL0),WALL0],[posV(pv),pv],[ridgeV(rearU(ridge)),ridge],[negV(nv),nv]],[
    {s:-.47,y:8.19,w:.42,h:.966,hood:true,narrow:true},
    {s:.905,y:8.19,w:.42,h:.966,hood:true,narrow:true},
  ]);

  const nearCorners=(y:number)=>[p(nearU(y),y,negV(y)),p(farU(y),y,negV(y)),p(farU(y),y,posV(y)),p(nearU(y),y,posV(y))];
  for(const i of [1,2])beam(white,nearCorners(WALL0)[i],nearCorners(Y_DECK_BEAM)[i],.094,.091,[i===1?-.04:.04,0,i===1?-1:1],[.979,.985,.992]);
  // Only the rear corner boards continue below the gable; no fake junction seam through the attached walls.
  for(const [s,edge,hy] of [[-1,negV,nv],[1,posV,pv]] as const){
    beam(white,p(rearU(WALL0),WALL0,edge(WALL0)),p(rearU(hy-.094),hy-.094,edge(hy-.094)),.09,.091,[-.32,0,s],[.965,.96,.941]);
  }

  const yS=RING_FLOOR,Ybottom=RING_FLOOR-.155;
  const outerDeck=(y:number,ex=0)=>[
    p(GALLERY.u0-ex,y,GALLERY.v0-ex),p(GALLERY.u1+ex,y,GALLERY.v0-ex),p(GALLERY.u1+ex,y,GALLERY.v1+ex),p(GALLERY.u0-ex,y,GALLERY.v1+ex),
  ];
  prism(deck,outerDeck(Ybottom),outerDeck(yS));
  // White edge board on the otherwise weathered board end grain; excludes the measured top face.
  const rimLow=outerDeck(RING_FLOOR-.123,.007),rimHigh=outerDeck(RING_FLOOR-.019,.007);
  for(let k=0;k<4;k++){const j=(k+1)%4; const q=[rimLow[k],rimLow[j],rimHigh[j],rimHigh[k]]; eaves.poly(q,orient(q,p([0,1,0,-1][k],0,[-1,0,1,0][k])),undefined,[.70,.686,.644]);}
  const d0=outerDeck(RING_FLOOR+.043,-.080),d1=outerDeck(RAIL_TOP-.043,-.08);
  for(let k=0;k<4;k++){
    const j=(k+1)%4;
    const normal=p([0,1,0,-1][k],0,[-1,0,1,0][k]);
    beam(frame,d0[k],d0[j],.097,.077,normal,[.922,.91,.882]);
    beam(frame,d1[k],d1[j],.092,.105,normal);
    const n=4;
    for(let i=0;i<n;i++){
      const t=i/n,tn=(i+1)/n;
      const low=mix(d0[k],d0[j],t),high=mix(d1[k],d1[j],t);
      boxCenter(frame,p(low[0],(RAIL_TOP+RING_FLOOR)/2,low[2]),.085,RAIL_TOP-RING_FLOOR,.085);
      const gap=.055;
      const m=(d0[k][0]===d0[j][0])?Math.abs(d0[k][2]-d0[j][2]):Math.abs(d0[k][0]-d0[j][0]);
      const l=(t+gap/m),r=(tn-gap/m);
      const lo=mix(d0[k],d0[j],l),ro=mix(d0[k],d0[j],r),hi=mix(d1[k],d1[j],l),ri=mix(d1[k],d1[j],r);
      const setBack=(loc:P,step:number)=>p(loc[0]-step*normal[0],loc[1],loc[2]-step*normal[2]);
      beam(frame,setBack(lo,.016),setBack(ri,.016),.060,.043,normal,[.968,.962,.936]);
      // Two half-depth diagonals as in a lapped timber X; slightly separate outside faces.
      beam(frame,setBack(ro,-.004),setBack(hi,-.004),.063,.036,normal,[.972,.973,.955]);
      if(hero && i%2===0){
        const nail=mix(lo,hi,.73);
        boxCenter(clips,p(nail[0]+normal[0]*.041,nail[1],nail[2]+normal[2]*.041),.012,.012,.012);
      }
    }
    const topWall=nearCorners(Ybottom),smallWall=nearCorners(Ybottom-.89);
    for(const s of (hero?[.20,.5,.80]:[.25,.75])){
      const inner=mix(topWall[k],topWall[j],s),below=mix(smallWall[k],smallWall[j],s),outer=mix(outerDeck(Ybottom-.055,-.08)[k],outerDeck(Ybottom-.055,-.08)[j],s);
      const nface=p(Math.abs(normal[2]),0,Math.abs(normal[0]));
      beam(eaves,p(inner[0]-normal[0]*.08,inner[1]-.035,inner[2]-normal[2]*.08),outer,.132,.112,nface,[.85,.837,.788]);
      beam(frame,p(below[0]+normal[0]*.026,below[1]-.035,below[2]+normal[2]*.026),p(outer[0]-normal[0]*.09,outer[1]-.044,outer[2]-normal[2]*.09),.098,.1,nface);
      beam(frame,p(below[0]+normal[0]*.030,below[1]-.107,below[2]+normal[2]*.030),p(inner[0]+normal[0]*.030,inner[1]-.100,inner[2]+normal[2]*.030),.121,.094,normal,[.883,.871,.822]);
    }
  }
  if(hero){
    // Deck end grain/floorboard seams. Main plane remains continuous (no masked apertures).
    for(let v=GALLERY.v0+.17,ix=0;v<GALLERY.v1-.12;v+=.166,ix++){
      const u0=GALLERY.u0+.045,u1=GALLERY.u1-.045;
      const y=Ybottom-.002;
      const sh=ix%4===1?.82:.78;
      deck.poly([p(u0,y,v-.006),p(u1,y,v-.006),p(u1,y,v+.006),p(u0,y,v+.006)],p(0,-1,0),undefined,[sh,sh*.977,sh*.94]);
    }
  }
  // The cottage roof is the calibrated pair of planes. No fabric or arbitrary prism over the seam.
  const roof=stock('calibrated-cottage-planes','shingle'), ridgeWood=stock('ridge-rakes-and-flashing','shingle');
  for(const key of ['neg','pos'] as const){
    const [a,b,c]=HOUSE_PLANES[key], v=HOUSE_EAVE[key];
    const ca=HOUSE_EAVE.u0,cb=roofNearU(key,v), uc=roofNearU(key,ridgeV(-1.36));
    const endV=ridgeV(uc);
    const ra=[p(ca,roofY(key,ca,v),v),p(cb,roofY(key,cb,v),v),p(uc,roofY(key,uc,endV),endV),p(ca,roofY(key,ca,ridgeV(ca)),ridgeV(ca))];
    const outward=p(-b,1,-c);
    roof.poly(ra,outward,ra.map(q=>[q[0],q[2]*Math.sqrt(1+c*c)] as XY));
    const under=ra.map(q=>p(q[0],q[1]-.093,q[2]));
    eaves.poly(under,orient(under,p(0,-1,0)));
    eaves.poly([ra[0],ra[1],under[1],under[0]],p(0,-.16,key==='neg'?-1:1));
    ridgeWood.poly([ra[3],ra[0],under[0],under[3]],p(-1,0,0),undefined,[.87,.823,.793]);
    const inset=.011, overlap=.023;
    beam(gutter,p(ra[3][0]+.012,ra[3][1]-.027,ra[3][2]),p(ra[0][0]+.012,ra[0][1]-.027,ra[0][2]),.065,.033,[-1,0,0],[.77,.586,.545]);
    // Very restrained corrosion-dark flash along the true roof/attaching tower cut.
    ridgeWood.poly([ra[1],ra[2],p(ra[2][0]-overlap,ra[2][1]+inset,ra[2][2]),p(ra[1][0]-overlap,ra[1][1]+inset,ra[1][2])],outward,undefined,[.39,.363,.35]);
  }
  // Narrow ridge cap, kept at <16mm over fitted adjoining planes.
  const us=[HOUSE_EAVE.u0+.012,roofNearU('neg',ridgeV(-1.36))-.019];
  for(const key of ['neg','pos'] as const){
    const sign=key==='neg'?-1:1;
    const rib=us.map(u=>p(u,roofY(key,u,ridgeV(u))+.013,ridgeV(u)));
    const fl=us.map(u=>{const v=ridgeV(u)+.113*sign;return p(u,roofY(key,u,v)+.008,v);});
    ridgeWood.poly([rib[0],rib[1],fl[1],fl[0]],orient([rib[0],rib[1],fl[1],fl[0]],p(0,1,0)),undefined,[.91,.88,.838]);
  }

  const chimney=stock('masonry-stack','brick'),chTop=stock('chimney-cap','chimneyCap');
  cuboid(chimney,-6.066,-5.28,9.220,10.899,-.273,.555);
  cuboid(chTop,-6.136,-5.213,10.897,10.96,-.331,.639,[.848,.795,.723]);
  for(const key of ['neg','pos'] as const){
    const xx=[-6.123,-5.198], vo=key==='neg'?-.362:.642;
    const A=xx.map(u=>p(u,roofY(key,u,vo)+.013,vo)),B=xx.map(u=>p(u,roofY(key,u,ridgeV(u))+.013,ridgeV(u)));
    clips.poly([A[0],A[1],B[1],B[0]],orient([A[0],A[1],B[1],B[0]],p(0,1,0)),undefined,[.73,.716,.674]);
  }
  if(hero){
    cuboid(clips,-5.965,-5.38,10.958,10.975,-.194,.469,[.73,.691,.632]);
  }

  const lowerLantern=stock('white-lantern-curb','siding'), iron=stock('red-lantern-rings','red'), lantern=stock('hex-iron-lantern-roof','red'), gl=stock('lantern-glazing','lantern',false), capTrim=stock('cap-iron-joinery','red');
  const ct=CAP.normalDegrees*Math.PI/180, R=CAP.apothem/Math.cos(Math.PI/6);
  const hex=(radius:number,h:number)=>Array.from({length:6},(_,i)=>{const t=ct+(i+.5)*Math.PI/3;return p(CAP.u+radius*Math.cos(t),h,CAP.v+radius*Math.sin(t));});
  const cutY=CAP.peak-CAP.apothem*CAP.slope,glassR=R-.113;
  const lower=Array.from({length:4},(_,i)=>p(CAP.u+(i===0||i===3?-1:1)*1.096,RING_FLOOR+.002,CAP.v+(i<2?-1:1)*1.096));
  const upper=lower.map(q=>p(CAP.u+(q[0]-CAP.u)*.888,12.118,CAP.v+(q[2]-CAP.v)*.888));
  prism(lowerLantern,lower,upper);
  prism(iron,hex(glassR,12.115),hex(glassR,12.223));
  prism(iron,hex(glassR+.014,cutY-.132),hex(glassR+.014,cutY-.014));
  const lp=hex(glassR,12.218),hp=hex(glassR,cutY-.112), rroof=hex(R,cutY);
  // Unpowered stylized optical element behind the glazing (not aid characteristics).
  const ns=hero?16:8;
  tube(lens,CAP.u,CAP.v,12.171,12.36,.27,.263,ns);
  tube(lens,CAP.u,CAP.v,12.36,12.98,.21,.21,ns);
  for(let h=12.416,ni=0;h<12.94;h+=.073,ni++){
    if(!hero&&ni%2!==0) continue;
    tube(lens,CAP.u,CAP.v,h,h+.022,.247,.232,ns);
  }
  tube(clips,CAP.u,CAP.v,12.985,13.074,.218,.053,ns);
  const inRoof=(q:P)=>p(q[0],q[1]-.059,q[2]);
  for(let i=0;i<6;i++){
    const j=(i+1)%6;
    const x=(lp[i][0]+lp[j][0])/2-CAP.u, v=(lp[i][2]+lp[j][2])/2-CAP.v;
    const n=p(x,0,v);
    beam(iron,p(lp[i][0],lp[i][1]-.008,lp[i][2]),p(hp[i][0],hp[i][1]+.038,hp[i][2]),.072,.07,n);
    const at=(f:number,up:boolean)=>mix(up?hp[i]:lp[i],up?hp[j]:lp[j],f);
    gl.poly([at(.018,false),at(.978,false),at(.978,true),at(.018,true)],n,undefined,[.92+(i%3)*.021,.97,1]);
    if(hero&&i%2===0)
      beam(capTrim,at(.519,false),at(.519,true),.017,.024,n,[.685,.531,.489]);
    lantern.poly([rroof[i],rroof[j],p(CAP.u,CAP.peak,CAP.v)]);
    lantern.poly([rroof[i],inRoof(rroof[i]),inRoof(rroof[j]),rroof[j]],n);
    if(hero){
      const L=p(CAP.u,CAP.peak,CAP.v),A=mix(rroof[i],L,.012),B=mix(rroof[i],L,.964);
      beam(capTrim,p(A[0],A[1]+.006,A[2]),p(B[0],B[1]+.006,B[2]),.023,.012,p(0,1,0),[.85,.78,.753]);
      const Bolt=mix(A,B,.084); boxCenter(capTrim,p(Bolt[0],Bolt[1]+.011,Bolt[2]),.025,.019,.024);
    }
  }
  flat(iron,hex(R,cutY-.059),p(0,-1,0));
  tube(iron,CAP.u,CAP.v,CAP.peak-.007,CAP.peak+.089,.105,.057,hero?12:6);
  tube(white,CAP.u,CAP.v,CAP.peak+.085,CAP.peak+.36,.048,.035,hero?10:5);
  tube(clips,CAP.u,CAP.v,CAP.peak+.33,CAP.peak+.44,.05,.047,hero?10:5);
  // Small wind ornament inferred from dated visible finial, without claimed silhouette dimensions.
  const vane=stock('crown-vane','iron');
  const vector=(along:number,h:number,depth:number)=>p(CAP.u+.78*along-.625*depth,h,CAP.v+.625*along+.78*depth);
  const vpoly:XY[]=[[-.17,13.975],[-.123,14.027],[-.08,14.056],[-.066,14.187],[-.02,14.208],[.034,14.104],[.091,14.009],[.188,13.981],[.123,13.948],[-.019,13.942]];
  for(const f of [-1,1]){
    const q=vpoly.map(([u,y])=>vector(u,y,f*.012));
    vane.poly(q,p(-.625*f,0,.78*f),undefined,[.63,.598,.52],[],vpoly);
  }
  const base=stock('nominal-foundation-separate','foundation');
  cuboid(base,rearU(WALL0)+.034,farU(WALL0)-.038,nominalFoundationLow,WALL0+.003,negV(WALL0)+.035,posV(WALL0)-.035);
  // Dated form study only. One bevelled solid follows the nominal threshold, no ramp, physics or access claim.
  const e=ENTRY, stoop=stock('nominal-dated-entry-stoop','foundation');
  const E=.009, c=.007;
  const profile:XY[]=[
    [e.back,e.low],[e.front,e.low],[e.front,e.foot-E],[e.front-c,e.foot],
    [e.noseMiddle,e.foot],[e.noseMiddle,e.middle-E],[e.noseMiddle-c,e.middle],
    [e.noseTop,e.middle],[e.noseTop,e.top-E],[e.noseTop-c,e.top],[e.back,e.top],
  ];
  const atE=(u:number,w:XY)=>p(u,w[1],w[0]);
  stoop.poly(profile.map(q=>atE(e.left,q)),p(-1,0,0),undefined,[1.08,1.075,1.032],[],profile);
  stoop.poly(profile.map(q=>atE(e.right,q)),p(1,0,0),undefined,[1.08,1.074,1.019],[],profile);
  for(let i=0;i<profile.length;i++){
    const a=profile[i],b=profile[(i+1)%profile.length],dv=b[0]-a[0],dy=b[1]-a[1];
    const color=dv<-.04?[.95,.926,.88]:[.98,.952,.9];
    stoop.poly([atE(e.left,a),atE(e.right,a),atE(e.right,b),atE(e.left,b)],p(0,-dv,dy),undefined,color);
  }
  const group=new T.Group();
  group.name='NORTH RUSTICO · '+tier;
  group.userData={frameDatum: DATUM,unchangedScenery:true,detached:true};
  for(const [key,r] of bat){
    const g=r.b.finish();if(!g) continue;
    const mesh=new T.Mesh(g,m[r.m]);
    mesh.name=key;mesh.castShadow=r.casting;mesh.receiveShadow=true;
    group.add(mesh);
  }
  return group;
}
