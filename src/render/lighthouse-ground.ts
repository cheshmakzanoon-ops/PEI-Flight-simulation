import {project} from '../sim/geo.ts';
import {LIGHT_STATIONS} from '../sim/lighthouse-sites.ts';
const ep=project(LIGHT_STATIONS.east.lon,LIGHT_STATIONS.east.lat),wp=project(LIGHT_STATIONS.west.lon,LIGHT_STATIONS.west.lat);

/** Original, deliberately bounded site materials. No aerial or street photograph is
 * downloaded at runtime. Called only after the official land mask has accepted a pixel.
 * Uses the renderer's existing noise() and the same world-space sun as the buildings. */
export const lighthouseGroundGLSL=`
float stationSegment(vec2 p,vec2 a,vec2 b) {
 vec2 e=b-a;return length(p-a-e*clamp(dot(p-a,e)/dot(e,e),0.,1.));
}
float stationBox(vec2 p,vec2 b) {
 vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);
}
vec3 stationGround(vec3 original,vec2 p,float coast){
 vec2 east=p-vec2(${ep.x.toFixed(4)},${ep.z.toFixed(4)});
 vec2 west=p-vec2(${wp.x.toFixed(4)},${wp.z.toFixed(4)});
 // Two cheap station bounds; ordinary PEI pixels return before any procedural work.
 bool E=abs(east.x+22.)<109.&&abs(east.y-1.)<83.;
 bool W=abs(west.x+4.)<87.&&abs(west.y+13.)<79.;
 if(!E&&!W)return original;
 vec2 q=E?east:west;
 float px=max(length(dFdx(p)),length(dFdy(p)));
 float broad=noise(q*.063),grain=mix(.50,noise(q*3.7),1.-smoothstep(.15,.69,px));
 float blade=mix(.50,noise(q*18.),1.-smoothstep(.025,.16,px));
 float edge=E?stationBox(q-vec2(-22.,1.),vec2(83.,56.)):stationBox(q-vec2(-4.,-13.),vec2(56.,49.));
 float amt=(1.-smoothstep(-3.,19.,edge)) * smoothstep(E?1.5:.5,E?9.:5.,coast);
 if(amt<=0.)return original;
 vec3 outcol;float houseShadow=0.;float contact=0.;
 if(E){
   // The 2023 aerial shows a clear mown point, radial walk, and gravel loop off
   // Lighthouse Road. The National Road Network centreline ends at (+19,-39)m.
   float dir=dot(q,vec2(.34,.94))*.77;
   float cut=sin(dir)*(1.-smoothstep(.45,2.1,fwidth(dir)));
   vec3 turf=mix(vec3(.108,.143,.049),vec3(.189,.216,.080),broad);
   turf*=.94+.095*grain+.064*blade+.026*cut;
   float drive=min(stationSegment(q,vec2(18.,-39.),vec2(31.,-30.)),
               min(stationSegment(q,vec2(31.,-30.),vec2(38.,-15.)),stationSegment(q,vec2(38.,-15.),vec2(34.,-1.))));
   // Local east/north axes parallel the surveyed long edge of the museum.
   vec2 st=vec2(dot(q-vec2(17.,-6.),vec2(.950,-.313)),dot(q-vec2(17.,-6.),vec2(.313,.950)));
   vec2 sh=vec2(dot(vec2(.60,.31),vec2(.950,-.313)),dot(vec2(.60,.31),vec2(.313,.950)))*6.2/.74;
   float hb=stationBox(st,vec2(6.65,4.05)), lb=stationBox(st-vec2(8.7,-.2),vec2(2.95));
   contact=1.-smoothstep(-.13,.98+px*.35,min(hb,lb));
   float footprint=min(min(hb,lb),min(stationBox(st-sh*.5,vec2(6.6,4.0)),
                  min(stationBox(st-sh,vec2(6.55,3.5)),stationBox(st-vec2(8.7,-.2)-sh*.55,vec2(2.93)))));
   houseShadow=1.-smoothstep(-.2,1.12+px*.45,footprint);
   float court=stationBox(st-vec2(4.,-8.),vec2(14.,3.3));
   float apron=min(drive-3.65,court);
   float path=min(abs(length(q)-4.5)-.83,
        min(stationSegment(q,vec2(-1.6,4.3),vec2(1.,9.1))-1.05,
            min(stationSegment(q,vec2(1.,9.1),vec2(31.,-.5))-.91,stationSegment(q,vec2(1.,9.1),vec2(-28.,17.))-.99)));
   vec3 gravel=vec3(.285,.248,.211)*(.80+.34*grain+.10*broad);
   vec3 concrete=vec3(.345,.328,.282)*(.92+.12*grain);
   outcol=mix(turf,gravel,1.-smoothstep(-.30,.42+px*.4,apron+(broad-.5)*.66));
   outcol=mix(outcol,concrete,1.-smoothstep(-.17,.23+px*.45,path));
 }else{
   // The evidenced West site is on a sandy shore, not an inland grass field.
   // Render beach/dune transition and gravel access, retaining native woods inland.
   float coastal=1.-smoothstep(13.,70.,coast+5.*(broad-.5));
   float tussock=smoothstep(.39,.64,broad+.13*(grain-.5))*smoothstep(11.,36.,coast);
   vec3 sand=mix(vec3(.335,.220,.125),vec3(.418,.306,.184),broad)*(.90+.17*grain+.05*blade);
   vec3 grass=mix(vec3(.114,.131,.046),vec3(.22,.21,.082),broad)*(.92+.14*grain);
   outcol=mix(mix(original,grass,.59),sand,coastal);
   outcol=mix(outcol,grass,tussock*coastal*.87);
   vec2 site=vec2(dot(q,vec2(-.874,.485)),dot(q,vec2(-.485,-.874)));
   vec2 inn=site-vec2(-5.45,12.),sh=vec2(dot(vec2(.60,.31),vec2(-.874,.485)),dot(vec2(.60,.31),vec2(-.485,-.874)))*6.5/.74;
   float bounds=stationBox(inn,vec2(5.28,14.)),annex=min(stationBox(site-vec2(-6.4,27.2),vec2(3.7,3.3)),stationBox(site-vec2(-11.7,9.5),vec2(4.15,2.28)));
   contact=1.-smoothstep(-.14,1.05+px*.35,min(bounds,annex));
   float shadowDistance=min(min(bounds,annex),min(stationBox(inn-sh*.5,vec2(5.28,14.)),stationBox(inn-sh,vec2(4.6,13.65))));
   houseShadow=1.-smoothstep(-.20,1.22+px*.4,shadowDistance);
   float apron=min(stationSegment(q,vec2(8.,15.),vec2(5.,5.))-3.1,stationSegment(q,vec2(8.,15.),vec2(16.,-4.))-2.5);
   outcol=mix(outcol,vec3(.355,.30,.227)*(.88+.21*grain),1.-smoothstep(-.32,.58+px*.4,apron));
 }
 // A fixed outdoor shadow follows the same lighting direction as the world sun.
 // Project the tapered tower onto the actual land surface; never draw it over water.
 vec2 tip=vec2(.60,.31)*(E?19.5:20.62)/.74;
 float along=clamp(dot(q,tip)/dot(tip,tip),0.,1.);
 float penumbra=.22+1.6*along;
 float shade=1.-smoothstep(-penumbra,penumbra+px*.45,length(q-tip*along)-mix(E?3.45:4.2,1.50,along));
 outcol*=1.-max(shade,houseShadow)*.33;
 outcol*=1.-contact*.23;
 return mix(original,outcol,amt*.96);
}
`;
