export type RegularNorthRimSampleProfile='rgba4'|'rgba0'|'unsupported';
/** The two measured default-canvas profiles only. Keep the antialias flag
 * and actual default framebuffer sample count in agreement. */
export function regularNorthRimSampleProfile(
 attrs:Pick<WebGLContextAttributes,'alpha'|'depth'|'antialias'>|null,
 readSamples:()=>unknown,
):RegularNorthRimSampleProfile{
 if(attrs?.alpha!==true||attrs.depth!==true||typeof attrs.antialias!=='boolean')return 'unsupported';
 const n=readSamples();
 if(attrs.antialias&&n===4)return 'rgba4';
 if(!attrs.antialias&&n===0)return 'rgba0';
 return 'unsupported';
}
