import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

/** There is intentionally no change to the original standalone build. */
const root=fileURLToPath(new URL('./',import.meta.url));
export default defineConfig({
 root,base:'./',publicDir:false,
 build:{target:'es2022',rollupOptions:{input:fileURLToPath(new URL('./combined-preview.html',import.meta.url))}},
});
