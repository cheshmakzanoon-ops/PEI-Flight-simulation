import {defineConfig} from 'vite';

export default defineConfig({
  base:'./',
  build:{
    target:'es2022',
    rollupOptions:{
      output:{
        minifyInternalExports:false,
        manualChunks(id){
          if(id.replaceAll('\\','/').includes('/node_modules/three/'))return 'three';
        },
      },
    },
  },
});
