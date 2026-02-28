import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/WORM-3/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-three': ['three'],
          'vendor-r3f': ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          'vendor-react': ['react', 'react-dom'],
          'vendor-misc': ['gsap', 'zustand'],
        },
      },
    },
  },
})
