import { defineConfig } from 'vite';
export default defineConfig({
 base:'./',
 build:{
  target:'es2022',
  chunkSizeWarningLimit:700,
  rollupOptions:{
   output:{
    // Avoid app-dependent generated export aliases in the vendor chunk.
    minifyInternalExports:false,
    // Keep the rendering library cacheable across ordinary world/app changes.
    manualChunks(id){if(id.replaceAll('\\','/').includes('/node_modules/three/'))return 'three';},
   },
  },
 },
});
