import {departureBriefing} from '../src/app/departure-briefing.ts';
import {SITES} from '../src/sim/places.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync as R} from 'node:fs';
import {Script} from 'node:vm';
import ts from 'typescript';
import * as T from 'three';
import * as profile from '../src/app/scenery-profile.ts';
import {northCapeStandOption} from '../src/app/north-cape-stand-option.ts';
import {SEAWARD_ROUTE} from '../src/render/quartermaster-seaward/lease.ts';
import {capeCardGain,capeTilt,capeCrownShaders,CAPE_DISPLAY,CAPE_LIVE} from '../src/render/north-cape-stand/appearance.ts';
import {CAPE_ROWS,CAPE_TYPED_ROWS_SHA} from '../src/render/north-cape-stand/roles.private.ts';
import {markPublishedCapeRows,newCapeCrownMaterial} from '../src/render/north-cape-stand/review.ts';
import {Vegetation} from '../src/render/vegetation.ts';

const H=x=>createHash('sha256').update(x).digest('hex');
const appearance='northCapeStandReview',veto='stockNorthCapeStandReview',route='departure=northcape-wind-low';
test('no default/other dispatch/profile opt in and exact veto preserves existing flags',()=>{
 assert.deepEqual(northCapeStandOption('?'+route),{requested:false,stockSearch:'?'+route});
 const subj=['?'+route+'&'+appearance, '?'+route+'&scenery=standard&diagnostics&'+appearance];
 assert(subj.every(s=>northCapeStandOption(s).requested));
 const invalid=[
  '?departure=harbour-low&'+appearance, '?'+route+'&'+appearance+'&'+appearance, '?'+route+'&'+appearance+'=true',
  '?'+route+'&'+appearance+'&scenery=detail', '?'+route+'&'+appearance+'&scenery=standard&scenery=detail',
  '?'+route+'&'+appearance+'&'+veto, '?'+route+'&'+appearance+'&northCapeWind',
  '?'+route+'&'+appearance+'&canopyLight', '?'+route+'&'+appearance+'&stockCanopyLight',
  '?'+route+'&'+appearance+'&northBaywalkPreview', '?'+route+'&'+appearance+'&datumDoesNotExist',
  '?'+route+'&departure=cavendish&'+appearance, '?'+route+'&diagnostics&diagnostics&'+appearance,
 ];
 assert(invalid.every(q=>!northCapeStandOption(q).requested));
 assert.equal(northCapeStandOption('?'+route+'&'+veto+'&stockOpenCoast&stockCanopyLight').stockSearch,route+'&stockOpenCoast=&stockCanopyLight=');
 assert(!profile.SCENERY_REVIEWS.some(q=>q.flag===appearance||q.flag===veto));
});
test('all known scenery predicates see exact stock options with editor key, veto or conflict',()=>{
 for(const old of ['?'+route,'?'+route+'&scenery=standard&diagnostics','?'+route+'&scenery=detail',
  '?'+route+'&stockNorthCapeWind&woodlandView','?'+route+'&northCapeWind&stockOpenCoast','?departure=curran&cavendishDetail']){
  const base=profile.sceneryOptions(old);
  for(const extra of [appearance,veto,appearance+'&'+veto]){
   const result=profile.sceneryOptions(northCapeStandOption(old+'&'+extra).stockSearch);
   assert.deepEqual([...result],[...base]);
   const names=Object.keys(profile).filter(n=>(n.startsWith('standard')||n==='canopyLightRequested'||n==='forestFloorMode')&&typeof profile[n]==='function'&&profile[n].length===1);
   assert(names.length>6);
   for(const k of names)assert.deepEqual(profile[k](result),profile[k](base),k);
  }
 }
 const main=R(new URL('../src/main.ts',import.meta.url),'utf8');
 assert(main.includes("if(datedCapeStand.requested&&directionalCanopy&&capeMode==='ordinary')"));
});
test('the actual frame submits once, restoring the Cape, all terrain leases and shoreline in both paint paths',()=>{
 const main=R(new URL('../src/main.ts',import.meta.url),'utf8');
 const dispatch='const submitWorld=';
 const frame='const rE=new THREE.Euler';
 const start='const endRidge=world.beginKingsRidgeDraw(camera);';
 const boundary="if(world.tryonRockState==='pending'";
 assert.equal(main.split(dispatch).length,2);
 assert.equal(main.split(frame).length,2);
 assert.equal(main.split(start).length,2);
 assert.equal(main.split(boundary).length,2);
 const body=main.slice(main.indexOf(dispatch),main.indexOf(frame))+main.slice(main.indexOf(start),main.indexOf(boundary));
 assert(body.length>0);
 const script=new Script(ts.transpile('(()=>{'+body+'})()', {target:ts.ScriptTarget.ES2022}));
 const paint=(cape,failAt,industrial=false,river=false,dune=false,lake=false,field=false,quay,west='ready',south='ready',roof=false,east=false)=>{
  const calls=[],error=new Error(failAt),route=east?'east-light':field?'kings-sand-dunes':
   quay==='foreign'?'seacow-head-coast':quay||roof?SEAWARD_ROUTE:'northcape-wind-low';
  const light=cape==='light-preview';
  const scope={scene:{},camera:{fov:53,zoom:1,position:{x:quay==='distant'?3000:5950,y:120,z:29811}},SITES:[{id:route}],
   activeSite:0,ui:{mode:'flight'},view:0,now:42,standardIndustrial:industrial,buildings:undefined,
   standardRiverSeat:undefined,standardLakeSeat:undefined,cavendishSeat:undefined,dunesFields:undefined,
   princeLowFieldSeat:undefined,KINGS_DUNES_MAPPED_PASS:{id:'kings-sand-dunes'},
   f:{status:'flying'},playing:true,dalvayDefaultFlight:()=>true,lakeFrame:()=>true,cavendishFrame:()=>true,
   QUAY_ROUTE:'harbour-low',quayCandidate:undefined,quaySeat:undefined,quayAdmitted:!!quay};
  // The extracted frame has no query bootstrap. Bind its optional diagnostic
  // exactly as a plain page, or as a ready lighthouse page for the opt-in case.
  scope.diagnostic=light;
  scope.capeLightPreview=light?{state:{phase:'active',solidDraws:1,paneDraws:1}}:undefined;
  scope.capeLightSupported=()=>true;
  scope.window={};
  scope.eastWallPreview=undefined;scope.eastWallDrawn=false;scope.eastWallGain={value:0};
  scope.eastWallRenderer=()=>true;
  if(east){
   const owner={};
   scope.eastWallPreview={owner,frame:(id,draw,supported)=>{
    assert.equal(id,'east-light');assert.equal(draw,true);assert.equal(supported,true);
    scope.eastWallGain.value=1;
   }};
   scope.buildings={drawEastVillageLocal:(renderer,camera,chosen,draw)=>{
    assert.equal(renderer,scope.renderer);assert.equal(camera,scope.camera);assert.equal(chosen,owner);
    assert.equal(scope.eastWallGain.value,1);
    calls.push('begin east');try{draw();return true;}finally{calls.push('end east');}
   }};
  }
  scope.SEAWARD_ROUTE=SEAWARD_ROUTE;
  const roofFrame={route,mode:'flight'};
  scope.seawardFrame=()=>roofFrame;
  // The old explicit north-quay comparison is outside ordinary roof admission.
  // Other ordinary sites have a lease object but must never call it.
  scope.seawardRoof=quay?undefined:{
   render:(f,submit)=>{
    assert(roof,'the roof lease must not run on an unrelated ordinary departure');
    assert.equal(f,roofFrame);assert.equal(f.route,SEAWARD_ROUTE);
    calls.push('begin roof');try{return submit();}finally{calls.push('end roof');}
   },
  };
  const finish=name=>()=>{calls.push('end '+name);};
  const begin=name=>{calls.push('begin '+name);if(failAt===name)throw error;return finish(name);};
  if(river)scope.standardRiverSeat={activeCohort:{beginDraw:()=>begin('river')},closeFlight:()=>calls.push('close river')};
  if(dune)scope.cavendishSeat={activeCohort:{beginDraw:()=>begin('dune')},closeFlight:()=>calls.push('close dune')};
  if(lake)scope.standardLakeSeat={beginDraw:()=>begin('lake')};
  if(field)scope.dunesFields={beginScopedDraw:()=>begin('field')};
  if(quay){
   scope.quayCandidate={draws:0};
   scope.quaySeat={
    beginDraw:(pilot,allowed)=>{
     assert.equal(pilot,scope.f);assert.equal(allowed,true);
     if(quay==='refused'){calls.push('refuse quay');return;}
     return begin('quay');
    },
    closeFlight:()=>calls.push('close quay'),
   };
  }
  scope.world={
   beginKingsRidgeDraw:c=>{assert.equal(c,scope.camera);return begin('ridge');},
   beginPrinceLandscapeDraw:()=>begin('prince'),
   beginRegularNorthRimDraw:c=>{assert.equal(c,scope.camera);return begin('rim');},
   beginBordenShoreArc:c=>{assert.equal(c,scope.camera);return begin('borden');},
   beginWest2RimDraw:c=>{
    assert.equal(c,scope.camera);
    if(west==='refused'){calls.push('refuse west2');return;}
    return begin('west2');
   },
   beginSouth21RimDraw:c=>{
    assert.equal(c,scope.camera);
    if(south==='refused'){calls.push('refuse south21');return;}
    const restore=begin('south21');
    return ()=>{restore();if(failAt==='close south21')throw error;};
   },
  };
  scope.datedStandReview=cape===true?{
   beforeFrame:p=>{assert.equal(p.site,'northcape-wind-low');assert.equal(p.mode,'flight');return begin('cape');},
   dispose:()=>calls.push('dispose cape'),
  }:undefined;
  if(industrial)scope.buildings={drawStandardIndustrial:submit=>{
   calls.push('begin industrial');try{return submit();}finally{calls.push('end industrial');}
  }};
  scope.renderer={render:(scene,camera)=>{
   assert.equal(scene,scope.scene);assert.equal(camera,scope.camera);calls.push('render');
   if(failAt==='render')throw error;
  }};
  if(['prince','rim','borden','west2','south21','close south21','render','quay'].includes(failAt))assert.throws(()=>script.runInNewContext(scope),e=>e===error);
  else script.runInNewContext(scope);
  assert.equal(scope.eastWallGain.value,0);
  if(light)assert.equal(JSON.stringify(scope.window.islandAirNorthCapeLightPreview),
   '{"phase":"active","solidDraws":1,"paneDraws":1,"authorityReady":true}');
  else assert.equal(Object.keys(scope.window).length,0);
  assert.equal(scope.eastWallDrawn,!!east&&failAt!=='render');
  if(quay)assert.equal(scope.quayAdmitted,quay!=='refused'&&quay!=='foreign');
  return calls;
 };
 const lead=['begin ridge','begin prince'],tail=['end prince','end ridge'];
 const southSubmit=['begin south21','render','end south21'];
 const submit=['begin west2',...southSubmit,'end west2'];
 const wholePaint=['begin rim','begin borden',...submit,'end borden','end rim'];
 for(const failAt of [undefined,'render']){
  assert.deepEqual(paint(false,failAt),[...lead,...wholePaint,...tail]);
  assert.deepEqual(paint(true,failAt),[...lead,'begin cape',...wholePaint,'end cape',...tail]);
 }
 assert.deepEqual(paint('light-preview',undefined),[...lead,...wholePaint,...tail]);
 assert.deepEqual(paint(true,'cape'),[...lead,'begin cape','dispose cape',...wholePaint,...tail]);
 assert.deepEqual(paint(false,'borden'),[...lead,'begin rim','begin borden','end rim',...tail]);
 assert.deepEqual(paint(true,'borden'),[...lead,'begin cape','begin rim','begin borden','end rim','end cape',...tail]);
 assert.deepEqual(paint(false,'rim'),[...lead,'begin rim',...tail]);
 assert.deepEqual(paint(false,'prince',false,true),['begin ridge','begin river','begin prince','end river','end ridge']);
 assert.deepEqual(paint(false,'render',false,true),['begin ridge','begin river','begin prince',...wholePaint,'end prince','end river','end ridge']);
 assert.deepEqual(paint(true,'rim'),[...lead,'begin cape','begin rim','end cape',...tail]);
 // Artificial combined owners exercise reverse restore even though real route IDs are exclusive.
 assert.deepEqual(paint(false,'render',false,false,false,false,true),[...lead,'begin rim','begin borden',
  'begin field',...submit,'end field','end borden','end rim',...tail]);
 assert.deepEqual(paint(false,'render',false,true,true,true),['begin ridge','begin dune','begin river',
  'begin prince','begin lake',...wholePaint,'end lake','end prince','end river','end dune','end ridge']);
 for(const failAt of [undefined,'render']){
  assert.deepEqual(paint(false,failAt,true),[...lead,'begin rim','begin borden','begin industrial',...submit,
   'end industrial','end borden','end rim',...tail]);
  assert.deepEqual(paint(true,failAt,true),[...lead,'begin cape',...wholePaint,'end cape',...tail]);
 }
 for(const failAt of [undefined,'render'])
  assert.deepEqual(paint(false,failAt,false,false,false,false,false,undefined,'ready','ready',false,true),
   [...lead,'begin rim','begin borden','begin east',...submit,'end east','end borden','end rim',...tail]);
 const roofPaint=failAt=>paint(false,failAt,false,false,false,false,false,undefined,'ready','ready',true);
 for(const failAt of [undefined,'render'])assert.deepEqual(roofPaint(failAt),[
  ...lead,'begin rim','begin borden','begin west2','begin south21','begin roof','render',
  'end roof','end south21','end west2','end borden','end rim',...tail
 ]);
 const quayPaint=(kind,failAt)=>paint(false,failAt,false,false,false,false,false,kind);
 const shoreLead=[...lead,'begin rim','begin borden'],shoreTail=['end borden','end rim',...tail];
 for(const failAt of [undefined,'render'])
  assert.deepEqual(quayPaint('near',failAt),[...shoreLead,'begin quay',...submit,'end quay',...shoreTail]);
 assert.deepEqual(quayPaint('near','quay'),[...shoreLead,'begin quay',...shoreTail]);
 assert.deepEqual(quayPaint('refused'),[...shoreLead,'refuse quay',...submit,...shoreTail]);
 assert.deepEqual(quayPaint('foreign'),[...shoreLead,'close quay',...submit,...shoreTail]);
 assert.deepEqual(quayPaint('distant'),[...shoreLead,...submit,...shoreTail]);
 // Distant/unavailable aperture retains the true one-render stock path;
 // a thrown begin or renderer still closes every previously acquired lease.
 for(const cape of [false,true]){
  const opener=cape?['begin cape']:[],closer=cape?['end cape']:[];
  const l=[...lead,...opener,'begin rim','begin borden'];
  const t=['end borden','end rim',...closer,...tail];
  for(const failAt of [undefined,'render'])assert.deepEqual(
   paint(cape,failAt,false,false,false,false,false,undefined,'refused'),[...l,'refuse west2',...southSubmit,...t]);
  assert.deepEqual(paint(cape,'west2'),[...l,'begin west2',...t]);
  for(const failAt of [undefined,'render']){
   assert.deepEqual(paint(cape,failAt,false,false,false,false,false,undefined,'ready','refused'),
    [...l,'begin west2','refuse south21','render','end west2',...t]);
   assert.deepEqual(paint(cape,failAt,false,false,false,false,false,undefined,'refused','refused'),
    [...l,'refuse west2','refuse south21','render',...t]);
  }
  assert.deepEqual(paint(cape,'south21'),[...l,'begin west2','begin south21','end west2',...t]);
  assert.deepEqual(paint(cape,'close south21'),[...l,...submit,...t]);
 }
});
test('angle, distance and lower-lens tapers exactly preserve full passed poses and exact overhead/far/near stock',()=>{
 for(const [meters,ry]of [[413,.175],[654,.267],[290,.384],[469,.242],[490,.30]])assert.equal(capeCardGain(meters,ry),1);
 for(const v of [[169.99,.21],[790,.20],[290,.048],[300,.8],[300,.94],[Infinity,.25],[NaN,.20],[400,NaN]])assert.equal(capeCardGain(...v),0);
 for(const v of [[175,.30],[730,.30],[440,.10],[400,.42]])assert(capeCardGain(...v)>0&&capeCardGain(...v)<1);
 const derivative=(fn,p)=>Math.abs(fn(p+.001)-fn(p-.001))/.002;
 for(const d of [170,255,690,790])assert(derivative(x=>capeCardGain(x,.31),d)<5e-6);
 for(const y of [.05,.14])assert(derivative(b=>capeCardGain(450,b),y)<.20);
 for(let k=0,last=1;k<=420;k++){
  const z=capeCardGain(430,.33+k*.001);assert(z>=0&&z<=last+1e-15);
  last=z;
 }
 assert(capeTilt(.3)<.25&&capeTilt(.48)>.42);
});
test('actual current Three stock shader source is recognized; old shadows and GPU geometry transforms not rewritten',()=>{
 const oldLoad=T.TextureLoader.prototype.load;
 T.TextureLoader.prototype.load=()=>new T.Texture();
 const oldEnv=import.meta.env;Object.assign(import.meta,{env:{BASE_URL:'/'}});
 let v;
 try{
  // Mark the actual module's one read-only in-source URL anchor in loader below.
  v=new Vegetation(new T.Scene(),{}, {},undefined,undefined,undefined,undefined,undefined,new T.Vector3(),undefined,undefined,true);
 }finally{T.TextureLoader.prototype.load=oldLoad;Object.assign(import.meta,{env:oldEnv});}
 const m=v.crownFillMaterial(),s=v.beaconsfieldShadowRoster().stock.material;
 assert.equal(H(m.vertexShader),'7cdc5727c9ddd750358ff213f6f2f6c9e07cfb3f927eb0ac2744d799795f0176');
 assert.equal(H(m.fragmentShader),'0b87f025c69132184c76a824fe86163d202cce3b3f0f50d54c0350f1ad2fc2d8');
 assert.equal(H(s.vertexShader),'1f0a1ec8670b21e67d24f6847bfa427b25ea0f0dbdeefb17a0f79afafad8f481');
 assert.equal(H(s.fragmentShader),'db2362b1e5d3b32f487bd66f0dc30ad0755845b6d3188f35af80d3e43a93b293');
 const p=capeCrownShaders(m.vertexShader,m.fragmentShader);assert.ok(p);
 assert(p.vertexShader.includes(CAPE_DISPLAY)&&p.vertexShader.includes(CAPE_LIVE));
 assert(p.vertexShader.includes('vec3 p=center+position.x*shape.y*right+position.y*portrait*up;'));
 assert(p.fragmentShader.includes('float a=mix(side.a,top.a,param.y);'));
 assert(p.fragmentShader.includes('float b=mix(otherSide.a,otherTop.a,param.y);'));
 assert(p.fragmentShader.includes('c=mix(pm,pn,capeStandMix.y)/max(a,.001);'));
 assert(p.fragmentShader.indexOf('dFdx(uv)')<p.fragmentShader.indexOf('if(capeStandMix.y>0.)'));
 assert(p.fragmentShader.includes('c=crownLeafFinish(c,uv,cardSun,param.x,a,crownLeafScale,crownFootprint);'));
 assert.equal(capeCrownShaders(s.vertexShader,s.fragmentShader),undefined);
 assert.equal(capeCrownShaders(p.vertexShader,p.fragmentShader),undefined);
});
function mockRoster(cold=false){
 const original=72,total=77,stems=new Float32Array(45000*3),shapes=new Float32Array(45000*4),
  hedge=new Float32Array(45000*4),marks=new Uint8Array(45000);
 for(let i=0;i<CAPE_ROWS.length;i++){
  const [x,y,z,from,,wh,ww,ch,cw,c]=CAPE_ROWS[i];
  stems.set([x,y,z],3*i+3);shapes.set([cold?ch:wh,cold?cw:ww,from,c],4*i+4);
 }
 return {r:{stems,shapes,original,total,stock:{},revision:2},hedge,marks};
}
test('exact 59 roots accepted for two legitimate cached metric profiles without editing any existing stream',()=>{
 assert.equal(CAPE_ROWS.length,59);assert.equal(H(JSON.stringify(CAPE_ROWS)),CAPE_TYPED_ROWS_SHA);
 assert(CAPE_ROWS.every(q=>q.every(v=>Math.fround(v)===v)));
 for(const cold of [false,true]){
  const {r,hedge,marks}=mockRoster(cold),before=[...['stems','shapes'].map(k=>H(Buffer.from(r[k].buffer))),H(Buffer.from(hedge.buffer))];
  const p=markPublishedCapeRows(r,hedge,marks);
  assert.equal(p?.length,59);assert(p.every(a=>marks[a.i]===a.row[4]));
  assert.deepEqual([H(Buffer.from(r.stems.buffer)),H(Buffer.from(r.shapes.buffer)),H(Buffer.from(hedge.buffer))],before);
  assert.equal(marks.filter(v=>v).length,59);
 }
});
test('missing or duplicate root, one ULP pose/size/tone/type drift, hedge alias and mixed prefixes cannot arm',()=>{
 for(const mutate of [
  a=>a.r.stems[3]+=.01, a=>a.r.stems[4]+=.01,a=>a.r.stems[5]+=.01,
  a=>a.r.shapes[4]+=.001,a=>a.r.shapes[5]+=.001,a=>a.r.shapes[6]=3,a=>a.r.shapes[7]+=.0001,
  a=>a.hedge[4]=.04,
  a=>a.r.original=58,
  a=>{a.r.stems.copyWithin(61*3,3,6);a.r.shapes.copyWithin(61*4,4,8);},
  a=>{a.r.stems.copyWithin(74*3,3,6);a.r.shapes.copyWithin(74*4,4,8);},
 ]){
  const a=mockRoster();mutate(a);assert.equal(markPublishedCapeRows(a.r,a.hedge,a.marks),undefined);
 }
});

test('new material shares original atlas wrappers and cannot dirty live r187 Texture.source',()=>{
 const t=new T.Texture(),c={value:t},sun={value:new T.Vector3()},gg={value:0};
 const old=new T.ShaderMaterial({uniforms:{canopy:c,canopySun:sun},side:T.DoubleSide,alphaToCoverage:true});
 const v=t.source.version,o=t.version;
 const next=newCapeCrownMaterial(old,{vertexShader:'a',fragmentShader:'b'},gg);
 assert(next);assert.equal(next.uniforms.canopy,c);assert.equal(next.uniforms.canopy.value,t);
 assert.equal(next.uniforms.canopySun,sun);assert.equal(next.uniforms.northCapeStandLive,gg);
 assert.deepEqual(Object.keys(old.uniforms),['canopy','canopySun']);
 assert.equal(t.source.version,v);assert.equal(t.version,o);
 next.dispose();assert.equal(t.source.version,v);
 old.colorWrite=false;
 assert.equal(newCapeCrownMaterial(old,{vertexShader:'a',fragmentShader:'b'},gg),undefined);
 assert.equal(t.source.version,v);
});


test('ancillary stand flags do not change another departure briefing or its scenery options',()=>{
 for(const site of SITES)for(const tail of ['', '&scenery=standard', '&scenery=detail', '&provinceFieldsReview', '&unknownConflict']){
  const base='?departure='+site.id+tail;
  const stock=departureBriefing(site,base),opts=profile.sceneryOptions(base).toString();
  for(const suffix of ['&northCapeStandReview','&stockNorthCapeStandReview','&northCapeStandReview&stockNorthCapeStandReview']){
   assert.equal(departureBriefing(site,base+suffix),stock,[site.id,tail,suffix].join(' '));
   assert.equal(profile.sceneryOptions(base+suffix).toString(),opts);
   assert.deepEqual(profile.capeTryonRockState(base+suffix),profile.capeTryonRockState(base));
  }
 }
 const queens=SITES.find(s=>s.id==='queens-fields');
 assert.ok(queens&&departureBriefing(queens,'?departure=northcape-wind-low&northCapeStandReview').includes('Look for fine furrows'));
});
