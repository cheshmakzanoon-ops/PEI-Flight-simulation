/** Private documentary material sketch for the original exact terminal row.
 * Keeps complete source shell, roof geometry, index, all original attributes
 * and all other material branches. A host still must authenticate the owner,
 * prove real WebGL link and all RGB outside the owner unchanged. */
export const TERMINAL_WALL_SPAN={tile:'q032001',start:5046,end:5490,vertices:69906} as const;
const unique=(s:string,tag:string)=>s.indexOf(tag)>=0&&s.indexOf(tag)===s.lastIndexOf(tag);
const common='#include <common>',mark='#include <logdepthbuf_vertex>';
const cases='if(facade>71.5&&facade<74.5){shadeHangar4(c,wp,uv2d,facade,d);}else';
export function terminalRooflessWallShader(vertex:string,fragment:string){
 if(vertex.includes('q68OuterWall')||fragment.includes('q68OuterWall')||fragment.includes('terminalWallLive')||
    !unique(vertex,common)||!unique(fragment,common)||!unique(vertex,mark)||
    !unique(fragment,cases)||!unique(fragment,'float area(float p,float a,float b)'))return;
 const id=`(gl_VertexID>=${TERMINAL_WALL_SPAN.start} && gl_VertexID<${TERMINAL_WALL_SPAN.end})`;
 const v=vertex.replace(common,common+'\nflat out float q68OuterWall;')
  .replace(mark,`q68OuterWall=${id}?1.:0.;\n `+mark);
 const f=fragment.replace(common,common+'\nflat in float q68OuterWall;\nuniform float terminalWallLive;')
  .replace(cases,`if(terminalWallLive>.5&&q68OuterWall>.5&&roof<.5){
   // No photographic paint code, window, light, access point or branding.
   // Underlying stock planes remain exact; imply neutral large industrial
   // sheet rather than a window grid. Resolve only aggregate broad variation.
   vec2 p=wp.xz-vec2(-45218.,12512.);
   float s=dot(p,abs(dot(n.xz,vec2(.235,-.972)))>.73?vec2(.972,.235):vec2(.235,-.972));
   float wz=max(fwidth(s),.001);
   float bandLimit=1.-smoothstep(.18,.62,wz),lapLimit=1.-smoothstep(.70,2.1,wz);
   float rhythm=s/.58;
   float rib=band(rhythm,.12,.21),lip=band(rhythm,.22,.27);
   float verticalJoin=band(s/4.1,.046,.076);
   float groundDust=(1.-smoothstep(.22,2.4,uv2d.y))*(.72+.28*sin(.251*s));
   float lean=(sin(s*.371+wp.y*.281)*sin(s*.789-wp.y*.421))*.46+
              sin(s*.096+wp.y*.158)*.54;
   float streaks=sin(s*1.813+sin(s*.437)*1.5)*(.52+.48*sin(wp.y*.464+s*.046));
   float capShadow=smoothstep(.90,.992,uv2d.y/max(.01,14.73-wp.y+uv2d.y));
   vec3 oxide=vec3(.009,.006,.003)*groundDust;
   vec3 sheet=vec3(.369,.381,.357)*(1.+.045*lean+.025*streaks*lapLimit
      -.099*rib*bandLimit+.046*lip*bandLimit-.059*verticalJoin*lapLimit
      -.115*groundDust-.062*capShadow)+oxide;
   c=max(vec3(0.),sheet);
  }else `+cases);
 return {vertex:v,fragment:f};
}
