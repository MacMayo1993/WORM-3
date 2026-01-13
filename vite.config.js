import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Bind to all network interfaces (required for Codespaces)
    port: 5173,
    strictPort: false,
    open: false, // Don't auto-open in Codespaces
  },
})
