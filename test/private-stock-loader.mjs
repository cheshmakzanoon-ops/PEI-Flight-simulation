import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){
 const out=next(url,context);
 return url.endsWith('/render/vegetation.ts')&&out.source?{...out,source:"import.meta.env={BASE_URL:'/'};\n"+out.source}:out;
}});
