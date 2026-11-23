/** Original architectural material categories inferred from broad size only.
 * This local downtown arts pass claims no facade survey or building use. */
export function downtownFacade(lon:number,lat:number,height:number,seed:number){
  if(lon< -63.130||lon> -63.116||lat<46.2285||lat>46.2395)return 0;
  if(height<8.5)return 1;
  if(height<17.5)return 2+(seed%2);
  return 4+(seed%2);
}
export const downtownFacadeGLSL=/* glsl */`
void harbourWalls(inout vec3 c,vec2 uv,vec3 wp,float style,float k,float fine){
 float home=step(.5,style)*(1.-step(1.5,style));
 float office=step(3.5,style), masonry=(1.-home)*(1.-step(4.5,style));
 vec2 bay=mix(vec2(2.8,3.17),vec2(2.24,2.68),home);
 bay=mix(bay,vec2(3.16,3.38),office);
 vec2 grid=uv/bay;
 float aperture=band(grid.x,mix(.25,.17,office),mix(.73,.84,office))*
    band(grid.y,mix(.32,.20,office),mix(.79,.84,office));
 float casing=band(grid.x,.20,.79)*band(grid.y,.25,.85);
 if(office>.5)casing=max(casing,band(grid.x,.13,.89)*band(grid.y,.17,.89));
 float upper=band(grid.y,.83,.94), vertical=band(grid.x,.48,.53);
 float glassDivider=vertical*aperture;
 float foundation=1.-smoothstep(.22,.66,uv.y);
 float ground=1.-smoothstep(bay.y*.80,bay.y*1.04,uv.y);
 float stoneCourse=band(uv.y*2.05,.0,.09), woodCourse=band(uv.y*5.1,.0,.16);
 float stoneStep=band((uv.x+.24*mod(floor(uv.y*2.05),2.))/.48,.0,.07);
 float wallVariation=.96+.08*warmWindowHash(floor(wp.xz*.31));
 c=mix(c,c*vec3(1.10,.99,.90),masonry*(.31+.38*step(2.5,style)));
 c*=wallVariation*(1.-fine*(home*.10*woodCourse+masonry*(.055+.040*step(2.5,style))*stoneCourse+
          masonry*.044*stoneStep));
 c=mix(c,c*vec3(.72,.76,.76),foundation*.68);
 c=mix(c,c*vec3(.85,.88,.89),casing*.8);
 if(office>.5)c*=1.-(.20+.12*step(4.5,style))*upper;
 vec3 skyGlass=mix(vec3(.035,.053,.058),vec3(.115,.147,.153),.36+.46*k);
 float occupied=smoothstep(.59,.87,warmWindowHash(floor(grid)+floor(wp.xz*.14)));
 skyGlass=mix(skyGlass,vec3(.18,.151,.104),occupied*.26*fine);
 c=mix(c,skyGlass,aperture*(.78+office*.12));
 c=mix(c,mix(vec3(.14,.14,.121),c,home*.47),glassDivider*.46*fine);
 float sill=band(grid.y,.27,.33)*band(grid.x,.19,.84);
 c+=mix(vec3(.038,.035,.026),vec3(.026,.035,.038),office)*sill*(.72+.28*fine);
 c*=1.-ground*(.09+.05*office);
}
`;
