import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/WORM-3/',
  build: {
    chunkSizeWarningLimit: 680,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/3d/')) return 'app-3d';
          if (id.includes('/src/components/')) return 'app-components';
          if (id.includes('/src/worm/')) return 'app-worm';
          if (id.includes('/src/manifold/')) return 'app-manifold';

          if (!id.includes('node_modules')) return;
          if (id.includes('/node_modules/react/')) return 'vendor-react';
          if (id.includes('/node_modules/react-dom/')) return 'vendor-react-dom';
          if (id.includes('/node_modules/@react-three/fiber/')) return 'vendor-r3f-fiber';
          if (id.includes('/node_modules/@react-three/drei/')) return 'vendor-r3f-drei';
          if (id.includes('/node_modules/@react-three/postprocessing/')) return 'vendor-r3f-post';
          if (id.includes('/node_modules/postprocessing/')) return 'vendor-postprocessing';
          if (id.includes('/node_modules/three/examples/')) {
            const examplesPath = id.split('/node_modules/three/examples/')[1] || '';
            const bucket = examplesPath.split('/')[0] || 'misc';
            return `vendor-three-examples-${bucket.toLowerCase()}`;
          }
          if (id.includes('/node_modules/three/src/')) {
            const srcPath = id.split('/node_modules/three/src/')[1] || '';
            const bucket = srcPath.split('/')[0] || 'core';
            return `vendor-three-${bucket.toLowerCase()}`;
          }
          if (id.includes('/node_modules/three/')) return 'vendor-three';
          if (id.includes('/node_modules/gsap/')) return 'vendor-gsap';
          if (id.includes('/node_modules/zustand/')) return 'vendor-zustand';
        },
      },
    },
  },
})
